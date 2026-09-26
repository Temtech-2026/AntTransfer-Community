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
 * 在线状态视图：<b>某个用户此刻的在线状态</b>。
 *
 * <p>HTTP 读取（{@code POST /v1/chat/presence/watch}）与 WebSocket 推送（{@code PRESENCE} 帧）
 * 共用同一个形状：前者的 {@code userId} 恒等于请求里的 {@code targetId}，
 * 后者的 {@code userId} 是「状态发生变化的那个用户」——前端拿它与自己正在看的会话对端比对，
 * 与 {@code CHAT_READ} 帧「先比对会话、再改 UI」的口径一致。</p>
 *
 * <p><b>{@code lastActiveAt} 是「最近一次心跳时刻」而不是「最后在线时刻」：</b>离线时它返回
 * {@code null}（记录已随心跳超时过期，具体何时下线无从得知）——离线用户不展示
 * 「最后在线时间」，避免把一个「心跳过期时刻」冒充成用户真实下线时刻（那会差最多 90s）。</p>
 *
 * @param userId       状态所属用户 ID（19 位雪花 ID，以字符串下发避免 JS 精度丢失）
 * @param status       三态：{@link ChatPresenceStatus}
 * @param lastActiveAt 最近活跃时刻（epoch millis）；离线为 {@code null}
 * @author AntTransfer CE
 */
public record ChatPresenceVO(
        @JsonSerialize(using = ToStringSerializer.class)
        Long userId,
        ChatPresenceStatus status,
        Long lastActiveAt) {
}
