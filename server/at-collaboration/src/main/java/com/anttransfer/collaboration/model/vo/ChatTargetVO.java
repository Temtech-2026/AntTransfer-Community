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
 * 会话目标视图（「发起会话」时把登录账号解析成可用的对端用户）。
 *
 * <p><b>为什么需要它：</b>发送 / 历史 / 已读都以 {@code (chatScope, targetId)} 为前提，
 * 而 {@code targetId} 在单聊里是 19 位雪花用户 ID——人既记不住也拿不到：
 * 用户目录端点（{@code /api/v1/system/users}）挂在系统管理面的 {@code system:user:list} 上，
 * 只有管理员可用。若不给「账号 → 会话目标」这一步，非管理员的「发起会话」就只剩
 * 「输入一个自己无从得知的 ID」这条死路。</p>
 *
 * <p><b>只回最小字段：</b>对端展示名（昵称为空时由 {@code UserLookupPort} 回落登录账号，
 * 恒非空）、头像地址与目标 ID。不回邮箱、权限、部门、账号状态等任何额外画像——
 * 本端点要回答的只是「你要发给谁」，不是「这个人的档案」。</p>
 *
 * <p><b>为什么可以把展示名与头像给非管理员：</b>会话列表（{@code GET /v1/chat/conversations}）
 * 本就把单聊对端的展示名与头像交给调用者（{@code targetName} / {@code targetAvatarUrl}），
 * 本视图不扩大可见面；且解析要求<b>精确提供对方登录账号</b>，不具备目录枚举能力。</p>
 *
 * @param targetId    会话目标：对端用户 ID（字符串过线，理由见 {@code ConversationVO}）
 * @param displayName 对端展示名（昵称，为空时回落登录账号）
 * @param avatarUrl   对端头像<b>对外地址</b>（可为 null=对端没设过头像；含 {@code ?v=}，
 *                    消费方不得再拼接。接口语义同 {@code UserLookupPort.UserContact#avatarUrl()}）
 * @author AntTransfer CE
 * @implNote ID 字段必须以字符串过线：雪花 ID 超出 JS 安全整数范围，
 * 漏标 {@code ToStringSerializer} 即「解析成功但发消息报目标不存在」的直接根因
 * （前端舍入后再回传，后端自然查无此人）。
 */
public record ChatTargetVO(
        @JsonSerialize(using = ToStringSerializer.class)
        Long targetId,
        String displayName,
        String avatarUrl) {
}
