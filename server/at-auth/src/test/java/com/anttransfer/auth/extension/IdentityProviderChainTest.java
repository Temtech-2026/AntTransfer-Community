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
import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.security.AuthenticatedUser;
import com.anttransfer.common.spi.identity.AuthenticationRequest;
import com.anttransfer.common.spi.identity.IdentityProvider;
import org.junit.jupiter.api.Test;
import org.springframework.core.annotation.Order;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * 身份提供方链的选择语义：按 {@code @Order} 取<b>第一个</b> {@code supports} 的实现。
 *
 * <p>验证两点：Bean 注入顺序不影响优先级（由 {@code @Order} 决定）；命中后不再调用其它实现
 * （避免一次登录触发多次远端认证）。</p>
 */
class IdentityProviderChainTest {

    /** 企业身份源：只认领 {@code @corp.example} 域名，且优先级最高 */
    @Order(10)
    static class EnterpriseProvider implements IdentityProvider {

        int invocations;

        @Override
        public String providerId() {
            return "enterprise";
        }

        @Override
        public boolean supports(AuthenticationRequest request) {
            return request.username() != null && request.username().endsWith("@corp.example");
        }

        @Override
        public AuthenticatedUser authenticate(AuthenticationRequest request) {
            invocations++;
            LoginUser principal = new LoginUser();
            principal.setId(42L);
            principal.setUsername("enterprise-user");
            return principal;
        }
    }

    /** 兜底本地身份源：无 {@code @Order} ⇒ 优先级最低 */
    static class FallbackLocalProvider implements IdentityProvider {

        int invocations;

        @Override
        public String providerId() {
            return "local";
        }

        @Override
        public boolean supports(AuthenticationRequest request) {
            return true;
        }

        @Override
        public AuthenticatedUser authenticate(AuthenticationRequest request) {
            invocations++;
            LoginUser principal = new LoginUser();
            principal.setId(1L);
            principal.setUsername(request.username());
            return principal;
        }
    }

    @Test
    void enterpriseLogin_shouldPickHigherOrderProviderRegardlessOfBeanOrder() {
        EnterpriseProvider enterprise = new EnterpriseProvider();
        FallbackLocalProvider local = new FallbackLocalProvider();
        // 故意把兜底实现放在前面：优先级必须由 @Order 决定，而不是注入顺序
        IdentityProviderChain chain = new IdentityProviderChain(List.of(local, enterprise));

        AuthenticatedUser principal = chain.authenticate(new AuthenticationRequest("alice@corp.example", null));

        assertEquals(42L, principal.getId());
        assertEquals(1, enterprise.invocations);
        assertEquals(0, local.invocations, "命中首个匹配项后不得继续尝试其它身份源");
    }

    @Test
    void localLogin_shouldFallBackToLocalProvider() {
        EnterpriseProvider enterprise = new EnterpriseProvider();
        FallbackLocalProvider local = new FallbackLocalProvider();
        IdentityProviderChain chain = new IdentityProviderChain(List.of(local, enterprise));

        AuthenticatedUser principal = chain.authenticate(new AuthenticationRequest("alice", "pwd"));

        assertEquals(1L, principal.getId());
        assertEquals(0, enterprise.invocations);
        assertEquals(1, local.invocations);
    }

    @Test
    void noProviderSupports_shouldThrowBadCredentials() {
        IdentityProviderChain chain = new IdentityProviderChain(List.of());

        AuthException e = assertThrows(AuthException.class,
                () -> chain.authenticate(new AuthenticationRequest("ghost", "x")));

        // 与「账号不存在」不可区分：不泄漏本部署启用了哪些身份源
        assertEquals(1007, e.getErrorCode().getCode());
    }
}
