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
package com.anttransfer.common.security;

import java.util.regex.Pattern;

/**
 * 输出清洗：文件名清洗 + HTML 转义 / 富文本全剥 + CSV 公式注入防护。
 *
 * <p><b>为什么富文本用「全剥」而不是标签白名单：</b>手写白名单解析器是历史上 XSS 漏洞
 * 的高发区（属性名、命名空间、注释、实体编码、畸形容错任何一个分支写错就绕过）。
 * CE 当前<b>没有任何富文本渲染入口</b>（前端为 React 默认转义，全仓无
 * {@code dangerouslySetInnerHTML} 业务用法），故本类只提供「剥光所有标签」的安全形态；
 * 将来若真引入富文本编辑器，<b>不要</b>把本方法扩展成白名单，应改为引入
 * OWASP Java HTML Sanitizer / Jsoup Safelist。</p>
 *
 * <p><b>输出后仍需按上下文编码：</b>{@link #richText(String)} 的产物是纯文本，
 * 若它最终要拼进 HTML，调用方必须再走 {@link #escapeHtml(String)}。反之，
 * 已 {@code escapeHtml} 的文本不要再交给 {@link #richText(String)}（会把 {@code &lt;} 还原）。</p>
 *
 * @author AntTransfer CE
 */
public final class OutputSanitizer {

    /** 文件名为空 / 全非法时的兜底名。 */
    public static final String DEFAULT_FILE_NAME = "未命名文件";

    /** 文件名长度上限（与 {@code sys_file_node} 列宽及常见文件系统一致）。 */
    public static final int MAX_FILE_NAME_LENGTH = 255;

    /**
     * 文件名非法字符：Windows 保留字符 + 路径分隔符 + 控制字符（{@code \p{Cntrl}）
     * + 格式字符（{@code \p{Cf}}，含 U+202E 双向覆写与零宽字符——用于伪装扩展名，如
     * {@code a\u202Egnp.exe} 显示成 {@code aexe.png}）。
     */
    private static final Pattern FILE_NAME_ILLEGAL =
            Pattern.compile("[\\\\/:*?\"<>|\\p{Cntrl}\\p{Cf}]");

    /** HTML 标签（含跨行与属性），用于全剥。 */
    private static final Pattern TAG = Pattern.compile("<[^>]*>", Pattern.DOTALL);

    /** CSV 公式注入触发字符（Excel / WPS 会把以它们开头的单元格当公式执行）。 */
    private static final String CSV_TRIGGERS = "=+-@\t\r";

    /** 纯数字（含负号 / 小数）——这类值以 {@code -} 开头是正常数据，不应加前缀。 */
    private static final Pattern PLAIN_NUMBER = Pattern.compile("-?\\d+(\\.\\d+)?");

    private OutputSanitizer() {
    }

    /**
     * 清洗上传文件名：只取最后一段路径 + 替换非法字符 + 兜底 + 截断。
     *
     * <p>三个历史实现（{@code FileController.sanitizeFileName} /
     * {@code LocalFileStorage.sanitize} / {@code TransferTaskService.normalizeFileName}）
     * 口径不一致（一处「替换」、一处「拒绝」），本方法为「替换」口径的统一实现；
     * 需要「拒绝」语义的调用方请用校验器（{@code FileUploadValidator}）而不是本方法。</p>
     *
     * @param originalName 客户端上报的原始名（可为 null）
     * @return 可安全展示与回显的文件名
     */
    public static String fileName(String originalName) {
        if (originalName == null) {
            return DEFAULT_FILE_NAME;
        }
        String cleaned = originalName.replace('\\', '/');
        int slash = cleaned.lastIndexOf('/');
        if (slash >= 0) {
            cleaned = cleaned.substring(slash + 1);
        }
        cleaned = FILE_NAME_ILLEGAL.matcher(cleaned).replaceAll("_").trim();
        if (cleaned.isEmpty() || ".".equals(cleaned) || "..".equals(cleaned)) {
            return DEFAULT_FILE_NAME;
        }
        return cleaned.length() > MAX_FILE_NAME_LENGTH
                ? cleaned.substring(cleaned.length() - MAX_FILE_NAME_LENGTH)
                : cleaned;
    }

