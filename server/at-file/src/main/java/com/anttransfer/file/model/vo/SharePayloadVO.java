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

/**
 * 票据核销后的取件载荷（交给下载 / 预览链路继续处理）。
 *
 * <p><b>刻意不返回存储路径 / 对象键</b>：访客是免登录调用方，
 * 暴露后端存储位置等于给出绕过票据直连存储的可能。字节流的读取由服务端
 * 凭 fileId 自行解析存储后端（详见 {@code ShareAccessService#redeem}）。</p>
 *
 * @author AntTransfer CE
 */
@Data
@Builder
public class SharePayloadVO {

    /** 外发链接 ID（审计归属） */
    private Long shareId;

    /** 文件 ID */
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
}
