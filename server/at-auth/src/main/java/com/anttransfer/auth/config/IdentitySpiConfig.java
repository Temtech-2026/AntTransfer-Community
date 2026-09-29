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
package com.anttransfer.auth.config;

import com.anttransfer.auth.extension.LocalIdentityProvider;
import com.anttransfer.auth.repository.UserMapper;
import com.anttransfer.common.spi.identity.IdentityProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * 身份提供方扩展点的 CE 默认装配。
 *
 * <p>{@code @ConditionalOnMissingBean} 保证 EE 声明自己的 {@link IdentityProvider} 后，
 * CE 的本地实现自动让位（不必删除本类，也不会有两个提供方争抢同一个登录名）。</p>
 *
 * @author AntTransfer CE
 */
@Configuration(proxyBeanMethods = false)
public class IdentitySpiConfig {

    /** CE 默认：本地账号 + BCrypt 口令 */
    @Bean
    @ConditionalOnMissingBean(IdentityProvider.class)
    public IdentityProvider localIdentityProvider(UserMapper userMapper, PasswordEncoder passwordEncoder) {
        return new LocalIdentityProvider(userMapper, passwordEncoder);
    }
}
