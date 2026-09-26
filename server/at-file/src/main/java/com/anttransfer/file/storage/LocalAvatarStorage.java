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

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.file.AvatarStoragePort;
import com.anttransfer.common.file.ImageTypes;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.file.config.FileProperties;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.FileAlreadyExistsException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * {@link AvatarStoragePort} 的本地磁盘实现（CE 默认，也是唯一实现）。
 *
 * <p><b>落盘布局：</b>{@code {root}/{avatarDirName}/{key[0:2]}/{key}}——
 * key 形如 {@code <32 位十六进制>.<扩展名>}，前两位散列成子目录避免单目录堆几万个文件
 * （与内容寻址区同一种分片思路，但<b>不按内容寻址</b>，理由见端口类注）。</p>
 *
 * <p><b>key 校验是安全边界而非格式检查：</b>{@link #KEY_PATTERN} 只允许
 * 十六进制 + 白名单扩展名，{@code /}、{@code \}、{@code .}（除扩展名分隔符）、
 * {@code ..} 全部无法通过。即使调用方把用户可控字符串当 key 传进来
 * （例如把请求参数直接透传），路径穿越与任意文件读取在结构上就不可达——
 * 不依赖「调用方一定会校验」这种假设。</p>
 *
 * <p><b>与 {@link LocalFileStorage} 的取舍差异：</b>那边目标路径由 sha256 算得，
 * 半截文件会被后续同内容上传误判为「已完成」，所以必须原子改名；这边路径由随机 key 决定，
 * 半截文件不会被任何人复用，但会被<b>直出成碎图</b>（库里的 key 指向的就是它），
 * 所以同样必须「先写临时文件再原子改名」。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LocalAvatarStorage implements AvatarStoragePort {

    /** 合法 key：32 位小写十六进制 + 白名单扩展名（见类注：这是安全边界）。 */
    private static final Pattern KEY_PATTERN = Pattern.compile("^[0-9a-f]{32}\\.(png|jpg|gif|webp)$");

    /** 临时文件后缀（落在目标同目录，保证原子改名不跨文件系统）。 */
    private static final String PART_SUFFIX = ".part";

    /**
     * key 随机源。
     *
     * <p>必须是密码学随机：key 是「谁知道谁就能拿到这张头像」的全部凭据（读取端点免登录），
     * {@code Random} / 时间戳这类可预测序列等于把头像变成可枚举资源。</p>
     */
    private static final SecureRandom KEY_RANDOM = new SecureRandom();

    private final FileProperties properties;

    /** 归一化后的头像目录（绝对路径），避免运行期反复 resolve 相对路径 */
    private Path avatarRoot;

    @PostConstruct
    void init() throws IOException {
        Path root = Paths.get(properties.getStorageRoot()).toAbsolutePath().normalize();
        this.avatarRoot = root.resolve(properties.getAvatarDirName());
        Files.createDirectories(avatarRoot);
        log.info("头像存储目录就绪：{}", avatarRoot);
    }

    @Override
    public String store(byte[] content) {
        if (content == null || content.length == 0) {
            throw new IllegalArgumentException("头像内容为空");
        }
        if (content.length > MAX_AVATAR_BYTES) {
            throw new IllegalArgumentException("头像超过 " + MAX_AVATAR_BYTES + " 字节上限");
        }
        // 扩展名与响应类型一律由魔数决定，客户端给的文件名 / MIME 不参与（见 ImageTypes）
        ImageTypes.ImageType type = ImageTypes.detect(content);
        if (type == null) {
            throw new IllegalArgumentException("不是支持的图片格式（仅 png / jpg / gif / webp）");
        }
        String key = newKey(type.extension());
        Path target = pathOf(key);
        try {
            Files.createDirectories(target.getParent());
            Path tmp = target.resolveSibling(target.getFileName() + "." + UUID.randomUUID() + PART_SUFFIX);
            try {
                try (OutputStream out = Files.newOutputStream(tmp)) {
                    out.write(content);
                }
                moveInto(tmp, target);
            } finally {
                Files.deleteIfExists(tmp);
            }
        } catch (IOException e) {
            log.error("头像落盘失败：key={}", key, e);
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAIL);
        }
        return key;
    }

    @Override
    public Optional<StoredAvatar> load(String key) {
        if (!isValidKey(key)) {
            return Optional.empty();
        }
        Path path = pathOf(key);
        if (!Files.exists(path)) {
            return Optional.empty();
        }
        try {
            long size = Files.size(path);
            if (size <= 0 || size > MAX_AVATAR_BYTES) {
                // 手工塞进来的超限 / 空文件：不直出（避免读放大），也不当「头像不存在」之外的事处理
                log.warn("头像文件大小异常，拒绝直出：key={}, size={}", key, size);
                return Optional.empty();
            }
            ImageTypes.ImageType type = ImageTypes.byExtension(extensionOf(key));
            if (type == null) {
                return Optional.empty();
            }
            return Optional.of(new StoredAvatar(Files.readAllBytes(path), type.contentType(), key));
        } catch (IOException e) {
            // 读失败 ≠ 没有头像：静默回空会让磁盘故障在前端表现成「头像凭空消失」，无从排查
            log.error("读取头像文件失败：key={}", key, e);
            throw new BusinessException(ErrorCode.FILE_DOWNLOAD_FAIL);
        }
    }

    @Override
    public boolean delete(String key) {
        if (!isValidKey(key)) {
            return false;
        }
        try {
            return Files.deleteIfExists(pathOf(key));
        } catch (IOException e) {
            // 删不掉只影响磁盘占用，不影响正确性（库里的引用已经换掉了），故不向上抛
            log.warn("删除头像文件失败：key={}", key, e);
            return false;
        }
    }

    /* ============================ 内部工具 ============================ */

    /** 新 key：随机 128 位 + 规范扩展名。刻意不做内容寻址去重（见端口类注的缓存口径）。 */
    private String newKey(String extension) {
        byte[] random = new byte[16];
        KEY_RANDOM.nextBytes(random);
        return HexFormat.of().formatHex(random) + "." + extension;
    }

    /** 落盘路径：{@code {avatarRoot}/{key[0:2]}/{key}}（已通过模式校验，不含路径分隔符）。 */
    private Path pathOf(String key) {
        return avatarRoot.resolve(key.substring(0, 2)).resolve(key);
    }

    private boolean isValidKey(String key) {
        return key != null && KEY_PATTERN.matcher(key).matches();
    }

    private String extensionOf(String key) {
        return key.substring(key.indexOf('.') + 1);
    }

    /**
     * 原子把临时文件改名到目标路径。
     *
     * <p>目标文件名由随机 key 决定，正常不会冲突；仍处理冲突与跨文件系统两种退化情形，
     * 与 {@link LocalFileStorage#storeContent} 保持同一套写法，避免两处各自演化。</p>
     */
    private void moveInto(Path tmp, Path target) throws IOException {
        try {
            Files.move(tmp, target, StandardCopyOption.ATOMIC_MOVE);
        } catch (FileAlreadyExistsException e) {
            log.debug("头像目标路径已存在（随机 key 冲突，可忽略）：{}", target.getFileName());
        } catch (AtomicMoveNotSupportedException e) {
            if (!Files.exists(target)) {
                Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING);
            }
        }
    }
}
