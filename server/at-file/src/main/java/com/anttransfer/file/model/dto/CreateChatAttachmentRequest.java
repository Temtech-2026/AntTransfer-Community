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
package com.anttransfer.file.model.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

/**
 * 创建会话附件授权请求（发送方在发出消息<b>之前</b>调用）。
 *
 * <p><b>为什么先建授权再发消息，而不是反过来：</b>授权行需要「发送方确实持有该条目」这一
 * 事实（由 {@code FileOwnershipGuard} 在本域内校验），以及文件名 / 大小的服务端快照
 * （不能信前端上报）。若把授权创建塞进发消息链路，就要么跨模块读文件域、要么把校验让渡给前端，
 * 前者违反模块铁律（见 architecture.md §1.2），后者把归属校验变成了摆设。两步式让
 * 「不可信输入（前端上报的限制参数）→ 可信事实（服务端快照 + 归属校验）」在同一次调用内完成，
 * 消息侧只转发一个已经落地的授权 ID。</p>
 *
 * <p>所有限制字段都可缺省：{@code usageMode} 缺省取
 * {@code anttransfer.file.chat-attachment.default-usage-mode}，
 * {@code expireHours} 缺省取 {@code default-expire-hours}，
 * {@code downloadLimit} 缺省为 0（不限次）。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class CreateChatAttachmentRequest {

    /** 文件条目 ID（必填）——发送方必须持有该条目，否则按「不存在」处理 */
    @NotNull(message = "文件条目 ID 不能为空")
    private Long nodeId;

    /**
     * 接收方用户 ID（必填）——本期仅单聊，即单聊对端。
     *
     * <p>刻意由前端显式传入而不是从会话推导：本域不认识「会话」这一概念，
     * 由会话侧把「这条消息要发给谁」翻译成一个用户 ID 交过来，是模块边界的正确切法。</p>
     */
    @NotNull(message = "接收方用户 ID 不能为空")
    private Long receiverUserId;

    /** 用途档位：1-仅预览 2-可下载 3-可转发转存；缺省取服务端默认值 */
    @Min(value = 1, message = "用途档位最小为 1（仅预览）")
    @Max(value = 3, message = "用途档位最大为 3（可转发转存）")
    private Integer usageMode;

    /**
     * 有效期（小时）；缺省取服务端默认值，{@code null} 与不传等价。
     *
     * <p>刻意用「小时数」而不是绝对时间：前端算出的绝对时间会受客户端时钟偏移影响，
     * 可能签出一条「出生即过期」（时钟慢）或「超长授权」（时钟快）的记录。
     * 由服务端用 {@code now()} 换算成 {@code expire_at}，时钟口径唯一。</p>
     */
    @Min(value = 1, message = "有效期至少 1 小时")
    private Integer expireHours;

    /**
     * 是否不限期（{@code true} 时忽略 {@code expireHours}）。
     *
     * <p>独立成一个布尔量而不是「传 0 表示不限期」：0 是常见的误输入值，
     * 用哨兵值表达「永不过期」会把一次笔误放大成一次永久授权。</p>
     */
    private Boolean neverExpire;

    /** 下载次数上限（0=不限）；缺省为 0 */
    @Min(value = 0, message = "下载次数上限不能为负")
    private Integer downloadLimit;

    /** 发送方消息幂等键（可选）——重发不重复建授权，建议传前端生成的 clientMsgId */
    private String clientMsgKey;
}
