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
package com.anttransfer.permission.service;

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.permission.MybatisPlusTestSupport;
import com.anttransfer.permission.constant.SystemAdminConstants;
import com.anttransfer.permission.model.PermissionModels.AccessSnapshot;
import com.anttransfer.permission.model.dto.RoleCreateDTO;
import com.anttransfer.permission.model.dto.RoleUpdateDTO;
import com.anttransfer.permission.model.entity.SysPermission;
import com.anttransfer.permission.model.entity.SysRole;
import com.anttransfer.permission.model.entity.SysRolePermission;
import com.anttransfer.permission.model.vo.PermissionPointVO;
import com.anttransfer.permission.model.vo.RoleVO;
import com.anttransfer.permission.repository.PermissionPointMapper;
import com.anttransfer.permission.repository.RoleAdminMapper;
import com.anttransfer.permission.repository.RolePermissionMapper;
import com.anttransfer.permission.repository.UserRoleMapper;
import com.anttransfer.permission.security.AuthzTestSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link RoleAdminService} 单测：四条红线（内置角色保护 / AUDITOR 锁定 / 防提权 / 防自锁）
 * 与授权替换的三分类、缓存广播失效。
 *
 * <p>全部依赖 Mockito 替换，用 {@link AuthzTestSupport} 注入「当前操作者」——
 * 红线的判定同时依赖「操作者是谁」与「操作者能看多大范围」，两者都必须在测试里可控，
 * 否则只能测出「抛了异常」而测不出「是否按预期的那一条红线抛的」。</p>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RoleAdminServiceTest {

    private static final Long OPERATOR_ID = 7L;
    private static final Long ROLE_ID = 9L;

    @Mock
    private RoleAdminMapper roleMapper;
    @Mock
    private RolePermissionMapper rolePermissionMapper;
    @Mock
    private UserRoleMapper userRoleMapper;
    @Mock
    private PermissionPointMapper permissionPointMapper;
    @Mock
    private PermissionService permissionService;
    @Mock
    private PermissionAuditLogger auditLogger;

    private RoleAdminService service;

    @BeforeEach
    void setUp() {
        MybatisPlusTestSupport.initTableInfo();
        service = new RoleAdminService(roleMapper, rolePermissionMapper, userRoleMapper,
                permissionPointMapper, permissionService, auditLogger);
        AuthzTestSupport.loginAs(OPERATOR_ID);
    }

    @AfterEach
    void tearDown() {
        AuthzTestSupport.clear();
    }

    /* ===================== 红线①：内置角色不可删 ===================== */

    @Test
    @DisplayName("删除内置角色 -> 1020 BUILT_IN_ROLE_PROTECTED，且不落任何删除语句")
    void deleteRole_shouldRejectBuiltInRole() {
        when(roleMapper.selectById(ROLE_ID)).thenReturn(role(ROLE_ID, SystemAdminConstants.ROLE_AUDITOR, 3, 1));

        assertCode(ErrorCode.BUILT_IN_ROLE_PROTECTED, () -> service.deleteRole(ROLE_ID));

        verify(roleMapper, never()).deleteById(any());
    }

    @Test
    @DisplayName("删除仍被用户占用的角色 -> 1022 ROLE_IN_USE（先解除分配）")
    void deleteRole_shouldRejectRoleStillAssigned() {
        when(roleMapper.selectById(ROLE_ID)).thenReturn(role(ROLE_ID, "CUSTOM", 2, SysRole.NOT_BUILT_IN));
        when(userRoleMapper.countByRoleId(ROLE_ID)).thenReturn(3L);

        assertCode(ErrorCode.ROLE_IN_USE, () -> service.deleteRole(ROLE_ID));

        verify(roleMapper, never()).deleteById(any());
    }

    @Test
    @DisplayName("删除未被占用的自建角色 -> 逻辑删除并广播失效")
    void deleteRole_shouldSoftDeleteWhenUnused() {
        when(roleMapper.selectById(ROLE_ID)).thenReturn(role(ROLE_ID, "CUSTOM", 2, SysRole.NOT_BUILT_IN));
        when(userRoleMapper.countByRoleId(ROLE_ID)).thenReturn(0L);
        when(userRoleMapper.selectUserIdsByRoleId(ROLE_ID)).thenReturn(List.of(31L, 32L));

        service.deleteRole(ROLE_ID);

        verify(roleMapper).deleteById(ROLE_ID);
        verify(permissionService).invalidate(31L);
        verify(permissionService).invalidate(32L);
    }

    @Test
    @DisplayName("角色不存在 -> 1018 ROLE_NOT_FOUND")
    void deleteRole_shouldRejectUnknownRole() {
        when(roleMapper.selectById(ROLE_ID)).thenReturn(null);

        assertCode(ErrorCode.ROLE_NOT_FOUND, () -> service.deleteRole(ROLE_ID));
    }

    /* ===================== 红线②：AUDITOR 权限锁定只读 ===================== */

    @Test
    @DisplayName("变更 AUDITOR 权限集 -> 1021，且在触碰任何权限表之前就拒绝")
    void assignPermissions_shouldLockAuditorRole() {
        when(roleMapper.selectById(ROLE_ID)).thenReturn(role(ROLE_ID, SystemAdminConstants.ROLE_AUDITOR, 3, 1));

        assertCode(ErrorCode.AUDITOR_PERM_LOCKED,
                () -> service.assignPermissions(ROLE_ID, List.of(1L)));

        verify(permissionPointMapper, never()).selectBatchIds(any());
        verify(rolePermissionMapper, never()).insert(any(SysRolePermission.class));
    }

    /* ===================== 红线③：防提权 ===================== */

    @Test
    @DisplayName("数据范围非全部时，不能把角色数据范围改到超过自身 -> 1027")
    void createRole_shouldRejectDataScopeBeyondOwn() {
        when(roleMapper.countByCodeAnyState("CUSTOM", null)).thenReturn(0);
        when(permissionService.current()).thenReturn(snapshot(AccessControlService.SCOPE_DEPT));

        RoleCreateDTO dto = new RoleCreateDTO("CUSTOM", "自定义角色", AccessControlService.SCOPE_ALL, null);

        assertCode(ErrorCode.PRIVILEGE_ESCALATION, () -> service.createRole(dto));

        verify(roleMapper, never()).insert(any(SysRole.class));
    }

    @Test
    @DisplayName("数据范围非全部时，不能授予自身不具备的权限点 -> 1027")
    void assignPermissions_shouldRejectGrantingPermsNotOwned() {
        when(roleMapper.selectById(ROLE_ID)).thenReturn(role(ROLE_ID, "CUSTOM", 2, SysRole.NOT_BUILT_IN));
        when(permissionPointMapper.selectBatchIds(any()))
                .thenReturn(List.of(perm(1L, "system:user:create")));
        when(permissionService.current())
                .thenReturn(snapshot(AccessControlService.SCOPE_DEPT, List.of("system:user:list")));

        assertCode(ErrorCode.PRIVILEGE_ESCALATION,
                () -> service.assignPermissions(ROLE_ID, List.of(1L)));

        verify(rolePermissionMapper, never()).insert(any(SysRolePermission.class));
    }

    @Test
    @DisplayName("内置角色的数据范围不可变更 -> 1020（即使操作者是超管）")
    void updateRole_shouldRejectBuiltInDataScopeChange() {
        when(roleMapper.selectById(ROLE_ID)).thenReturn(role(ROLE_ID, SystemAdminConstants.ROLE_DEPT_ADMIN, 2, 1));

        RoleUpdateDTO dto = new RoleUpdateDTO("部门管理员", AccessControlService.SCOPE_ALL, null);

        assertCode(ErrorCode.BUILT_IN_ROLE_PROTECTED, () -> service.updateRole(ROLE_ID, dto));

        verify(roleMapper, never()).updateById(any(SysRole.class));
    }

    /* ===================== 红线④：防自锁 ===================== */

    @Test
    @DisplayName("从 SUPER_ADMIN 移除必需的挂管理能力 -> 1028（移除后不可逆）")
    void assignPermissions_shouldRejectRemovingSuperAdminControlPerms() {
        when(roleMapper.selectById(ROLE_ID)).thenReturn(role(ROLE_ID, SystemAdminConstants.ROLE_SUPER_ADMIN, 3, 1));
        // 只授一个非必需权限点：必需集合（assign-perm / user:list / user:assign-role）全丢
        when(permissionPointMapper.selectBatchIds(any())).thenReturn(List.of(perm(1L, "system:role:list")));
        when(permissionService.current()).thenReturn(snapshot(AccessControlService.SCOPE_ALL));

        assertCode(ErrorCode.ADMIN_SELF_LOCKOUT,
                () -> service.assignPermissions(ROLE_ID, List.of(1L)));

        verify(rolePermissionMapper, never()).insert(any(SysRolePermission.class));
    }

    @Test
    @DisplayName("SUPER_ADMIN 保留必需管理能力时正常落库")
    void assignPermissions_shouldAllowSuperAdminKeepingControlPerms() {
        when(roleMapper.selectById(ROLE_ID)).thenReturn(role(ROLE_ID, SystemAdminConstants.ROLE_SUPER_ADMIN, 3, 1));
        List<SysPermission> perms = SystemAdminConstants.SUPER_ADMIN_REQUIRED_PERMS.stream()
                .map(code -> perm((long) code.hashCode(), code))
                .toList();
        when(permissionPointMapper.selectBatchIds(any())).thenReturn(perms);
        when(permissionService.current()).thenReturn(snapshot(AccessControlService.SCOPE_ALL));

        service.assignPermissions(ROLE_ID,
                perms.stream().map(SysPermission::getId).toList());

        verify(rolePermissionMapper, times(perms.size())).insert(any(SysRolePermission.class));
    }

    /* ===================== 替换语义与缓存广播 ===================== */

    @Test
    @DisplayName("授权替换走「复活 / 停用 / 新增」三分类，绝不删旧插新")
    void assignPermissions_shouldClassifyRestoreDeactivateAndInsert() {
        when(roleMapper.selectById(ROLE_ID)).thenReturn(role(ROLE_ID, "CUSTOM", 2, SysRole.NOT_BUILT_IN));
        when(permissionPointMapper.selectBatchIds(any()))
                .thenReturn(List.of(perm(2L, "system:role:list"), perm(3L, "system:role:create")));
        when(permissionService.current()).thenReturn(snapshot(AccessControlService.SCOPE_ALL));
        when(rolePermissionMapper.selectAllByRoleIdIncludingDeleted(ROLE_ID)).thenReturn(List.of(
                link(101L, 2L, 1),   // 命中且曾被删 -> 复活
                link(102L, 1L, 0))); // 未命中且生效 -> 停用

        service.assignPermissions(ROLE_ID, List.of(2L, 3L));

        verify(rolePermissionMapper).markRestored(101L, OPERATOR_ID);
        verify(rolePermissionMapper).markDeleted(102L, OPERATOR_ID);

        ArgumentCaptor<SysRolePermission> inserted = ArgumentCaptor.forClass(SysRolePermission.class);
        verify(rolePermissionMapper).insert(inserted.capture());
        assertThat(inserted.getValue().getRoleId()).isEqualTo(ROLE_ID);
        assertThat(inserted.getValue().getPermissionId()).isEqualTo(3L);
        assertThat(inserted.getValue().getCreateBy()).isEqualTo(OPERATOR_ID);
    }

    @Test
    @DisplayName("存在无效权限点 ID -> 1026，且不产生任何变更")
    void assignPermissions_shouldRejectUnknownPermissionIds() {
        when(roleMapper.selectById(ROLE_ID)).thenReturn(role(ROLE_ID, "CUSTOM", 2, SysRole.NOT_BUILT_IN));
        when(permissionPointMapper.selectBatchIds(any())).thenReturn(List.of(perm(1L, "system:role:list")));

        assertCode(ErrorCode.PERMISSION_NOT_FOUND,
                () -> service.assignPermissions(ROLE_ID, List.of(1L, 2L)));

        verify(rolePermissionMapper, never()).markDeleted(any(), any());
        verify(rolePermissionMapper, never()).insert(any(SysRolePermission.class));
    }

    @Test
    @DisplayName("授权变更后按「角色 -> 持有者」广播失效权限缓存")
    void assignPermissions_shouldInvalidateAllRoleHolders() {
        when(roleMapper.selectById(ROLE_ID)).thenReturn(role(ROLE_ID, "CUSTOM", 2, SysRole.NOT_BUILT_IN));
        when(permissionPointMapper.selectBatchIds(any())).thenReturn(List.of());
        when(permissionService.current()).thenReturn(snapshot(AccessControlService.SCOPE_ALL));
        when(userRoleMapper.selectUserIdsByRoleId(ROLE_ID)).thenReturn(List.of(41L, 42L));

        service.assignPermissions(ROLE_ID, List.of());

        verify(permissionService).invalidate(41L);
        verify(permissionService).invalidate(42L);
    }

    /* ===================== 其它 ===================== */

    @Test
    @DisplayName("角色编码重复 -> 1019 ROLE_CODE_CONFLICT")
    void createRole_shouldRejectDuplicateCode() {
        when(roleMapper.countByCodeAnyState("DUP", null)).thenReturn(1);

        RoleCreateDTO dto = new RoleCreateDTO("DUP", "重复角色", AccessControlService.SCOPE_DEPT, null);

        assertCode(ErrorCode.ROLE_CODE_CONFLICT, () -> service.createRole(dto));
        verify(roleMapper, never()).insert(any(SysRole.class));
    }

    @Test
    @DisplayName("建号角色恒为非内置：无法通过接口伪造内置角色")
    void createRole_shouldForceNonBuiltIn() {
        when(roleMapper.countByCodeAnyState("CUSTOM", null)).thenReturn(0);
        when(permissionService.current()).thenReturn(snapshot(AccessControlService.SCOPE_ALL));

        RoleCreateDTO dto = new RoleCreateDTO("CUSTOM", "自定义角色", AccessControlService.SCOPE_DEPT, "备注");
        RoleVO created = service.createRole(dto);

        ArgumentCaptor<SysRole> saved = ArgumentCaptor.forClass(SysRole.class);
        verify(roleMapper).insert(saved.capture());
        assertThat(saved.getValue().getBuiltIn()).isEqualTo(SysRole.NOT_BUILT_IN);
        assertThat(saved.getValue().getCreateBy()).isEqualTo(OPERATOR_ID);
        assertThat(created.code()).isEqualTo("CUSTOM");
    }

    @Test
    @DisplayName("AUDITOR 的权限锁定标记随详情下发（前端不硬编码角色码）")
    void getRole_shouldExposeAuditorLockedFlag() {
        when(roleMapper.selectById(ROLE_ID)).thenReturn(role(ROLE_ID, SystemAdminConstants.ROLE_AUDITOR, 3, 1));

        assertThat(service.getRole(ROLE_ID).auditorLocked()).isTrue();
    }

    @Test
    @DisplayName("权限点树按 parentId 组装父子层级")
    void permissionPointTree_shouldNestChildrenUnderParent() {
        SysPermission root = perm(1L, "system");
        root.setParentId(0L);
        SysPermission child = perm(2L, SystemAdminConstants.PERM_USER_LIST);
        child.setParentId(1L);
        when(permissionPointMapper.selectList(any())).thenReturn(List.of(root, child));

        List<PermissionPointVO> tree = service.permissionPointTree();

        assertThat(tree).hasSize(1);
        assertThat(tree.get(0).id()).isEqualTo(1L);
        assertThat(tree.get(0).children()).extracting(PermissionPointVO::id).containsExactly(2L);
    }

    /* ===================== 夹具 ===================== */

    private static void assertCode(ErrorCode expected, Runnable action) {
        BusinessException ex = assertThrows(BusinessException.class, action::run);
        assertThat(ex.getCode()).isEqualTo(expected.getCode());
    }

    private static SysRole role(Long id, String code, int dataScope, int builtIn) {
        SysRole role = new SysRole();
        role.setId(id);
        role.setCode(code);
        role.setName(code);
        role.setDataScope(dataScope);
        role.setBuiltIn(builtIn);
        return role;
    }

    private static SysPermission perm(Long id, String code) {
        SysPermission permission = new SysPermission();
        permission.setId(id);
        permission.setPermCode(code);
        permission.setPermName(code);
        return permission;
    }

    private static SysRolePermission link(Long id, Long permissionId, int deleted) {
        SysRolePermission row = new SysRolePermission();
        row.setId(id);
        row.setRoleId(ROLE_ID);
        row.setPermissionId(permissionId);
        row.setDeleted(deleted);
        return row;
    }

    /** 数据范围「全部」+ 拥有全部权限点的操作者快照。 */
    private static AccessSnapshot snapshot(int dataScope) {
        return snapshot(dataScope, List.of());
    }

    private static AccessSnapshot snapshot(int dataScope, List<String> permCodes) {
        return new AccessSnapshot(OPERATOR_ID, List.of(SystemAdminConstants.ROLE_SUPER_ADMIN),
                permCodes, List.of(), dataScope);
    }
}
