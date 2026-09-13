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

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 创建外发分享请求。
 *
 * <p>三要素（PRD US-03）：<b>文件</b> + <b>提取码</b> + <b>有效期 / 次数</b>。
 * {@code downloadLimit} 与 {@code expireAt} 可省略，取配置默认值（10 次 / 7 天）。</p>
 *
 * <p>提取码 <b>只进不出</b>：请求携带明文，服务端立即 BCrypt 散列入库，任何接口均不回显。</p>
 *
 * @author AntTransfer CE
 */
@Data
public class CreateShareRequest {

    /** 被分享文件 ID（须存在、未删除、归属于当前用户） */
    @NotNull(message = "文件 ID 不能为空")
    private Long fileId;

    /**
     * 提取码（明文，仅用于本次散列）。
     *
     * <p>长度下限由配置 {@code anttransfer.file.share.extract-code-min-length}（默认 6）二次校验，
     * 此处只做防御性上限。</p>
     */
    @NotBlank(message = "提取码不能为空")
    @Size(max = 32, message = "提取码长度不能超过 32 位")
    private String extractCode;

    /** 下载次数上限；为空取默认 10，超出配置硬上限（默认 1000）以 2005 拒绝 */
    private Integer downloadLimit;

    /** 链接到期时间；为空取默认「创建后 7 天」，超出配置硬上限（默认 30 天）以 2005 拒绝 */
    private LocalDateTime expireAt;
}
