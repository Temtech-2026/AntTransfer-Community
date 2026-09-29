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

import com.anttransfer.common.spi.approval.ApprovalContext;
import com.anttransfer.common.spi.approval.ApprovalNodeResolver;
import com.anttransfer.permission.config.ApprovalProperties;
import com.anttransfer.permission.config.ApprovalResolverConfig;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.annotation.Order;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 审批节点解析接缝：CE 单节点默认装配 + EE 多级替换 + 链的「不静默放行」语义。
 *
 * <p>C 组把 {@code ApprovalNodeResolver} / {@code ApprovalContext} 上收至 {@code at-common} 后，
 * 本测试同时守住「上收未改变行为」这一回归口径。</p>
 */
class ApprovalResolverSpiTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(ApprovalResolverConfig.class, ApprovalProperties.class);

    /** EE 多级（两级会签）解析器，优先级最高 */
    @Order(1)
    static class TwoLevelStub implements ApprovalNodeResolver {

        @Override
        public boolean supports(ApprovalContext context) {
            return true;
        }

        @Override
        public List<ResolvedNode> resolve(ApprovalContext context) {
            return List.of(new ResolvedNode(11L, 1, 2), new ResolvedNode(12L, 2, 2));
        }
    }

    /** 「认领但解析不出人」的解析器：链必须继续向后尝试 */
    static class BlankStub implements ApprovalNodeResolver {

        @Override
        public boolean supports(ApprovalContext context) {
            return true;
        }

        @Override
        public List<ResolvedNode> resolve(ApprovalContext context) {
            return List.of();
        }
    }

    /* ==================== 装配门禁 ==================== */

    @Test
    void ceDefaults_shouldProvideSingleNodeResolver() {
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).hasSingleBean(ApprovalNodeResolver.class);
            assertThat(context.getBean(ApprovalNodeResolver.class)).isInstanceOf(SingleNodeApprovalResolver.class);
        });
    }

    @Test
    void eeResolver_shouldTakeOverCeDefault() {
        runner.withBean(ApprovalNodeResolver.class, TwoLevelStub::new)
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(ApprovalNodeResolver.class);
                    assertThat(context.getBean(ApprovalNodeResolver.class)).isInstanceOf(TwoLevelStub.class);
                });
    }

    /* ==================== 链语义 ==================== */

    @Test
    void chain_shouldPreferHighestOrderResolver() {
        ApprovalNodeResolverChain chain = new ApprovalNodeResolverChain(
                List.of(new SingleNodeApprovalResolver(new ApprovalProperties()), new TwoLevelStub()));

        List<ApprovalNodeResolver.ResolvedNode> nodes = chain.resolve(accessContext(1L, null));

        assertThat(nodes).hasSize(2);
        assertThat(nodes.get(0).nodeSeq()).isEqualTo(1);
        assertThat(nodes.get(1).approverId()).isEqualTo(12L);
    }

    @Test
    void chain_shouldFallThroughWhenResolverClaimsButReturnsNothing() {
        ApprovalNodeResolverChain chain = new ApprovalNodeResolverChain(
                List.of(new BlankStub(), new TwoLevelStub()));

        assertThat(chain.resolve(accessContext(1L, null))).hasSize(2);
    }

    @Test
    void chain_shouldReturnEmptyRatherThanSilentlyPassing() {
        ApprovalNodeResolverChain chain = new ApprovalNodeResolverChain(List.of(new BlankStub()));

        // 空结果 = 「无法确定审批人」由调用方处置；绝不能变成「无人需审批」
        assertThat(chain.resolve(accessContext(1L, null))).isEmpty();
    }

    /* ==================== CE 单节点解析行为（上收后的回归） ==================== */

    @Test
    void ceResolver_shouldPreferSuggestedApprover() {
        ApprovalProperties properties = new ApprovalProperties();
        properties.setDefaultApproverId(99L);
        SingleNodeApprovalResolver resolver = new SingleNodeApprovalResolver(properties);

        assertThat(resolver.resolve(accessContext(1L, 8L)))
                .singleElement()
                .satisfies(node -> {
                    assertThat(node.approverId()).isEqualTo(8L);
                    assertThat(node.nodeType()).isEqualTo(ApprovalNodeResolver.ResolvedNode.TYPE_SINGLE);
                });
    }

    @Test
    void ceResolver_shouldFallBackToConfiguredApprover() {
        ApprovalProperties properties = new ApprovalProperties();
        properties.setDefaultApproverId(99L);
        SingleNodeApprovalResolver resolver = new SingleNodeApprovalResolver(properties);

        assertThat(resolver.resolve(accessContext(1L, null)))
                .singleElement()
                .extracting(ApprovalNodeResolver.ResolvedNode::approverId)
                .isEqualTo(99L);
    }

    @Test
    void ceResolver_shouldRefuseSelfApprovalAndMissingApprover() {
        ApprovalProperties properties = new ApprovalProperties();
        properties.setDefaultApproverId(99L);
        SingleNodeApprovalResolver resolver = new SingleNodeApprovalResolver(properties);

        // 建议审批人 = 申请人本人 ⇒ 不允许自审
        assertThat(resolver.supports(accessContext(7L, 7L))).isFalse();
        assertThat(resolver.resolve(accessContext(7L, 7L))).isEmpty();

        // 无建议审批人且未配置兜底 ⇒ 不猜人
        SingleNodeApprovalResolver withoutFallback = new SingleNodeApprovalResolver(new ApprovalProperties());
        assertThat(withoutFallback.resolve(accessContext(7L, null))).isEmpty();
    }

    private static ApprovalContext accessContext(Long applicantId, Long suggestedApproverId) {
        return new ApprovalContext(null, applicantId, "ACCESS", "FILE", 100L, 2, suggestedApproverId);
    }
}
