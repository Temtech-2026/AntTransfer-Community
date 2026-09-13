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
package com.anttransfer.collaboration.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 发送会话消息入参（单聊 / 群聊共用）。
 *
 * <p><b>{@code scope + targetId} 是路由键</b>：{@code scope=1} 时 {@code targetId} 是<b>对端用户 ID</b>，
 * {@code scope=2} 时是<b>群组 ID</b>。两者共用一个字段而不是拆成 {@code toUserId}/{@code groupId}，
 * 是为了让「按 target 路由」这件事在一处收敛——拆成两个字段必然出现「两个都传 / 都不传」的非法组合，
 * 而单字段 + {@code scope} 天然只有一种解释（语义见 {@code ChatScope}）。</p>
 *
 * <p><b>{@code clientMsgId} 为什么必填：</b>它是 HTTP 重试与移动端弱网重发场景下的幂等键。
 * 客户端每次「新建」消息生成一个（如 UUID），重发时沿用同一个——
 * 服务端据此识别「这是同一条消息」，不重复落库、不重复推送。
 * 若允许为空则退化为「重试即刷屏」，且在弱网下极难复现定位。</p>
 *
 * <p>长度上限此处取 {@code sys_notify_message.content} 的列宽 1000：这是<b>物理上界</b>，
 * 与配置无关；{@code notify.content-max-length} 只允许在其之下继续收紧
 * （服务端按配置再校验一次，超出返回 2005）。</p>
 *
 * @param scope       会话范围：1-单聊 2-群聊（见 {@code ChatScope}）
 * @param targetId    会话目标：单聊=对端用户 ID；群聊=群组 ID
 * @param messageType 消息体类型：1-文本 2-文件传输 3-审批结果（见 {@code MessageType}，禁止 0）
 * @param content     消息正文（纯文本；文件传输 / 审批结果类消息此处为展示文案）
 * @param clientMsgId 客户端消息 ID（幂等键，同一消息重发须沿用同一个值）
 * @author AntTransfer CE
 */
public record ChatSendDTO(
        @NotNull(message = "会话范围不能为空") Integer scope,
        @NotNull(message = "会话目标不能为空") Long targetId,
        @NotNull(message = "消息类型不能为空") Integer messageType,
        @NotBlank(message = "消息内容不能为空")
        @Size(max = 1000, message = "消息内容过长") String content,
        @NotBlank(message = "客户端消息 ID 不能为空")
        @Size(max = 64, message = "客户端消息 ID 过长") String clientMsgId) {
}
