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
 * 会话范围常量（与 {@code sys_notify_message.chat_scope} 一一对应）。
 *
 * <p>会话消息的路由键：单聊按 <b>对端 userId</b> 路由，群聊按 <b>groupId</b> 路由，
 * 两者共用 {@code chat_target_id} 列，由本常量区分语义——群聊发送前必须校验
 * {@code sys_group_member} 成员关系（非成员拒收），单聊需校验对端用户存在。</p>
 *
 * @author AntTransfer CE
 */
public final class ChatScope {

    /** 单聊：{@code chat_target_id} = 对端用户 ID（会话双方各存一条，互为收发人） */
    public static final int PRIVATE = 1;

    /** 群聊：{@code chat_target_id} = 群组 ID（逻辑关联 {@code sys_group}） */
    public static final int GROUP = 2;

    private ChatScope() {
    }

    /** 是否合法会话范围。 */
    public static boolean isValid(int scope) {
        return scope == PRIVATE || scope == GROUP;
    }

    /** 是否群聊。 */
    public static boolean isGroup(int scope) {
        return scope == GROUP;
    }
}
