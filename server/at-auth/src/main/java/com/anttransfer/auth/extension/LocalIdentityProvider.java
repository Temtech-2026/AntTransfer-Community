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
package com.anttransfer.auth.extension;

import com.anttransfer.auth.model.LoginUser;
import com.anttransfer.auth.model.entity.SysUser;
import com.anttransfer.auth.repository.UserMapper;
import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.security.AuthenticatedUser;
import com.anttransfer.common.spi.identity.AuthenticationRequest;
import com.anttransfer.common.spi.identity.IdentityProvider;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * CE 默认身份提供方：<b>本地账号 + BCrypt 口令</b>。
 *
 * <p>只做「这个账号能否被证明是本人」这一件事：查账号 → 校验口令 → 检查账号状态。
 * 失败计数、锁定、会话与令牌签发、审计全部留在 {@code AuthService}（登录编排）——</p>
 *
 * <ul>
 *     <li>失败计数属于<b>平台防爆破策略</b>：它按「登录名」计数，而不是按身份源计数。
 *         若放进提供方，EE 部署里 SSO 失败就会走另一套计数（甚至不计数），
 *         出现「本地账号能被锁、SSO 账号锁不住」的口径裂缝；</li>
 *     <li>账号状态（停用 / 锁定）属于<b>本地账号事实</b>，故留在本类；</li>
 *     <li>{@code ACCOUNT_LOCKED} 与 {@code BAD_CREDENTIALS} 的区分很关键：前者表示
 *         「身份已确认但被锁」，若被计入失败次数，会让「被锁账号」在编排层被重复计数。</li>
 * </ul>
 *
 * <p>不标注 {@code @Component}：由 {@code IdentitySpiConfig} 以 {@code @ConditionalOnMissingBean}
 * 注册，EE 提供自己的 {@link IdentityProvider}（LDAP / OIDC）时自动让位。</p>
 *
 * @author AntTransfer CE
 */
public class LocalIdentityProvider implements IdentityProvider {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    public LocalIdentityProvider(UserMapper userMapper, PasswordEncoder passwordEncoder) {
        this.userMapper = userMapper;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public String providerId() {
        return "local";
    }

    @Override
    public boolean supports(AuthenticationRequest request) {
        // 本地账号没有「域名 / 企业标识」可判别：只要提交了口令，就由本提供方处理
        return request != null && request.username() != null && !request.username().isEmpty();
    }

    @Override
    public AuthenticatedUser authenticate(AuthenticationRequest request) {
        SysUser user = userMapper.selectByUsername(request.username());

        // 账号不存在与口令错误合并为同一错误码：不暴露「账号是否存在」（与改造前完全一致）
        if (user == null || !passwordEncoder.matches(request.rawPassword(), user.getPasswordHash())) {
            throw new AuthException(ErrorCode.BAD_CREDENTIALS);
        }
        if (user.getStatus() != null && user.getStatus() == SysUser.STATUS_DISABLED) {
            throw new AuthException(ErrorCode.ACCOUNT_DISABLED);
        }
        if (user.getStatus() != null && user.getStatus() == SysUser.STATUS_LOCKED) {
            throw new AuthException(ErrorCode.ACCOUNT_LOCKED);
        }

        LoginUser principal = new LoginUser();
        principal.setId(user.getId());
        principal.setUsername(user.getUsername());
        principal.setNickname(user.getNickname());
        return principal;
    }
}
