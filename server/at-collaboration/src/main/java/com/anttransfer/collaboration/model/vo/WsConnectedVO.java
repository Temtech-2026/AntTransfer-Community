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
 * {@code CONNECTED} 帧载荷——连接建立时下发的第一帧，客户端据此初始化界面状态。
 *
 * <p><b>为什么把未读快照放在连接帧里：</b>客户端建连后若再单独拉一次未读数，会出现
 * 「连接成功 → 拉未读」之间的竞态窗口：窗口期到达的实时通知会被计入快照，
 * 也可能不计，客户端无法判断是否重复计数。把快照绑在连接帧上，语义变成
 * 「此刻的权威状态」，之后的实时帧一律视为<b>增量</b>，客户端只需「先以快照覆盖、
 * 再叠加增量」，无需去重逻辑。</p>
 *
 * @param userId 已鉴权用户 ID（客户端可据此校验连接归属，防止令牌串用）
 * @param unread 未读三口径快照；查询失败时为 {@code null}，客户端退化为轮询
 * @author AntTransfer CE
 */
public record WsConnectedVO(Long userId, UnreadCountVO unread) {
}
