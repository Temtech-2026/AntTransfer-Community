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

import java.util.List;

/**
 * RBAC 权限解析模型。
 *
 * @author AntTransfer CE
 */
public final class PermissionModels {

    private PermissionModels() {
    }

    /** 角色授权快照（mapper 返回行） */
    public record RoleGrant(String roleCode, int dataScope) {
    }

    /**
     * 用户的最终权限快照（含多角色并集结果）。
     *
     * @param permCodes       放行权限点并集（已剔除显式 Deny 项），前端据此渲染路由 / 按钮
     * @param deniedPermCodes 显式拒绝项（Deny 优先：命中即 403，即使另一角色已授予）
     * @param roles           角色编码（ROLE_* 前缀由前端自行加）
     */
    public record AccessSnapshot(Long userId, List<String> roles, List<String> permCodes,
                                 List<String> deniedPermCodes, int dataScope) {
    }

    /** 接口输出视图（GET /v1/permission/my，Phase 5 前端权限引导用） */
    public record PermissionView(List<String> roles, List<String> permCodes, int dataScope) {
    }
}
