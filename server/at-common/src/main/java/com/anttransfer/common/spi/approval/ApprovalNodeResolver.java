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
package com.anttransfer.common.spi.approval;

import java.util.List;

/**
 * 审批节点解析扩展点（SPI）。
 *
 * <p><b>CE</b>：{@code SingleNodeApprovalResolver} 返回单节点审批（资源属主 → 兜底安全管理员）。
 * <b>EE</b>：实现本接口并按 {@code @Order} 优先注册即可替换为多级 / 会签 / 按组织架构动态解析，
 * 业务侧（{@code ApprovalNodeResolverChain}）无需改动——这是 schema 中 {@code node_seq} /
 * {@code node_type} 预留多级的落地入口。</p>
 *
 * <p>扩展点只解析「应由谁审」，不参与状态流转判断；解析结果为空视为「无法确定审批人」，
 * 由调用方决定是拒绝申请还是置空待管理员认领，不得静默放行。</p>
 *
 * <p><b>C 组归位</b>：本接口原定义在 {@code at-permission} 的 {@code extension} 包，现已上收至
 * {@code at-common} 的 SPI 包——EE 只需依赖 {@code at-common} 即可实现。</p>
 *
 * @author AntTransfer CE
 */
public interface ApprovalNodeResolver {

    /**
     * 是否由本解析器处理该上下文。
     *
     * <p>EE 实现通常返回 {@code true} 并置于链首；CE 默认实现仅在能确定审批人时返回 {@code true}。</p>
     */
    boolean supports(ApprovalContext context);

    /**
     * 解析审批节点（按 {@code nodeSeq} 升序，CE 恒为 1 个）。
     *
     * @return 不可为 null；返回空列表表示无法解析出审批人
     */
    List<ResolvedNode> resolve(ApprovalContext context);

    /**
     * 解析出的审批节点。
     *
     * @param approverId 审批人用户 ID
     * @param nodeSeq    节点序号（从 1 起）
     * @param nodeType   节点类型：1-单级审批（预留 2-会签 3-或签）
     */
    record ResolvedNode(Long approverId, int nodeSeq, int nodeType) {

        /** 单级审批节点类型 */
        public static final int TYPE_SINGLE = 1;

        public static ResolvedNode single(Long approverId) {
            return new ResolvedNode(approverId, 1, TYPE_SINGLE);
        }
    }
}
