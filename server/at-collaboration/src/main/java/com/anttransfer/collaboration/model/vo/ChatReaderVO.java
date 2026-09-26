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
 * 一位读者（会话消息气泡下方那个小头像的数据）。
 *
 * <p><b>为什么要回展示名而不是只回 ID：</b>前端要在气泡下画头像，而头像需要「首字符」——
 * 单聊里对方的名字前端本来就知道，但<b>群聊里的读者是任意群成员</b>，而群成员名单没有对外的
 * 只读端点（{@code /api/v1/system/users} 挂在系统管理面权限上，普通用户取不到）。
 * 让服务端在回执里带上展示名，是「非管理员也能看到谁读了」的唯一可行路径。</p>
 *
 * <p><b>为什么同时回展示名与头像地址（两个都要）：</b>头像用真实图片，但「没设过头像」
 * 是常态，此时前端要能用展示名首字符画兜底圆——只回头像地址，空地址就是一个空圆；
 * 只回展示名，设过头像的人也显示不出来。两者都由 {@code UserLookupPort} 一次反查给出，
 * 不额外增加查询。</p>
 *
 * <p><b>为什么不回已读时间：</b>本项目的置读是<b>整会话批量翻转</b>
 * （{@code markSessionRead}：进入会话即把该会话未读一次清空），
 * 于是同一读者的 {@code read_time} 是「他进入会话的那一刻」，而不是「他逐条读到这条的时刻」——
 * 把它标在每条气泡下会精确地误导。真需要「谁、何时读到了哪」时，应按
 * {@code read_time} 重新设计语义（例如读游标），而不是把批量时间冒充逐条时间。</p>
 *
 * @param userId      读者用户 ID（字符串过线，理由见 {@code ChatTargetVO}）
 * @param displayName 读者展示名（昵称为空时回落登录账号，恒非空）
 * @param avatarUrl   读者头像<b>对外地址</b>（可为 null=没设过头像；含 {@code ?v=}，
 *                    消费方不得再拼接）
 * @author AntTransfer CE
 */
public record ChatReaderVO(
        @JsonSerialize(using = ToStringSerializer.class)
        Long userId,
        String displayName,
        String avatarUrl) {
}
