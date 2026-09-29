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

import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.security.AuthenticatedUser;
import com.anttransfer.common.spi.identity.AuthenticationRequest;
import com.anttransfer.common.spi.identity.IdentityProvider;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.AnnotationAwareOrderComparator;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * 身份提供方选择链：按 {@code @Order} 取<b>第一个</b> {@code supports} 的实现执行。
 *
 * <p><b>为什么是「首个匹配」而不是「逐个尝试」</b>：串行试错会让一次失败登录触发多次远端认证
 * （账号在 A 源不存在 → 试 B 源 → 再试 C 源），既放大认证服务的压力，也让失败计数的归属变得
 * 不可解释。身份源之间应当是<b>互斥</b>的（按域名 / 企业标识划分），命中的那个说了算。</p>
 *
 * <p><b>没有匹配项时</b>抛 {@code BAD_CREDENTIALS}：这与「账号不存在」对外不可区分，
 * 既避免泄漏「本部署启用了哪些身份源」，也让前端沿用同一条错误提示分支。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Component
public class IdentityProviderChain {

    private final List<IdentityProvider> providers;

    public IdentityProviderChain(List<IdentityProvider> providers) {
        List<IdentityProvider> ordered = new ArrayList<>(providers);
        ordered.sort(AnnotationAwareOrderComparator.INSTANCE);
        this.providers = List.copyOf(ordered);
        log.info("[auth] 身份提供方链已装配 {} 个: {}", this.providers.size(),
                this.providers.stream().map(IdentityProvider::providerId).toList());
    }

    /**
     * 执行认证：由第一个声明支持该请求的提供方处理。
     *
     * @throws AuthException 凭据错误 / 账号锁定 / 账号停用；无匹配提供方时同样按凭据错误返回
     */
    public AuthenticatedUser authenticate(AuthenticationRequest request) {
        for (IdentityProvider provider : providers) {
            if (provider.supports(request)) {
                return provider.authenticate(request);
            }
        }
        log.debug("没有身份提供方认领本次登录请求：providers={}", providers.size());
        throw new AuthException(ErrorCode.BAD_CREDENTIALS);
    }
}
