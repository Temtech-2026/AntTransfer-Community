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

import com.anttransfer.common.file.NotificationSoundStoragePort;
import com.anttransfer.file.config.FileProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 提示音落盘的契约测试。
 *
 * <p>与 {@link LocalAvatarStorageTest} 同风格：重点守「key 即安全边界」与「不做内容寻址」，
 * 外加一条本域特有的约束——<b>落盘目录必须与头像目录隔离</b>，
 * 否则「切回内置音色」的清理会误删头像，反之亦然。</p>
 *
 * @author AntTransfer CE
 */
class LocalNotificationSoundStorageTest {

    /** 一份能被识别为 MP3 的最小字节：帧同步字 + 填充（本模块只按魔数判定，不解码音频）。 */
    private static final byte[] MP3_HEAD =
            {(byte) 0xFF, (byte) 0xFB, (byte) 0x90, (byte) 0xC0, 0, 0, 0, 0};

    @TempDir
    Path tempDir;

    private FileProperties properties;
    private LocalNotificationSoundStorage storage;

    @BeforeEach
    void setUp() throws IOException {
        properties = new FileProperties();
        properties.setStorageRoot(tempDir.toString());
        storage = new LocalNotificationSoundStorage(properties);
        storage.init();
    }

    /* ==================== 正常路径 ==================== */

    @Test
    @DisplayName("存 → 读 往返：扩展名与响应类型由字节决定，调用方不需要（也无法）指定")
    void storeThenLoad_roundTrips() {
        String key = storage.store(MP3_HEAD);

        assertThat(key).matches("^[0-9a-f]{32}\\.mp3$");
        Optional<NotificationSoundStoragePort.StoredSound> loaded = storage.load(key);
        assertThat(loaded).isPresent();
        assertThat(loaded.get().content()).isEqualTo(MP3_HEAD);
        assertThat(loaded.get().contentType()).isEqualTo("audio/mpeg");
        assertThat(loaded.get().etag()).isEqualTo(key);

        // 落盘位置在提示音专属子目录下，不混进头像区与内容寻址区
        assertThat(tempDir.resolve(properties.getNotifySoundDirName())
                .resolve(key.substring(0, 2)).resolve(key)).exists();
    }

    @Test
    @DisplayName("同一份字节两次上传得到两个 key：不做内容寻址，否则「换回旧音」不会触发前端重新拉取")
    void sameContent_storeTwice_producesDistinctKeys() {
        String first = storage.store(MP3_HEAD);
        String second = storage.store(MP3_HEAD);

        assertThat(second).isNotEqualTo(first);
        assertThat(storage.load(first)).isPresent();
        assertThat(storage.load(second)).isPresent();
    }

    @Test
    @DisplayName("提示音目录与头像目录不同名：两类文件的清理互不误伤")
    void storageDirectory_isIsolatedFromAvatar() {
        assertThat(properties.getNotifySoundDirName()).isNotEqualTo(properties.getAvatarDirName());

        String key = storage.store(MP3_HEAD);
        Path underAvatar = tempDir.resolve(properties.getAvatarDirName())
                .resolve(key.substring(0, 2)).resolve(key);

        assertThat(underAvatar).doesNotExist();
    }

    @Test
    @DisplayName("删除是幂等的：第一次 true，之后 false，且不抛异常")
    void delete_isIdempotent() {
        String key = storage.store(MP3_HEAD);

        assertThat(storage.delete(key)).isTrue();
        assertThat(storage.delete(key)).isFalse();
        assertThat(storage.load(key)).isEmpty();
    }

    @Test
    @DisplayName("子目录名走配置：改配置后落盘位置随之变化（不写死 _notify_sounds）")
    void store_honoursConfiguredDirectoryName() throws IOException {
        properties.setNotifySoundDirName("_sounds");
        LocalNotificationSoundStorage custom = new LocalNotificationSoundStorage(properties);
        custom.init();

        String key = custom.store(MP3_HEAD);
        assertThat(tempDir.resolve("_sounds").resolve(key.substring(0, 2)).resolve(key)).exists();
    }

    /* ==================== 准入：非音频必须拒绝 ==================== */

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"<html>x</html>", "plain text", "fLaC____", "M4A is not supported"})
    @DisplayName("非支持容器必须抛错，且不得在磁盘上留下任何文件")
    void store_rejectsUnsupportedContent(String content) throws IOException {
        assertThatThrownBy(() -> storage.store(content.getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(IllegalArgumentException.class);

        try (var walk = Files.walk(tempDir)) {
            assertThat(walk.filter(Files::isRegularFile).count())
                    .as("准入失败不得留下半截文件（临时文件也要清掉）")
                    .isZero();
        }
    }

    @Test
    @DisplayName("空内容与超限内容在落盘前就被拒（超限按 size 拦，不读进内存再判）")
    void store_rejectsEmptyAndOversized() {
        assertThatThrownBy(() -> storage.store(new byte[0]))
                .isInstanceOf(IllegalArgumentException.class);

        byte[] oversized = new byte[(int) NotificationSoundStoragePort.MAX_SOUND_BYTES + 1];
        System.arraycopy(MP3_HEAD, 0, oversized, 0, MP3_HEAD.length);
        assertThatThrownBy(() -> storage.store(oversized))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /* ==================== key 即安全边界 ==================== */

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {
            "../secret.mp3",
            "../../secret.mp3",
            "0123456789abcdef/../../secret.mp3",
            "/etc/passwd",
            "..\\secret.mp3",
            "0123456789ABCDEF0123456789ABCDEF.mp3",
            "0123456789abcdef0123456789abcdef.svg",
            "0123456789abcdef0123456789abcdef.exe",
            "0123456789abcdef0123456789abcdef",
            "short.mp3",
            "0123456789abcdef0123456789abcdef.mp3.exe"})
    @DisplayName("形态非法的 key 一律读不到、删不掉：路径穿越与任意扩展名在结构上不可达")
    void malformedKey_cannotEscapeSoundDirectory(String evilKey) throws IOException {
        Path outside = tempDir.resolve("secret.mp3");
        Files.writeString(outside, "不该被读到");

        assertThat(storage.load(evilKey)).isEmpty();
        assertThat(storage.delete(evilKey)).isFalse();
        assertThat(outside).as("目录外的文件必须原封不动").exists();
        assertThat(Files.readString(outside)).isEqualTo("不该被读到");
    }

    @Test
    @DisplayName("空 key 不抛异常：库里 custom_sound_key 为 null 时调用方不必先判空")
    void blankKey_isTolerated() {
        assertThat(storage.load(null)).isEmpty();
        assertThat(storage.load("")).isEmpty();
        assertThat(storage.delete(null)).isFalse();
        assertThat(storage.delete("")).isFalse();
    }

    @Test
    @DisplayName("形态合法但文件不存在时返回空：库里残留 key 不该让页面报 500")
    void validButMissingKey_returnsEmpty() {
        assertThat(storage.load("0123456789abcdef0123456789abcdef.mp3")).isEmpty();
    }
}
