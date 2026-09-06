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
package com.anttransfer.permission.security;

import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.security.AuthenticatedUser;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

/**
 * at-permission 域内读取当前已认证主体（经由 at-common {@link AuthenticatedUser} 契约，
 * 不依赖 at-auth 的具体类——满足模块依赖铁律）。
 *
 * @author AntTransfer CE
 */
public final class AuthzContext {

    private AuthzContext() {
    }

    /**
     * 当前登录主体；未认证（理论不可达——接口已默认要求登录）抛 {@code 1001}。
     */
    public static AuthenticatedUser currentUser() {
        return getOptionalUser().orElseThrow(() -> new AuthException(ErrorCode.NOT_LOGIN));
    }

    /**
     * 当前登录用户（可能为空，供需要区分匿名/内部调用的场景）。
     */
    public static Optional<AuthenticatedUser> getOptionalUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user) {
            return Optional.of(user);
        }
        return Optional.empty();
    }
}
