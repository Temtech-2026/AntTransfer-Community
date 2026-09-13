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

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ABAC 规则解析扩展点（P1）单元测试：Deny 优先、ABSTAIN 兜底、按 supports 路由。
 *
 * @author AntTransfer CE
 */
@DisplayName("ABAC 规则解析链 · P1 扩展点")
class AccessRuleResolverChainTest {

    private static final AccessRuleContext CTX = new AccessRuleContext(
            10L, "DOWNLOAD", "FILE", 100L, "10.0.0.1", LocalDateTime.now());

    @Test
    @DisplayName("CE 默认：无解析器 → ABSTAIN（等价放行，不改变现有校验行为）")
    void shouldAbstainWhenNoResolver() {
        AccessRuleResolverChain chain = new AccessRuleResolverChain(List.of());
        assertThat(chain.evaluate(CTX)).isEqualTo(AccessRuleDecision.ABSTAIN);
        assertThat(chain.evaluate(null)).isEqualTo(AccessRuleDecision.ABSTAIN);
    }

    @Test
    @DisplayName("Deny 优先：同时存在 ALLOW 与 DENY 时整体拒绝（与注册顺序无关）")
    void shouldLetDenyWin() {
        AccessRuleResolverChain allowThenDeny =
                new AccessRuleResolverChain(List.of(fixed(AccessRuleDecision.ALLOW), fixed(AccessRuleDecision.DENY)));
        AccessRuleResolverChain denyThenAllow =
                new AccessRuleResolverChain(List.of(fixed(AccessRuleDecision.DENY), fixed(AccessRuleDecision.ALLOW)));

        assertThat(allowThenDeny.evaluate(CTX)).isEqualTo(AccessRuleDecision.DENY);
        assertThat(denyThenAllow.evaluate(CTX)).isEqualTo(AccessRuleDecision.DENY);
    }

    @Test
    @DisplayName("仅 ALLOW → ALLOW；仅 ABSTAIN → ABSTAIN")
    void shouldAggregateAllowAndAbstain() {
        assertThat(new AccessRuleResolverChain(List.of(fixed(AccessRuleDecision.ALLOW))).evaluate(CTX))
                .isEqualTo(AccessRuleDecision.ALLOW);
        assertThat(new AccessRuleResolverChain(List.of(fixed(AccessRuleDecision.ABSTAIN))).evaluate(CTX))
                .isEqualTo(AccessRuleDecision.ABSTAIN);
    }

    @Test
    @DisplayName("supports=false 的解析器被跳过，不参与判定")
    void shouldSkipUnsupportedResolver() {
        AtomicBoolean evaluated = new AtomicBoolean(false);
        AccessRuleResolver unsupported = new AccessRuleResolver() {
            @Override
            public boolean supports(AccessRuleContext context) {
                return false;
            }

            @Override
            public AccessRuleDecision evaluate(AccessRuleContext context) {
                evaluated.set(true);
                return AccessRuleDecision.DENY;
            }
        };

        AccessRuleResolverChain chain = new AccessRuleResolverChain(List.of(unsupported));
        assertThat(chain.evaluate(CTX)).isEqualTo(AccessRuleDecision.ABSTAIN);
        assertThat(evaluated).isFalse();
    }

    private static AccessRuleResolver fixed(AccessRuleDecision decision) {
        return new AccessRuleResolver() {
            @Override
            public boolean supports(AccessRuleContext context) {
                return true;
            }

            @Override
            public AccessRuleDecision evaluate(AccessRuleContext context) {
                return decision;
            }
        };
    }
}
