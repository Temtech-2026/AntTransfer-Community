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

/**
 * 输入状态帧（{@code TYPING}）的载荷：<b>对端正在（或不再）输入</b>。
 *
 * <p><b>{@code chatTargetId} 是「接收人视角」的会话目标</b>——单聊即输入者本人的用户 ID。
 * 这与 {@link ChatReadReceiptVO} 同一口径（那边是「发送人视角」），原因也一样：前端要拿它
 * 与<b>自己当前打开的会话</b>比对（{@code (chatScope, chatTargetId)}），
 * 而不是与数据库里那行的原始指向比对。输入者是 A、接收者是 B 时，B 的会话窗口是
 * {@code (1, A)}，因此这里给 B 发的是 A 的 ID。</p>
 *
 * <p><b>为什么载荷里没有「谁在输入」的名字：</b>单聊里对端唯一，「正在输入」这句话的主语
 * 无需传输（前端直接显示「对方正在输入…」）。群聊需要「张三正在输入…」，
 * 那要额外带上输入者的展示名与多人聚合策略——属独立设计，本帧暂不承载
 * （群聊入口直接拒绝，见 {@code ChatService#notifyTyping}）。</p>
 *
 * <p><b>瞬时信号，不落库、不补推、不做离线补偿：</b>丢了只表现为「少显示一次输入提示」，
 * 下一次续订帧（客户端每 3s 续一次输入态）就会补上；接收端另有空闲兜底自动收起。
 * 因此它既不进未读、也不属于「消息」，客户端不应（也不需要）为它写重试逻辑。</p>
 *
 * @param chatScope    会话范围：1-单聊（当前仅单聊承载本帧）
 * @param chatTargetId 会话目标（<b>接收人视角</b>）：单聊=输入者的用户 ID
 * @param typing       {@code true} 开始/继续输入；{@code false} 停止输入（发完消息或空闲超时）
 * @author AntTransfer CE
 */
public record ChatTypingVO(
        Integer chatScope,
        @JsonSerialize(using = ToStringSerializer.class)
        Long chatTargetId,
        boolean typing) {
}
