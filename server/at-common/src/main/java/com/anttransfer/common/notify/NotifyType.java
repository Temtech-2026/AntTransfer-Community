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
 * 与系统通知共用一张表但语义独立，见 {@link ChatScope}）；<b>8~9</b> 业务提醒
 * （8 传输完成 / 9 外发取件回执，两者均计入站内信未读，9 不进待办中心）。</p>
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

    /**
     * 外发链接被取件回执（→ 链接创建者）。
     *
     * <p>与 {@link #SHARE_LOCKED} / {@link #SHARE_EXPIRE_SOON} 同属「外发链接状态提醒」，
     * 但语义是<b>正向回执</b>（有人取走了文件），故与两者并列单列一码：
     * 复用 3 / 4 会把「取件成功」在收件箱显示成「链接被锁 / 即将到期」，
     * 是比不发更糟的语义误导（同「授权到期回收」不映射到 2 的裁定口径）。</p>
     *
     * <p><b>每次成功取件各提醒一次</b>（不做跨次幂等）：取件次数已由链接额度闸门约束，
     * 且「又一次取件」本身就是新信息。因此 {@code bizType + bizId + notifyType} 幂等键
     * 在本类型上<b>不可</b>用于去重。</p>
     */
    public static final int SHARE_ACCESSED = 9;

    /** 全部合法类型上界（用于出参 / 入库校验，防越界写入） */
    public static final int MAX = SHARE_ACCESSED;

    private NotifyType() {
    }

    /** 是否会话消息（单聊 / 群聊）；会话消息不进站内信未读红点，走会话未读。 */
    public static boolean isChat(int notifyType) {
        return notifyType == IM_PRIVATE || notifyType == IM_GROUP;
    }

    /**
     * 是否系统通知（站内信）。
     *
     * <p>口径 = 「合法且非会话消息」，与未读 SQL（{@code NotifyMessageMapper}
     * 的 {@code notify_type not in (6,7)}）严格一致。原实现写作 {@code 1..5} 区间判断，
     * 与 SQL 分歧（8 被 SQL 计入未读、却被原方法判为 false）；该方法此前无调用方、
     * 无线上影响，随 {@link #SHARE_ACCESSED} 扩段一并修正为与 SQL 同一口径。</p>
     */
    public static boolean isInbox(int notifyType) {
        return isValid(notifyType) && !isChat(notifyType);
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
