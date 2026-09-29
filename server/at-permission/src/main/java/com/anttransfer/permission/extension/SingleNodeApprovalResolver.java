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

import java.util.List;
import java.util.Objects;

/**
 * CE 默认审批人解析：<b>单节点</b>。
 *
 * <p>优先级：调用方建议审批人（资源属主） → 配置的兜底安全管理员
 * （{@code anttransfer.permission.approval.default-approver-id}）。两者皆无则返回空列表，
 * 表示「当前无法确定审批人」，申请单将以 {@code approver_id=null} 落库待管理员认领，
 * 而不是被静默放行。</p>
 *
 * <p>不标注 {@code @Component}：由 {@code ApprovalResolverConfig} 以
 * {@code @ConditionalOnMissingBean} 注册，EE 提供自己的 {@link ApprovalNodeResolver} 时自动让位。</p>
 *
 * @author AntTransfer CE
 */
public class SingleNodeApprovalResolver implements ApprovalNodeResolver {

    private final ApprovalProperties properties;

    public SingleNodeApprovalResolver(ApprovalProperties properties) {
        this.properties = properties;
    }

    @Override
    public boolean supports(ApprovalContext context) {
        return resolveApproverId(context) != null;
    }

    @Override
    public List<ResolvedNode> resolve(ApprovalContext context) {
        Long approverId = resolveApproverId(context);
        if (approverId == null) {
            return List.of();
        }
        return List.of(ResolvedNode.single(approverId));
    }

    /**
     * 确定唯一审批人：建议审批人优先，其次配置兜底；相同于申请人本人时跳过（禁止自审）。
     */
    private Long resolveApproverId(ApprovalContext context) {
        Long candidate = context.suggestedApproverId() != null
                ? context.suggestedApproverId()
                : properties.getDefaultApproverId();
        if (candidate == null || Objects.equals(candidate, context.applicantId())) {
            return null;
        }
        return candidate;
    }
}
