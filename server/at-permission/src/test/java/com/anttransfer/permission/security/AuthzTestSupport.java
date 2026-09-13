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

import com.anttransfer.common.security.AuthenticatedUser;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * 纯单元测试下的「当前登录人」注入工具。
 *
 * <p>{@link AuthzContext#currentUser()} 从 Spring Security 的 {@code SecurityContextHolder}
 * 读取 principal。Service 单测不起容器，需要手工把
 * 「操作者身份」放进去——因为「不得对自己操作」这类红线判定依赖它，
 * 若用无身份的上下文，测试会先撞 1001 而未登录，把红线断言掩盖成假通过。</p>
 *
 * <p>注意：SecurityContextHolder 默认是 ThreadLocal（MODE_THREADLOCAL），
 * 用例结束必须 {@link #clear()}，否则同一线程里的后续用例会继承上一条的身份。</p>
 *
 * @author AntTransfer CE
 */
public final class AuthzTestSupport {

    private AuthzTestSupport() {
    }

    /** 以指定用户 ID 的身份登录，供 {@link AuthzContext} 读取。 */
    public static void loginAs(Long userId) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(new StubUser(userId), null));
    }

    /** 清理线程上下文，避免身份在用例之间外溢。 */
    public static void clear() {
        SecurityContextHolder.clearContext();
    }

    /** 最小身份桩：只实现 at-common 的只读摘要契约。 */
    private record StubUser(Long userId) implements AuthenticatedUser {

        @Override
        public Long getId() {
            return userId;
        }

        @Override
        public String getUsername() {
            return "operator";
        }

        @Override
        public String getNickname() {
            return "操作员";
        }
    }
}
