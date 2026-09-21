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

import com.anttransfer.collaboration.model.entity.NotifyMessage;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

import java.time.LocalDateTime;

/**
 * 站内 / 会话消息出参视图——REST 列表与 WebSocket {@code NOTIFY} / {@code CHAT} 帧共用。
 *
 * <p><b>为什么不直接序列化实体：</b>实体继承了 {@code BaseEntity}，
 * 带 {@code tenantId / createBy / updateBy / deleted} 等内部字段；直接吐出去等于把
 * 存储细节固化进对外契约，日后改表结构就会破坏接口。VO 是「契约与存储之间的防火墙」。</p>
 *
 * <p>同一份 VO 复用于 HTTP 与 WS，前端只需写一套解析逻辑（帧内 {@code data} 字段与
 * 列表元素同构），这是「上下行信封一致」之外的又一处减负。</p>
 *
 * @param id              消息 ID
 * @param recipientUserId 接收人用户 ID
 * @param senderUserId    发送人用户 ID（系统通知为 null）
 * @param notifyType      通知类型（见 {@code NotifyType}）
 * @param messageType     消息体类型（见 {@code MessageType}）
 * @param chatScope       会话范围（1-单聊 2-群聊；系统通知为 null）
 * @param chatTargetId    会话目标 ID（单聊=对端用户 ID；群聊=群组 ID）
 * @param clientMsgId     客户端消息 ID（会话幂等键，系统通知为 null）
 * @param title           标题
 * @param content         正文
 * @param bizType         关联业务类型
 * @param bizId           关联业务 ID
 * @param readStatus      阅读状态：0-未读 1-已读
 * @param readTime        阅读时间
 * @param createTime      创建时间
 * @author AntTransfer CE
 * @implNote ID 字段以字符串过线，理由见 {@code UserVO}；本 VO 同时供 HTTP 与 WS 帧使用，
 * 漏标会让实时下发的 {@code chatTargetId} 被前端舍入，回传时即触发「目标用户不存在或不可用」。
 */
public record NotifyMessageVO(
        @JsonSerialize(using = ToStringSerializer.class)
        Long id,
        @JsonSerialize(using = ToStringSerializer.class)
        Long recipientUserId,
        @JsonSerialize(using = ToStringSerializer.class)
        Long senderUserId,
        Integer notifyType,
        Integer messageType,
        Integer chatScope,
        @JsonSerialize(using = ToStringSerializer.class)
        Long chatTargetId,
        String clientMsgId,
        String title,
        String content,
        String bizType,
        @JsonSerialize(using = ToStringSerializer.class)
        Long bizId,
        Integer readStatus,
        LocalDateTime readTime,
        LocalDateTime createTime) {

    /** 由实体转换（忽略内部审计字段）。 */
    public static NotifyMessageVO from(NotifyMessage message) {
        if (message == null) {
            return null;
        }
        return new NotifyMessageVO(
                message.getId(),
                message.getRecipientUserId(),
                message.getSenderUserId(),
                message.getNotifyType(),
                message.getMessageType(),
                message.getChatScope(),
                message.getChatTargetId(),
                message.getClientMsgId(),
                message.getTitle(),
                message.getContent(),
                message.getBizType(),
                message.getBizId(),
                message.getReadStatus(),
                message.getReadTime(),
                message.getCreateTime());
    }
}
