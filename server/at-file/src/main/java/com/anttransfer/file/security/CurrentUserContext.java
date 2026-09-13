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
package com.anttransfer.file.security;

import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.security.AuthenticatedUser;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

/**
 * at-file 域内读取当前已认证主体（经 at-common {@link AuthenticatedUser} 契约，
 * 不依赖 at-auth 的具体 principal 类型——满足模块依赖铁律）。
 *
 * <p>访客侧接口（免登录）<b>不得</b>调用 {@link #currentUser()}；需要「可能是匿名」的场景
 * 请用 {@link #getOptionalUser()}，并显式处理空值。</p>
 *
 * @author AntTransfer CE
 */
public final class CurrentUserContext {

    private CurrentUserContext() {
    }

    /**
     * 当前登录主体；未认证抛 {@code 1001}（用于已声明要求登录的接口）。
     */
    public static AuthenticatedUser currentUser() {
        return getOptionalUser().orElseThrow(() -> new AuthException(ErrorCode.NOT_LOGIN));
    }

    /**
     * 当前登录用户 ID；未认证抛 {@code 1001}。
     */
    public static Long currentUserId() {
        return currentUser().getId();
    }

    /**
     * 当前登录主体（可能为空）：供匿名 / 内部调用场景区分使用。
     */
    public static Optional<AuthenticatedUser> getOptionalUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user) {
            return Optional.of(user);
        }
        return Optional.empty();
    }
}
