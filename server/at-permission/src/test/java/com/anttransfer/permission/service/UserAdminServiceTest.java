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
import com.anttransfer.common.file.AvatarStoragePort;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.result.PageResult;
import com.anttransfer.common.security.UserAdminPort;
import com.anttransfer.common.security.UserAdminPort.DeptRow;
import com.anttransfer.common.security.UserAdminPort.UserQuery;
import com.anttransfer.common.security.UserAdminPort.UserRow;
import com.anttransfer.permission.MybatisPlusTestSupport;
import com.anttransfer.permission.constant.SystemAdminConstants;
import com.anttransfer.permission.model.PermissionModels.AccessSnapshot;
import com.anttransfer.permission.model.dto.UserCreateDTO;
import com.anttransfer.permission.model.dto.UserResetPasswordDTO;
import com.anttransfer.permission.model.dto.UserStatusDTO;
import com.anttransfer.permission.model.dto.UserUpdateDTO;
import com.anttransfer.permission.model.entity.SysRole;
import com.anttransfer.permission.model.entity.SysUserRole;
import com.anttransfer.permission.repository.RbacAccessMapper;
import com.anttransfer.permission.repository.RoleAdminMapper;
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
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link UserAdminService} 单测：自身操作禁止、受保护账号、防自锁、防提权，
 * 以及「调岗 / 离职触发权限重评估」这一核心副作用的可观测性。
 *
 * <p><b>为什么用 Verify 而不是 Mock：</b>调岗 / 离职的价值不在返回值，而在于
 * 「是否真的调用了 {@link PermissionGrantService#revokeApprovalGrants(Long)}」。
 * 这类跨模块副作用一旦漏调不会有任何异常，只会静默留下越权残留，
 * 所以必须用 verify 把它钉在测试里。</p>
 *
 * <p>{@link AccessControlService} 在本类中被 mock（其可见性判定由
 * {@code AccessControlServiceTest} 覆盖），本类只断言「调用时机与入参」——
 * 例如调岗时必须把目标部门交给它做范围校验。</p>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UserAdminServiceTest {

    private static final Long OPERATOR_ID = 7L;
    private static final Long TARGET_ID = 9L;
    private static final Long TARGET_DEPT_ID = 3L;
    private static final Long NEW_DEPT_ID = 5L;

    @Mock
    private UserAdminPort userAdminPort;
    @Mock
    private UserRoleMapper userRoleMapper;
    @Mock
    private RoleAdminMapper roleMapper;
    @Mock
    private RoleAdminService roleAdminService;
    @Mock
    private RbacAccessMapper rbacAccessMapper;
    @Mock
    private PermissionService permissionService;
    @Mock
    private AccessControlService accessControlService;
    @Mock
    private PermissionGrantService permissionGrantService;
    @Mock
    private PermissionAuditLogger auditLogger;
    @Mock
    private AvatarStoragePort avatarStoragePort;
    @Mock
    private ApplicationEventPublisher eventPublisher;

    private UserAdminService service;

    @BeforeEach
    void setUp() {
        MybatisPlusTestSupport.initTableInfo();
        service = new UserAdminService(userAdminPort, userRoleMapper, roleMapper, roleAdminService,
                rbacAccessMapper, permissionService, accessControlService, permissionGrantService,
                auditLogger, avatarStoragePort, eventPublisher);
        AuthzTestSupport.loginAs(OPERATOR_ID);
    }

    @AfterEach
    void tearDown() {
        AuthzTestSupport.clear();
    }

    /* ===================== 红线：不得对自己操作 ===================== */

    @Test
    @DisplayName("停用自己 -> 1023（最短的自我提权/自锁路径）")
    void changeStatus_shouldRejectSelfOperation() {
        when(permissionService.current()).thenReturn(snapshot(OPERATOR_ID, AccessControlService.SCOPE_ALL));

        assertCode(ErrorCode.SELF_OPERATION_FORBIDDEN,
                () -> service.changeStatus(OPERATOR_ID, new UserStatusDTO(UserAdminPort.STATUS_DISABLED)));

        verify(userAdminPort, never()).changeStatus(any(), eq(UserAdminPort.STATUS_DISABLED), any());
    }

    @Test
    @DisplayName("重置自己的口令 -> 1023（应走个人中心）")
    void resetPassword_shouldRejectSelfOperation() {
        when(permissionService.current()).thenReturn(snapshot(OPERATOR_ID, AccessControlService.SCOPE_ALL));

        assertCode(ErrorCode.SELF_OPERATION_FORBIDDEN,
                () -> service.resetPassword(OPERATOR_ID, new UserResetPasswordDTO("newPassword8")));

        verify(userAdminPort, never()).resetPassword(any(), any(), any());
    }

    @Test
    @DisplayName("改自己的角色 -> 1023（杜绝自查自升）")
    void assignRoles_shouldRejectSelfOperation() {
        when(permissionService.current()).thenReturn(snapshot(OPERATOR_ID, AccessControlService.SCOPE_ALL));

        assertCode(ErrorCode.SELF_OPERATION_FORBIDDEN, () -> service.assignRoles(OPERATOR_ID, List.of(2L)));

        verify(userRoleMapper, never()).insert(any(SysUserRole.class));
    }

    /* ===================== 红线：受保护账号 ===================== */

    @Test
    @DisplayName("停用受保护账号 admin -> 1024")
    void changeStatus_shouldRejectDisablingProtectedAccount() {
        when(permissionService.current()).thenReturn(snapshot(OPERATOR_ID, AccessControlService.SCOPE_ALL));
        when(userAdminPort.findById(TARGET_ID))
                .thenReturn(Optional.of(user(TARGET_ID, SystemAdminConstants.PROTECTED_USERNAME, 0, TARGET_DEPT_ID)));

        assertCode(ErrorCode.PROTECTED_ACCOUNT,
                () -> service.changeStatus(TARGET_ID, new UserStatusDTO(UserAdminPort.STATUS_DISABLED)));

        verify(userAdminPort, never()).changeStatus(any(), anyInt(), any());
    }

    @Test
    @DisplayName("删除受保护账号 admin -> 1024")
    void deleteUser_shouldRejectProtectedAccount() {
        when(permissionService.current()).thenReturn(snapshot(OPERATOR_ID, AccessControlService.SCOPE_ALL));
        when(userAdminPort.findById(TARGET_ID))
                .thenReturn(Optional.of(user(TARGET_ID, SystemAdminConstants.PROTECTED_USERNAME, 0, TARGET_DEPT_ID)));

        assertCode(ErrorCode.PROTECTED_ACCOUNT, () -> service.deleteUser(TARGET_ID));

        verify(userAdminPort, never()).softDelete(any(), any());
    }

    @Test
    @DisplayName("摘掉受保护账号的超级管理员角色 -> 1028")
    void assignRoles_shouldKeepProtectedAccountAsSuperAdmin() {
        when(permissionService.current()).thenReturn(snapshot(OPERATOR_ID, AccessControlService.SCOPE_ALL));
        when(userAdminPort.findById(TARGET_ID))
                .thenReturn(Optional.of(user(TARGET_ID, SystemAdminConstants.PROTECTED_USERNAME, 0, TARGET_DEPT_ID)));
        when(roleMapper.selectBatchIds(any()))
                .thenReturn(List.of(role(3L, SystemAdminConstants.ROLE_USER, 1, 1)));

        assertCode(ErrorCode.ADMIN_SELF_LOCKOUT, () -> service.assignRoles(TARGET_ID, List.of(3L)));

        verify(userRoleMapper, never()).insert(any(SysUserRole.class));
    }

    /* ===================== 红线：防自锁（账号维度） ===================== */

    @Test
    @DisplayName("停用系统里最后一个可用的超级管理员 -> 1028")
    void changeStatus_shouldRejectDisablingLastSuperAdmin() {
        when(permissionService.current()).thenReturn(snapshot(OPERATOR_ID, AccessControlService.SCOPE_ALL));
        when(userAdminPort.findById(TARGET_ID)).thenReturn(Optional.of(user(TARGET_ID, "alice", 0, TARGET_DEPT_ID)));
        when(roleMapper.selectOne(any())).thenReturn(role(1L, SystemAdminConstants.ROLE_SUPER_ADMIN, 3, 1));
        when(userRoleMapper.selectRoleIds(TARGET_ID)).thenReturn(List.of(1L));
        when(userRoleMapper.countEnabledUsersByRoleCode(SystemAdminConstants.ROLE_SUPER_ADMIN)).thenReturn(1L);

        assertCode(ErrorCode.ADMIN_SELF_LOCKOUT,
                () -> service.changeStatus(TARGET_ID, new UserStatusDTO(UserAdminPort.STATUS_DISABLED)));

        verify(userAdminPort, never()).changeStatus(any(), anyInt(), any());
    }

    @Test
    @DisplayName("摘除最后一个可用超管的角色 -> 1028")
    void assignRoles_shouldRejectRemovingLastSuperAdmin() {
        when(permissionService.current()).thenReturn(snapshot(OPERATOR_ID, AccessControlService.SCOPE_ALL));
        when(userAdminPort.findById(TARGET_ID)).thenReturn(Optional.of(user(TARGET_ID, "alice", 0, TARGET_DEPT_ID)));
        when(roleMapper.selectBatchIds(any()))
                .thenReturn(List.of(role(3L, SystemAdminConstants.ROLE_USER, 1, 1)));
        when(roleMapper.selectOne(any())).thenReturn(role(1L, SystemAdminConstants.ROLE_SUPER_ADMIN, 3, 1));
        when(userRoleMapper.selectRoleIds(TARGET_ID)).thenReturn(List.of(1L));
        when(userRoleMapper.countEnabledUsersByRoleCode(SystemAdminConstants.ROLE_SUPER_ADMIN)).thenReturn(1L);

        assertCode(ErrorCode.ADMIN_SELF_LOCKOUT, () -> service.assignRoles(TARGET_ID, List.of(3L)));

        verify(userRoleMapper, never()).insert(any(SysUserRole.class));
    }

    /* ===================== 红线：防提权（角色维度） ===================== */

    @Test
    @DisplayName("数据范围非全部时只能分配自己持有的角色 -> 1027")
    void assignRoles_shouldRejectAssigningRoleNotOwned() {
        when(permissionService.current()).thenReturn(
                snapshot(OPERATOR_ID, AccessControlService.SCOPE_DEPT, List.of(SystemAdminConstants.ROLE_DEPT_ADMIN)));
        when(userAdminPort.findById(TARGET_ID)).thenReturn(Optional.of(user(TARGET_ID, "alice", 0, TARGET_DEPT_ID)));
        when(roleMapper.selectBatchIds(any()))
                .thenReturn(List.of(role(1L, SystemAdminConstants.ROLE_SUPER_ADMIN, 3, 1)));

        assertCode(ErrorCode.PRIVILEGE_ESCALATION, () -> service.assignRoles(TARGET_ID, List.of(1L)));

        verify(userRoleMapper, never()).insert(any(SysUserRole.class));
    }

    /* ===================== 调岗 / 离职 -> 权限重评估 ===================== */

    @Test
    @DisplayName("调岗：改部门并回收该用户全部审批获得授权")
    void updateUser_shouldReEvaluateOnDeptChange() {
        when(permissionService.current()).thenReturn(snapshot(OPERATOR_ID, AccessControlService.SCOPE_ALL));
        when(userAdminPort.findById(TARGET_ID)).thenReturn(Optional.of(user(TARGET_ID, "alice", 0, TARGET_DEPT_ID)));
        when(userAdminPort.findDept(NEW_DEPT_ID))
                .thenReturn(Optional.of(new DeptRow(NEW_DEPT_ID, 0L, "研发中心", 1)));
        when(userAdminPort.listDeptOptions()).thenReturn(List.of(new DeptRow(NEW_DEPT_ID, 0L, "研发中心", 1)));
        when(userRoleMapper.selectRolesByUserIds(any())).thenReturn(List.of());

        service.updateUser(TARGET_ID, new UserUpdateDTO("爱丽丝", null, null, NEW_DEPT_ID, null));

        verify(userAdminPort).changeDept(TARGET_ID, NEW_DEPT_ID, OPERATOR_ID);
        verify(permissionGrantService).revokeApprovalGrants(TARGET_ID);
        // 目标部门必须交给数据范围校验：不能把人调到自己看不见的部门
        verify(accessControlService).assertResourceVisibleTo(any(), isNull(), eq(NEW_DEPT_ID));
    }

    @Test
    @DisplayName("部门未变化时不触发重评估（避免无谓回收授权）")
    void updateUser_shouldNotReEvaluateWhenDeptUnchanged() {
        when(permissionService.current()).thenReturn(snapshot(OPERATOR_ID, AccessControlService.SCOPE_ALL));
        when(userAdminPort.findById(TARGET_ID)).thenReturn(Optional.of(user(TARGET_ID, "alice", 0, TARGET_DEPT_ID)));
        when(userAdminPort.listDeptOptions()).thenReturn(List.of());
        when(userRoleMapper.selectRolesByUserIds(any())).thenReturn(List.of());

        service.updateUser(TARGET_ID, new UserUpdateDTO("爱丽丝", null, null, TARGET_DEPT_ID, null));

        verify(userAdminPort, never()).changeDept(any(), any(), any());
        verify(permissionGrantService, never()).revokeApprovalGrants(any());
    }

    @Test
    @DisplayName("停用（离职）：回收审批授权并失效权限缓存")
    void changeStatus_shouldReEvaluateOnDisable() {
        when(permissionService.current()).thenReturn(snapshot(OPERATOR_ID, AccessControlService.SCOPE_ALL));
        when(userAdminPort.findById(TARGET_ID)).thenReturn(Optional.of(user(TARGET_ID, "alice", 0, TARGET_DEPT_ID)));
        when(userRoleMapper.selectRoleIds(TARGET_ID)).thenReturn(List.of());

        service.changeStatus(TARGET_ID, new UserStatusDTO(UserAdminPort.STATUS_DISABLED));

        verify(userAdminPort).changeStatus(TARGET_ID, UserAdminPort.STATUS_DISABLED, OPERATOR_ID);
        verify(permissionGrantService).revokeApprovalGrants(TARGET_ID);
        verify(permissionService).invalidate(TARGET_ID);
    }

    @Test
    @DisplayName("启用：不回收授权，仅失效缓存")
    void changeStatus_shouldNotReEvaluateOnEnable() {
        when(permissionService.current()).thenReturn(snapshot(OPERATOR_ID, AccessControlService.SCOPE_ALL));
        when(userAdminPort.findById(TARGET_ID)).thenReturn(Optional.of(user(TARGET_ID, "alice", 0, TARGET_DEPT_ID)));

        service.changeStatus(TARGET_ID, new UserStatusDTO(UserAdminPort.STATUS_ACTIVE));

        verify(permissionGrantService, never()).revokeApprovalGrants(any());
        verify(permissionService).invalidate(TARGET_ID);
    }

    @Test
    @DisplayName("删除：先回收授权、再解除角色关联、最后软删账号")
    void deleteUser_shouldRevokeAndDetachRoles() {
        when(permissionService.current()).thenReturn(snapshot(OPERATOR_ID, AccessControlService.SCOPE_ALL));
        when(userAdminPort.findById(TARGET_ID)).thenReturn(Optional.of(user(TARGET_ID, "alice", 0, TARGET_DEPT_ID)));
        when(userRoleMapper.selectRoleIds(TARGET_ID)).thenReturn(List.of());
        when(userRoleMapper.selectAllByUserIdIncludingDeleted(TARGET_ID))
                .thenReturn(List.of(userRoleLink(55L, 3L, 0)));

        service.deleteUser(TARGET_ID);

        verify(permissionGrantService).revokeApprovalGrants(TARGET_ID);
        verify(userRoleMapper).markDeleted(55L, OPERATOR_ID);
        verify(userAdminPort).softDelete(TARGET_ID, OPERATOR_ID);
        verify(permissionService).invalidate(TARGET_ID);
    }

    /* ===================== 唯一性口径 ===================== */

    @Test
    @DisplayName("登录账号已占用 -> 1016（含已逻辑删除的占位行）")
    void createUser_shouldRejectDuplicateUsername() {
        when(permissionService.current()).thenReturn(snapshot(OPERATOR_ID, AccessControlService.SCOPE_ALL));
        when(userAdminPort.existsUsername("bob")).thenReturn(true);

        assertCode(ErrorCode.USERNAME_CONFLICT, () -> service.createUser(
                new UserCreateDTO("bob", "password12", "鲍勃", null, null, null, null, null)));

        verify(userAdminPort, never()).create(any());
    }

    @Test
    @DisplayName("邮箱已占用 -> 1017")
    void createUser_shouldRejectDuplicateEmail() {
        when(permissionService.current()).thenReturn(snapshot(OPERATOR_ID, AccessControlService.SCOPE_ALL));
        when(userAdminPort.existsUsername("bob")).thenReturn(false);
        when(userAdminPort.existsEmail("bob@ant.dev", null)).thenReturn(true);

        assertCode(ErrorCode.EMAIL_CONFLICT, () -> service.createUser(
                new UserCreateDTO("bob", "password12", "鲍勃", "bob@ant.dev", null, null, null, null)));

        verify(userAdminPort, never()).create(any());
    }

    /* ===================== 数据范围收敛 ===================== */

    @Test
    @DisplayName("数据范围「本人」：查询条件收敛为当前用户，忽略请求部门")
    void pageUsers_shouldRestrictToSelfForScopeSelf() {
        when(permissionService.current()).thenReturn(snapshot(OPERATOR_ID, AccessControlService.SCOPE_SELF));
        when(userAdminPort.page(any())).thenReturn(PageResult.of(List.of(), 0L, 1L, 20L));
        when(userAdminPort.listDeptOptions()).thenReturn(List.of());

        service.pageUsers(null, null, TARGET_DEPT_ID, 1L, 20L);

        ArgumentCaptor<UserQuery> captor = ArgumentCaptor.forClass(UserQuery.class);
        verify(userAdminPort).page(captor.capture());
        assertThat(captor.getValue().restrictUserId()).isEqualTo(OPERATOR_ID);
        assertThat(captor.getValue().deptId()).isNull();
    }

    @Test
    @DisplayName("数据范围「本部门及以下」但操作者无部门：返回空页而非降级为全量")
    void pageUsers_shouldReturnEmptyWhenDeptAdminHasNoDept() {
        when(permissionService.current()).thenReturn(snapshot(OPERATOR_ID, AccessControlService.SCOPE_DEPT));
        when(rbacAccessMapper.selectUserDeptId(OPERATOR_ID)).thenReturn(null);

        PageResult<?> page = service.pageUsers(null, null, null, 1L, 20L);

        assertThat(page.getTotal()).isZero();
        assertThat(page.getRecords()).isEmpty();
        verify(userAdminPort, never()).page(any());
    }

    @Test
    @DisplayName("分页上界收敛到 100，防止大页拖库")
    void pageUsers_shouldClampPageSize() {
        when(permissionService.current()).thenReturn(snapshot(OPERATOR_ID, AccessControlService.SCOPE_ALL));
        when(userAdminPort.page(any())).thenReturn(PageResult.of(List.of(), 0L, 1L, 100L));
        when(userAdminPort.listDeptOptions()).thenReturn(List.of());

        service.pageUsers(null, null, null, 0L, 9_999L);

        ArgumentCaptor<UserQuery> captor = ArgumentCaptor.forClass(UserQuery.class);
        verify(userAdminPort).page(captor.capture());
        assertThat(captor.getValue().size()).isEqualTo(SystemAdminConstants.MAX_PAGE_SIZE);
        assertThat(captor.getValue().current()).isEqualTo(1L);
    }

    /* ===================== 夹具 ===================== */

    private static void assertCode(ErrorCode expected, Runnable action) {
        BusinessException ex = assertThrows(BusinessException.class, action::run);
        assertThat(ex.getCode()).isEqualTo(expected.getCode());
    }

    private static UserRow user(Long id, String username, int status, Long deptId) {
        return new UserRow(id, username, username, null, null, null, deptId, status, null, null);
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

    private static SysUserRole userRoleLink(Long id, Long roleId, int deleted) {
        SysUserRole row = new SysUserRole();
        row.setId(id);
        row.setUserId(TARGET_ID);
        row.setRoleId(roleId);
        row.setDeleted(deleted);
        return row;
    }

    private static AccessSnapshot snapshot(Long userId, int dataScope) {
        return snapshot(userId, dataScope, List.of());
    }

    private static AccessSnapshot snapshot(Long userId, int dataScope, List<String> roles) {
        return new AccessSnapshot(userId, roles, List.of(), List.of(), dataScope);
    }
}
