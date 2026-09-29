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
 * 会话对端备注的操作结果（设置 / 取消后回吐当前状态）。
 *
 * <p>调用方拿到它就知道了「这次操作的最终结果」，无需再查一次：
 * 设置成功即 {@code alias} 为写入值，取消成功即 {@code alias} 为 {@code null}。
 * 前端据此更新本地覆盖表，界面立刻变——不必重拉整个会话列表。</p>
 *
 * <p><b>不返回对端昵称 / 头像：</b>那些属于「用户是谁」的信息，已由会话列表
 * （{@code ConversationVO.targetName / targetAvatarUrl}）与消息载荷下发过；
 * 在这里重复一份只会多一个会过期的副本。</p>
 *
 * @param peerId 被备注的用户 ID（原样回吐，便于调用方确认这次改的是谁）
 * @param alias  当前的备注名；{@code null} 表示「现在没有备注」（取消成功，或本来就没设过）
 * @author AntTransfer CE
 * @implNote ID 字段以字符串过线，理由见 {@code UserVO}
 */
public record ChatPeerVO(
        @JsonSerialize(using = ToStringSerializer.class)
        Long peerId,
        String alias) {
}
