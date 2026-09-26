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
 * 群详情面板里的一位群成员。
 *
 * <p><b>为什么回展示名：</b>同 {@link ChatReaderVO}——群成员是任意用户，
 * 而「按 ID 查人」的用户目录端点挂在 {@code system:user:list} 上，普通成员取不到。
 * 不回展示名，面板就只剩一串雪花 ID。</p>
 *
 * <p><b>为什么 {@code displayName} 可为 null（与 {@code ChatReaderVO} 的「恒非空」不同）：</b>
 * 读者恒是「当前有消息往来的人」，必为可用账号；而群成员可能离职后被禁用 / 删除，
 * 此时 {@code UserLookupPort.findContacts} 查不到（端口约定：查不到的 ID 不出现在结果 Map 中）。
 * 服务端不编造占位文案（那是展示层的事，且要按语言切换），前端按 i18n 文案回落「未知成员」。</p>
 *
 * <p><b>为什么回 {@code joinTime}：</b>面板需要给成员排序依据与「他什么时候进来的」这一事实；
 * 复用 V4 已有的列，不额外查询。</p>
 *
 * @param userId      成员用户 ID（字符串过线，理由见 {@code ChatTargetVO}）
 * @param displayName 展示名（账号已被删除 / 禁用时为 null，前端回落占位）
 * @param avatarUrl   成员头像<b>对外地址</b>（与 {@code displayName} 同源同命运：查不到该账号时
 *                    两者一起为 null；含 {@code ?v=}，消费方不得再拼接）
 * @param memberRole  群内角色：1-普通成员 2-管理员 3-只读（见 {@code GroupMember}）
 * @param owner       是否为群主（由 {@code sys_group.owner_user_id} 判定，
 *                    <b>不</b>看 {@code memberRole}——群主变更时无需同步刷成员行）
 * @param joinTime    入群时间（被移除后重新入群时刷新为本次时间）
 * @author AntTransfer CE
 */
public record ChatGroupMemberVO(
        @JsonSerialize(using = ToStringSerializer.class)
        Long userId,
        String displayName,
        String avatarUrl,
        int memberRole,
        boolean owner,
        LocalDateTime joinTime) {
}
