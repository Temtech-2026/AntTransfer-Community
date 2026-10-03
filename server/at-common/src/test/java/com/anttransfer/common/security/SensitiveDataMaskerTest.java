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

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@link SensitiveDataMasker} 回归测试。
 *
 * @author AntTransfer CE
 */
class SensitiveDataMaskerTest {

    @Test
    @DisplayName("全遮：非空一律 ***，保留「无值」与「被遮」的区别")
    void maskFully() {
        assertEquals("***", SensitiveDataMasker.maskFully("p@ssw0rd"));
        assertEquals("", SensitiveDataMasker.maskFully(""));
        assertNull(SensitiveDataMasker.maskFully(null));
    }

    @Test
    @DisplayName("令牌：前 4 后 4，短令牌整体全遮")
    void maskToken() {
        assertEquals("abcd****klmn", SensitiveDataMasker.maskToken("abcdefghijklmn"));
        assertEquals("***", SensitiveDataMasker.maskToken("short"));
        assertNull(SensitiveDataMasker.maskToken(null));
    }

    @Test
    @DisplayName("邮箱 / 手机号 / 身份证：部分保留")
    void partialMask() {
        assertEquals("a***@example.com", SensitiveDataMasker.maskEmail("alice@example.com"));
        assertEquals("***@example.com", SensitiveDataMasker.maskEmail("a@example.com"));
        assertEquals("***", SensitiveDataMasker.maskEmail("not-an-email"));
        assertEquals("138****8000", SensitiveDataMasker.maskPhone("13800138000"));
        assertEquals("***", SensitiveDataMasker.maskPhone("123"));
        assertEquals("110101********1234", SensitiveDataMasker.maskIdCard("110101199001011234"));
    }

    @Test
    @DisplayName("键名判定：口令 / 令牌 / 提取码命中，statusCode 不被误伤")
    void isFullySensitive() {
        assertTrue(SensitiveDataMasker.isFullySensitive("password"));
        assertTrue(SensitiveDataMasker.isFullySensitive("old_password"));
        assertTrue(SensitiveDataMasker.isFullySensitive("accessToken"));
        assertTrue(SensitiveDataMasker.isFullySensitive("refresh-token"));
        assertTrue(SensitiveDataMasker.isFullySensitive("shareCode"));
        assertTrue(SensitiveDataMasker.isFullySensitive("extractCode"));
        assertTrue(SensitiveDataMasker.isFullySensitive("code"));
        assertTrue(SensitiveDataMasker.isFullySensitive("Authorization"));
        assertFalse(SensitiveDataMasker.isFullySensitive("statusCode"));
        assertFalse(SensitiveDataMasker.isFullySensitive("remark"));
        assertFalse(SensitiveDataMasker.isFullySensitive(null));
    }

    @Test
    @DisplayName("按键名脱敏：敏感键全遮，邮箱键部分遮，普通键原样")
    void maskByName() {
        assertEquals("***", SensitiveDataMasker.maskByName("password", "p@ssw0rd"));
        assertEquals("a***@example.com", SensitiveDataMasker.maskByName("userEmail", "alice@example.com"));
        assertEquals("hello", SensitiveDataMasker.maskByName("remark", "hello"));
        assertEquals("", SensitiveDataMasker.maskByName("password", ""));
    }

    @Test
    @DisplayName("递归脱敏：敏感键的整棵子树替换，嵌套与列表一并覆盖")
    void maskMap() {
        Map<String, Object> source = new java.util.LinkedHashMap<>();
        source.put("password", "p@ssw0rd");
        source.put("shareCode", "8A7B");
        source.put("userEmail", "alice@example.com");
        source.put("tokens", List.of("t1", "t2"));
        source.put("nested", Map.of("token", "t", "name", "visible"));

        Map<String, Object> masked = SensitiveDataMasker.maskMap(source);

        assertEquals("***", masked.get("password"));
        assertEquals("***", masked.get("shareCode"));
        assertEquals("a***@example.com", masked.get("userEmail"));
        assertEquals("***", masked.get("tokens"));
        @SuppressWarnings("unchecked")
        Map<String, Object> nested = (Map<String, Object>) masked.get("nested");
        assertEquals("***", nested.get("token"));
        assertEquals("visible", nested.get("name"));
        assertEquals("p@ssw0rd", source.get("password"));
    }

    @Test
    @DisplayName("递归脱敏：null 入参返回空 map，不抛异常")
    void maskMapNullSafe() {
        assertTrue(SensitiveDataMasker.maskMap(null).isEmpty());
        assertNull(SensitiveDataMasker.maskValue(null, 1));
    }
}
