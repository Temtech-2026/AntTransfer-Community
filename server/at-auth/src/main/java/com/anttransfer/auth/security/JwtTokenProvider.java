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
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.MacAlgorithm;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
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
 *     <li><b>access token</b>：HS256 JWT（jjwt 0.12，算法<b>固化</b>见 {@link #JWT_ALGORITHM}，
 *         签发与验签双侧校验，不随密钥长度漂移），claims 含
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

    /** HS256 密钥最小字节数（256 bit）；与 {@link AuthProperties} 启动自检阈值保持一致 */
    private static final int MIN_SECRET_BYTES = 32;

    /**
     * access JWT 签名算法（<b>固化，禁止隐式推断</b>）。
     *
     * <p><b>为什么是 HS256 而不是更长的摘要</b>：HMAC 的安全强度由<b>密钥长度</b>决定，
     * 而非摘要长度。本项目已强制密钥 ≥ {@value #MIN_SECRET_BYTES} 字节（256 bit），
     * 因此 HS256 / HS384 / HS512 在本项目中的实际强度同为 256 bit ——
     * 换成更长的摘要并不会提升安全性。而 HS256 是 RFC 7518 的
     * <i>Required</i> 算法（HS384/HS512 仅 <i>Optional</i>），
     * 互操作性最好，且性能更优。</p>
     *
     * <p><b>为什么要显式指定</b>：jjwt 的 {@code signWith(SecretKey)} 单参重载会按
     * <b>密钥字节长度</b>自动选择算法（≥64 字节→HS512、≥48→HS384、≥32→HS256），
     * 导致「换个长度的密钥，算法静默漂移」——既与文档口径不符，也无法通过安全评审。
     * 此处固化后，算法不再随密钥长度变化。</p>
     */
    private static final MacAlgorithm JWT_ALGORITHM = Jwts.SIG.HS256;

    /**
     * 与 {@link #JWT_ALGORITHM} 同口径的 JCA 算法名，用于构造签名密钥。
     *
     * <p>jjwt 0.12 的 {@code MacAlgorithm} 接口未暴露 JCA 名称（仅实现类持有），
     * 故由 JWA 标识符派生（{@code HS256 → HmacSHA256}），
     * 从根源上杜绝「换算法却漏改 JCA 名」导致密钥与算法错配。</p>
     */
    private static final String JWT_JCA_NAME =
            "HmacSHA" + JWT_ALGORITHM.getId().substring("HS".length());

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final AuthProperties properties;
    private final SecretKey signingKey;

    public JwtTokenProvider(AuthProperties properties) {
        this.properties = properties;
        this.signingKey = buildSigningKey(properties.getAccessTokenSecret());
    }

    /**
     * 构造与固化算法<b>严格匹配</b>的签名密钥。
     *
     * <p>刻意不用 {@code Keys.hmacShaKeyFor(...)}：它会按密钥长度返回
     * {@code HmacSHA256/384/512} 三种算法名，与固化算法错配。
     * 此处直接用固化算法的 JCA 名称构造密钥，使「密钥算法名」与「签名算法」
     * 不可能再漂移。</p>
     *
     * <p>密钥强度校验与 {@link AuthProperties#validate()} 双重兜底：
     * 后者拦截配置注入路径，本方法拦截直接 new Provider 的路径。</p>
     *
     * @param accessTokenSecret 明文密钥
     * @return HS256 签名密钥
     * @throws IllegalStateException 密钥不足 {@value #MIN_SECRET_BYTES} 字节
     */
    private static SecretKey buildSigningKey(String accessTokenSecret) {
        byte[] secret = accessTokenSecret.getBytes(StandardCharsets.UTF_8);
        if (secret.length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "anttransfer.auth.access-token-secret 不足 " + MIN_SECRET_BYTES
                            + " 字节（" + (MIN_SECRET_BYTES * 8) + " bit），拒绝以弱密钥启动");
        }
        return new SecretKeySpec(secret, JWT_JCA_NAME);
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
                .signWith(signingKey, JWT_ALGORITHM)
                .compact();
    }

    /**
     * 验签 + 解析 access token。
     *
     * <p>异常映射：过期 → {@code AuthException(TOKEN_EXPIRED, 1002)}；
     * 伪造 / 签名错误 / 结构非法 → {@code AuthException(TOKEN_INVALID, 1006)}。</p>
     */
    public AccessClaims parseAccessToken(String token) {
        Jws<Claims> jws;
        try {
            jws = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token);
        } catch (ExpiredJwtException e) {
            throw new AuthException(ErrorCode.TOKEN_EXPIRED);
        } catch (JwtException | IllegalArgumentException e) {
            throw new AuthException(ErrorCode.TOKEN_INVALID);
        }
        // 算法固化校验（验签侧）：拒绝任何非 HS256 的算法头，
        // 与签发侧 JWT_ALGORITHM 形成闭环，杜绝算法混淆类攻击残留面
        if (!JWT_ALGORITHM.getId().equals(jws.getHeader().getAlgorithm())) {
            throw new AuthException(ErrorCode.TOKEN_INVALID);
        }
        Claims claims = jws.getPayload();
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
