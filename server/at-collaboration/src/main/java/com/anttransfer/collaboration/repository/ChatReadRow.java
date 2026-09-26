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
package com.anttransfer.collaboration.repository;

import lombok.Getter;
import lombok.Setter;

/**
 * 一条「消息 × 读者」事实的投影（{@code NotifyMessageMapper} 的已读回执类查询载体）。
 *
 * <p><b>为什么两类查询共用一个投影：</b>它们问的是同一件事的两个时态——
 * ① {@code selectReadReceipts} 取<b>已读</b>的行（{@code read_status = 1}），用于「历史里哪几条被谁读过」；
 * ② {@code selectSessionUnreadRows} 取<b>将被置读</b>的行（{@code read_status = 0}），
 * 用于置读后把「刚被读了哪些条」推给发送人。
 * 两边的行结构完全一致（会话消息一行 = 一个读者视角的一条消息），
 * 故共用同一个投影，避免为「同一个概念的两个时态」立两个几乎一样的类。</p>
 *
 * <p>写扩散下，「已读」这件事只存在一处：<b>收件人那一行</b>的 {@code read_status}。
 * 本投影不引入任何新的存储，只是把那一行里回执需要的列挑出来。</p>
 *
 * <p>放在 {@code repository} 包而非 {@code model.vo}：它是 DAO 层的内部投影，不参与对外契约；
 * 对外契约是 {@code ChatReaderVO} / {@code ChatReadReceiptVO}。</p>
 *
 * <p>与 {@link ConversationSummary} 同理，用 setter 而非 record 作为映射目标：
 * MyBatis 的构造器自动映射要求列顺序与参数顺序严格一致，属隐式约定；
 * setter 映射（列名 alias 成驼峰）是 MyBatis 最稳定的默认行为。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class ChatReadRow {

    /** 发送人用户 ID（② 用于按发送人分组推送回执；① 恒为查询人自己） */
    private Long senderUserId;

    /** 会话范围：1-单聊 2-群聊（对齐 {@code ChatScope}） */
    private Integer chatScope;

    /**
     * 该行所属的会话目标（<b>该行接收人视角</b>）：单聊=对端用户 ID；群聊=群组 ID。
     *
     * <p>② 取回的是「我作为接收人」的视角（单聊=发送人、群聊=群 ID），
     * 推给发送人前须换算成发送人视角（单聊=读者自己），换算见 {@code NotifyMessageService}。</p>
     */
    private Long chatTargetId;

    /** 客户端消息 ID——同一条逻辑消息的所有扩散行共享同一个值，回执按它归并到具体气泡 */
    private String clientMsgId;

    /** 读者用户 ID（① 取镜像行的 {@code recipient_user_id}；② 恒为查询人自己） */
    private Long readerUserId;
}
