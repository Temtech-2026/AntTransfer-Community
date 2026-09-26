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
 * 群聊视图（建群返回 / 「我加入的群」列表项）。
 *
 * <p><b>{@code id} 即会话的 {@code targetId}：</b>建群成功后前端拿它直接以
 * {@code scope=2 + targetId=id} 进入会话，不必再查一次。因此这里的 id 必须与
 * {@code ConversationVO.targetId}（群聊分支）是同一个值域——都是 {@code sys_group.id}。</p>
 *
 * <p><b>只回最小字段：</b>群名、群主、成员数。不回成员名单（成员会变动，
 * 名单属群组管理面的详情视图）、不回描述 / 状态 / 创建时间——
 * 本视图要回答的只是「这个群叫什么、有多少人」，而不是群组档案。</p>
 *
 * <p><b>为什么 id / ownerUserId 要转字符串：</b>19 位雪花 ID 超出
 * JavaScript 安全整数范围，前端一律按字符串承接与回传（口径见 {@code ConversationVO}）。</p>
 *
 * @param id         群组 ID（即群聊会话的 targetId）
 * @param name       群聊名称
 * @param ownerUserId 群主用户 ID
 * @param memberCount 成员数（含群主）
 * @author AntTransfer CE
 */
public record ChatGroupVO(
        @JsonSerialize(using = ToStringSerializer.class)
        Long id,
        String name,
        @JsonSerialize(using = ToStringSerializer.class)
        Long ownerUserId,
        long memberCount) {
}
