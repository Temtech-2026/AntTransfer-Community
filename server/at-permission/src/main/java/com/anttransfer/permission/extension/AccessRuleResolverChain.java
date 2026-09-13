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
package com.anttransfer.permission.extension;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.AnnotationAwareOrderComparator;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * ABAC 规则解析器链：按 {@link AccessRuleResolver#supports} 路由并聚合结论。
 *
 * <p>聚合策略：<b>Deny 优先</b>——任一命中解析器返回 {@link AccessRuleDecision#DENY} 即整体拒绝；
 * 否则若存在 {@link AccessRuleDecision#ALLOW} 则放行；否则 {@link AccessRuleDecision#ABSTAIN}
 * （等同于放行，保持 CE 行为不变）。</p>
 *
 * <p>CE 无实现 Bean 时链为空，{@link #evaluate} 恒返回 {@code ABSTAIN}，即权限校验只取决于授权表与有效期。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Component
public class AccessRuleResolverChain {

    private final List<AccessRuleResolver> resolvers;

    public AccessRuleResolverChain(List<AccessRuleResolver> resolvers) {
        List<AccessRuleResolver> ordered = new ArrayList<>(resolvers);
        AnnotationAwareOrderComparator.sort(ordered);
        this.resolvers = List.copyOf(ordered);
        log.info("[permission] ABAC 规则解析链已装配 {} 个解析器", ordered.size());
    }

    /**
     * 聚合所有命中解析器的结论。
     */
    public AccessRuleDecision evaluate(AccessRuleContext context) {
        if (context == null || resolvers.isEmpty()) {
            return AccessRuleDecision.ABSTAIN;
        }
        boolean allowed = false;
        for (AccessRuleResolver resolver : resolvers) {
            if (!resolver.supports(context)) {
                continue;
            }
            AccessRuleDecision decision = resolver.evaluate(context);
            if (decision == AccessRuleDecision.DENY) {
                return AccessRuleDecision.DENY;
            }
            if (decision == AccessRuleDecision.ALLOW) {
                allowed = true;
            }
        }
        return allowed ? AccessRuleDecision.ALLOW : AccessRuleDecision.ABSTAIN;
    }
}
