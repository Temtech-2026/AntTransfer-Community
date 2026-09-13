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

import com.anttransfer.common.exception.AuthException;

/**
 * 访问令牌校验端口（SPI）——「HTTP 请求之外」的登录态复用入口。
 *
 * <p>存在原因：WebSocket 握手升格（HTTP Upgrade）与普通 HTTP 请求走的是<b>不同</b>的
 * 处理通道——Servlet 过滤器链只在握手请求上跑一次，之后的长连接帧不再经过
 * {@code JwtAuthenticationFilter}；且浏览器 {@code WebSocket} 构造器<b>不允许</b>自定义
 * {@code Authorization} 头，令牌只能经握手参数（{@code ?token=}）或子协议携带。
 * 因此握手拦截器必须能自行校验令牌。</p>
 *
 * <p>而 JWT 的解析与签名校验（jjwt）属 at-auth 的实现细节，at-collaboration 按模块依赖
 * 铁律不能依赖 at-auth；故按依赖倒置把「校验令牌 → 拿身份摘要」抽成本接口置于共享内核，
 * at-auth 提供实现，at-collaboration 只依赖接口（与 {@code AuthenticatedUser}、
 * {@code RequiresPerm} 同一处理方式）。</p>
 *
 * <p><b>语义约定</b>（实现必须遵守，握手侧据此决定拒绝原因）：</p>
 * <ul>
 *     <li>令牌为空 / 格式非法 / 签名不符 / 已吊销 → 抛 {@code AuthException(TOKEN_INVALID)}；</li>
 *     <li>令牌过期 → 抛 {@code AuthException(TOKEN_EXPIRED)}；</li>
 *     <li>账号锁定 / 禁用 → 抛 {@code AuthException(ACCOUNT_LOCKED / ACCOUNT_DISABLED)}；</li>
 *     <li>校验通过 → 返回<b>只读身份摘要</b>，不返回权限点集合（握手阶段不判权，
 *         权限判定仍由各 HTTP 接口的 {@code @RequiresPerm} 完成）。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
public interface AccessTokenVerifier {

    /**
     * 校验访问令牌并返回身份摘要。
     *
     * @param rawToken 原始令牌（不含 {@code Bearer } 前缀；由调用方剥离）
     * @return 身份摘要（{@link AuthenticatedUser}），非 null
     * @throws AuthException 令牌非法 / 过期 / 账号锁定或禁用
     */
    AuthenticatedUser verify(String rawToken);
}
