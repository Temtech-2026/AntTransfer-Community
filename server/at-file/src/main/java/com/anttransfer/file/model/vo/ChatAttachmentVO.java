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
package com.anttransfer.file.model.vo;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

/**
 * 会话附件授权视图（发送方与接收方共用）。
 *
 * <p>下发给前端的 ID <b>必须逐字段标 {@link ToStringSerializer}</b> 才是字符串：19 位雪花 ID
 * 超出 JS 安全整数范围，按 JSON number 下发后浏览器 {@code JSON.parse} 会静默丢末位。
 * 本站<b>没有</b>全局 {@code Long → String} 配置（{@code application.yml} 只设了
 * {@code write-dates-as-timestamps}），不存在「自动生效」——{@link #id} 曾漏标而以 number
 * 下发，被取整的值又写进消息正文 {@code #att:{id}}，导致发送方与接收方回查详情都报
 * 「会话附件不存在或已失效」（4024）。</p>
 *
 * <p>{@link #remaining} 是<b>派生值</b>而非库中列：它把「不限次」与「还剩 N 次」折叠成
 * 一个前端可直接渲染的语义（{@code null}=不限次），避免每个调用点各自解释
 * {@code downloadLimit == 0} 这个哨兵值。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Builder
public class ChatAttachmentVO {

    /** 授权 ID（消息正文 {@code #att:{id}} 尾注即此值） */
    @JsonSerialize(using = ToStringSerializer.class)
    private final Long id;

    /** 文件条目 ID */
    @JsonSerialize(using = ToStringSerializer.class)
    private final Long nodeId;

    /** 发送方用户 ID */
    @JsonSerialize(using = ToStringSerializer.class)
    private final Long senderUserId;

    /** 接收方用户 ID（单聊对端） */
    @JsonSerialize(using = ToStringSerializer.class)
    private final Long receiverUserId;

    /** 发送时文件名快照 */
    private final String fileName;

    /** 发送时文件大小快照（字节） */
    private final Long sizeBytes;

    /** 用途档位：1-仅预览 2-可下载 3-可转发转存 */
    private final Integer usageMode;

    /** 授权过期时间（{@code null}=不限期） */
    private final LocalDateTime expireAt;

    /** 下载次数上限（0=不限） */
    private final Integer downloadLimit;

    /** 已下载次数 */
    private final Integer downloadCount;

    /**
     * 剩余可下载次数（派生）：{@code null}=不限次；0=已用尽。
     *
     * <p>「已用尽」与「已失效」不同：前者还能失败得明白，后者连行都不该再被取件。</p>
     */
    private final Integer remaining;

    /** 状态：0-生效 1-已撤销 2-已失效（过期 / 达上限） */
    private final Integer status;

    /** 创建时间 */
    private final LocalDateTime createTime;
}
