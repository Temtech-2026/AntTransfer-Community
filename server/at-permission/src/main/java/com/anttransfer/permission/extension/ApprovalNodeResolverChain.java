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
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.AnnotationAwareOrderComparator;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * 审批节点解析链：按 {@code @Order} 顺序取第一个 {@code supports} 的解析器。
 *
 * <p>调用方只依赖本类，CE → EE 的替换对业务代码透明。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Component
public class ApprovalNodeResolverChain {

    private final List<ApprovalNodeResolver> resolvers;

    public ApprovalNodeResolverChain(List<ApprovalNodeResolver> resolvers) {
        List<ApprovalNodeResolver> ordered = new ArrayList<>(resolvers);
        AnnotationAwareOrderComparator.sort(ordered);
        this.resolvers = List.copyOf(ordered);
        log.info("[permission] 审批节点解析器链已装配 {} 个: {}", ordered.size(),
                ordered.stream().map(r -> r.getClass().getSimpleName()).toList());
    }

    /**
     * 解析审批节点；无解析器可处理时返回空列表（交由调用方决定处置，不静默放行）。
     */
    public List<ApprovalNodeResolver.ResolvedNode> resolve(ApprovalContext context) {
        for (ApprovalNodeResolver resolver : resolvers) {
            if (resolver.supports(context)) {
                List<ApprovalNodeResolver.ResolvedNode> nodes = resolver.resolve(context);
                if (nodes != null && !nodes.isEmpty()) {
                    return nodes;
                }
            }
        }
        log.warn("[permission] 无法解析审批人: applicantId={}, resource={}:{}, level={}",
                context.applicantId(), context.resourceType(), context.resourceId(), context.level());
        return List.of();
    }
}
