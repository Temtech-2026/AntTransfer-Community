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
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * {@link ClientIpResolver} 回归测试：取值优先级 + 伪造头部拒绝。
 *
 * @author AntTransfer CE
 */
class ClientIpResolverTest {

    @Test
    @DisplayName("优先级：X-Forwarded-For 首跳 &gt; X-Real-IP &gt; remoteAddr")
    void priority() {
        assertEquals("1.1.1.1", ClientIpResolver.resolve("1.1.1.1, 2.2.2.2", "2.2.2.2", "3.3.3.3"));
        assertEquals("2.2.2.2", ClientIpResolver.resolve(null, "2.2.2.2", "3.3.3.3"));
        assertEquals("3.3.3.3", ClientIpResolver.resolve(null, null, "3.3.3.3"));
        assertEquals(ClientIpResolver.UNKNOWN, ClientIpResolver.resolve(null, null, null));
    }

    @Test
    @DisplayName("伪造头部被拒绝并降级回直连地址")
    void rejectsForgedHeaders() {
        assertEquals("3.3.3.3", ClientIpResolver.resolve("evil\"; DROP TABLE", null, "3.3.3.3"));
        assertEquals("3.3.3.3", ClientIpResolver.resolve("unknown", null, "3.3.3.3"));
        assertEquals("3.3.3.3", ClientIpResolver.resolve("attacker.example.com", null, "3.3.3.3"));
        assertEquals("3.3.3.3", ClientIpResolver.resolve("\u0000null", null, "3.3.3.3"));
        assertEquals(ClientIpResolver.UNKNOWN, ClientIpResolver.resolve("not-an-ip", null, null));
    }

    @Test
    @DisplayName("IPv4 去端口、IPv6 原样保留、超长字面量拒绝")
    void normalization() {
        assertEquals("3.3.3.3", ClientIpResolver.resolve("3.3.3.3:8080", null, null));
        assertEquals("2001:db8::1", ClientIpResolver.resolve("2001:db8::1", null, null));
        assertEquals("::1", ClientIpResolver.resolve("[::1]", null, null));
        assertNull(ClientIpResolver.normalize("a".repeat(ClientIpResolver.MAX_LITERAL_LENGTH + 1)));
        assertNull(ClientIpResolver.normalize("  "));
        assertNull(ClientIpResolver.normalize(null));
    }

    @Test
    @DisplayName("首跳为空 / 空白时回退")
    void firstHopFallback() {
        assertNull(ClientIpResolver.firstHop(null));
        assertNull(ClientIpResolver.firstHop("  "));
        assertNull(ClientIpResolver.firstHop(" , 2.2.2.2"));
    }
}
