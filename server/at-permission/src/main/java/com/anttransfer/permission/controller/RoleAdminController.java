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
import com.anttransfer.common.result.PageResult;
import com.anttransfer.common.result.Result;
import com.anttransfer.permission.constant.SystemAdminConstants;
import com.anttransfer.permission.model.dto.RoleCreateDTO;
import com.anttransfer.permission.model.dto.RolePermissionAssignDTO;
import com.anttransfer.permission.model.dto.RoleUpdateDTO;
import com.anttransfer.permission.model.vo.RoleVO;
import com.anttransfer.permission.service.RoleAdminService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 系统管理面 · 角色管理端点（use-case-flows §4）。
 *
 * <p>“角色管理”与“角色授权”刻意拆成两个权限点（{@code system:role:update} 对
 * {@code system:role:assign-perm}）：改名可以放开给运营，改权限集必须收紧给安全管理员。</p>
 *
 * @author AntTransfer CE
 */
@RestController
@RequestMapping("/v1/roles")
public class RoleAdminController {

    private final RoleAdminService roleAdminService;

    public RoleAdminController(RoleAdminService roleAdminService) {
        this.roleAdminService = roleAdminService;
    }

    /** 角色分页。 */
    @GetMapping
    @RequiresPerm(SystemAdminConstants.PERM_ROLE_LIST)
    public Result<PageResult<RoleVO>> page(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") long current,
            @RequestParam(defaultValue = "20") long pageSize) {
        return Result.ok(roleAdminService.pageRoles(keyword, current, pageSize));
    }

    /**
     * 全部角色下拉：角色列表页与「用户分配角色」选单共用，任一权限点即可。
     */
    @GetMapping("/options")
    @RequiresPerm(value = {SystemAdminConstants.PERM_ROLE_LIST,
            SystemAdminConstants.PERM_USER_ASSIGN_ROLE}, any = true)
    public Result<List<RoleVO>> options() {
        return Result.ok(roleAdminService.listRoleOptions());
    }

    /** 角色详情。 */
    @GetMapping("/{id}")
    @RequiresPerm(SystemAdminConstants.PERM_ROLE_LIST)
    public Result<RoleVO> detail(@PathVariable Long id) {
        return Result.ok(roleAdminService.getRole(id));
    }

    /** 创建角色。 */
    @PostMapping
    @RequiresPerm(SystemAdminConstants.PERM_ROLE_CREATE)
    public Result<RoleVO> create(@Valid @RequestBody RoleCreateDTO dto) {
        return Result.ok(roleAdminService.createRole(dto));
    }

    /** 编辑角色（内置角色编码与数据范围受保护）。 */
    @PutMapping("/{id}")
    @RequiresPerm(SystemAdminConstants.PERM_ROLE_UPDATE)
    public Result<RoleVO> update(@PathVariable Long id, @Valid @RequestBody RoleUpdateDTO dto) {
        return Result.ok(roleAdminService.updateRole(id, dto));
    }

    /** 删除角色（内置角色受保护，在用角色需先解除分配）。 */
    @DeleteMapping("/{id}")
    @RequiresPerm(SystemAdminConstants.PERM_ROLE_DELETE)
    public Result<Void> delete(@PathVariable Long id) {
        roleAdminService.deleteRole(id);
        return Result.ok();
    }

    /** 角色已生效的权限点 ID 集合（授权弹窗回显）。 */
    @GetMapping("/{id}/permissions")
    @RequiresPerm(SystemAdminConstants.PERM_ROLE_LIST)
    public Result<List<String>> permissions(@PathVariable Long id) {
        // ID 一律以字符串下发：19 位雪花 ID 超出 JS Number.MAX_SAFE_INTEGER；
        // 本响应是裸 List<Long>、不经 VO，故在控制器边界显式转字符串，
        // 与 PermissionPointVO.id（字符串）保持同一值空间，否则授权弹窗勾选态会丢。
        return Result.ok(roleAdminService.listPermissionIds(id).stream()
                .map(String::valueOf)
                .toList());
    }

    /** 分配角色权限点（整集替换；AUDITOR 锁定只读、防提权、防自锁）。 */
    @PutMapping("/{id}/permissions")
    @RequiresPerm(SystemAdminConstants.PERM_ROLE_ASSIGN_PERM)
    public Result<Void> assignPermissions(@PathVariable Long id,
                                          @Valid @RequestBody RolePermissionAssignDTO dto) {
        roleAdminService.assignPermissions(id, dto.permissionIds());
        return Result.ok();
    }
}
