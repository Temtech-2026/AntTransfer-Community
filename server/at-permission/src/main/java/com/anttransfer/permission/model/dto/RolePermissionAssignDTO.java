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

import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * 角色授权入参（整集替换语义）。
 *
 * <p>对应 {@code PUT /api/v1/roles/{id}/permissions}（需 {@code system:role:assign-perm}）。
 * 传空列表表示清空该角色全部权限点——语义明确，避免「null 表示不变」这种
 * 会让前端勾选框清空后无法提交的歧义。</p>
 *
 * @param permissionIds 目标权限点 ID 全集（不得为 null；空列表 = 清空）
 * @author AntTransfer CE
 */
public record RolePermissionAssignDTO(

        @NotNull(message = "权限点集合不能为 null（清空请传空数组）")
        List<Long> permissionIds) {
}
