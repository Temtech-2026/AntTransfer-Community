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
}
