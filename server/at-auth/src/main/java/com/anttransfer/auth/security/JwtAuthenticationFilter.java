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
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Optional;

/**
 * JWT 认证过滤器：Header 解析 → 校验签名 / 过期 / 会话纪元（Redis 白名单比对）→
 * 构建 Authentication 放入 SecurityContext。
 *
 * <p>处理路径：</p>
 * <ul>
 *     <li>无 Authorization 头 / 非 Bearer → 放行（匿名），由授权规则 / 入口点决定是否 401；</li>
 *     <li>验签失败（过期 / 伪造）→ 把错误码写入请求属性，放行由入口点回读输出
 *         （1002 过期触发前端静默刷新、1003 无效跳登录）；</li>
 *     <li>验签通过后比对 {@code ver} 与当前会话纪元（{@code at:token:access:{userId}}，
 *         miss 回源 DB）——已全端吊销的 access 在此拦截（1001）；</li>
 *     <li>全部通过 → 以 {@link LoginUser} 为主体构建 Authentication 放入 SecurityContext，
 *         供业务层 {@link SecurityUtils} 读取。角色不放入 JWT，变更即时生效。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    /** 认证失败错误码的请求属性名（入口点据此输出 Result.code） */
    public static final String ATTR_AUTH_ERROR_CODE = JwtAuthenticationFilter.class.getName() + ".errorCode";

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtTokenProvider tokenProvider;
    private final TokenSessionService sessionService;

    public JwtAuthenticationFilter(JwtTokenProvider tokenProvider,
                                   TokenSessionService sessionService) {
        this.tokenProvider = tokenProvider;
        this.sessionService = sessionService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");

        if (header != null && header.startsWith(BEARER_PREFIX)
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            authenticate(request, header.substring(BEARER_PREFIX.length()).trim());
        }
        filterChain.doFilter(request, response);
    }

    private void authenticate(HttpServletRequest request, String token) {
        // 1. 验签 + 结构 + 过期（失败会抛带 ErrorCode 的 AuthException）
        JwtTokenProvider.AccessClaims claims;
        try {
            claims = tokenProvider.parseAccessToken(token);
        } catch (AuthException e) {
            markFailure(request, e.getErrorCode());
            return;
        }

        // 2. 会话纪元比对：DB 权威（Redis 缓存加速 + 回源自愈），不匹配 = 已全端吊销
        Optional<Long> epoch = sessionService.currentEpoch(claims.userId());
        if (epoch.isEmpty()) {
            // 用户不存在 / 已删除：等同未登录
            markFailure(request, ErrorCode.NOT_LOGIN);
            return;
        }
        if (epoch.get() != claims.epoch()) {
            markFailure(request, ErrorCode.NOT_LOGIN);
            return;
        }

        // ===================== TODO[AT-DIFF-02] 待整体完工后裁决 =====================
        // 差异：外部计划要求本 Filter 在写入 SecurityContext 前就「加载用户权限集合
        // （多角色并集 + 显式 Deny 优先）」；当前实现【不在此加载权限】，原因是模块铁律
        // （at-auth 禁止依赖 at-permission，权限解析归 at-permission 域），权限改为
        // 惰性解析：@RequiresPerm 切面 → PermissionService → at:perm:{userId} Redis 缓存
        // （30min，miss 回源 DB，授权/角色变更 invalidate 即时生效，PRD US-04）。
        // 方案：
        //   A) 维持现状（推荐）：权限按需解析 + 缓存，角色变更即时生效，认证/授权域边界干净；
        //   B) 严格对齐外部计划「Filter 内加载权限」：在 at-common 定义
        //      PermissionAuthorityProvider SPI（返回 roles/permCodes），由 at-permission 实现、
        //      at-auth 注入；Filter 解析成功后拉取一次并作为 authorities/LoginUser 附加写入
        //      SecurityContext（需新增 SPI + 缓存失效联动，改动面中等，收益是鉴权信息集中）。
        // ======================================================================

        // 3. 构建认证主体（角色/权限动态获取，不写死进 JWT 令牌）
        LoginUser loginUser = new LoginUser();
        loginUser.setId(claims.userId());
        loginUser.setUsername(claims.username());

        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(loginUser, "", List.of());
        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    private void markFailure(HttpServletRequest request, ErrorCode errorCode) {
        request.setAttribute(ATTR_AUTH_ERROR_CODE, errorCode.getCode());
    }
}
