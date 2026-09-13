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

import com.anttransfer.auth.model.LoginUser;
import com.anttransfer.auth.service.TokenSessionService;
import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.security.AccessTokenVerifier;
import com.anttransfer.common.security.AuthenticatedUser;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * {@link AccessTokenVerifier} 的 at-auth 实现——把 {@link JwtAuthenticationFilter} 内部的
 * 「验签 → 会话纪元比对」判定逻辑抽成可复用入口，供 HTTP 之外的通道（当前为 WebSocket 握手）使用。
 *
 * <p><b>强度对齐：</b>与 HTTP 过滤器<b>完全同源</b>——同一 {@link JwtTokenProvider} 验签（含
 * HS256 算法固化校验）、同一 {@link TokenSessionService} 会话纪元比对（Redis 缓存 + 回源 DB）。
 * 因此「HTTP 被吊销」与「WebSocket 被吊销」不会出现两套判定，杜绝长连接成为吊销盲区——
 * 这正是把校验逻辑抽成 SPI 而非让消费方自行 {@code paste} 一份的原因。</p>
 *
 * <p><b>刻意不做的事</b>：不加载权限点（与过滤器一致，权限由 {@code @RequiresPerm} 惰性解析）。
 * 握手只解决「你是谁」，不解决「你能干什么」——长连接的<b>下行</b>推送不需要权限点，
 * <b>上行</b>发消息仍走 HTTP 接口鉴权，因此握手阶段放宽不产生越权面。</p>
 *
 * @author AntTransfer CE
 */
@Component
public class JwtAccessTokenVerifier implements AccessTokenVerifier {

    private final JwtTokenProvider tokenProvider;
    private final TokenSessionService sessionService;

    public JwtAccessTokenVerifier(JwtTokenProvider tokenProvider,
                                  TokenSessionService sessionService) {
        this.tokenProvider = tokenProvider;
        this.sessionService = sessionService;
    }

    @Override
    public AuthenticatedUser verify(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new AuthException(ErrorCode.NOT_LOGIN);
        }
        // 1. 验签 + 结构 + 过期：非法 → 1006，过期 → 1002（异常直接向上抛，由握手侧拒绝升级）
        JwtTokenProvider.AccessClaims claims = tokenProvider.parseAccessToken(rawToken.trim());

        // 2. 会话纪元比对：不匹配即「已全端吊销」——长连接必须与 HTTP 同口径拒绝，
        //    否则被吊销的令牌仍可通过 WebSocket 收推送（信息泄露面）
        Optional<Long> currentEpoch = sessionService.currentEpoch(claims.userId());
        if (currentEpoch.isEmpty() || currentEpoch.get() != claims.epoch()) {
            throw new AuthException(ErrorCode.NOT_LOGIN);
        }

        // 3. 身份摘要（不含权限，与过滤器构建的 principal 同构）
        LoginUser loginUser = new LoginUser();
        loginUser.setId(claims.userId());
        loginUser.setUsername(claims.username());
        return loginUser;
    }
}
