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
 * 通知类型常量（与 {@code sys_notify_message.notify_type} 一一对应）。
 *
 * <p><b>为何位于 at-common：</b>通知的「写入方」是各业务模块（审批、外发、登录风控…），
 * 「落地与推送方」是 at-collaboration（{@link NotificationPort} 的实现）。按架构铁律
 * 业务模块之间禁止互相依赖，故类型常量必须沉到共享内核，双方以同一份编码表对话。</p>
 *
 * <p>编码分段：<b>1~5</b> 系统通知（站内信，非会话）；<b>6~7</b> 会话消息（单聊 / 群聊，
 * 与系统通知共用一张表但语义独立，见 {@link ChatScope}）；<b>8</b> 业务提醒（传输完成）。</p>
 *
 * @author AntTransfer CE
 */
public final class NotifyType {

    /** 审批待办（→ 审批人；未读即「待我审批」待办项） */
    public static final int APPROVAL_TODO = 1;

    /** 审批结果（→ 申请人；含通过 / 驳回，驳回同时是待办中心的结果项） */
    public static final int APPROVAL_RESULT = 2;

    /** 外发链接锁定（提取码连续错误触发保护） */
    public static final int SHARE_LOCKED = 3;

    /** 外发链接到期提醒（→ 创建者） */
    public static final int SHARE_EXPIRE_SOON = 4;

    /** 异常登录告警 */
    public static final int ABNORMAL_LOGIN = 5;

    /** 单聊消息（会话消息） */
    public static final int IM_PRIVATE = 6;

    /** 群聊消息（会话消息） */
    public static final int IM_GROUP = 7;

    /** 传输完成提醒（→ 发起人；待办中心的提醒项） */
    public static final int TRANSFER_COMPLETED = 8;

    /** 全部合法类型上界（用于出参 / 入库校验，防越界写入） */
    public static final int MAX = TRANSFER_COMPLETED;

    private NotifyType() {
    }

    /** 是否会话消息（单聊 / 群聊）；会话消息不进站内信未读红点，走会话未读。 */
    public static boolean isChat(int notifyType) {
        return notifyType == IM_PRIVATE || notifyType == IM_GROUP;
    }

    /** 是否系统通知（站内信）。 */
    public static boolean isInbox(int notifyType) {
        return notifyType >= APPROVAL_TODO && notifyType <= ABNORMAL_LOGIN;
    }

    /** 待办中心纳入口径：待我审批 / 审批结果（驳回）/ 传输完成。 */
    public static boolean isTodo(int notifyType) {
        return notifyType == APPROVAL_TODO
                || notifyType == APPROVAL_RESULT
                || notifyType == TRANSFER_COMPLETED;
    }

    /** 类型是否合法（1..{@link #MAX}）。 */
    public static boolean isValid(int notifyType) {
        return notifyType >= APPROVAL_TODO && notifyType <= MAX;
    }
}
