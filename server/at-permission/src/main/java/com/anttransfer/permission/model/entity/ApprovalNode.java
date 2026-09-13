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
 * 审批节点实体（映射 {@code sys_approval_node}）。
 *
 * <p>CE 固定单级审批（{@code node_seq} 恒为 1），但结构上即「多级 / 会签」的扩展载体：
 * 审批人解析走 {@code ApprovalNodeResolver} SPI（EE 实现动态解析），CE 由
 * {@code SingleNodeApprovalResolver} 返回单节点。转审 / 升级提醒在此追加留痕。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@TableName("sys_approval_node")
public class ApprovalNode extends BaseEntity {

    /** 节点状态：待处理 */
    public static final int STATUS_PENDING = 0;

    /** 节点状态：同意 */
    public static final int STATUS_AGREED = 1;

    /** 节点状态：驳回 */
    public static final int STATUS_REJECTED = 2;

    /** 节点状态：转审 */
    public static final int STATUS_TRANSFERRED = 3;

    /** 节点状态：作废 */
    public static final int STATUS_VOID = 4;

    /** 申请单 ID（逻辑关联 sys_approval_request） */
    @TableField("approval_id")
    private Long approvalId;

    /** 节点序号（CE 恒为 1；多级审批按序追加） */
    @TableField("node_seq")
    private Integer nodeSeq;

    /** 节点类型：1-单级审批（预留：2-会签 3-或签） */
    @TableField("node_type")
    private Integer nodeType;

    /** 节点审批人用户 ID（转审即更新此处，逻辑关联 sys_user） */
    @TableField("approver_id")
    private Long approverId;

    /** 节点状态：0-待处理 1-同意 2-驳回 3-转审 4-作废 */
    @TableField("status")
    private Integer status;

    /** 节点审批意见 */
    @TableField("opinion")
    private String opinion;

    /** 节点处理时间 */
    @TableField("acted_at")
    private LocalDateTime actedAt;
}
