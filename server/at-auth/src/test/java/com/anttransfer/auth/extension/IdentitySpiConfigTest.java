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

import com.anttransfer.auth.config.IdentitySpiConfig;
import com.anttransfer.auth.repository.UserMapper;
import com.anttransfer.common.security.AuthenticatedUser;
import com.anttransfer.common.spi.identity.AuthenticationRequest;
import com.anttransfer.common.spi.identity.IdentityProvider;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * 身份提供方扩展点的装配门禁：CE 本地账号默认装配，EE 声明实现即顶替。
 *
 * <p>关键口径：CE 部署<b>不加任何配置</b>必须能启动；EE 部署<b>不需要删除或改写 CE 的配置类</b>，
 * 只靠 {@code @ConditionalOnMissingBean} 让位——这就是「差异化不靠 if 分支」的落地证据。</p>
 */
class IdentitySpiConfigTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(IdentitySpiConfig.class)
            .withBean(UserMapper.class, () -> mock(UserMapper.class))
            .withBean(PasswordEncoder.class, () -> mock(PasswordEncoder.class));

    static class EnterpriseStub implements IdentityProvider {

        @Override
        public String providerId() {
            return "enterprise-stub";
        }

        @Override
        public boolean supports(AuthenticationRequest request) {
            return true;
        }

        @Override
        public AuthenticatedUser authenticate(AuthenticationRequest request) {
            throw new UnsupportedOperationException("本测试只验证装配，不触发认证");
        }
    }

    @Test
    void ceDefaults_shouldProvideLocalIdentityProvider() {
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).hasSingleBean(IdentityProvider.class);
            assertThat(context.getBean(IdentityProvider.class)).isInstanceOf(LocalIdentityProvider.class);
        });
    }

    @Test
    void eeIdentityProvider_shouldTakeOverCeDefault() {
        runner.withBean(IdentityProvider.class, EnterpriseStub::new)
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(IdentityProvider.class);
                    assertThat(context.getBean(IdentityProvider.class)).isInstanceOf(EnterpriseStub.class);
                    assertThat(context).doesNotHaveBean(LocalIdentityProvider.class);
                });
    }
}
