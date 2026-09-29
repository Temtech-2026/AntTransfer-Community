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
import com.anttransfer.common.file.AudioTypes;
import com.anttransfer.common.file.NotificationSoundStoragePort;
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
 * {@link NotificationSoundStoragePort} 的本地磁盘实现（CE 默认，也是唯一实现）。
 *
 * <p>落盘布局与 {@link LocalAvatarStorage} 同一套写法：
 * {@code {root}/{notifySoundDirName}/{key[0:2]}/{key}}，key 形如
 * {@code <32 位十六进制>.<mp3|wav|ogg>}。之所以不抽成「通用媒体存储」再传参复用，
 * 是因为三处关键取舍在本域与头像域<b>并不相同</b>（容量上限、清理时机、直出鉴权），
 * 抽象只会把两套策略绑在一起；真正需要共享的（key 校验规则、原子改名写法）已经足够短，
 * 复制过来的成本低于维护一个会不断长出 {@code if (isAvatar)} 分支的基类。</p>
 *
 * <p><b>时长不在这里校验：</b>本实现只保证「容器可识别 + 字节在其上限内」。
 * 「不超过 10 秒」需要把整个字节数组读进来解析容器头，而解析结果是<b>要落库的业务事实</b>
 * （{@code custom_sound_duration_ms}），故由调用方（at-auth 的设置服务）在调用
 * {@link #store} 之前用 {@link AudioTypes#durationMillis} 判定并以 4030 拒绝。
 * 放到这一层会变成「存储实现替业务下结论」，且错误码要从 at-file 泄漏出去。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LocalNotificationSoundStorage implements NotificationSoundStoragePort {

    /** 合法 key：32 位小写十六进制 + 白名单扩展名（同头像：这是安全边界而非格式检查）。 */
    private static final Pattern KEY_PATTERN = Pattern.compile("^[0-9a-f]{32}\\.(mp3|wav|ogg)$");

    /** 临时文件后缀（落在目标同目录，保证原子改名不跨文件系统）。 */
    private static final String PART_SUFFIX = ".part";

    /** key 随机源：key 是「谁能拿到这段音频」的凭据，必须密码学随机（可预测序列等于可枚举）。 */
    private static final SecureRandom KEY_RANDOM = new SecureRandom();

    private final FileProperties properties;

    /** 归一化后的提示音目录（绝对路径），避免运行期反复 resolve 相对路径。 */
    private Path soundRoot;

    @PostConstruct
    void init() throws IOException {
        Path root = Paths.get(properties.getStorageRoot()).toAbsolutePath().normalize();
        this.soundRoot = root.resolve(properties.getNotifySoundDirName());
        Files.createDirectories(soundRoot);
        log.info("提示音存储目录就绪：{}", soundRoot);
    }

    @Override
    public String store(byte[] content) {
        if (content == null || content.length == 0) {
            throw new IllegalArgumentException("提示音内容为空");
        }
        if (content.length > MAX_SOUND_BYTES) {
            throw new IllegalArgumentException("提示音超过 " + MAX_SOUND_BYTES + " 字节上限");
        }
        // 扩展名与响应类型一律由魔数决定，客户端给的文件名 / MIME 不参与（见 AudioTypes）
        AudioTypes.AudioType type = AudioTypes.detect(content);
        if (type == null) {
            throw new IllegalArgumentException("不是支持的音频格式（仅 mp3 / wav / ogg）");
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
            log.error("提示音落盘失败：key={}", key, e);
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAIL);
        }
        return key;
    }

    @Override
    public Optional<StoredSound> load(String key) {
        if (!isValidKey(key)) {
            return Optional.empty();
        }
        Path path = pathOf(key);
        if (!Files.exists(path)) {
            return Optional.empty();
        }
        try {
            long size = Files.size(path);
            if (size <= 0 || size > MAX_SOUND_BYTES) {
                // 手工塞进来的超限 / 空文件：不直出（避免读放大），也不当作「不存在」之外的异常
                log.warn("提示音文件大小异常，拒绝直出：key={}, size={}", key, size);
                return Optional.empty();
            }
            AudioTypes.AudioType type = AudioTypes.byExtension(extensionOf(key));
            if (type == null) {
                return Optional.empty();
            }
            return Optional.of(new StoredSound(Files.readAllBytes(path), type.contentType(), key));
        } catch (IOException e) {
            // 读失败 ≠ 没有提示音：静默回空会让磁盘故障表现成「提示音凭空没了」，无从排查
            log.error("读取提示音文件失败：key={}", key, e);
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
            log.warn("删除提示音文件失败：key={}", key, e);
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

    /** 落盘路径：{@code {soundRoot}/{key[0:2]}/{key}}（已通过模式校验，不含路径分隔符）。 */
    private Path pathOf(String key) {
        return soundRoot.resolve(key.substring(0, 2)).resolve(key);
    }

    private boolean isValidKey(String key) {
        return key != null && KEY_PATTERN.matcher(key).matches();
    }

    private String extensionOf(String key) {
        return key.substring(key.indexOf('.') + 1);
    }

    /** 原子把临时文件改名到目标路径（写法与 {@link LocalAvatarStorage#moveInto} 保持一致）。 */
    private void moveInto(Path tmp, Path target) throws IOException {
        try {
            Files.move(tmp, target, StandardCopyOption.ATOMIC_MOVE);
        } catch (FileAlreadyExistsException e) {
            log.debug("提示音目标路径已存在（随机 key 冲突，可忽略）：{}", target.getFileName());
        } catch (AtomicMoveNotSupportedException e) {
            if (!Files.exists(target)) {
                Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING);
            }
        }
    }
}
