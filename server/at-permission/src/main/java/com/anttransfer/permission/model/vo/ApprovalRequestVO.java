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
package com.anttransfer.permission.model.vo;

import com.anttransfer.permission.model.entity.ApprovalRequest;

import java.time.LocalDateTime;

/**
 * 申请单视图（待我审批 / 我发起 列表与详情共用）。
 *
 * @author AntTransfer CE
 */
public record ApprovalRequestVO(

        Long id,
        String applicationNo,
        Long applicantId,
        String applyType,
        String resourceType,
        Long resourceId,
        Integer level,
        String purpose,
        LocalDateTime desiredExpireAt,
        Integer status,
        Long approverId,
        String opinion,
        LocalDateTime decidedAt,
        LocalDateTime createdAt) {

    /** 实体 → 视图（仅暴露对外字段，不泄漏 deleted 等持久化细节） */
    public static ApprovalRequestVO of(ApprovalRequest request) {
        return new ApprovalRequestVO(
                request.getId(),
                request.getApplicationNo(),
                request.getApplicantId(),
                request.getApplyType(),
                request.getResourceType(),
                request.getResourceId(),
                request.getLevel(),
                request.getPurpose(),
                request.getDesiredExpireAt(),
                request.getStatus(),
                request.getApproverId(),
                request.getOpinion(),
                request.getDecidedAt(),
                request.getCreateTime());
    }
}
