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
import com.anttransfer.common.result.ErrorCode;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;

/**
 * 双令牌的生成与解析（JWt access + 不透明 refresh）。
 *
 * <p>模型（对齐 system-design §2.1）：</p>
 * <ul>
 *     <li><b>access token</b>：HS256 JWT（jjwt 0.12），claims 含
 *         {@code sub=userId / username / ver=签发时 token_epoch / jti / iat / exp}；
 *         验签通过后再由 {@code JwtAuthenticationFilter} 比对 {@code ver} 与当前会话纪元；
 *         不携带角色等可变信息（角色变更即时生效，US-04）；</li>
 *     <li><b>refresh token</b>：随机不透明串（非 JWT），格式
 *         {@code base64url(userId).随机 32 字节}；Redis 白名单只存其 SHA-256 指纹，
 *         Redis 被拖库也不会泄露可用令牌。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
@Component
public class JwtTokenProvider {

    /** access JWT 中 token 类型 claim 值 */
    private static final String CLAIM_USERNAME = "username";
    private static final String CLAIM_VER = "ver";

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final AuthProperties properties;
    private final SecretKey signingKey;

    public JwtTokenProvider(AuthProperties properties) {
        this.properties = properties;
        this.signingKey = Keys.hmacShaKeyFor(
                properties.getAccessTokenSecret().getBytes(StandardCharsets.UTF_8));
    }

    /** 解析后的 access token 载荷 */
    public record AccessClaims(Long userId, String username, long epoch, String jti) {
    }

    /* ============================ Access token ============================ */

    /**
     * 签发 access token（HS256）。
     *
     * @param epoch 当前会话吊销纪元（写入 ver claim）
     */
    public String createAccessToken(Long userId, String username, long epoch) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .claim(CLAIM_USERNAME, username)
                .claim(CLAIM_VER, epoch)
                .id(UUID.randomUUID().toString().replace("-", ""))
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(properties.getAccessTokenTtl())))
                .signWith(signingKey)
                .compact();
    }

    /**
     * 验签 + 解析 access token。
     *
     * <p>异常映射：过期 → {@code AuthException(TOKEN_EXPIRED, 1002)}；
     * 伪造 / 签名错误 / 结构非法 → {@code AuthException(TOKEN_INVALID, 1003)}。</p>
     */
    public AccessClaims parseAccessToken(String token) {
        Claims claims;
        try {
            claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (ExpiredJwtException e) {
            throw new AuthException(ErrorCode.TOKEN_EXPIRED);
        } catch (JwtException | IllegalArgumentException e) {
            throw new AuthException(ErrorCode.TOKEN_INVALID);
        }
        Long userId;
        try {
            userId = Long.valueOf(claims.getSubject());
        } catch (NumberFormatException e) {
            throw new AuthException(ErrorCode.TOKEN_INVALID);
        }
        Object ver = claims.get(CLAIM_VER);
        long epoch = ver instanceof Number number ? number.longValue() : 0L;
        return new AccessClaims(userId,
                claims.get(CLAIM_USERNAME, String.class), epoch, claims.getId());
    }

    /* ============================ Refresh token ============================ */

    /**
     * 生成新 refresh token（格式：base64url(userId) + "." + base64url(随机 32 字节)）。
     */
    public String createRefreshToken(Long userId) {
        byte[] random = new byte[32];
        SECURE_RANDOM.nextBytes(random);
        String uid = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(String.valueOf(userId).getBytes(StandardCharsets.UTF_8));
        String rand = Base64.getUrlEncoder().withoutPadding().encodeToString(random);
        return uid + "." + rand;
    }

    /**
     * 从 refresh token 解析用户 ID；格式非法 → {@code AuthException(TOKEN_INVALID)}。
     */
    public Long parseRefreshUserId(String refreshToken) {
        try {
            int dot = refreshToken.indexOf('.');
            if (dot <= 0) {
                throw new IllegalArgumentException("bad format");
            }
            String uid = new String(
                    Base64.getUrlDecoder().decode(refreshToken.substring(0, dot)),
                    StandardCharsets.UTF_8);
            return Long.valueOf(uid);
        } catch (IllegalArgumentException e) {
            throw new AuthException(ErrorCode.TOKEN_INVALID);
        }
    }

    /**
     * 指纹：refresh token 的 SHA-256 十六进制摘要（Redis 白名单只存指纹）。
     */
    public String fingerprint(String refreshToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(refreshToken.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(Character.forDigit((b >> 4) & 0xF, 16))
                        .append(Character.forDigit(b & 0xF, 16));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 不可用", e);
        }
    }
}
