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
package com.anttransfer.file.util;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CharsetDecoder;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;

/**
 * 文本预览解码：把「一段可能是任意编码的字节」还原成可展示的字符串。
 *
 * <p><b>为什么必须收敛成一处：</b>文本预览有两条下发通道——文件域以 JSON 返回字符串
 * （{@code FilePreviewService}），取件侧以 {@code text/plain} 直出（{@code FileDownloadService}）。
 * 两条通道面向同一份字节，编码判定口径一旦分叉，同一个文件会出现「在我的文件里中文正常、
 * 别人发给我全是问号」这种极难定位的差异。故解码只此一份实现。</p>
 *
 * @author AntTransfer CE
 */
public final class TextPreviewDecoder {

    /** UTF-8 单字符最长 4 字节，故末尾最多 3 字节可能是被截断的不完整序列 */
    private static final int MAX_CHAR_BYTES = 4;

    private TextPreviewDecoder() {
    }

    /**
     * 解码文本字节：优先严格 UTF-8 → 严格 GBK → ISO-8859-1 兜底。
     *
     * <p><b>为什么必须 try-strict 而不是直接用默认解码器：</b>默认解码器遇到非法字节会静默替换成
     * {@code U+FFFD}，于是「这个文件根本不是 UTF-8」这一关键事实被抹掉，中文 GBK 文件会整篇变成问号。
     * 开 {@code REPORT} 才能把「解不了」变成可判断的信号，进而回退到 GBK（中文环境的实际主力编码）。</p>
     *
     * <p><b>末尾回退重试：</b>截断可能把一个多字节字符切成两半，严格解码会因此报错并误判编码。
     * 故每次失败后退掉最多 3 个字节再试——把「内容被截断」与「编码不对」这两件事区分开。</p>
     *
     * @param bytes  字节数组（可能长于 {@code length}，仅前 {@code length} 个字节有效）
     * @param length 有效字节数
     * @return 解码后的字符串；{@code length <= 0} 时返回空串
     */
    public static String decode(byte[] bytes, int length) {
        if (length <= 0) {
            return "";
        }
        Charset bomCharset = charsetFromBom(bytes, length);
        if (bomCharset != null) {
            return new String(bytes, 2, length - 2, bomCharset);
        }
        int offset = hasUtf8Bom(bytes, length) ? 3 : 0;
        int size = length - offset;
        if (size <= 0) {
            return "";
        }
        String utf8 = tryDecodeStrict(StandardCharsets.UTF_8, bytes, offset, size);
        if (utf8 != null) {
            return utf8;
        }
        Charset gbk = gbkOrNull();
        if (gbk != null) {
            String decoded = tryDecodeStrict(gbk, bytes, offset, size);
            if (decoded != null) {
                return decoded;
            }
        }
        // 最终兜底：ISO-8859-1 对任意字节序列都可解码，永不抛异常，
        // 保证「编码完全无法识别」时用户看到乱码而不是一个 500
        return new String(bytes, offset, size, StandardCharsets.ISO_8859_1);
    }

    /** 严格解码；失败则逐字节回退重试（应对末尾被截断的多字节字符），全失败返回 {@code null}。 */
    private static String tryDecodeStrict(Charset charset, byte[] bytes, int offset, int length) {
        CharsetDecoder decoder = charset.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT);
        int maxTrim = Math.min(MAX_CHAR_BYTES - 1, length);
        for (int trim = 0; trim <= maxTrim; trim++) {
            try {
                return decoder.reset().decode(ByteBuffer.wrap(bytes, offset, length - trim)).toString();
            } catch (CharacterCodingException ignored) {
                // 换更短的尾部再试
            }
        }
        return null;
    }

    /** UTF-16 / UTF-8 BOM 对应的字符集；无 BOM 返回 {@code null}。 */
    private static Charset charsetFromBom(byte[] bytes, int length) {
        if (length >= 2) {
            int b0 = bytes[0] & 0xFF;
            int b1 = bytes[1] & 0xFF;
            if (b0 == 0xFF && b1 == 0xFE) {
                return StandardCharsets.UTF_16LE;
            }
            if (b0 == 0xFE && b1 == 0xFF) {
                return StandardCharsets.UTF_16BE;
            }
        }
        return null;
    }

    private static boolean hasUtf8Bom(byte[] bytes, int length) {
        return length >= 3
                && (bytes[0] & 0xFF) == 0xEF
                && (bytes[1] & 0xFF) == 0xBB
                && (bytes[2] & 0xFF) == 0xBF;
    }

    private static Charset gbkOrNull() {
        try {
            return Charset.isSupported("GBK") ? Charset.forName("GBK") : null;
        } catch (RuntimeException e) {
            return null;
        }
    }
}
