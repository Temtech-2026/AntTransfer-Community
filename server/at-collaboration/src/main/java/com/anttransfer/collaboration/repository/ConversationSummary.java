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
 * 会话列表的聚合投影（{@code NotifyMessageMapper.selectConversationSummaries} 的返回载体）。
 *
 * <p><b>为什么单独建一个类而不是让 Mapper 直接返回 {@code ConversationVO}：</b>
 * 聚合 SQL 只能一次问出「有哪些会话、每个会话最后一条的 ID、各有多少未读」，
 * 而对外视图还需要最后一条的<b>正文 / 发送人 / 时间</b>（要按 ID 回查明细行）
 * 与单聊对端的<b>昵称</b>（要经 {@code UserLookupPort} 反查）。两者不是同一次查询的产物，
 * 硬合成一个类会让「哪些字段是 SQL 给的、哪些是补的」失去边界，
 * 因此这里只承载 SQL 直接产出的四列，组装留给 {@code ChatService}。</p>
 *
 * <p>放在 {@code repository} 包而非 {@code model.vo}：它是 DAO 层的内部投影，
 * 不参与对外契约；对外契约是 {@code ConversationVO}。</p>
 *
 * <p>用 setter 而非 record 作为映射目标是有意的——MyBatis 的「构造器自动映射」
 * 需要列顺序与构造参数顺序严格一致（且受 {@code argNameBasedConstructorAutoMapping} 影响），
 * 属隐式约定；setter 映射是 MyBatis 最稳定的默认行为，
 * 后续增删列不会因顺序变化而静默串位。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class ConversationSummary {

    /** 会话范围：1-单聊 2-群聊（对齐 {@code ChatScope}） */
    private Integer chatScope;

    /** 会话目标（接收人视角）：单聊=对端用户 ID；群聊=群组 ID */
    private Long chatTargetId;

    /** 该会话最后一条消息的 ID（同时作为列表的排序键） */
    private Long lastMessageId;

    /** 该会话下我的未读条数（已读行不计入） */
    private Long unreadCount;
}
