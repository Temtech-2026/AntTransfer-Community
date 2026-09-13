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
package com.anttransfer.permission.model.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 创建角色入参。
 *
 * <p>对应 {@code POST /api/v1/roles}（需 {@code system:role:create}）。</p>
 *
 * @param code      角色编码（唯一，大写字母数字下划线；内置角色编码由脚本固化，此处仅自建角色用）
 * @param name      角色名称
 * @param dataScope 数据范围：1-本人 2-本部门及以下 3-全部
 * @param remark    备注（可空）
 * @author AntTransfer CE
 */
public record RoleCreateDTO(

        @NotBlank(message = "角色编码不能为空")
        @Size(max = 64, message = "角色编码不超过 64 字符")
        @Pattern(regexp = "^[A-Z][A-Z0-9_]{1,63}$",
                message = "角色编码须以大写字母开头，仅含大写字母/数字/下划线")
        String code,

        @NotBlank(message = "角色名称不能为空")
        @Size(max = 64, message = "角色名称不超过 64 字符")
        String name,

        @NotNull(message = "数据范围不能为空")
        @Min(value = 1, message = "数据范围取值 1-3")
        @Max(value = 3, message = "数据范围取值 1-3")
        Integer dataScope,

        @Size(max = 255, message = "备注不超过 255 字符")
        String remark) {
}
