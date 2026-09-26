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
package com.anttransfer.collaboration.model.vo;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

import java.time.LocalDateTime;

/**
 * 会话列表项视图（聊天页左侧栏一行）。
 *
 * <p><b>为什么需要这个端点：</b>写扩散（见 {@code NotifyMessage} 类注）让「某会话的历史」
 * 退化成单表等值查询，但代价是<b>「我有哪些会话」无法从任一单点推出</b>——
 * 收件箱分页（{@code pageInbox}）按产品口径排除了会话消息（{@code notify_type not in (6,7)}），
 * 离线补拉只覆盖纯提醒类。若不提供本视图，前端只能靠「用户点过谁」在本地拼会话列表，
 * 刷新即残缺、也永远列不出「别人给我发过但我没回过」的会话。</p>
 *
 * <p><b>targetName 的口径（重要）：</b>单聊回落为对端展示名（经 {@code UserLookupPort} 反查，
 * 查不到时为 {@code null} → 前端回落「用户 #id」）；群聊<b>恒为 null</b>——
 * 群名属 {@code sys_group}，该表族由 at-collaboration 接管的收口动作仍挂在
 * architecture.md D-11，当前不越界取数，前端按「群聊 #id」渲染。
 * 这是「宁可少显示一个名字，也不越过表族边界」的取舍。</p>
 *
 * <p>不返回 {@code recipientUserId}：它恒等于调用者本人（查询维度），吐出去只会诱导前端
 * 误用为「会话 ID」。会话的唯一标识是 {@code (chatScope, targetId)} 二元组。</p>
 *
 * @param chatScope        会话范围：1-单聊 2-群聊
 * @param targetId         会话目标（接收人视角）：单聊=对端用户 ID；群聊=群组 ID
 * @param targetName       会话名：单聊=对端展示名（可能为 null）；群聊恒为 null
 * @param targetAvatarUrl  会话头像：单聊=对端头像<b>对外地址</b>（可能为 null=对端没设过头像）；
 *                         群聊<b>恒为 null</b>——口径与 {@code targetName} 逐字一致：群名都还没取，
 *                         更谈不上群头像，前端一律用会话名首字符画兜底圆
 * @param lastMessageId    最后一条消息 ID（前端据此去重实时帧 / 作翻页游标）
 * @param lastContent      最后一条消息正文（列表摘要，前端自行截断）
 * @param lastMessageType  最后一条消息体类型（见 {@code MessageType}，前端据此渲染「[文件]」等摘要）
 * @param lastSenderUserId 最后一条消息的发送人（保留原值，前端如需展示发送人身份可用）
 * @param lastMessageMine  最后一条消息是否我发的（前端据此渲染「我：」前缀）
 * @param lastTime         最后一条消息时间
 * @param unreadCount      该会话未读数（0 表示无未读，前端不渲染角标）
 * @author AntTransfer CE
 * @implNote ID 字段以字符串过线，理由见 {@code UserVO}；此处漏标即「点已有会话发消息报
 * 目标用户不存在」的直接根因——targetId 被前端舍入后再回传，后端自然查无此人。
 */
public record ConversationVO(
        Integer chatScope,
        @JsonSerialize(using = ToStringSerializer.class)
        Long targetId,
        String targetName,
        String targetAvatarUrl,
        @JsonSerialize(using = ToStringSerializer.class)
        Long lastMessageId,
        String lastContent,
        Integer lastMessageType,
        @JsonSerialize(using = ToStringSerializer.class)
        Long lastSenderUserId,
        boolean lastMessageMine,
        LocalDateTime lastTime,
        long unreadCount) {
}
