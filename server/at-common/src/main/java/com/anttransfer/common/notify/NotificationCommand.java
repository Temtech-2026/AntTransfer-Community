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
package com.anttransfer.common.notify;

/**
 * 一条「渠道无关」的通知描述——跨模块发送通知的唯一报文。
 *
 * <p>业务模块（如 at-permission 审批通过、at-file 外发链接锁定）只负责<b>描述要通知什么</b>，
 * 不关心通知怎么落地：由 {@link NotificationPort} 的实现（at-collaboration）负责
 * 落 {@code sys_notify_message}、判断在线并推送 WebSocket、离线留待补拉。</p>
 *
 * <p><b>幂等：</b>{@code bizType + bizId + notifyType} 三元组即幂等键，实现侧可用
 * {@link NotificationPort#existsForBiz} 做「同一业务对象只提醒一次」的兜底判定
 * （权威幂等源仍是调用方的 Redis 幂等键）。</p>
 *
 * @param recipientUserId 接收人用户 ID（必填，为空实现侧拒绝并跳过）
 * @param notifyType      通知类型（取值见 {@link NotifyType}，须为系统通知段 1~5 / 8）
 * @param title           标题（≤ 128 字符）
 * @param content         正文（纯文本，≤ 1000 字符）
 * @param bizType         关联业务类型，取值见 {@link #BIZ_APPLICATION} 等常量
 * @param bizId           关联业务 ID（申请单 / 链接 / 传输任务等）
 * @author AntTransfer CE
 */
public record NotificationCommand(
        Long recipientUserId,
        int notifyType,
        String title,
        String content,
        String bizType,
        Long bizId) {

    /** 关联业务类型：权限申请单 */
    public static final String BIZ_APPLICATION = "APPLICATION";

    /** 关联业务类型：外发链接 */
    public static final String BIZ_SHARE = "SHARE";

    /** 关联业务类型：安全事件（异常登录等） */
    public static final String BIZ_SECURITY = "SECURITY";

    /** 关联业务类型：传输任务 */
    public static final String BIZ_TRANSFER = "TRANSFER";

    /** 审批待办（→ 审批人） */
    public static NotificationCommand approvalTodo(Long approverId, Long applicationId,
                                                   String applicationNo, String summary) {
        return new NotificationCommand(approverId, NotifyType.APPROVAL_TODO,
                "您有一条权限申请待审批",
                "申请单 " + applicationNo + "：" + summary,
                BIZ_APPLICATION, applicationId);
    }

    /** 审批结果（→ 申请人） */
    public static NotificationCommand approvalResult(Long applicantId, Long applicationId,
                                                     String applicationNo, String result) {
        return new NotificationCommand(applicantId, NotifyType.APPROVAL_RESULT,
                "您的权限申请已有结果",
                "申请单 " + applicationNo + "：" + result,
                BIZ_APPLICATION, applicationId);
    }

    /** 传输完成提醒（→ 传输发起人） */
    public static NotificationCommand transferCompleted(Long userId, Long transferId, String summary) {
        return new NotificationCommand(userId, NotifyType.TRANSFER_COMPLETED,
                "传输已完成",
                summary,
                BIZ_TRANSFER, transferId);
    }
}
