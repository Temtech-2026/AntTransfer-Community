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
 * 标签创建 / 更新请求。
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
public class TagRequest {

    /** 标签名（同一用户下唯一）。 */
    @NotBlank(message = "标签名不能为空")
    @Size(max = 32, message = "标签名长度不能超过 32")
    private String name;

    /** 展示色（十六进制，如 {@code #4C8DFF}）。 */
    @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "颜色须为 #RRGGBB 格式")
    private String color;
}
