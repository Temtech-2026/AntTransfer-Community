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

import java.util.List;

/**
 * 已读回执帧（{@code CHAT_READ}）的载荷：<b>某位读者把「我发的这一批消息」读了</b>。
 *
 * <p>推送方向是「读者 → 发送人」：读者进入会话触发整会话置读，服务端把被翻转的镜像行
 * 按发送人归并，给每位发送人推一帧，前端据此在对应气泡下补上读者头像。</p>
 *
 * <p><b>{@code chatTargetId} 是「发送人视角」的会话目标</b>——单聊回读者的用户 ID、
 * 群聊回群 ID。不能直接照抄数据库里的 {@code chat_target_id}：那是<b>接收人（读者）视角</b>的
 * 定位（单聊的镜像行 target 指向发送人自己，见 {@code V5} 注释 c），
 * 直接下发给发送人会让前端匹配不到自己的会话窗口。</p>
 *
 * <p><b>为什么用 {@code clientMsgIds} 而不是消息 ID：</b>① 乐观发送下前端在服务端 ID 落地前
 * 就已经把气泡画出来了，只有 {@code clientMsgId} 是两侧都稳定的锚点；
 * ② 同一逻辑消息的扩散行各有各的 ID，用行 ID 反而要前端再折算一次。</p>
 *
 * <p><b>本帧是加速通道而非真值：</b>推送丢失/被裁剪不会造成状态错乱——发送人下次拉会话历史
 * （{@code GET /v1/chat/messages}）时，回执照样由 {@code read_status} 派生出来。
 * 因此帧内条数可裁剪（见 {@code NotifyMessageService}），也不必补偿重发。</p>
 *
 * @param chatScope    会话范围：1-单聊 2-群聊
 * @param chatTargetId 会话目标（<b>发送人视角</b>）：单聊=读者用户 ID；群聊=群 ID
 * @param reader       读者
 * @param clientMsgIds 本次被该读者读掉的、发送人自己发的消息（客户端消息 ID）
 * @author AntTransfer CE
 */
public record ChatReadReceiptVO(
        Integer chatScope,
        @JsonSerialize(using = ToStringSerializer.class)
        Long chatTargetId,
        ChatReaderVO reader,
        List<String> clientMsgIds) {
}
