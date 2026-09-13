/*
 * Copyright (c) 2026 AntTransfer Community Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package com.anttransfer.file.storage;

import com.anttransfer.file.config.FileProperties;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

/**
 * 本地磁盘存储实现（CE 默认，也是唯一实现）。
 *
 * <p>落盘策略的关键点全在 {@link #storeContent}：<b>先写同目录临时文件、再原子改名</b>。
 * 若直接往目标路径边收边写，一旦上传中断就会在内容寻址路径上留下一个「半截文件」——
 * 而这个路径是由 sha256 算出来的，下次有人上传同样的内容时会被 {@code Files.exists}
 * 判定为「已存在」，于是所有人拿到的都是那份损坏数据。临时文件 + 原子改名把这种可能
 * 从根上排除：目标路径要么不存在，要么内容是完整的。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LocalFileStorage implements FileStorage {

    private final FileProperties properties;

    /** 归一化后的存储根（绝对路径），避免运行期反复 resolve 相对路径 */
    private Path root;

    /** 临时产物目录 */
    private Path tempRoot;

    @PostConstruct
    void init() throws IOException {
        this.root = Paths.get(properties.getStorageRoot()).toAbsolutePath().normalize();
        this.tempRoot = root.resolve(properties.getTempDirName());
        Files.createDirectories(tempRoot);
        log.info("文件存储根目录就绪：{}（临时区 {}）", root, tempRoot);
    }

    @Override
    public String storeContent(InputStream in, String sha256) throws IOException {
        Path target = contentPath(sha256);
        if (Files.exists(target)) {
            // 内容已落盘：字节已经在磁盘上了，本次入参流直接丢弃即可完成「上传」
            return toRelative(target);
        }
        Files.createDirectories(target.getParent());
        Path tmp = target.getParent().resolve(sha256 + "." + UUID.randomUUID() + ".part");
        try {
            try (OutputStream out = Files.newOutputStream(tmp)) {
                in.transferTo(out);
            }
            try {
                Files.move(tmp, target, StandardCopyOption.ATOMIC_MOVE);
            } catch (FileAlreadyExistsException e) {
                // 并发下另一线程刚写完同一份内容：内容一致，复用即可
                log.debug("内容寻址路径已被并发写入，复用现有副本：{}", sha256);
            } catch (AtomicMoveNotSupportedException e) {
                // 跨文件系统等场景不支持原子改名时退化；仍需先确认目标不存在再落位
                if (!Files.exists(target)) {
                    Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING);
                }
            }
        } finally {
            Files.deleteIfExists(tmp);
        }
        return toRelative(target);
    }

    @Override
    public boolean contentExists(String sha256) {
        return sha256 != null && Files.exists(contentPath(sha256));
    }

    @Override
    public long contentSize(String sha256) {
        Path p = contentPath(sha256);
        try {
            return Files.exists(p) ? Files.size(p) : -1L;
        } catch (IOException e) {
            log.warn("读取物理文件大小失败：{}", p, e);
            return -1L;
        }
    }

    @Override
    public Resource contentResource(String sha256) {
        return new FileSystemResource(contentPath(sha256));
    }

    @Override
    public Path createTemp(String fileName) throws IOException {
        Files.createDirectories(tempRoot);
        return tempRoot.resolve(sanitize(fileName));
    }

    @Override
    public Resource resource(String relativePath) {
        return new FileSystemResource(resolve(relativePath));
    }

    @Override
    public Path resolve(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            throw new IllegalArgumentException("相对路径不能为空");
        }
        return root.resolve(relativePath).normalize();
    }

    @Override
    public String toRelative(Path path) {
        Path normalized = path.toAbsolutePath().normalize();
        if (!normalized.startsWith(root)) {
            // 越界要立刻炸：静默返回一个奇怪的相对路径，会让产物写进库、下不到、也删不掉
            throw new IllegalArgumentException("路径不在存储根内：" + normalized);
        }
        return relativize(normalized);
    }

    @Override
    public boolean delete(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            return false;
        }
        try {
            // 用 resolve 而非直接拼串：normalize 会把 ../ 折叠掉，防止越出存储根删到系统文件
            return Files.deleteIfExists(resolve(relativePath));
        } catch (IOException e) {
            log.warn("删除物理文件失败：{}", relativePath, e);
            return false;
        }
    }

    @Override
    public boolean deleteContent(String sha256) {
        if (sha256 == null || sha256.isBlank()) {
            return false;
        }
        try {
            return Files.deleteIfExists(contentPath(sha256));
        } catch (IOException e) {
            log.warn("删除内容寻址文件失败：{}", sha256, e);
            return false;
        }
    }

    /** 内容寻址路径：{@code {root}/{h1h2}/{h3h4}/{sha256}} */
    private Path contentPath(String sha256) {
        String h = sha256.toLowerCase();
        return root.resolve(h.substring(0, 2)).resolve(h.substring(2, 4)).resolve(h);
    }

    private String relativize(Path target) {
        return root.relativize(target).toString().replace('\\', '/');
    }

    /**
     * 清洗文件名中的路径分隔与上跳段。
     *
     * <p>打包产物名来自用户输入（如「我的资料.zip」），若不清洗，{@code ../../etc/passwd}
     * 这类名字会让 {@code tempRoot.resolve(...)} 落到存储根之外。</p>
     */
    private String sanitize(String fileName) {
        String cleaned = fileName == null ? "unnamed" : fileName.replace('\\', '/');
        int slash = cleaned.lastIndexOf('/');
        if (slash >= 0) {
            cleaned = cleaned.substring(slash + 1);
        }
        cleaned = cleaned.replace("..", "_").trim();
        return cleaned.isEmpty() ? "unnamed" : cleaned;
    }
}
