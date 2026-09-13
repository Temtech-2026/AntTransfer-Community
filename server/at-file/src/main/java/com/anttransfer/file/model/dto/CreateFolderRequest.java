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
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/**
 * 新建目录请求。
 *
 * <p>{@code parentId} 缺省为 0（根目录）；名称禁止包含路径分隔符与 Windows 保留字符，
 * 从入口即杜绝「文件名即路径」的目录穿越风险（存储层另有一道清洗，双重防护）。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class CreateFolderRequest {

    /** 父目录 ID，0 表示根目录。 */
    private Long parentId = 0L;

    /** 目录名称。 */
    @NotBlank(message = "目录名不能为空")
    @Size(max = 255, message = "目录名长度不能超过 255")
    @Pattern(regexp = "[^/\\\\:*?\"<>|]+", message = "目录名包含非法字符")
    private String name;

    /** 密级：0 公开 / 1 内部 / 2 保密 / 3 机密；为空则继承父目录。 */
    private Integer level;
}
