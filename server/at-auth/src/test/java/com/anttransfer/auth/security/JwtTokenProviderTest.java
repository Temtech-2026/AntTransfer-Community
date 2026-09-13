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

import com.anttransfer.auth.config.AuthProperties;
import com.anttransfer.common.exception.AuthException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * {@link JwtTokenProvider} 单测：access 签发 / 验签 / 过期，refresh 随机性与指纹。
 */
class JwtTokenProviderTest {

    private JwtTokenProvider provider;

    @BeforeEach
    void setUp() {
        AuthProperties properties = new AuthProperties();
        properties.setAccessTokenSecret("unit-test-secret-0123456789-abcdefghijklmnop");
        properties.setAccessTokenTtl(Duration.ofMinutes(30));
        properties.setRefreshTokenTtl(Duration.ofDays(7));
        provider = new JwtTokenProvider(properties);
    }

    @Test
    void createAndParseAccessToken_shouldRoundTripClaims() {
        String token = provider.createAccessToken(1001L, "alice", 7L);

        JwtTokenProvider.AccessClaims claims = provider.parseAccessToken(token);

        assertEquals(1001L, claims.userId());
        assertEquals("alice", claims.username());
        assertEquals(7L, claims.epoch());
    }

    @Test
    void expiredAccessToken_shouldMapToTokenExpired() throws InterruptedException {
        AuthProperties shortTtl = new AuthProperties();
        shortTtl.setAccessTokenSecret("unit-test-secret-0123456789-abcdefghijklmnop");
        shortTtl.setAccessTokenTtl(Duration.ofMillis(10));
        JwtTokenProvider shortLived = new JwtTokenProvider(shortTtl);
        String token = shortLived.createAccessToken(1L, "u", 0L);
        Thread.sleep(50);

        AuthException e = assertThrows(AuthException.class, () -> provider.parseAccessToken(token));
        assertEquals(1002, e.getErrorCode().getCode());
    }

    @Test
    void tamperedAccessToken_shouldMapToTokenInvalid() {
        String token = provider.createAccessToken(1L, "u", 0L) + "x";

        AuthException e = assertThrows(AuthException.class, () -> provider.parseAccessToken(token));
        assertEquals(1006, e.getErrorCode().getCode());
    }

    @Test
    void refreshToken_shouldBeOpaqueRandomAndParsable() {
        String a = provider.createRefreshToken(42L);
        String b = provider.createRefreshToken(42L);

        // 随机不透明串：同用户两次生成不同
        assertNotEquals(a, b);
        assertEquals(42L, provider.parseRefreshUserId(a));
        // 指纹稳定且不等价于原文
        assertEquals(provider.fingerprint(a), provider.fingerprint(a));
        assertTrue(provider.fingerprint(a).length() == 64);
        assertNotEquals(a, provider.fingerprint(a));
    }

    @Test
    void malformedRefreshToken_shouldMapToTokenInvalid() {
        AuthException e = assertThrows(AuthException.class, () -> provider.parseRefreshUserId("not-a-token"));
        assertEquals(1006, e.getErrorCode().getCode());
    }
}
