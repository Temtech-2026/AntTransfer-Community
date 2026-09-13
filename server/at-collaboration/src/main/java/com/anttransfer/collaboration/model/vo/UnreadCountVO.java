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

/**
 * 未读三口径快照——同时用于 WebSocket {@code CONNECTED} / {@code UNREAD} 帧与
 * {@code GET /v1/notifications/unread} 接口。
 *
 * <p><b>为什么是一个聚合而不是三个接口：</b>红点、待办、会话角标在 UI 上同屏出现，
 * 分三次请求会出现「红点已变、待办未变」的撕裂瞬间；一次返回保证同屏数字来自同一时刻。
 * 三个数各有明确口径（见 {@code NotifyMessageMapper}），互不重叠：</p>
 * <ul>
 *     <li>{@code inbox} —— 系统通知未读（导航栏红点，<b>不含</b>会话消息）；</li>
 *     <li>{@code todo} —— 待我审批 / 审批结果 / 传输完成 的未办数（待办中心角标）；</li>
 *     <li>{@code chat} —— 单聊 + 群聊未读合计（聊天入口角标）。</li>
 * </ul>
 *
 * @param inbox 系统通知未读数（红点）
 * @param todo  待办未办数
 * @param chat  会话未读数
 * @author AntTransfer CE
 */
public record UnreadCountVO(long inbox, long todo, long chat) {
}
