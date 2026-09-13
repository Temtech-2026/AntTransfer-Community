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

import jakarta.validation.constraints.Pattern;
import lombok.Data;

/**
 * 访客换取一次性票据请求（免登录）。
 *
 * @author AntTransfer CE
 */
@Data
public class VerifyShareRequest {

    /**
     * 提取码。
     *
     * <p>库中 {@code extract_code_hash} 为 NOT NULL（PRD US-03 要求必须设置提取码），
     * 故此处按「必填」处理；校验失败按 4010 计数，连续达阈值转 4011 锁定。</p>
     */
    private String extractCode;

    /** 访问类型：download=下载 / preview=在线预览（默认 download） */
    @Pattern(regexp = "download|preview", message = "访问类型仅支持 download 或 preview")
    private String accessType;
}
