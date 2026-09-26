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
 * 用户资料变更载荷（{@code PROFILE} 帧，见 {@code WsProtocol#TYPE_PROFILE}）。
 *
 * <p><b>它不是会话消息，故不复用 {@code NotifyMessageVO}：</b>后者到达客户端会被当作
 * 「新消息」处理——插进消息流、未读 +1、重算会话摘要。而本帧只回答一句话：
 * 「这个人的画像变了，请刷新」。两者混用会让「换个头像」在会话列表里凭空多出一条未读。</p>
 *
 * <p><b>为什么带上 {@code avatarUrl} 而不是只发「变了」：</b>帧里的地址就是本次提交后的
 * 最终值，客户端可直接换图；只发通知会逼着每个在线端为一个纯展示字段再发一次请求，
 * 还会引入「拉取期间又发生新变更」的多余往返。</p>
 *
 * @param userId    资料变更的用户 ID（字符串过线，理由见 {@code ChatTargetVO}：
 *                  雪花 ID 超出 JS 安全整数范围，走 number 会被前端舍入成另一个人）
 * @param avatarUrl 变更后的头像<b>对外地址</b>（可为 null=该用户当前没有头像；
 *                  已含 {@code ?v=}，消费方不得再拼接）
 * @author AntTransfer CE
 */
public record ChatProfileVO(
        @JsonSerialize(using = ToStringSerializer.class)
        Long userId,
        String avatarUrl) {
}
