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
import lombok.Data;

/**
 * 票据核销后的取件载荷（交给下载 / 预览链路继续处理）。
 *
 * <p><b>刻意不返回存储路径 / 对象键</b>：访客是免登录调用方，
 * 暴露后端存储位置等于给出绕过票据直连存储的可能。字节流的读取由服务端
 * 凭 fileId 自行解析存储后端（详见 {@code ShareAccessService#redeem}）。</p>
 *
 * <p>链接 ID / 文件 ID 为 19 位雪花 ID，须以字符串过线（理由见 {@link FileNodeVO}）。</p>
 *
 * @author AntTransfer CE
 */
@Data
@Builder
public class SharePayloadVO {

    /** 外发链接 ID（审计归属） */
    @JsonSerialize(using = ToStringSerializer.class)
    private Long shareId;

    /** 文件 ID */
    @JsonSerialize(using = ToStringSerializer.class)
    private Long fileId;

    /** 原始文件名（Content-Disposition 用） */
    private String fileName;

    /** 文件字节数（Content-Length / Range 用） */
    private Long sizeBytes;

    /** 文件 SHA-256（完整性校验用） */
    private String sha256;

    /** MIME 类型 */
    private String contentType;

    /** 本次访问类型：download / preview */
    private String accessType;

    /**
     * 核销后换发的取件票：前端据此拼 {@code /v1/shares/{token}/content?ticket=...} 取字节。
     *
     * <p>与换票阶段的一次性票据是<b>两张不同的票</b>：一次性票已在本方法内 {@code GETDEL} 焚毁
     * （不可重放，红队 [V-05]），本票只覆盖「把这一次取件读完」，TTL 内可重复使用，
     * 以支撑 {@code Range} 断点续传与浏览器重试（详见 {@code RedisKeyConstants#SHARE_PICK_PREFIX}）。</p>
     */
    private String contentTicket;

    /** 取件票剩余有效期（秒），与 {@code ShareProperties#ticketTtl} 同源 */
    private Long expiresInSeconds;
}
