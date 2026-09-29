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
 * @param notifyType      通知类型（取值见 {@link NotifyType}，须为系统通知段 1~5 / 8~9）
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

    /** 外发链接被临时锁定（→ 链接创建者；提取码连续输错触发保护） */
    public static NotificationCommand shareLocked(Long ownerUserId, Long shareId,
                                                  String fileName, long lockMinutes) {
        return new NotificationCommand(ownerUserId, NotifyType.SHARE_LOCKED,
                "外发链接已被临时锁定",
                "文件「" + safeName(fileName) + "」的分享链接因提取码连续输错已锁定 "
                        + lockMinutes + " 分钟",
                BIZ_SHARE, shareId);
    }

    /**
     * 外发链接即将到期（→ 链接创建者）。
     *
     * @param expireAt 已格式化的到期时刻文本（如 {@code 2026-09-30 18:00}），
     *                 由调用方按展示口径格式化后传入——本类不做时区 / 格式假设
     */
    public static NotificationCommand shareExpireSoon(Long ownerUserId, Long shareId,
                                                      String fileName, String expireAt) {
        return new NotificationCommand(ownerUserId, NotifyType.SHARE_EXPIRE_SOON,
                "外发链接即将到期",
                "文件「" + safeName(fileName) + "」的分享链接将于 " + expireAt + " 到期，"
                        + "到期后访客将无法继续访问",
                BIZ_SHARE, shareId);
    }

    /**
     * 外发链接被取件回执（→ 链接创建者）。
     *
     * @param accessType 访问类型（{@code preview} 预览 / 其他值按下载处理）
     * @param quotaText  额度描述（如「剩余可取件 3 次」「该链接不限取件次数」），
     *                   由调用方按链接额度口径生成
     */
    public static NotificationCommand shareAccessed(Long ownerUserId, Long shareId,
                                                    String fileName, String accessType,
                                                    String quotaText) {
        String action = "preview".equals(accessType) ? "预览" : "下载";
        return new NotificationCommand(ownerUserId, NotifyType.SHARE_ACCESSED,
                "外发链接已被取件",
                "访客已" + action + "文件「" + safeName(fileName) + "」，" + quotaText,
                BIZ_SHARE, shareId);
    }

    /** 文件名兜底：文件已被删除 / 未取到时避免把字面量 {@code null} 拼进用户可见文案。 */
    private static String safeName(String fileName) {
        return (fileName == null || fileName.isBlank()) ? "（文件已删除）" : fileName;
    }
}
