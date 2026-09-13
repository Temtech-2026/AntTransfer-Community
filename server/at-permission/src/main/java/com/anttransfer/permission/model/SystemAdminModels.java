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
package com.anttransfer.permission.model;

/**
 * 系统管理面（用户 / 角色）内部模型：Mapper 返回行，不对外暴露。
 *
 * @author AntTransfer CE
 */
public final class SystemAdminModels {

    private SystemAdminModels() {
    }

    /**
     * 用户-角色扁平行（{@code sys_user_role join sys_role}）。
     *
     * <p>列表页批量取角色的载体：一页至多 100 个用户，逐个查角色是典型的 N+1，
     * 故按 {@code user_id in (...)} 一次取回后在内存分组。</p>
     *
     * @param userId   用户 ID
     * @param roleId   角色 ID
     * @param roleCode 角色编码
     */
    public record UserRoleRow(Long userId, Long roleId, String roleCode) {
    }
}
