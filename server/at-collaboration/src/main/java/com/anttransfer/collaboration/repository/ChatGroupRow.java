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
 * 「我加入的群」聚合投影（{@code SysGroupMapper#selectMyGroups} 的返回载体）。
 *
 * <p><b>为什么要单独一个类而不是直接返回 {@code ChatGroupVO}：</b>
 * 成员数来自 {@code sys_group_member} 的聚合列，而群名 / 群主来自 {@code sys_group}；
 * 这仍是一次查询的产物，但它属于 DAO 层的内部投影，不参与对外契约。
 * 与 {@code ConversationSummary} 同一取舍——投影类放 {@code repository} 包，
 * 对外契约才是 {@code model.vo} 里那个。</p>
 *
 * <p>用 setter 而非 record 作为映射目标：理由见 {@code ConversationSummary} 类注
 * （构造器自动映射依赖列顺序，setter 映射是 MyBatis 最稳定的默认行为）。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class ChatGroupRow {

    /** 群组 ID（即群聊会话的 targetId） */
    private Long id;

    /** 群组名称 */
    private String name;

    /** 群主用户 ID */
    private Long ownerUserId;

    /** 成员数（含群主；已逻辑删除的成员行不计入） */
    private Long memberCount;

    /**
     * <b>我</b>在该群的消息免打扰状态：0-关闭 1-开启（取自我的成员行 {@code me}）。
     *
     * <p>与成员数共用同一次 JOIN——提醒偏好本就搭在 {@code me} 那一行上，不额外查询。</p>
     */
    private Integer muteStatus;

    /** <b>我</b>的「有人 @ 我时提醒」开关：0-关闭 1-开启（取自我的成员行）。 */
    private Integer notifyOnMention;

    /** <b>我</b>的「群主 @ 所有人时提醒」开关：0-关闭 1-开启（取自我的成员行）。 */
    private Integer notifyOnMentionAll;
}
