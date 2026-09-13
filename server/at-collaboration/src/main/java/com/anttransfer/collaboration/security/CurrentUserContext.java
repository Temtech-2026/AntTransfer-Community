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
package com.anttransfer.collaboration.security;

import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.security.AuthenticatedUser;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

/**
 * at-collaboration 域内读取当前已认证主体（经 at-common {@link AuthenticatedUser} 契约，
 * 不依赖 at-auth 的具体 principal 类型——满足模块依赖铁律）。
 *
 * <p>与 at-file 的 {@code CurrentUserContext} 同构：每个业务模块自持一份 20 行的小工具，
 * 好过为此在 at-common 造一个「谁都能用的全局登录态读取器」——后者会让「哪一层能读登录态」
 * 失去约束，也让 SPI 边界变糊。</p>
 *
 * <p>通知 / 会话 / 待办的<b>全部</b>接口都要求登录（消息天然私有），
 * 故本类只提供抛异常版本；WebSocket 侧不走本类，身份来自握手拦截器写入的会话属性
 * （见 {@code WsHandshakeInterceptor}）。</p>
 *
 * @author AntTransfer CE
 */
public final class CurrentUserContext {

    private CurrentUserContext() {
    }

    /**
     * 当前登录主体；未认证抛 {@code 1001}。
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
     * 当前登录主体（可能为空）：供内部调用 / 异步场景区分使用。
     */
    public static Optional<AuthenticatedUser> getOptionalUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AuthenticatedUser user) {
            return Optional.of(user);
        }
        return Optional.empty();
    }
}
