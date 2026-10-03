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

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@link OutputSanitizer} 回归测试：文件名清洗 / HTML 转义 / 富文本全剥 / CSV 公式注入。
 *
 * @author AntTransfer CE
 */
class OutputSanitizerTest {

    @Test
    @DisplayName("文件名：剥离路径段与非法字符，空名兜底，截断超长")
    void fileName() {
        assertEquals("a.txt", OutputSanitizer.fileName("../../etc/a.txt"));
        assertEquals("a.txt", OutputSanitizer.fileName("C:\\windows\\a.txt"));
        assertEquals("a_b_c.txt", OutputSanitizer.fileName("a:b*c.txt"));
        assertEquals("未命名文件", OutputSanitizer.fileName("   "));
        assertEquals("未命名文件", OutputSanitizer.fileName(".."));
        assertEquals("未命名文件", OutputSanitizer.fileName(null));
        assertEquals(OutputSanitizer.MAX_FILE_NAME_LENGTH,
                OutputSanitizer.fileName("x".repeat(400) + ".txt").length());
    }

    @Test
    @DisplayName("文件名：双向覆写字符（U+202E）必须被清除，防扩展名伪装")
    void fileNameStripsBidiOverride() {
        String spoofed = "photo\u202Egnp.exe";
        String cleaned = OutputSanitizer.fileName(spoofed);
        assertFalse(cleaned.contains("\u202E"));
        assertEquals("photo_gnp.exe", cleaned);
    }

    @Test
    @DisplayName("HTML 转义：六个危险字符全覆盖，null 透传")
    void escapeHtml() {
        assertEquals("&lt;script&gt;alert(1)&lt;&#x2F;script&gt;",
                OutputSanitizer.escapeHtml("<script>alert(1)</script>"));
        assertEquals("&amp;&quot;&#39;&#x60;", OutputSanitizer.escapeHtml("&\"'`"));
        assertNull(OutputSanitizer.escapeHtml(null));
    }

    @Test
    @DisplayName("富文本：剥光标签，实体编码的脚本也要现形后被剥掉")
    void richTextStripsTags() {
        assertEquals("alert(1)", OutputSanitizer.richText("<script>alert(1)</script>"));
        assertEquals("alert(1)", OutputSanitizer.richText("&lt;script&gt;alert(1)&lt;/script&gt;"));
        assertEquals("clean", OutputSanitizer.richText("<img src=x onerror=alert(1)>clean"));
        assertFalse(OutputSanitizer.richText("<svg/onload=alert(1)>").contains("<"));
        String nested = OutputSanitizer.richText("<<script>script>nested");
        assertFalse(nested.contains("<"));
        assertFalse(nested.contains(">"));
    }

    @Test
    @DisplayName("富文本：清除零宽与控制字符（防绕过与展示欺骗）")
    void richTextStripsControlChars() {
        assertEquals("ab", OutputSanitizer.richText("a\u0000\u200Bb"));
    }

    @Test
    @DisplayName("CSV：公式注入触发字符被中和，负数与普通文本不受影响")
    void csvFormula() {
        assertEquals("'=cmd|'/c calc'!A1", OutputSanitizer.neutralizeCsvFormula("=cmd|'/c calc'!A1"));
        assertEquals("'+1", OutputSanitizer.neutralizeCsvFormula("+1"));
        assertEquals("'@SUM(A1)", OutputSanitizer.neutralizeCsvFormula("@SUM(A1)"));
        assertEquals("-5", OutputSanitizer.neutralizeCsvFormula("-5"));
        assertEquals("正常文本", OutputSanitizer.neutralizeCsvFormula("正常文本"));
    }

    @Test
    @DisplayName("CSV：公式中和后仍按 RFC 4180 处理引号与分隔符")
    void csvCell() {
        assertEquals("'=SUM(A1)", OutputSanitizer.csvCell("=SUM(A1)"));
        assertEquals("\"a,b\"", OutputSanitizer.csvCell("a,b"));
        assertEquals("\"say \"\"hi\"\"\"", OutputSanitizer.csvCell("say \"hi\""));
        assertEquals("", OutputSanitizer.csvCell(null));
    }

    @Test
    @DisplayName("CSV：真实攻击链——UA 里的公式在导出后不再是可执行公式")
    void csvCellBlocksUserAgentAttack() {
        String userAgent = "=cmd|'/c calc'!A1";
        assertTrue(OutputSanitizer.csvCell(userAgent).startsWith("'="));
    }
}
