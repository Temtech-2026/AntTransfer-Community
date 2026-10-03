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

import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * 通用文件魔数识别（只看文件头字节，不依赖 Tika / 不解析内容）。
 *
 * <p><b>与 {@link ImageTypes} 的关系：</b>图片分支直接复用 {@code ImageTypes.detect}，
 * 本类只补「图片之外的常见容器」与「可执行 / 标记文本」的嗅探，避免同一份 PNG 魔数写两遍。</p>
 *
 * <p><b>为什么识别「标记文本」（HTML / SVG / XML）：</b>这是「改名换后缀」攻击的核心形态——
 * {@code x.html} 改名 {@code x.png} 上传，若服务端按扩展名回写 {@code Content-Type: image/png}
 * 且允许内联，则形成同源存储型 XSS。扩展名与魔数<b>不一致</b>时必须拒绝，故本类要能识别出
 * 「内容是标记文本」这一事实。</p>
 *
 * <p><b>为什么用「族（family）」而不是精确类型：</b>校验只关心「声明的扩展名与该族是否自洽」
 * （如 docx / xlsx / pptx 都是 zip 族），精确到 zip 内部子类型需要解析中央目录，
 * 属于内容扫描器（{@code VirusScanner} / {@code ContentScanInterceptor}）的职责。</p>
 *
 * @author AntTransfer CE
 */
public final class FileMagic {

    /** 嗅探所需最小字节数（webp 需读到第 12 字节，视频 ftyp 在第 4~8 字节）。 */
    public static final int SNIFF_LENGTH = 32;

    private static final byte[] MAGIC_PDF = {'%', 'P', 'D', 'F', '-'};
    private static final byte[] MAGIC_ZIP = {'P', 'K', 0x03, 0x04};
    private static final byte[] MAGIC_ZIP_EMPTY = {'P', 'K', 0x05, 0x06};
    private static final byte[] MAGIC_OLE2 = {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0,
            (byte) 0xA1, (byte) 0xB1, 0x1A, (byte) 0xE1};
    private static final byte[] MAGIC_GZIP = {0x1F, (byte) 0x8B};
    private static final byte[] MAGIC_RAR = {'R', 'a', 'r', '!', 0x1A, 0x07};
    private static final byte[] MAGIC_7Z = {'7', 'z', (byte) 0xBC, (byte) 0xAF, 0x27, 0x1C};
    private static final byte[] MAGIC_ID3 = {'I', 'D', '3'};
    private static final byte[] MAGIC_MP3_FRAME = {(byte) 0xFF, (byte) 0xFB};
    private static final byte[] MAGIC_OGG = {'O', 'g', 'g', 'S'};
    private static final byte[] MAGIC_MATROSKA = {0x1A, 0x45, (byte) 0xDF, (byte) 0xA3};
    private static final byte[] MAGIC_FTYP = {'f', 't', 'y', 'p'};
    private static final byte[] MAGIC_PE = {'M', 'Z'};
    private static final byte[] MAGIC_ELF = {0x7F, 'E', 'L', 'F'};

    private static final Magic PDF = new Magic("pdf", "pdf", "application/pdf");
    private static final Magic ZIP = new Magic("archive", "zip", "application/zip");
    private static final Magic OLE2 = new Magic("ole", "doc", "application/x-ole-storage");
    private static final Magic GZIP = new Magic("archive", "gz", "application/gzip");
    private static final Magic RAR = new Magic("archive", "rar", "application/vnd.rar");
    private static final Magic SEVEN_Z = new Magic("archive", "7z", "application/x-7z-compressed");
    private static final Magic MP3 = new Magic("audio", "mp3", "audio/mpeg");
    private static final Magic OGG = new Magic("audio", "ogg", "audio/ogg");
    private static final Magic WAV = new Magic("audio", "wav", "audio/wav");
    private static final Magic MATROSKA = new Magic("video", "webm", "video/webm");
    private static final Magic MP4 = new Magic("video", "mp4", "video/mp4");
    private static final Magic EXECUTABLE = new Magic("executable", "exe", "application/octet-stream");

    private FileMagic() {
    }

