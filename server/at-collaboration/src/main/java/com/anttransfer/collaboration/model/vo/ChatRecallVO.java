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
 * 会话消息撤回帧载荷（WebSocket {@code CHAT_RECALL}）。
 *
 * <p><b>为什么撤回要单独一帧，而不是重推一次 {@code CHAT}：</b>撤回改变的是「已存在的那条消息」
 * 的状态，而 {@code CHAT} 帧的语义是「来了一条新消息」——重推会让客户端把它当成新消息插进列表
 * （或者依赖去重逻辑碰巧覆盖掉），未读数、会话摘要、排序都会被多算一次。
 * 撤回复用了不产生新消息，帧语义必须与之一致。</p>
 *
 * <p><b>定位用 {@code clientMsgId} 而不是消息行 id：</b>写扩散下同一条消息在每个参与人那里
 * 是不同的行（id 各不相同），只有幂等键是全局一致的；客户端本地也只有幂等键可以拿来匹配
 * （见 {@code services/chat/messages#messageKey}）。{@code chatScope + chatTargetId}
 * 是<b>本接收人视角</b>的会话定位，服务端按行逐条下发，客户端直接与当前打开的会话比对。</p>
 *
 * <p><b>本帧是加速通道</b>：撤回是已落库的事实（{@code recall_status = 1}），
 * 丢了只表现为「刷新 / 重新拉历史后才看到已撤回」，客户端不需要为它写补偿逻辑。</p>
 *
 * @param clientMsgId  被撤回消息的幂等键（客户端消息 ID）
 * @param senderUserId 撤回者（= 原消息发送人）用户 ID
 * @param chatScope    会话范围：1-单聊 2-群聊
 * @param chatTargetId 本接收人视角的会话目标（单聊=撤回者；群聊=群 ID）
 * @param recallTime   撤回时间
 * @author AntTransfer CE
 * @implNote ID 字段以字符串过线，理由见 {@code UserVO}——本 VO 只走 WebSocket，
 * 但客户端要与本地字符串形式的会话键比对，漏标会让 {@code chatTargetId} 被舍入后匹配不上。
 */
public record ChatRecallVO(
        String clientMsgId,
        @JsonSerialize(using = ToStringSerializer.class)
        Long senderUserId,
        Integer chatScope,
        @JsonSerialize(using = ToStringSerializer.class)
        Long chatTargetId,
        LocalDateTime recallTime) {
}
