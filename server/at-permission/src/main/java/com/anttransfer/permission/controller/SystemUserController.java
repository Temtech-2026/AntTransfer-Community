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
import com.anttransfer.permission.model.dto.UserCreateDTO;
import com.anttransfer.permission.model.dto.UserResetPasswordDTO;
import com.anttransfer.permission.model.dto.UserRoleAssignDTO;
import com.anttransfer.permission.model.dto.UserStatusDTO;
import com.anttransfer.permission.model.dto.UserUpdateDTO;
import com.anttransfer.permission.model.vo.DeptOptionVO;
import com.anttransfer.permission.model.vo.RoleVO;
import com.anttransfer.permission.model.vo.UserVO;
import com.anttransfer.permission.service.UserAdminService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 系统管理面 · 用户管理端点（use-case-flows §4 系统管理）。
 *
 * <p><b>为什么前缀是 {@code /v1/system/users} 而不是 {@code /v1/users}：</b>
 * {@code /v1/users} 在 api/README.md 的前缀表中归属 at-auth（自助资料 / 账号域），
 * 而这里是 at-permission 承载的「管理员别人」的系统管理面——两者受众、权限点、
 * 数据范围收敛都不同。用独立前缀避免「同一个 URL 两处实现」的路由歧义。</p>
 *
 * <p>每个动作一个独立权限点（列表 / 建号 / 编辑 / 重置口令 / 启停 / 分配角色 / 删除），
 * 使「只读管理员」「能改但不能删」这类最小权限组合可以纯靠授权表达；
 * 数据范围（能看/能管到哪些部门）由服务层 {@code AccessControlService} 收敛，
 * 注解只表达功能权限（详见 {@link RequiresPerm} 的语义说明）。</p>
 *
 * @author AntTransfer CE
 */
@RestController
@RequestMapping("/v1/system/users")
public class SystemUserController {

    private final UserAdminService userAdminService;

    public SystemUserController(UserAdminService userAdminService) {
        this.userAdminService = userAdminService;
    }

    /** 用户分页（按操作者数据范围收敛）。 */
    @GetMapping
    @RequiresPerm(SystemAdminConstants.PERM_USER_LIST)
    public Result<PageResult<UserVO>> page(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) Long deptId,
            @RequestParam(defaultValue = "1") long current,
            @RequestParam(defaultValue = "20") long pageSize) {
        return Result.ok(userAdminService.pageUsers(keyword, status, deptId, current, pageSize));
    }

    /** 用户详情。 */
    @GetMapping("/{id}")
    @RequiresPerm(SystemAdminConstants.PERM_USER_LIST)
    public Result<UserVO> detail(@PathVariable Long id) {
        return Result.ok(userAdminService.getUser(id));
    }

    /** 部门下拉（列表过滤与调岗目标共用；建号 / 编辑场景也需要，故任一权限点即可）。 */
    @GetMapping("/dept-options")
    @RequiresPerm(value = {SystemAdminConstants.PERM_USER_LIST,
            SystemAdminConstants.PERM_USER_CREATE,
            SystemAdminConstants.PERM_USER_UPDATE}, any = true)
    public Result<List<DeptOptionVO>> deptOptions() {
        return Result.ok(userAdminService.listDeptOptions());
    }

    /** 角色下拉（分配角色选单）。 */
    @GetMapping("/role-options")
    @RequiresPerm(SystemAdminConstants.PERM_USER_ASSIGN_ROLE)
    public Result<List<RoleVO>> roleOptions() {
        return Result.ok(userAdminService.listRoleOptions());
    }

    /** 建号（可选同时分配初始角色）。 */
    @PostMapping
    @RequiresPerm(SystemAdminConstants.PERM_USER_CREATE)
    public Result<UserVO> create(@Valid @RequestBody UserCreateDTO dto) {
        return Result.ok(userAdminService.createUser(dto));
    }

    /** 编辑资料；提交的部门与原值不同即视为调岗，触发权限重评估。 */
    @PutMapping("/{id}")
    @RequiresPerm(SystemAdminConstants.PERM_USER_UPDATE)
    public Result<UserVO> update(@PathVariable Long id, @Valid @RequestBody UserUpdateDTO dto) {
        return Result.ok(userAdminService.updateUser(id, dto));
    }

    /** 启用 / 停用（停用即离职，回收审批类授权并吊销在途会话）。 */
    @PatchMapping("/{id}/status")
    @RequiresPerm(SystemAdminConstants.PERM_USER_STATUS)
    public Result<Void> changeStatus(@PathVariable Long id, @Valid @RequestBody UserStatusDTO dto) {
        userAdminService.changeStatus(id, dto);
        return Result.ok();
    }

    /** 管理员重置用户口令（禁止对自己调用）。 */
    @PostMapping("/{id}/reset-password")
    @RequiresPerm(SystemAdminConstants.PERM_USER_RESET_PASSWORD)
    public Result<Void> resetPassword(@PathVariable Long id,
                                      @Valid @RequestBody UserResetPasswordDTO dto) {
        userAdminService.resetPassword(id, dto);
        return Result.ok();
    }

    /** 分配用户角色（整集替换；禁止对自己操作）。 */
    @PutMapping("/{id}/roles")
    @RequiresPerm(SystemAdminConstants.PERM_USER_ASSIGN_ROLE)
    public Result<Void> assignRoles(@PathVariable Long id, @Valid @RequestBody UserRoleAssignDTO dto) {
        userAdminService.assignRoles(id, dto.roleIds());
        return Result.ok();
    }

    /** 删除用户（逻辑删除；受保护账号与最后一个超管不可删）。 */
    @DeleteMapping("/{id}")
    @RequiresPerm(SystemAdminConstants.PERM_USER_DELETE)
    public Result<Void> delete(@PathVariable Long id) {
        userAdminService.deleteUser(id);
        return Result.ok();
    }
}
