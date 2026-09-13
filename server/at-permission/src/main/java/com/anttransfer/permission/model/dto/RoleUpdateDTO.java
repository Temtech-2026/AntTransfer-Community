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
import jakarta.validation.constraints.Size;

/**
 * 编辑角色入参。
 *
 * <p>对应 {@code PUT /api/v1/roles/{id}}（需 {@code system:role:update}）。</p>
 *
 * <p><b>刻意不含 code：</b>角色编码可能已被下游策略 / 前端路由以字符串引用
 * （如 role-deny 黑名单配置），改名会让引用静默失效；内置角色编码更是安全锚点。</p>
 *
 * <p><b>dataScope 对内置角色只读：</b>内置角色的数据范围是安全基线
 * （DEPT_ADMIN=2 → 改成 3 等于一次性下放全公司数据），服务层会拒绝变更（1020）。</p>
 *
 * @param name      角色名称
 * @param dataScope 数据范围：1-本人 2-本部门及以下 3-全部（非内置角色可改）
 * @param remark    备注（可空）
 * @author AntTransfer CE
 */
public record RoleUpdateDTO(

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
