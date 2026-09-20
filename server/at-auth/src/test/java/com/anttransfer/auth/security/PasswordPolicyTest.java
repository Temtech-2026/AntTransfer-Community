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
package com.anttransfer.auth.security;

import com.anttransfer.common.exception.BusinessException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@link PasswordPolicy} 单测：长度边界 / 字符组合 / 空白 / 与原口令相同。
 */
class PasswordPolicyTest {

    private static final String OLD = "OldPass123";

    @Test
    @DisplayName("长度 8~64 位为合规边界，7 / 65 位必须拒绝（BCrypt 72 字节截断线以内）")
    void lengthBoundary() {
        assertDoesNotThrow(() -> PasswordPolicy.assertCompliant("Abcdefg1"));
        assertDoesNotThrow(() -> PasswordPolicy.assertCompliant("A1" + "b".repeat(62)));

        assertViolation("Abcdef1", "长度 7 位应拒绝");
        assertViolation("A1" + "b".repeat(63), "长度 65 位应拒绝");
    }

    @ParameterizedTest
    @ValueSource(strings = {"Abcdefgh", "12345678", "Abcdef 1", "Abcdef\t1", "abcdefg1 "})
    @DisplayName("缺字母 / 缺数字 / 含空白一律拒绝")
    void compositionAndWhitespace(String candidate) {
        assertViolation(candidate, "不合规口令应拒绝：" + candidate);
    }

    @Test
    @DisplayName("与原口令相同必须拒绝：否则「改密」等于没改，却白白吊销了全部会话")
    void sameAsOldRejected() {
        BusinessException e = assertThrows(BusinessException.class,
                () -> PasswordPolicy.assertCompliant(OLD, OLD));
        assertEquals(1030, e.getCode());
        assertTrue(e.getMessage().contains("原密码"));
    }

    @Test
    @DisplayName("合规且与原口令不同则放行")
    void compliantAccepted() {
        assertDoesNotThrow(() -> PasswordPolicy.assertCompliant("NewPass456", OLD));
    }

    @Test
    @DisplayName("null 口令拒绝而非 NPE")
    void nullRejected() {
        assertViolation(null, "null 应转为 1030 而非空指针");
    }

    /** 违规一律是 1030（策略 E），具体原因走 message。 */
    private void assertViolation(String candidate, String message) {
        BusinessException e = assertThrows(BusinessException.class,
                () -> PasswordPolicy.assertCompliant(candidate), message);
        assertEquals(1030, e.getCode(), message);
    }
}
