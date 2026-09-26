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

/**
 * 光栅图类型识别（只看文件头魔数，不依赖第三方库、不解码像素）。
 *
 * <p><b>为什么按魔数而不是按扩展名 / 客户端 MIME：</b>两者都来自客户端，可任意伪造。
 * 若按扩展名落盘，攻击者把 {@code x.html} 改名成 {@code x.png} 上传，再诱导他人直接访问，
 * 就是一个同源下的存储型 XSS。本类只认字节内容，落盘扩展名与响应 {@code Content-Type}
 * 都由识别结果决定，客户端输入不参与路径与类型的构造。</p>
 *
 * <p><b>为什么支持面刻意只到 png / jpg / gif / webp：</b></p>
 * <ul>
 *     <li><b>SVG 不收</b>——它是 XML，可内嵌 {@code <script>} 与外部引用，当图片直出即 XSS；</li>
 *     <li><b>BMP 不收</b>——MIME 的魔数只有 {@code "BM"} 两个字节，误判率过高
 *         （任何以 BM 开头的文本都会被当成图片），且体积臃肿无实际使用场景。</li>
 * </ul>
 *
 * <p>收录范围与 {@code anttransfer.file.thumbnail-extensions} 的取向一致（同为「可安全
 * 当图片渲染的光栅图」），但本类不收 bmp —— 那条配置的 bmp 是给缩略图链路
 * （先读图片头拿尺寸做准入）用的，与本类的「魔数即可判定」场景要求不同。</p>
 *
 * @author AntTransfer CE
 */
public final class ImageTypes {

    /** 识别所需的最小字节数（webp 需要读到第 12 字节）。 */
    public static final int SNIFF_LENGTH = 12;

    /** PNG（8 字节签名，末尾 {@code \r\n\x1a\n} 是防传输层换行转换的固定校验） */
    private static final byte[] MAGIC_PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A};
    /** JPEG（SOI + 首个标记起始；不校验具体标记类型，交给浏览器容错） */
    private static final byte[] MAGIC_JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    /** GIF87a */
    private static final byte[] MAGIC_GIF87A = {'G', 'I', 'F', '8', '7', 'a'};
    /** GIF89a */
    private static final byte[] MAGIC_GIF89A = {'G', 'I', 'F', '8', '9', 'a'};
    /** RIFF 容器头（webp 是 RIFF 的一种载荷） */
    private static final byte[] MAGIC_RIFF = {'R', 'I', 'F', 'F'};
    /** RIFF 载荷类型标识：WEBP */
    private static final byte[] MAGIC_WEBP = {'W', 'E', 'B', 'P'};

    private static final ImageType PNG = new ImageType("png", "image/png");
    private static final ImageType JPEG = new ImageType("jpg", "image/jpeg");
    private static final ImageType GIF = new ImageType("gif", "image/gif");
    private static final ImageType WEBP = new ImageType("webp", "image/webp");

    private ImageTypes() {
    }

    /**
     * 支持的图片类型：落盘扩展名 + 响应 {@code Content-Type} 的唯一真相源。
     *
     * @param extension   规范扩展名（小写、无点；落盘文件名只用它）
     * @param contentType HTTP 响应类型（对外直出只用它）
     */
    public record ImageType(String extension, String contentType) {
    }

    /**
     * 按魔数识别图片类型。
     *
     * @param content 文件字节（至少前 {@link #SNIFF_LENGTH} 字节，多传无妨）
     * @return 识别结果；<b>不是支持的光栅图时返回 {@code null}</b>（调用方据此以 4007 拒绝）
     */
    public static ImageType detect(byte[] content) {
        if (content == null || content.length < 3) {
            return null;
        }
        if (startsWith(content, MAGIC_PNG)) {
            return PNG;
        }
        if (startsWith(content, MAGIC_JPEG)) {
            return JPEG;
        }
        if (startsWith(content, MAGIC_GIF87A) || startsWith(content, MAGIC_GIF89A)) {
            return GIF;
        }
        if (content.length >= SNIFF_LENGTH
                && startsWith(content, MAGIC_RIFF)
                && matchesAt(content, MAGIC_WEBP, 8)) {
            return WEBP;
        }
        return null;
    }

    /**
     * 按已知扩展名反查响应类型。
     *
     * <p>用于「读侧」：读盘时只有落盘扩展名，没有原始字节可嗅探
     * （为了不打开展示路径的读放大，不读魔数）。扩展名由 {@link #detect} 在落盘时写定，
     * 故这里是可信输入；不在白名单内的扩展名返回 {@code null}，调用方按「不可直出」处理。</p>
     */
    public static ImageType byExtension(String extension) {
        if (extension == null) {
            return null;
        }
        return switch (extension.toLowerCase()) {
            case "png" -> PNG;
            case "jpg", "jpeg" -> JPEG;
            case "gif" -> GIF;
            case "webp" -> WEBP;
            default -> null;
        };
    }

    private static boolean startsWith(byte[] content, byte[] magic) {
        return matchesAt(content, magic, 0);
    }

    private static boolean matchesAt(byte[] content, byte[] magic, int offset) {
        if (content.length < offset + magic.length) {
            return false;
        }
        for (int i = 0; i < magic.length; i++) {
            if (content[offset + i] != magic[i]) {
                return false;
            }
        }
        return true;
    }
}
