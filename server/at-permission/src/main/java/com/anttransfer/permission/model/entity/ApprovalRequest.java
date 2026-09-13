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
package com.anttransfer.permission.model.entity;

import com.anttransfer.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 权限申请单实体（映射 {@code sys_approval_request}，见 sql/V1__schema.sql）。
 *
 * <p>一次「无权限 → 申请 → 审批 → 授权」的完整留痕。状态机（use-case-flows §2.3）：</p>
 * <pre>
 *   0 待审 ──通过──▶ 1 通过（同事务写 sys_user_file_permission）
 *         ├─驳回──▶ 2 驳回（必填理由）
 *         ├─转审──▶ 3 转审（改指审批人后回到 0 待审，留痕于 sys_approval_node）
 *         └─撤销──▶ 4 撤销（申请人撤回）
 * </pre>
 *
 * <p>所有状态迁移一律 CAS（{@code UPDATE ... WHERE id=? AND status=<期望源态>}） + 行数校验，
 * 禁止「查-判-改」（system-design §6 红线 P-1 / [C-06]）。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_approval_request")
public class ApprovalRequest extends BaseEntity {

    /** 状态：待审（唯一活动态之一） */
    public static final int STATUS_PENDING = 0;

    /** 状态：通过（终态） */
    public static final int STATUS_APPROVED = 1;

    /** 状态：驳回（终态） */
    public static final int STATUS_REJECTED = 2;

    /** 状态：转审（改指审批人后回到待审，非终态） */
    public static final int STATUS_TRANSFERRED = 3;

    /** 状态：撤销（申请人撤回，终态） */
    public static final int STATUS_CANCELLED = 4;

    /** 申请单号（对用户可读，如 AP20260906001，全局唯一） */
    @TableField("application_no")
    private String applicationNo;

    /** 申请人用户 ID（逻辑关联 sys_user） */
    @TableField("applicant_id")
    private Long applicantId;

    /** 申请类型：ACCESS-访问 DOWNLOAD-下载 EDIT-编辑 SHARE-外发 */
    @TableField("apply_type")
    private String applyType;

    /** 目标资源类型：FILE-文件 SPACE-空间 GROUP-项目/群组（CE 默认 FILE） */
    @TableField("resource_type")
    private String resourceType;

    /** 目标资源 ID（逻辑关联，CE 下为 sys_file.id） */
    @TableField("resource_id")
    private Long resourceId;

    /** 资源敏感级别：1-低 2-中 3-高（SLA 解析依据） */
    @TableField("level")
    private Integer level;

    /** 申请目的 / 理由（必填） */
    @TableField("purpose")
    private String purpose;

    /** 申请人拟授权到期时刻（null=永久；实际以审批批复为准，批复不得放宽） */
    @TableField("desired_expire_at")
    private LocalDateTime desiredExpireAt;

    /** 状态：0-待审 1-通过 2-驳回 3-转审 4-撤销 */
    @TableField("status")
    private Integer status;

    /** 当前 / 最近审批人用户 ID（逻辑关联 sys_user） */
    @TableField("approver_id")
    private Long approverId;

    /** 审批意见 / 驳回理由（驳回必填） */
    @TableField("opinion")
    private String opinion;

    /** 最近批复 / 处理时刻（status 进入终态时写入） */
    @TableField("decided_at")
    private LocalDateTime decidedAt;

    /** 是否仍处活动态（待审 / 转审途中），活动态才受「防重复」约束 */
    public boolean isActive() {
        return status != null
                && (status == STATUS_PENDING || status == STATUS_TRANSFERRED);
    }
}
