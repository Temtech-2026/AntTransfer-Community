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
package com.anttransfer.auth.config;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * 认证与会话配置（前缀 {@code anttransfer.auth}，见 at-bootstrap/application.yml）。
 *
 * <p>安全约定：</p>
 * <ul>
 *     <li>{@code access-token-secret} 为 HS256 签名密钥，生产必须经环境变量
 *         {@code AUTH_ACCESS_TOKEN_SECRET} 注入且长度 ≥ 32 字节（256 bit），
 *         启动时强校验，不满足直接 fail-fast；</li>
 *     <li>access/refresh 有效期默认对齐 PRD US-07（30 min / 7 d）；</li>
 *     <li>登录失败阈值与锁定时长默认 5 次 / 15 min（PRD §6、红队 [D-03]）。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "anttransfer.auth")
public class AuthProperties {

    /** access token 签名密钥（HS256，≥ 32 字符；生产环境变量 AUTH_ACCESS_TOKEN_SECRET 注入） */
    private String accessTokenSecret = "";

    /** access token 有效期（默认 30 min，PRD US-07） */
    private Duration accessTokenTtl = Duration.ofMinutes(30);

    /** refresh token 有效期（默认 7 d，PRD US-07；Redis 白名单 TTL 同值） */
    private Duration refreshTokenTtl = Duration.ofDays(7);

    /** 登录失败锁定阈值（默认 5 次） */
    private int loginFailThreshold = 5;

    /** 登录失败锁定时长（默认 15 min） */
    private Duration loginLockDuration = Duration.ofMinutes(15);

    /**
     * 免登录白名单（追加到内置白名单之后；PathPattern 语法，不含 context-path 前缀）。
     * 内置固定白名单：{@code /v1/auth/token}（登录）、{@code /v1/auth/token/refresh}（刷新）。
     */
    private List<String> permitAll = new ArrayList<>();

    /**
     * 启动自检：密钥缺失 / 过短时拒绝启动，避免弱密钥上线。
     */
    @PostConstruct
    void validate() {
        if (!StringUtils.hasText(accessTokenSecret) || accessTokenSecret.length() < 32) {
            throw new IllegalStateException(
                    "anttransfer.auth.access-token-secret 未配置或长度不足 32 字节（HS256 最小密钥长度 256 bit）。"
                            + "生产请通过环境变量 AUTH_ACCESS_TOKEN_SECRET 注入足够强度的随机串。");
        }
    }
}
