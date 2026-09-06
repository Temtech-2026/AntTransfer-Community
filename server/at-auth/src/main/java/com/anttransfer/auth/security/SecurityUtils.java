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
import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.result.ErrorCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

/**
 * 安全上下文便捷读取（当前登录用户）。
 *
 * <p>线程安全：SecurityContext 由 Spring Security 过滤器在请求线程建立并在清理过滤器释放，
 * 业务层可放心读取；异步边界须显式透传，禁止隐式串号（system-design §2.4）。</p>
 *
 * @author AntTransfer CE
 */
public final class SecurityUtils {

    private SecurityUtils() {
    }

    /**
     * 当前登录用户；未认证 / 上下文被清除时抛 {@code AuthException(NOT_LOGIN)}。
     */
    public static LoginUser getLoginUser() {
        return getOptionalLoginUser()
                .orElseThrow(() -> new AuthException(ErrorCode.NOT_LOGIN));
    }

    /**
     * 当前登录用户（可能为空）。
     */
    public static Optional<LoginUser> getOptionalLoginUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof LoginUser loginUser) {
            return Optional.of(loginUser);
        }
        return Optional.empty();
    }
}
