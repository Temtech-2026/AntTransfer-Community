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

import com.anttransfer.common.file.FileMagic;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * 上传文件「扩展名白名单 + 魔数」双校验器。
 *
 * <p><b>为什么必须双校验：</b>只查扩展名，攻击者把 {@code x.html} 改名成 {@code x.png} 即可绕过
 * （现网 {@code SuffixAndKeywordScanInterceptor} 的注释已自认「改名换后缀即可绕过」）；
 * 只查魔数，则「合法魔数 + 危险扩展名」（如 {@code a.exe} 带 MZ 头）仍会被放行。
 * 两者必须同时成立，且以<b>魔数结论</b>为准回写 {@code Content-Type}——客户端上报的
 * {@code MultipartFile#getContentType()} 全程不采信。</p>
 *
 * <p><b>为什么把「危险扩展名」硬编码而不放配置：</b>这是安全底线而非业务策略。
 * 放进配置就等于「线上把 html 加进白名单即可开放存储型 XSS」，属可被配置误伤的防线。
 * 业务可放行的范围由 {@code allowedExtensions}（配置）决定，危险集永远先于白名单生效。</p>
 *
 * <p><b>调用时机：</b>必须在<b>清洗文件名之前</b>用客户端上报的<b>原始文件名</b>调用——
 * {@code OutputSanitizer.fileName} 会把 {@code a.exe.png} 的路径段与非法字符抹掉，
 * 先清洗就再也看不出双重扩展名攻击了。</p>
 *
 * @author AntTransfer CE
 */
public final class FileUploadValidator {

    /** 危险扩展名（硬拒绝，先于白名单判定）：脚本 / 标记 / 可执行 / 容器内代码。 */
    public static final Set<String> DANGEROUS_EXTENSIONS = Set.copyOf(List.of(
            "html", "htm", "xhtml", "shtml", "svg", "svgz", "xml", "xsl", "xslt", "dtd",
            "js", "mjs", "cjs", "jsp", "jspx", "jspf", "php", "php3", "php4", "php5", "phtml",
            "asp", "aspx", "ashx", "asmx", "cgi", "pl", "py", "rb", "sh", "bash", "zsh",
            "bat", "cmd", "ps1", "psm1", "vbs", "vbe", "wsf", "wsh", "hta", "jnlp",
            "jar", "war", "ear", "class", "apk", "dex", "swf",
            "exe", "dll", "so", "dylib", "sys", "msi", "msp", "scr", "com",
            "lnk", "reg", "url", "desktop", "torrent"));

    /** 声明的扩展名 → 允许的魔数扩展名集合（空集合表示不校验魔数）。 */
    private static final Map<String, Set<String>> REQUIRED_MAGIC = Map.ofEntries(
            Map.entry("png", Set.of("png")),
            Map.entry("jpg", Set.of("jpg")),
            Map.entry("jpeg", Set.of("jpg")),
            Map.entry("gif", Set.of("gif")),
            Map.entry("webp", Set.of("webp")),
            Map.entry("pdf", Set.of("pdf")),
            Map.entry("zip", Set.of("zip")),
            Map.entry("docx", Set.of("zip")),
            Map.entry("xlsx", Set.of("zip")),
            Map.entry("pptx", Set.of("zip")),
            Map.entry("doc", Set.of("doc", "zip")),
            Map.entry("xls", Set.of("doc", "zip")),
            Map.entry("ppt", Set.of("doc", "zip")),
            Map.entry("7z", Set.of("7z")),
            Map.entry("rar", Set.of("rar")),
            Map.entry("gz", Set.of("gz")),
            Map.entry("mp3", Set.of("mp3")),
            Map.entry("wav", Set.of("wav")),
            Map.entry("ogg", Set.of("ogg")),
            Map.entry("mp4", Set.of("mp4")),
            Map.entry("mov", Set.of("mp4")),
            Map.entry("webm", Set.of("webm")),
            Map.entry("mkv", Set.of("webm")));

    /** 纯文本类扩展名：只要求「不是二进制」。 */
    private static final Set<String> PLAIN_TEXT = Set.of(
            "txt", "md", "markdown", "csv", "log", "json", "yaml", "yml", "ini", "properties", "sql");

    /** 文件名长度上限（与列宽一致）。 */
    public static final int MAX_FILE_NAME_LENGTH = 255;

    private FileUploadValidator() {
    }

    /**
     * 校验结果。
     *
     * @param allowed    是否放行
     * @param extension  服务端认定的扩展名（放行时非空；取自魔数优先）
     * @param contentType 服务端认定的 MIME（放行时可能为空 = 由文件类型策略兜底）
     * @param reason     拒绝原因（放行时为 null；直接可回显给用户）
     */
    public record Decision(boolean allowed, String extension, String contentType, String reason) {

        public static Decision allow(String extension, String contentType) {
            return new Decision(true, extension, contentType, null);
        }

        public static Decision deny(String reason) {
            return new Decision(false, null, null, reason);
        }
    }

    /**
     * 双校验入口。
     *
     * @param originalName      客户端上报的<b>原始</b>文件名（勿先清洗）
     * @param head              文件头字节（建议前 {@link FileMagic#SNIFF_LENGTH} 字节）
     * @param allowedExtensions 允许的扩展名白名单（全小写、无点）；空 / null 视为未配置并全部拒绝
     * @return 校验结论
     */
    public static Decision validate(String originalName, byte[] head, Set<String> allowedExtensions) {
        if (allowedExtensions == null || allowedExtensions.isEmpty()) {
            return Decision.deny("服务端未配置上传扩展名白名单，已拒绝全部上传");
        }
        Decision nameCheck = checkName(originalName);
        if (nameCheck != null) {
            return nameCheck;
        }
        String extension = extensionOf(originalName);
        if (DANGEROUS_EXTENSIONS.contains(extension)) {
            return Decision.deny("禁止上传该类型文件：" + extension);
        }
        if (!allowedExtensions.contains(extension)) {
            return Decision.deny("不允许的文件类型：" + extension);
        }
        if (head == null || head.length == 0) {
            return Decision.deny("文件内容为空，无法完成内容校验");
        }
        FileMagic.Magic magic = FileMagic.detect(head);
        Set<String> required = REQUIRED_MAGIC.get(extension);
        if (required != null) {
            if (magic == null || !required.contains(magic.extension())) {
                return Decision.deny("文件内容与扩展名不符（疑似伪装文件），已拒绝");
            }
            return Decision.allow(magic.extension(), magic.contentType());
        }
        if (FileMagic.looksBinary(head) && (PLAIN_TEXT.contains(extension) || "executable".equals(familyOf(magic)))) {
            return Decision.deny("文件内容与扩展名不符（疑似伪装文件），已拒绝");
        }
        if (magic != null) {
            return Decision.allow(extension, magic.contentType());
        }
        return Decision.allow(extension, null);
    }

    /** 原始文件名结构性检查；通过返回 {@code null}。 */
    private static Decision checkName(String originalName) {
        if (originalName == null || originalName.isBlank()) {
            return Decision.deny("文件名缺失");
        }
        if (originalName.length() > MAX_FILE_NAME_LENGTH) {
            return Decision.deny("文件名过长（上限 " + MAX_FILE_NAME_LENGTH + " 字符）");
        }
        for (int i = 0; i < originalName.length(); i++) {
            char c = originalName.charAt(i);
            if (c == '/' || c == '\\') {
                return Decision.deny("文件名含路径分隔符，疑似路径穿越");
            }
            if (Character.isISOControl(c) || Character.getType(c) == Character.FORMAT) {
                return Decision.deny("文件名含控制字符，疑似伪造扩展名");
            }
        }
        if (originalName.endsWith(".") || originalName.endsWith(" ")) {
            return Decision.deny("文件名以点或空格结尾");
        }
        return null;
    }

    /** 取末段扩展名（小写无点）；无扩展名返回空串。 */
    private static String extensionOf(String name) {
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) {
            return "";
        }
        if (dot == 0) {
            return name.substring(1).toLowerCase(Locale.ROOT);
        }
        // 双重扩展名（a.exe.png）：任一中段为危险扩展名即判定为伪装，这里先取中段做硬拒绝
        String[] segments = name.toLowerCase(Locale.ROOT).split("\\.");
        for (int i = 0; i < segments.length - 1; i++) {
            if (DANGEROUS_EXTENSIONS.contains(segments[i])) {
                return segments[i];
            }
        }
        return name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private static String familyOf(FileMagic.Magic magic) {
        return magic == null ? null : magic.family();
    }
}
