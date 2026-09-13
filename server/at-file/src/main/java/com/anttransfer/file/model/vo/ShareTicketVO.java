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

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 一次性下载 / 预览票据视图对象。
 *
 * <p>票据 = 访客通过校验链后的<b>短期取件凭证</b>：不解密文件、不携带提取码，
 * 仅绑定「哪个链接的哪个文件、允许哪种访问」，且 GETDEL 取用即焚。</p>
 *
 * @author AntTransfer CE
 */
@Data
@Builder
public class ShareTicketVO {

    /** 一次性票据（高熵随机，服务端 GETDEL 核销） */
    private String ticket;

    /** 票据对应的外发链接令牌 */
    private String shareToken;

    /** 访问类型：download / preview */
    private String accessType;

    /** 票据到期时间（短 TTL，仅覆盖「校验 → 取件」间隔） */
    private LocalDateTime expireAt;

    /** 票据剩余有效秒数（便于前端展示倒计时） */
    private Long ttlSeconds;

    /**
     * 该链接剩余可下载次数（换票时的快照值，便于访客侧提示）。
     *
     * <p>真正扣减发生在核销取件时（{@code ShareAccessService#redeem}），故此处是<b>预检快照</b>；
     * 并发下以核销结果为准（可能提示还有 1 次但核销时已被他人取走）。</p>
     */
    private Integer remainingCount;
}