    /**
     * 识别结果。
     *
     * @param family      族：image / pdf / archive / ole / audio / video / executable / markup
     * @param extension   规范扩展名（服务端据此落盘与回写 Content-Type，不采信客户端值）
     * @param contentType 对应 MIME
     */
    public record Magic(String family, String extension, String contentType) {
    }

    /**
     * 按魔数识别类型。
     *
     * @param head 文件头字节（建议前 {@link #SNIFF_LENGTH} 字节）
     * @return 识别结果；无法识别返回 {@code null}（调用方按「无魔数可校验」处理）
     */
    public static Magic detect(byte[] head) {
        if (head == null || head.length < 2) {
            return null;
        }
        ImageTypes.ImageType image = ImageTypes.detect(head);
        if (image != null) {
            return new Magic("image", image.extension(), image.contentType());
        }
        if (startsWith(head, MAGIC_PDF)) {
            return PDF;
        }
        if (startsWith(head, MAGIC_ZIP) || startsWith(head, MAGIC_ZIP_EMPTY)) {
            return ZIP;
        }
        if (startsWith(head, MAGIC_OLE2)) {
            return OLE2;
        }
        if (startsWith(head, MAGIC_GZIP)) {
            return GZIP;
        }
        if (startsWith(head, MAGIC_RAR)) {
            return RAR;
        }
        if (startsWith(head, MAGIC_7Z)) {
            return SEVEN_Z;
        }
        if (startsWith(head, MAGIC_PE) || startsWith(head, MAGIC_ELF)) {
            return EXECUTABLE;
        }
        if (startsWith(head, MAGIC_OGG)) {
            return OGG;
        }
        if (startsWith(head, MAGIC_MATROSKA)) {
            return MATROSKA;
        }
        if (startsWith(head, MAGIC_ID3) || startsWith(head, MAGIC_MP3_FRAME)) {
            return MP3;
        }
        if (head.length >= 12 && startsWith(head, new byte[] {'R', 'I', 'F', 'F'})
                && matchesAt(head, new byte[] {'W', 'A', 'V', 'E'}, 8)) {
            return WAV;
        }
        if (head.length >= 12 && matchesAt(head, MAGIC_FTYP, 4)) {
            return MP4;
        }
        return null;
    }

    /**
     * 内容是否像标记语言（HTML / XHTML / SVG / XML / 脚本 / JSP / PHP）。
     *
     * <p>先跳过 UTF-8 BOM 与前导空白，再小写比对——攻击者常在 {@code <script>} 前塞换行 / 空格绕过。</p>
     *
     * @param head 文件头字节
     * @return 像标记文本返回 true
     */
    public static boolean looksLikeMarkup(byte[] head) {
        if (head == null || head.length == 0) {
            return false;
        }
        int offset = skipBomAndSpace(head);
        if (offset >= head.length) {
            return false;
        }
        int length = Math.min(head.length - offset, 64);
        String prefix = new String(head, offset, length, StandardCharsets.ISO_8859_1)
                .toLowerCase(Locale.ROOT);
        return prefix.startsWith("<!doctype html")
                || prefix.startsWith("<html")
                || prefix.startsWith("<head")
                || prefix.startsWith("<body")
                || prefix.startsWith("<svg")
                || prefix.startsWith("<?xml")
                || prefix.startsWith("<script")
                || prefix.startsWith("<%")
                || prefix.startsWith("<?php");
    }

    /** 是否含 NUL 字节（二进制信号；文本类扩展名据此拒绝）。 */
    public static boolean looksBinary(byte[] head) {
        if (head == null) {
            return false;
        }
        for (byte b : head) {
            if (b == 0) {
                return true;
            }
        }
        return false;
    }

    private static int skipBomAndSpace(byte[] head) {
        int offset = 0;
        if (head.length >= 3 && (head[0] & 0xFF) == 0xEF
                && (head[1] & 0xFF) == 0xBB && (head[2] & 0xFF) == 0xBF) {
            offset = 3;
        }
        while (offset < head.length) {
            byte b = head[offset];
            if (b == ' ' || b == '\t' || b == '\n' || b == '\r' || b == 0x0C) {
                offset++;
            } else {
                break;
            }
        }
        return offset;
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
