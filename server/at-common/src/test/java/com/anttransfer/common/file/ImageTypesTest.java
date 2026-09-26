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
package com.anttransfer.common.file;

import com.anttransfer.common.file.ImageTypes.ImageType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 头像图片类型识别的契约测试。
 *
 * <p>这里守的是一条<b>安全边界</b>而非格式偏好：识别结果被同时用来决定落盘扩展名与
 * 直出时的响应 {@code Content-Type}。一旦放进来一个「看起来是图片、其实是可执行内容」
 * 的类型（典型是 SVG），上传者就能在本站源下让其他用户的浏览器执行脚本——
 * 存储型 XSS。因此本测试的重点不是「png 能被认出来」，而是
 * <b>「html / svg / 纯文本 / 弱魔数的 bmp 必须认不出来」</b>。</p>
 *
 * @author AntTransfer CE
 */
class ImageTypesTest {

    /* ==================== 正常类型：必须认出来 ==================== */

    @Test
    @DisplayName("PNG 按 8 字节签名识别，扩展名与响应类型一并给出")
    void png_isDetected() {
        ImageType type = ImageTypes.detect(concat(new int[]{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}));
        assertThat(type).isNotNull();
        assertThat(type.extension()).isEqualTo("png");
        assertThat(type.contentType()).isEqualTo("image/png");
    }

