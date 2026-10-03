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

import java.nio.charset.StandardCharsets;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@link FileUploadValidator} 回归测试：扩展名白名单 + 魔数双校验。
 *
 * <p>覆盖三类绕过手法：改名换后缀（html→png）、双重扩展名（a.exe.png）、
 * 以及白名单内类型与真实内容不符（zip→pdf）。</p>
 *
 * @author AntTransfer CE
 */
class FileUploadValidatorTest {

    private static final Set<String> WHITELIST = Set.of(
            "png", "jpg", "jpeg", "gif", "webp", "pdf", "zip", "docx", "txt", "csv", "mp4", "dat");

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A,
            0, 0, 0, 0x0D, 'I', 'H', 'D', 'R'};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0x10,
            'J', 'F', 'I', 'F'};
    private static final byte[] PDF = "%PDF-1.7\n".getBytes(StandardCharsets.ISO_8859_1);
    private static final byte[] ZIP = {'P', 'K', 0x03, 0x04, 0x14, 0, 0, 0};
    private static final byte[] MZ = {'M', 'Z', (byte) 0x90, 0, 0x03, 0, 0, 0};
    private static final byte[] HTML = "<!DOCTYPE html><html><script>alert(1)</script>"
            .getBytes(StandardCharsets.ISO_8859_1);
    private static final byte[] MP4 = {0, 0, 0, 0x18, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm'};

    @Test
    @DisplayName("放行：扩展名在白名单且魔数一致，Content-Type 取服务端识别值")
    void allowWhenExtensionAndMagicAgree() {
        FileUploadValidator.Decision png = FileUploadValidator.validate("photo.png", PNG, WHITELIST);
        assertTrue(png.allowed());
        assertEquals("png", png.extension());
        assertEquals("image/png", png.contentType());

        assertTrue(FileUploadValidator.validate("a.pdf", PDF, WHITELIST).allowed());
        assertTrue(FileUploadValidator.validate("a.zip", ZIP, WHITELIST).allowed());
        assertTrue(FileUploadValidator.validate("a.docx", ZIP, WHITELIST).allowed());
        assertTrue(FileUploadValidator.validate("a.mp4", MP4, WHITELIST).allowed());
        assertTrue(FileUploadValidator.validate("a.jpg", JPEG, WHITELIST).allowed());
    }

    @Test
    @DisplayName("拒绝：危险扩展名先于白名单生效（即使被误加进白名单）")
    void denyDangerousExtensionEvenIfWhitelisted() {
        Set<String> misconfigured = Set.of("html", "svg", "png");
        FileUploadValidator.Decision decision =
                FileUploadValidator.validate("x.html", HTML, misconfigured);
        assertFalse(decision.allowed());
        assertNotNull(decision.reason());

        assertFalse(FileUploadValidator.validate("x.svg", HTML, misconfigured).allowed());
    }

    @Test
    @DisplayName("拒绝：双重扩展名伪装（a.exe.png）")
    void denyDoubleExtension() {
        FileUploadValidator.Decision decision = FileUploadValidator.validate("a.exe.png", PNG, WHITELIST);
        assertFalse(decision.allowed());
        assertTrue(decision.reason().contains("exe"));
    }

    @Test
    @DisplayName("拒绝：改名换后缀——内容是 HTML 却声明 png / zip / pdf")
    void denyDisguisedByRename() {
        assertFalse(FileUploadValidator.validate("x.png", HTML, WHITELIST).allowed());
        assertFalse(FileUploadValidator.validate("x.zip", HTML, WHITELIST).allowed());
        assertFalse(FileUploadValidator.validate("x.pdf", HTML, WHITELIST).allowed());
        assertFalse(FileUploadValidator.validate("x.docx", HTML, WHITELIST).allowed());
    }

    @Test
    @DisplayName("拒绝：白名单内类型之间错配（zip 冒充 pdf、png 冒充 jpg）")
    void denyCrossTypeMismatch() {
        assertFalse(FileUploadValidator.validate("x.pdf", ZIP, WHITELIST).allowed());
        assertFalse(FileUploadValidator.validate("x.jpg", PNG, WHITELIST).allowed());
        assertFalse(FileUploadValidator.validate("x.gif", JPEG, WHITELIST).allowed());
    }

    @Test
    @DisplayName("放行：纯文本类扩展名只要求不是二进制")
    void allowPlainText() {
        assertTrue(FileUploadValidator.validate("note.txt", "hello 世界".getBytes(StandardCharsets.UTF_8),
                WHITELIST).allowed());
        assertTrue(FileUploadValidator.validate("data.csv", "a,b\n1,2\n".getBytes(StandardCharsets.UTF_8),
                WHITELIST).allowed());
    }

    @Test
    @DisplayName("拒绝：文本扩展名实际是二进制（含 NUL）")
    void denyBinaryAsText() {
        byte[] binary = {'a', 0, 'b'};
        FileUploadValidator.Decision decision = FileUploadValidator.validate("note.txt", binary, WHITELIST);
        assertFalse(decision.allowed());
        assertTrue(decision.reason().contains("不符"));
    }

    @Test
    @DisplayName("拒绝：白名单外可执行内容伪装成无魔数扩展名（dat 带 MZ 头）")
    void denyExecutableBehindUnknownExtension() {
        assertFalse(FileUploadValidator.validate("a.dat", MZ, WHITELIST).allowed());
        assertTrue(FileUploadValidator.validate("a.dat", new byte[] {1, 2, 3, 4}, WHITELIST).allowed());
    }

    @Test
    @DisplayName("拒绝：文件名结构性攻击（路径穿越 / 控制字符 / 无扩展名 / 空内容）")
    void denyMalformedName() {
        assertFalse(FileUploadValidator.validate("../../etc/passwd", PNG, WHITELIST).allowed());
        assertFalse(FileUploadValidator.validate("..\\..\\win.ini", PNG, WHITELIST).allowed());
        assertFalse(FileUploadValidator.validate("a\u202Egnp.exe", PNG, WHITELIST).allowed());
        assertFalse(FileUploadValidator.validate("noext", PNG, WHITELIST).allowed());
        assertFalse(FileUploadValidator.validate("trailing.", PNG, WHITELIST).allowed());
        assertFalse(FileUploadValidator.validate("x.png", new byte[0], WHITELIST).allowed());
        assertFalse(FileUploadValidator.validate(null, PNG, WHITELIST).allowed());
        assertFalse(FileUploadValidator.validate("x".repeat(300) + ".png", PNG, WHITELIST).allowed());
    }

    @Test
    @DisplayName("拒绝：白名单未配置时全部拒绝（fail-closed）")
    void denyWhenWhitelistMissing() {
        assertFalse(FileUploadValidator.validate("a.png", PNG, null).allowed());
        assertFalse(FileUploadValidator.validate("a.png", PNG, Set.of()).allowed());
    }
}
