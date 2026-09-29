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
package com.anttransfer.common.spi.identity;

import com.anttransfer.common.security.AuthenticatedUser;

/**
 * 身份提供方扩展点（CE/EE 边界接口）。
 *
 * <p><b>定位</b>：CE 只有「本地账号 + BCrypt 口令」一种身份源；企业版在此接入 LDAP / OIDC /
 * 企业微信 / 钉钉等，并在认证成功后完成本地用户的即时供给（JIT provision）。登录编排
 * （锁定计数、会话与令牌签发、审计）始终留在 {@code AuthService}，换身份源不得改动它。</p>
 *
 * <p><b>扩展方式</b>：EE 只需声明自己的 {@link IdentityProvider} Bean（用 {@code @Order} 控制优先级），
 * {@code IdentityProviderChain} 按顺序取<b>第一个</b> {@link #supports(AuthenticationRequest)} 为 {@code true}
 * 的实现执行——不做「全部尝试」式串联，避免一次失败登录触发多次远端认证与多次失败计数。</p>
 *
 * <p><b>实现约束</b>：</p>
 * <ul>
 *     <li>认证失败必须抛 {@code AuthException}（凭据错误、账号锁定、账号停用各自对应错误码），
 *         不得返回 {@code null}、不得自行吞掉失败；</li>
 *     <li>不得记录明文口令或令牌到日志；</li>
 *     <li>不得在此实现基座策略（失败计数、验证码、限流）——重复实现会与编排层叠加，锁号更早、更难排查。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
public interface IdentityProvider {

    /**
     * 提供方标识（{@code local} / {@code oidc} / {@code ldap} …），用于日志与错误定位。
     */
    String providerId();

    /**
     * 是否由本提供方处理该请求。
     *
     * <p>CE 默认实现仅在 {@code username} 非空时返回 {@code true}；SSO 实现通常按域名后缀或
     * 企业标识前缀判定。</p>
     */
    boolean supports(AuthenticationRequest request);

    /**
     * 执行认证。
     *
     * @return 认证通过的主体摘要（至少含本地用户 ID 与登录名）
     * @throws com.anttransfer.common.exception.AuthException 凭据错误 / 账号锁定 / 账号停用
     */
    AuthenticatedUser authenticate(AuthenticationRequest request);
}
