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

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

/**
 * 复制请求：把文件复制到目标目录（物理内容复用同一 {@code sys_file} 行，仅新增引用）。
 *
 * <p>{@code name} 为空时服务端自动消歧（追加「副本 / 副本(2)」后缀），
 * 因此与「重命名 / 移动」不同，复制不因同名而失败。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class CopyRequest {

    /** 目标父目录 ID，0 表示根目录。 */
    @NotNull(message = "目标目录不能为空")
    private Long targetFolderId;

    /** 目标名称，为空则自动消歧。 */
    @Size(max = 255, message = "名称长度不能超过 255")
    @Pattern(regexp = "[^/\\\\:*?\"<>|]*", message = "名称包含非法字符")
    private String name;
}
