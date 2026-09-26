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

import com.anttransfer.common.file.AvatarStoragePort;
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
 * 头像落盘的契约测试。
 *
 * <p>重点守两件事，都是「出错代价不对称」的地方：</p>
 * <ol>
 *     <li><b>key 即安全边界</b>：读 / 删两个动作的入参在生产上最终来自
 *     「库里的 {@code avatar_url}」，而库里那一列是应用自己写的；但一旦有人图省事
 *     把请求参数直接透传进来（这类改动看起来很自然），路径穿越就成立了。
 *     本测试用真实的目录外文件证明它拿不到 —— 而不是靠「调用方会校验」的约定。</li>
 *     <li><b>不做内容寻址</b>：同一份字节上传两次必须得到两个不同的 key。
 *     若按内容寻址去重，「换一张图再换回来」会复用旧 key，{@code ?v=} 版本号不变，
 *     浏览器就一直拿缓存 —— 表现为「上传成功了但头像没变」。</li>
 * </ol>
 *
 * @author AntTransfer CE
 */
class LocalAvatarStorageTest {

    /** 一份「能被识别为 PNG」的最小内容：本模块只按魔数判定，不解码像素（见 ImageTypes）。 */
    private static final byte[] PNG_HEAD = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D};

    @TempDir
    Path tempDir;

    private FileProperties properties;
    private LocalAvatarStorage storage;

    @BeforeEach
    void setUp() throws IOException {
        properties = new FileProperties();
        properties.setStorageRoot(tempDir.toString());
        storage = new LocalAvatarStorage(properties);
        storage.init();
    }

    /* ==================== 正常路径 ==================== */

    @Test
    @DisplayName("存 → 读 往返：扩展名与响应类型都由字节决定，调用方不需要（也无法）指定")
    void storeThenLoad_roundTrips() {
        String key = storage.store(PNG_HEAD);

        assertThat(key).matches("^[0-9a-f]{32}\\.png$");
        Optional<AvatarStoragePort.StoredAvatar> loaded = storage.load(key);
        assertThat(loaded).isPresent();
        assertThat(loaded.get().content()).isEqualTo(PNG_HEAD);
        assertThat(loaded.get().contentType()).isEqualTo("image/png");
        // etag 用 key：同一 key 的内容永不变，可直接做强校验
        assertThat(loaded.get().etag()).isEqualTo(key);

        // 落盘位置在头像专属子目录下，不混进内容寻址区
        assertThat(tempDir.resolve(properties.getAvatarDirName()).resolve(key.substring(0, 2)).resolve(key))
                .exists();
    }

    @Test
    @DisplayName("同一份字节两次上传得到两个 key：不做内容寻址，否则「换回旧图」不会触发前端刷新")
    void sameContent_storeTwice_producesDistinctKeys() {
        String first = storage.store(PNG_HEAD);
        String second = storage.store(PNG_HEAD);

        assertThat(second).isNotEqualTo(first);
        assertThat(storage.load(first)).isPresent();
        assertThat(storage.load(second)).isPresent();
    }

    @Test
    @DisplayName("删除是幂等的：第一次 true，之后 false，且不抛异常")
    void delete_isIdempotent() {
        String key = storage.store(PNG_HEAD);

        assertThat(storage.delete(key)).isTrue();
        assertThat(storage.delete(key)).isFalse();
        assertThat(storage.load(key)).isEmpty();
    }

    @Test
    @DisplayName("存储根目录下的头像子目录在启动时即创建，避免首次上传才暴露权限问题")
    void init_createsAvatarDirectory() {
        assertThat(tempDir.resolve(properties.getAvatarDirName())).isDirectory();
    }

    @Test
    @DisplayName("子目录名走配置：改配置后落盘位置随之变化（不写死 _avatars）")
    void store_honoursConfiguredDirectoryName() throws IOException {
        properties.setAvatarDirName("_heads");
        LocalAvatarStorage custom = new LocalAvatarStorage(properties);
        custom.init();

        String key = custom.store(PNG_HEAD);
        assertThat(tempDir.resolve("_heads").resolve(key.substring(0, 2)).resolve(key)).exists();
    }

    /* ==================== 准入：非图片必须拒绝 ==================== */

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {
            "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>",
            "<html>x</html>",
            "plain text",
            "BM not a bitmap"})
    @DisplayName("非光栅图（尤其 SVG / HTML）必须抛错，且不得在磁盘上留下任何文件")
    void store_rejectsNonImage(String content) throws IOException {
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

        byte[] oversized = new byte[(int) AvatarStoragePort.MAX_AVATAR_BYTES + 1];
        System.arraycopy(PNG_HEAD, 0, oversized, 0, PNG_HEAD.length);
        assertThatThrownBy(() -> storage.store(oversized))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /* ==================== key 即安全边界 ==================== */

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {
            "../secret.png",
            "../../secret.png",
            "0123456789abcdef/../../secret.png",
            "/etc/passwd",
            "..\\secret.png",
            "0123456789ABCDEF0123456789ABCDEF.png",
            "0123456789abcdef0123456789abcdef.svg",
            "0123456789abcdef0123456789abcdef.exe",
            "0123456789abcdef0123456789abcdef",
            "short.png",
            "0123456789abcdef0123456789abcdef.png.exe"})
    @DisplayName("形态非法的 key 一律读不到、删不掉：路径穿越与任意扩展名在结构上不可达")
    void malformedKey_cannotEscapeAvatarDirectory(String evilKey) throws IOException {
        Path outside = tempDir.resolve("secret.png");
        Files.writeString(outside, "不该被读到");

        assertThat(storage.load(evilKey)).isEmpty();
        assertThat(storage.delete(evilKey)).isFalse();
        assertThat(outside).as("目录外的文件必须原封不动").exists();
        assertThat(Files.readString(outside)).isEqualTo("不该被读到");
    }

    @Test
    @DisplayName("空 key 不抛异常：库里 avatar_url 为 null 时调用方不必先判空")
    void blankKey_isTolerated() {
        assertThat(storage.load(null)).isEmpty();
        assertThat(storage.load("")).isEmpty();
        assertThat(storage.delete(null)).isFalse();
        assertThat(storage.delete("")).isFalse();
    }

    @Test
    @DisplayName("形态合法但文件不存在时返回空：库里残留 key 不该让页面报 500")
    void validButMissingKey_returnsEmpty() {
        assertThat(storage.load("0123456789abcdef0123456789abcdef.png")).isEmpty();
    }
}
