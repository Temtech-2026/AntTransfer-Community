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

import com.anttransfer.common.result.Result;
import com.anttransfer.permission.model.PermissionModels.AccessSnapshot;
import com.anttransfer.permission.model.PermissionModels.PermissionView;
import com.anttransfer.permission.service.PermissionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 权限端点。
 *
 * @author AntTransfer CE
 */
@RestController
@RequestMapping("/v1/permission")
public class PermissionController {

    private final PermissionService permissionService;

    public PermissionController(PermissionService permissionService) {
        this.permissionService = permissionService;
    }

    /**
     * 当前用户权限视图：角色编码 + perm_code 并集 + 数据范围。
     * 前端据此做路由守卫 / 按钮显隐（与后端 perm_code 一一对应，Phase 5）。
     */
    @GetMapping("/my")
    public Result<PermissionView> myPermissions() {
        AccessSnapshot snapshot = permissionService.current();
        return Result.ok(new PermissionView(
                snapshot.roles(), snapshot.permCodes(), snapshot.dataScope()));
    }
}
