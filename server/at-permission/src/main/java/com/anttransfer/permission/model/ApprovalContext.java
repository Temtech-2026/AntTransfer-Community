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
package com.anttransfer.permission.model;

/**
 * 审批人解析上下文——{@link com.anttransfer.permission.extension.ApprovalNodeResolver} 的入参。
 *
 * <p>CE 由申请单信息 + 调用方给出的建议审批人（如资源属主）组装；EE 的动态解析（按部门 /
 * 密级 / 组织架构）亦可从中取用，无需依赖任何跨模块类型（模块间只经 at-common 契约）。</p>
 *
 * @param applicationId       申请单 ID（新建前为 null）
 * @param applicantId         申请人用户 ID
 * @param applyType           申请类型（ACCESS / DOWNLOAD / EDIT / SHARE）
 * @param resourceType        资源类型
 * @param resourceId          资源 ID
 * @param level               敏感等级 1/2/3
 * @param suggestedApproverId 调用方建议审批人（如资源属主；可为 null，由解析器兜底）
 * @author AntTransfer CE
 */
public record ApprovalContext(
        Long applicationId,
        Long applicantId,
        String applyType,
        String resourceType,
        Long resourceId,
        int level,
        Long suggestedApproverId) {
}
