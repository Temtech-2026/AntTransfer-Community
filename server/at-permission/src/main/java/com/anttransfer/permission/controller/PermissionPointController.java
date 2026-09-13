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
package com.anttransfer.permission.controller;

import com.anttransfer.common.permission.RequiresPerm;
import com.anttransfer.common.result.Result;
import com.anttransfer.permission.constant.SystemAdminConstants;
import com.anttransfer.permission.model.vo.PermissionPointVO;
import com.anttransfer.permission.service.RoleAdminService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 系统管理面 · 权限点目录端点（只读）。
 *
 * <p>权限点是迁移脚本写入的全量枚举，CE 不提供 CRUD；本端点只返回可勾选的权限点树。
 * 角色列表页与角色授权弹窗都需要它，故「角色查看」或「角色授权」任一权限点即放行。</p>
 *
 * @author AntTransfer CE
 */
@RestController
@RequestMapping("/v1/permission-points")
public class PermissionPointController {

    private final RoleAdminService roleAdminService;

    public PermissionPointController(RoleAdminService roleAdminService) {
        this.roleAdminService = roleAdminService;
    }

    /** 权限点全树（按 parent_id / sort_no 组织）。 */
    @GetMapping
    @RequiresPerm(value = {SystemAdminConstants.PERM_ROLE_LIST,
            SystemAdminConstants.PERM_ROLE_ASSIGN_PERM}, any = true)
    public Result<List<PermissionPointVO>> tree() {
        return Result.ok(roleAdminService.permissionPointTree());
    }
}