    /**
     * HTML 文本上下文转义（含属性上下文需要的引号与斜杠）。
     *
     * @param text 原始文本（可为 null）
     * @return 转义后文本；null 透传
     */
    public static String escapeHtml(String text) {
        if (text == null || text.isEmpty()) {
            return text;
        }
        StringBuilder sb = new StringBuilder(text.length() + 16);
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            switch (c) {
                case '&' -> sb.append("&amp;");
                case '<' -> sb.append("&lt;");
                case '>' -> sb.append("&gt;");
                case '"' -> sb.append("&quot;");
                case '\'' -> sb.append("&#39;");
                case '/' -> sb.append("&#x2F;");
                case '`' -> sb.append("&#x60;");
                default -> sb.append(c);
            }
        }
        return sb.toString();
    }

    /**
     * 富文本清洗：<b>剥光所有标签</b>并去控制字符，返回纯文本。
     *
     * <p>处理顺序固定为「实体折叠一次 → 反复剥标签 → 去控制字符」：先折叠是为了让
     * {@code &lt;script&gt;} 这类实体编码的标签现形后被剥掉；反复剥是为了应对
     * {@code <<script>script>} 这类嵌套残缺写法。</p>
     *
     * @param html 原始内容（可为 null）
     * @return 纯文本（永不返回含 {@code <} 的标签结构）；null 透传
     */
    public static String richText(String html) {
        if (html == null || html.isEmpty()) {
            return html;
        }
        String text = foldEntitiesOnce(html);
        String previous;
        do {
            previous = text;
            text = TAG.matcher(text).replaceAll("");
        } while (!previous.equals(text));
        text = text.replace("<", "").replace(">", "");
        return stripControlChars(text);
    }

    /**
     * CSV 单元格编码：先做公式注入防护，再按 RFC 4180 加引号。
     *
     * <p><b>为什么必须做：</b>审计导出的 {@code detail} 里含 {@code User-Agent} 等
     * 完全由攻击者控制的字符串。攻击者发送 {@code User-Agent: =cmd|'/c calc'!A1}
     * 后诱导审计员打开导出的 CSV，Excel 会把它当公式执行（CSV / Formula Injection）。
     * 防护方式是在触发字符前加单引号，使 Excel 视其为文本。</p>
     *
     * @param value 原始单元格值（可为 null）
     * @return 可直接写入 CSV 的字段
     */
    public static String csvCell(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        String safe = neutralizeCsvFormula(value);
        boolean needQuote = safe.indexOf(',') >= 0
                || safe.indexOf('"') >= 0
                || safe.indexOf('\n') >= 0
                || safe.indexOf('\r') >= 0;
        String escaped = safe.replace("\"", "\"\"");
        return needQuote ? '"' + escaped + '"' : escaped;
    }

    /**
     * 公式注入中和：以触发字符开头且不是纯数字时，前置单引号。
     *
     * @param value 原始值
     * @return 中和后的值
     */
    public static String neutralizeCsvFormula(String value) {
        if (value == null || value.isEmpty()) {
            return value;
        }
        char first = value.charAt(0);
        if (CSV_TRIGGERS.indexOf(first) < 0) {
            return value;
        }
        if (first == '-' && PLAIN_NUMBER.matcher(value).matches()) {
            return value;
        }
        return "'" + value;
    }

    /** 实体折叠一次（只认标签相关实体，不做完整 HTML 解码——避免二次解码引入新绕过面）。 */
    private static String foldEntitiesOnce(String text) {
        String folded = text;
        if (folded.contains("&lt;")) {
            folded = folded.replace("&lt;", "<");
        }
        if (folded.contains("&#60;")) {
            folded = folded.replace("&#60;", "<");
        }
        if (folded.contains("&#x3c;")) {
            folded = folded.replace("&#x3c;", "<");
        }
        if (folded.contains("&#X3C;")) {
            folded = folded.replace("&#X3C;", "<");
        }
        if (folded.contains("&gt;")) {
            folded = folded.replace("&gt;", ">");
        }
        if (folded.contains("&#62;")) {
            folded = folded.replace("&#62;", ">");
        }
        if (folded.contains("&#x3e;")) {
            folded = folded.replace("&#x3e;", ">");
        }
        if (folded.contains("&#X3E;")) {
            folded = folded.replace("&#X3E;", ">");
        }
        return folded;
    }

    /** 去控制字符（保留 \n \r \t，其余 C0/C1 与格式字符清理）。 */
    private static String stripControlChars(String text) {
        StringBuilder sb = new StringBuilder(text.length());
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            boolean keep = c == '\n' || c == '\r' || c == '\t'
                    || (!Character.isISOControl(c) && Character.getType(c) != Character.FORMAT);
            if (keep) {
                sb.append(c);
            }
        }
        return sb.toString();
    }
}
