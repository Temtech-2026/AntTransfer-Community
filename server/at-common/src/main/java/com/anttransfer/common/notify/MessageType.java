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
 * 消息体类型常量（与 {@code sys_notify_message.message_type} 一一对应）。
 *
 * <p>与 {@link NotifyType} 正交：{@code notify_type} 决定「这是哪一类通知 / 会话」，
 * {@code message_type} 决定「消息体怎么渲染」。会话消息（单聊 / 群聊）必须取
 * {@link #CHAT_TEXT} / {@link #FILE_TRANSFER} / {@link #APPROVAL_RESULT} 三者之一，
 * 不得为 {@link #SYSTEM}——校验由 at-collaboration 的会话服务执行。</p>
 *
 * @author AntTransfer CE
 */
public final class MessageType {

    /** 非会话消息（系统通知 / 待办提醒），不经会话渲染 */
    public static final int SYSTEM = 0;

    /** 文本消息（单聊 / 群聊） */
    public static final int CHAT_TEXT = 1;

    /** 文件传输通知消息（传输任务状态 / 文件卡片） */
    public static final int FILE_TRANSFER = 2;

    /** 审批结果通知消息（审批结论卡片，可在会话中下发） */
    public static final int APPROVAL_RESULT = 3;

    private MessageType() {
    }

    /** 是否为会话可承载的消息体类型（会话消息禁止使用 {@link #SYSTEM}）。 */
    public static boolean isChatBody(int messageType) {
        return messageType == CHAT_TEXT
                || messageType == FILE_TRANSFER
                || messageType == APPROVAL_RESULT;
    }
}