    @Test
    @DisplayName("JPEG 识别为规范扩展名 jpg / image/jpeg（jpeg 与 jpg 落同一扩展名，避免同名两种写法）")
    void jpeg_isDetected() {
        ImageType type = ImageTypes.detect(concat(new int[]{0xFF, 0xD8, 0xFF, 0xE0}));
        assertThat(type).isNotNull();
        assertThat(type.extension()).isEqualTo("jpg");
        assertThat(type.contentType()).isEqualTo("image/jpeg");
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"GIF87a", "GIF89a"})
    @DisplayName("GIF 的两个版本标识都要认（87a 是历史文件，漏认会让老图无法当头像）")
    void gif_isDetected(String signature) {
        ImageType type = ImageTypes.detect(signature.getBytes(StandardCharsets.US_ASCII));
        assertThat(type).isNotNull();
        assertThat(type.extension()).isEqualTo("gif");
        assertThat(type.contentType()).isEqualTo("image/gif");
    }

    @Test
    @DisplayName("WebP 必须同时满足 RIFF 容器头与第 8 字节起的 WEBP 载荷标识")
    void webp_isDetected() {
        ImageType type = ImageTypes.detect(concat(new int[]{'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'}));
        assertThat(type).isNotNull();
        assertThat(type.extension()).isEqualTo("webp");
        assertThat(type.contentType()).isEqualTo("image/webp");
    }

    @Test
    @DisplayName("只有 RIFF 头、载荷不是 WEBP 的（如 wav）不得被当成图片")
    void riffWithoutWebpPayload_isNotDetected() {
        assertThat(ImageTypes.detect(concat(new int[]{'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'A', 'V', 'E'})))
                .isNull();
    }

    /* ==================== 危险 / 不支持类型：必须认不出来 ==================== */

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {
            "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>",
            "<html><body>hi</body></html>",
            "<?xml version=\"1.0\"?><svg/>",
            "just plain text",
            "{\"a\":1}"})
    @DisplayName("SVG / HTML / XML / 文本一律不得被判为图片（否则会以图片类型直出成可执行内容）")
    void executableOrTextContent_isNotDetected(String content) {
        assertThat(ImageTypes.detect(content.getBytes(StandardCharsets.UTF_8)))
                .as("把内容当图片直出等于让上传者在本站源下执行脚本")
                .isNull();
    }

    @Test
    @DisplayName("BMP 不收：魔数只有 \"BM\" 两个字节，任何以 BM 开头的文本都会被误判为图片")
    void bmp_isDeliberatelyNotDetected() {
        assertThat(ImageTypes.detect("BM not really a bitmap, just text".getBytes(StandardCharsets.US_ASCII)))
                .as("两字节魔数不足以判定类型，故 BMP 整体不在支持面内")
                .isNull();
    }

    @Test
    @DisplayName("扩展名伪装无效：判定只看字节，不看任何客户端可伪造的字段")
    void extensionDisguise_hasNoEffectOnDetection() {
        // 同一个方法没有「文件名」入参，这条断言同时是「接口形状」的契约：
        // 一旦有人为方便把扩展名传进来，这里会编译失败，提示他先想清楚可信来源
        assertThat(ImageTypes.detect("<html>x</html>".getBytes(StandardCharsets.UTF_8))).isNull();
        assertThat(ImageTypes.detect(concat(new int[]{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}))).isNotNull();
    }

    /* ==================== 边界输入：不得抛异常 ==================== */

    @Test
    @DisplayName("null / 空 / 过短内容一律返回 null，不得抛异常（上传入口需要拿到「不支持」而不是 500）")
    void degenerateInput_returnsNull() {
        assertThat(ImageTypes.detect(null)).isNull();
        assertThat(ImageTypes.detect(new byte[0])).isNull();
        assertThat(ImageTypes.detect(new byte[]{(byte) 0x89})).isNull();
        assertThat(ImageTypes.detect(new byte[]{(byte) 0x89, 'P'})).isNull();
        // PNG 签名完整但整体不足 12 字节：仍应识别成功（不足只在 webp 分支才构成拒绝理由）
        assertThat(ImageTypes.detect(new byte[]{(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}))
                .isNotNull();
    }

    /* ==================== 反向查表（读侧用） ==================== */

    @Test
    @DisplayName("byExtension 与 detect 互为反向：落盘扩展名能反查回响应类型")
    void byExtension_isInverseOfDetect() {
        for (byte[] content : new byte[][]{
                concat(new int[]{0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}),
                concat(new int[]{0xFF, 0xD8, 0xFF}),
                "GIF89a".getBytes(StandardCharsets.US_ASCII),
                concat(new int[]{'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'})}) {
            ImageType detected = ImageTypes.detect(content);
            assertThat(detected).isNotNull();
            assertThat(ImageTypes.byExtension(detected.extension())).isEqualTo(detected);
        }
        // jpeg 的历史别名要认，否则手工放进目录的老文件读不出来
        assertThat(ImageTypes.byExtension("jpeg")).isEqualTo(ImageTypes.byExtension("jpg"));
    }

    @Test
    @DisplayName("byExtension 对空值 / 未知扩展名返回 null，调用方据此拒绝直出")
    void byExtension_rejectsUnknown() {
        assertThat(ImageTypes.byExtension(null)).isNull();
        assertThat(ImageTypes.byExtension("")).isNull();
        assertThat(ImageTypes.byExtension("svg")).isNull();
        assertThat(ImageTypes.byExtension("html")).isNull();
        assertThat(ImageTypes.byExtension("bmp")).isNull();
        assertThat(ImageTypes.byExtension("exe")).isNull();
    }

    /* ==================== 头像地址契约 ==================== */

    @Test
    @DisplayName("urlOf：没有 key 时返回 null（表示「没有头像」而不是「空串头像」）")
    void urlOf_isNullWithoutKey() {
        assertThat(AvatarStoragePort.urlOf(1L, null)).isNull();
        assertThat(AvatarStoragePort.urlOf(1L, "")).isNull();
        assertThat(AvatarStoragePort.urlOf(1L, "   ")).isNull();
        assertThat(AvatarStoragePort.urlOf(null, "abc.png")).isNull();
    }

    @Test
    @DisplayName("urlOf：把 key 编进版本参数——key 每次上传都变，故它同时是缓存失效依据")
    void urlOf_encodesKeyAsVersion() {
        String url = AvatarStoragePort.urlOf(1234567890L, "0123456789abcdef0123456789abcdef.png");
        assertThat(url).isEqualTo(
                "/api/v1/users/1234567890/avatar?v=0123456789abcdef0123456789abcdef.png");
        // 同 key 必须稳定（否则每次渲染都换 URL，缓存形同虚设）
        assertThat(AvatarStoragePort.urlOf(1234567890L, "0123456789abcdef0123456789abcdef.png"))
                .isEqualTo(url);
        // 换 key 必须换 URL（否则换了头像浏览器仍拿缓存）
        assertThat(AvatarStoragePort.urlOf(1234567890L, "ffffffffffffffffffffffffffffffff.png"))
                .isNotEqualTo(url);
    }

    /** 把 int 序列拼成字节数组（魔数用十六进制 / 字符混写，比 byte[] 字面量易读）。 */
    private static byte[] concat(int[] values) {
        byte[] bytes = new byte[values.length];
        for (int i = 0; i < values.length; i++) {
            bytes[i] = (byte) values[i];
        }
        return bytes;
    }
}
