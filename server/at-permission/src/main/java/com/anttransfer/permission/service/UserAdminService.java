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

import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.result.PageResult;
import com.anttransfer.common.security.UserAdminPort;
import com.anttransfer.common.security.UserAdminPort.DeptRow;
import com.anttransfer.common.security.UserAdminPort.NewUser;
import com.anttransfer.common.security.UserAdminPort.ProfilePatch;
import com.anttransfer.common.security.UserAdminPort.UserQuery;
import com.anttransfer.common.security.UserAdminPort.UserRow;
import com.anttransfer.permission.constant.SystemAdminConstants;
import com.anttransfer.permission.model.PermissionModels.AccessSnapshot;
import com.anttransfer.permission.model.SystemAdminModels.UserRoleRow;
import com.anttransfer.permission.model.dto.UserCreateDTO;
import com.anttransfer.permission.model.dto.UserResetPasswordDTO;
import com.anttransfer.permission.model.dto.UserStatusDTO;
import com.anttransfer.permission.model.dto.UserUpdateDTO;
import com.anttransfer.permission.model.entity.SysRole;
import com.anttransfer.permission.model.entity.SysUserRole;
import com.anttransfer.permission.model.vo.DeptOptionVO;
import com.anttransfer.permission.model.vo.RoleVO;
import com.anttransfer.permission.model.vo.UserVO;
import com.anttransfer.permission.repository.RbacAccessMapper;
import com.anttransfer.permission.repository.RoleAdminMapper;
import com.anttransfer.permission.repository.UserRoleMapper;
import com.anttransfer.permission.security.AuthzContext;
import com.anttransfer.permission.util.AfterCommitUtils;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 用户管理（系统管理面）：CRUD + 重置口令 + 启停（离职）+ 分配角色 + 调岗。
 *
 * <p><b>读写分道：</b>{@code sys_user} 是 at-auth 的表族，本服务的所有账号写入
 * 一律经 {@link UserAdminPort} 委托表主（散列、会话吊销、唯一键口径都在那边收口）；
 * 而角色关联 {@code sys_user_role} 是 at-permission 自持表族，本服务直接读写。</p>
 *
 * <h3>三条红线</h3>
 * <ol>
 *     <li><b>不得对自己操作</b>（{@link ErrorCode#SELF_OPERATION_FORBIDDEN}）：
 *         停用 / 删除 / 重置口令 / 分配角色。给自己分配角色是最短的提权路径
 *         （例如 DEPT_ADMIN 给自己加 SUPER_ADMIN），必须由另一名管理员执行；</li>
 *     <li><b>受保护账号</b>（{@link ErrorCode#PROTECTED_ACCOUNT}）：初始管理员
 *         {@code admin} 禁止停用 / 删除；</li>
 *     <li><b>防自锁 / 防提权</b>（{@link ErrorCode#ADMIN_SELF_LOCKOUT} /
 *         {@link ErrorCode#PRIVILEGE_ESCALATION}）：不能把系统里最后一个可用的
 *         SUPER_ADMIN 停掉 / 删掉 / 摘掉其超管角色；数据范围非「全部」时，
 *         只能分配自己持有的角色、只能把人调到自己的部门子树内。</li>
 * </ol>
 *
 * <h3>调岗 / 离职 → 权限重评估</h3>
 * <p>调岗（{@code dept_id} 变更）与离职（停用 / 删除）都会调用
 * {@link PermissionGrantService#revokeApprovalGrants(Long)} 回收该用户「审批获得」
 * 的全部生效授权（4.2 权限重评估入口）。不回收的话，用户会带着原部门审批来的
 * 资源授权去新部门——授权来源消失但授权还在，是最典型的越权残留。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Service
public class UserAdminService {

    private final UserAdminPort userAdminPort;
    private final UserRoleMapper userRoleMapper;
    private final RoleAdminMapper roleMapper;
    private final RoleAdminService roleAdminService;
    private final RbacAccessMapper rbacAccessMapper;
    private final PermissionService permissionService;
    private final AccessControlService accessControlService;
    private final PermissionGrantService permissionGrantService;
    private final PermissionAuditLogger auditLogger;

    public UserAdminService(UserAdminPort userAdminPort,
                            UserRoleMapper userRoleMapper,
                            RoleAdminMapper roleMapper,
                            RoleAdminService roleAdminService,
                            RbacAccessMapper rbacAccessMapper,
                            PermissionService permissionService,
                            AccessControlService accessControlService,
                            PermissionGrantService permissionGrantService,
                            PermissionAuditLogger auditLogger) {
        this.userAdminPort = userAdminPort;
        this.userRoleMapper = userRoleMapper;
        this.roleMapper = roleMapper;
        this.roleAdminService = roleAdminService;
        this.rbacAccessMapper = rbacAccessMapper;
        this.permissionService = permissionService;
        this.accessControlService = accessControlService;
        this.permissionGrantService = permissionGrantService;
        this.auditLogger = auditLogger;
    }

    /* ============================ 查询 ============================ */

    /**
     * 用户分页（按操作者数据范围收敛）。
     *
     * <p>数据范围的三种形态：全部=按请求部门过滤；本部门及以下=强制收敛到本人部门子树
     * （请求里的 deptId 被忽略，防越范围探测）；本人=只回自己一条。
     * 收敛发生在<b>查询条件</b>上而非结果过滤，避免「先查全量再筛」把不可见数据读进内存。</p>
     */
    public PageResult<UserVO> pageUsers(String keyword, Integer status, Long deptId,
                                        long current, long pageSize) {
        AccessSnapshot snapshot = permissionService.current();
        Long scopedDeptId = deptId;
        boolean includeSubtree = true;
        Long restrictUserId = null;

        if (snapshot.dataScope() == AccessControlService.SCOPE_SELF) {
            restrictUserId = snapshot.userId();
            scopedDeptId = null;
        } else if (snapshot.dataScope() == AccessControlService.SCOPE_DEPT) {
            scopedDeptId = rbacAccessMapper.selectUserDeptId(snapshot.userId());
            if (scopedDeptId == null) {
                // 无部门归属的部门管理员没有任何可见范围：返回空页而不是降级为全量
                return PageResult.empty(clampCurrent(current), clampSize(pageSize));
            }
        }

        UserQuery query = new UserQuery(normalize(keyword), status, scopedDeptId, includeSubtree,
                restrictUserId, clampCurrent(current), clampSize(pageSize));
        PageResult<UserRow> page = userAdminPort.page(query);

        Map<Long, List<UserRoleRow>> rolesByUser = loadRolesByUser(
                page.getRecords().stream().map(UserRow::id).toList());
        Map<Long, String> deptNames = deptNameMap();
        List<UserVO> records = page.getRecords().stream()
                .map(row -> toVO(row, rolesByUser.getOrDefault(row.id(), List.of()), deptNames))
                .toList();
        return PageResult.of(records, page.getTotal(), page.getCurrent(), page.getPageSize());
    }

    /**
     * 用户详情（受数据范围约束）。
     */
    public UserVO getUser(Long userId) {
        AccessSnapshot snapshot = permissionService.current();
        UserRow row = requireUser(userId);
        accessControlService.assertResourceVisibleTo(snapshot, row.id(), row.deptId());
        return toVO(row, userRoleRows(userId), deptNameMap());
    }

    /**
     * 调岗目标部门下拉（全部启用部门）。
     */
    public List<DeptOptionVO> listDeptOptions() {
        return userAdminPort.listDeptOptions().stream().map(DeptOptionVO::of).toList();
    }

    /**
     * 分配角色选单（复用角色管理下拉）。
     */
    public List<RoleVO> listRoleOptions() {
        return roleAdminService.listRoleOptions();
    }

    /* ============================ 写操作 ============================ */

    /**
     * 建号（可选同时分配初始角色）。
     */
    @Transactional(rollbackFor = Exception.class)
    public UserVO createUser(UserCreateDTO dto) {
        AccessSnapshot snapshot = permissionService.current();
        Long operatorId = snapshot.userId();
        String username = dto.username().trim();

        if (userAdminPort.existsUsername(username)) {
            throw new BusinessException(ErrorCode.USERNAME_CONFLICT, "登录账号已存在：" + username);
        }
        String email = emptyToNull(dto.email());
        if (userAdminPort.existsEmail(email, null)) {
            throw new BusinessException(ErrorCode.EMAIL_CONFLICT, "邮箱已被占用：" + email);
        }
        assertDeptAssignable(snapshot, dto.deptId());

        Long userId = userAdminPort.create(new NewUser(username, dto.password(), dto.nickname(),
                email, emptyToNull(dto.mobile()), dto.deptId(), dto.remark(), operatorId));

        Set<Long> roleIds = normalizeIds(dto.roleIds());
        if (!roleIds.isEmpty()) {
            changeUserRoles(snapshot, userId, roleIds, operatorId);
        }
        Map<String, Object> audit = new LinkedHashMap<>();
        audit.put("username", username);
        audit.put("deptId", dto.deptId());
        audit.put("roleIds", roleIds);
        auditLogger.success(OperationLog.ACTION_USER_CREATE, OperationLog.TARGET_USER, userId, audit);
        log.info("[system] 创建用户: userId={}, username={}, operator={}", userId, username, operatorId);
        return getUser(userId);
    }

    /**
     * 编辑用户资料；提交的部门与原值不同即视为调岗，触发权限重评估。
     */
    @Transactional(rollbackFor = Exception.class)
    public UserVO updateUser(Long userId, UserUpdateDTO dto) {
        AccessSnapshot snapshot = permissionService.current();
        Long operatorId = snapshot.userId();
        UserRow row = requireUser(userId);
        accessControlService.assertResourceVisibleTo(snapshot, row.id(), row.deptId());

        String email = emptyToNull(dto.email());
        if (email != null && !email.equals(row.email()) && userAdminPort.existsEmail(email, userId)) {
            throw new BusinessException(ErrorCode.EMAIL_CONFLICT, "邮箱已被占用：" + email);
        }

        userAdminPort.updateProfile(userId, new ProfilePatch(dto.nickname(), email,
                emptyToNull(dto.mobile()), dto.remark(), operatorId));

        boolean deptChanged = !Objects.equals(row.deptId(), dto.deptId());
        int revoked = 0;
        if (deptChanged) {
            assertDeptAssignable(snapshot, dto.deptId());
            userAdminPort.changeDept(userId, dto.deptId(), operatorId);
            // 调岗重评估：回收其审批获得授权（授权来源随部门变化而失效）
            revoked = permissionGrantService.revokeApprovalGrants(userId);
            log.info("[system] 用户调岗: userId={}, {} -> {}, 回收审批授权={} 条, operator={}",
                    userId, row.deptId(), dto.deptId(), revoked, operatorId);
        }
        Map<String, Object> audit = new LinkedHashMap<>();
        audit.put("username", row.username());
        audit.put("deptChanged", deptChanged);
        audit.put("deptFrom", row.deptId());
        audit.put("deptTo", dto.deptId());
        audit.put("revokedGrants", revoked);
        auditLogger.success(OperationLog.ACTION_USER_UPDATE, OperationLog.TARGET_USER, userId, audit);
        return getUser(userId);
    }

    /**
     * 重置用户口令（表主侧同时吊销其在途会话）。
     */
    @Transactional(rollbackFor = Exception.class)
    public void resetPassword(Long userId, UserResetPasswordDTO dto) {
        AccessSnapshot snapshot = permissionService.current();
        Long operatorId = snapshot.userId();
        assertNotSelf(userId, "重置自己的口令请走个人中心");
        UserRow row = requireUser(userId);
        accessControlService.assertResourceVisibleTo(snapshot, row.id(), row.deptId());

        userAdminPort.resetPassword(userId, dto.newPassword(), operatorId);
        // 只记「谁重置了谁的」，口令明文 / 哈希一律不入审计
        Map<String, Object> audit = new LinkedHashMap<>();
        audit.put("username", row.username());
        auditLogger.success(OperationLog.ACTION_USER_PASSWORD_RESET, OperationLog.TARGET_USER, userId, audit);
        log.info("[system] 重置用户口令: userId={}, operator={}", userId, operatorId);
    }

    /**
     * 启用 / 停用（停用=离职）。
     *
     * <p>停用即触发权限重评估：离职的人不该继续持有在途的审批类授权。</p>
     */
    @Transactional(rollbackFor = Exception.class)
    public void changeStatus(Long userId, UserStatusDTO dto) {
        AccessSnapshot snapshot = permissionService.current();
        Long operatorId = snapshot.userId();
        assertNotSelf(userId, "不能变更自己的账号状态");
        UserRow row = requireUser(userId);
        accessControlService.assertResourceVisibleTo(snapshot, row.id(), row.deptId());

        if (dto.status() == UserAdminPort.STATUS_DISABLED) {
            assertNotProtected(row);
            assertSuperAdminNotLockedOut(row, "停用");
        }

        userAdminPort.changeStatus(userId, dto.status(), operatorId);
        int revoked = 0;
        if (dto.status() == UserAdminPort.STATUS_DISABLED) {
            revoked = permissionGrantService.revokeApprovalGrants(userId);
            invalidateAfterCommit(userId);
            log.info("[system] 停用用户（离职重评估）: userId={}, 回收审批授权={} 条, operator={}",
                    userId, revoked, operatorId);
        } else {
            invalidateAfterCommit(userId);
            log.info("[system] 启用用户: userId={}, operator={}", userId, operatorId);
        }
        Map<String, Object> audit = new LinkedHashMap<>();
        audit.put("username", row.username());
        audit.put("statusFrom", row.status());
        audit.put("statusTo", dto.status());
        audit.put("revokedGrants", revoked);
        auditLogger.success(OperationLog.ACTION_USER_STATUS, OperationLog.TARGET_USER, userId, audit);
    }

    /**
     * 删除用户（逻辑删除）：受保护账号与最后一个超管不可删；删除同时解除其角色关联。
     */
    @Transactional(rollbackFor = Exception.class)
    public void deleteUser(Long userId) {
        AccessSnapshot snapshot = permissionService.current();
        Long operatorId = snapshot.userId();
        assertNotSelf(userId, "不能删除自己的账号");
        UserRow row = requireUser(userId);
        accessControlService.assertResourceVisibleTo(snapshot, row.id(), row.deptId());
        assertNotProtected(row);
        assertSuperAdminNotLockedOut(row, "删除");

        int revoked = permissionGrantService.revokeApprovalGrants(userId);
        // 先解除角色关联再删账号：否则被删用户仍占着角色，会让「角色在用」判定永久为真
        replaceUserRoles(userId, Set.of(), operatorId);
        userAdminPort.softDelete(userId, operatorId);
        invalidateAfterCommit(userId);
        Map<String, Object> audit = new LinkedHashMap<>();
        audit.put("username", row.username());
        audit.put("revokedGrants", revoked);
        auditLogger.success(OperationLog.ACTION_USER_DELETE, OperationLog.TARGET_USER, userId, audit);
        log.info("[system] 删除用户: userId={}, 回收审批授权={} 条, operator={}", userId, revoked, operatorId);
    }

    /**
     * 分配用户角色（整集替换）。
     */
    @Transactional(rollbackFor = Exception.class)
    public void assignRoles(Long userId, List<Long> roleIds) {
        AccessSnapshot snapshot = permissionService.current();
        Long operatorId = snapshot.userId();
        assertNotSelf(userId, "不能修改自己的角色（防自我提权）");
        UserRow row = requireUser(userId);
        accessControlService.assertResourceVisibleTo(snapshot, row.id(), row.deptId());

        Set<Long> desired = normalizeIds(roleIds);
        List<SysRole> roles = desired.isEmpty() ? List.of() : roleMapper.selectBatchIds(desired);
        if (roles.size() != desired.size()) {
            throw new BusinessException(ErrorCode.ROLE_NOT_FOUND, "存在无效的角色 ID");
        }
        assertRolesAssignable(snapshot, roles);
        assertProtectedKeepsSuperAdmin(row, roles);
        assertSuperAdminRemainsAfterRoleChange(row, roles);

        changeUserRoles(snapshot, userId, desired, operatorId);
        Map<String, Object> audit = new LinkedHashMap<>();
        audit.put("username", row.username());
        audit.put("roleIds", desired);
        auditLogger.success(OperationLog.ACTION_USER_ROLE_ASSIGN, OperationLog.TARGET_USER, userId, audit);
        log.info("[system] 分配用户角色: userId={}, roles={}, operator={}", userId, desired, operatorId);
    }

    /* ============================ 红线守卫 ============================ */

    /** 不接受对自己执行高危动作（停用/删除/改角色/重置口令）。 */
    private void assertNotSelf(Long targetUserId, String message) {
        if (targetUserId.equals(AuthzContext.currentUser().getId())) {
            throw new BusinessException(ErrorCode.SELF_OPERATION_FORBIDDEN, message);
        }
    }

    /** 初始管理员账号禁止停用 / 删除。 */
    private void assertNotProtected(UserRow row) {
        if (isProtected(row)) {
            throw new BusinessException(ErrorCode.PROTECTED_ACCOUNT, "受保护账号不可停用或删除：" + row.username());
        }
    }

    /**
     * 防自锁（账号维度）：停用 / 删除后系统中必须仍有可用的 SUPER_ADMIN。
     */
    private void assertSuperAdminNotLockedOut(UserRow row, String action) {
        if (row.status() == null || row.status() != UserAdminPort.STATUS_ACTIVE) {
            return;
        }
        SysRole superAdmin = findRoleByCode(SystemAdminConstants.ROLE_SUPER_ADMIN);
        if (superAdmin == null || !userRoleMapper.selectRoleIds(row.id()).contains(superAdmin.getId())) {
            return;
        }
        if (userRoleMapper.countEnabledUsersByRoleCode(SystemAdminConstants.ROLE_SUPER_ADMIN) <= 1) {
            throw new BusinessException(ErrorCode.ADMIN_SELF_LOCKOUT,
                    "不能" + action + "系统最后一个可用的超级管理员");
        }
    }

    /** 受保护账号必须始终保留 SUPER_ADMIN 角色。 */
    private void assertProtectedKeepsSuperAdmin(UserRow row, List<SysRole> targetRoles) {
        if (!isProtected(row)) {
            return;
        }
        boolean keepsSuperAdmin = targetRoles.stream()
                .anyMatch(role -> SystemAdminConstants.ROLE_SUPER_ADMIN.equals(role.getCode()));
        if (!keepsSuperAdmin) {
            throw new BusinessException(ErrorCode.ADMIN_SELF_LOCKOUT,
                    "受保护账号必须保留超级管理员角色");
        }
    }

    /** 防自锁（角色维度）：摘掉某人的超管角色后，系统必须仍有可用的超管。 */
    private void assertSuperAdminRemainsAfterRoleChange(UserRow row, List<SysRole> targetRoles) {
        if (row.status() == null || row.status() != UserAdminPort.STATUS_ACTIVE) {
            return;
        }
        SysRole superAdmin = findRoleByCode(SystemAdminConstants.ROLE_SUPER_ADMIN);
        if (superAdmin == null) {
            return;
        }
        boolean currentlyHolds = userRoleMapper.selectRoleIds(row.id()).contains(superAdmin.getId());
        boolean keeps = targetRoles.stream().anyMatch(role -> role.getId().equals(superAdmin.getId()));
        if (currentlyHolds && !keeps
                && userRoleMapper.countEnabledUsersByRoleCode(SystemAdminConstants.ROLE_SUPER_ADMIN) <= 1) {
            throw new BusinessException(ErrorCode.ADMIN_SELF_LOCKOUT,
                    "不能摘除系统最后一个可用超级管理员的超管角色");
        }
    }

    /** 防提权（角色维度）：数据范围非「全部」时只能分配自己持有的角色。 */
    private void assertRolesAssignable(AccessSnapshot snapshot, List<SysRole> roles) {
        if (snapshot.dataScope() >= AccessControlService.SCOPE_ALL) {
            return;
        }
        Set<String> mine = new HashSet<>(snapshot.roles());
        List<String> escalated = roles.stream()
                .map(SysRole::getCode)
                .filter(code -> !mine.contains(code))
                .toList();
        if (!escalated.isEmpty()) {
            throw new BusinessException(ErrorCode.PRIVILEGE_ESCALATION,
                    "不能分配自身不具备的角色：" + String.join(",", escalated));
        }
    }

    /** 目标部门必须存在，且在操作者的数据范围之内（防把用户调到自己看不到的部门）。 */
    private void assertDeptAssignable(AccessSnapshot snapshot, Long deptId) {
        if (deptId == null) {
            return;
        }
        userAdminPort.findDept(deptId)
                .orElseThrow(() -> new BusinessException(ErrorCode.DEPT_NOT_FOUND, "部门不存在：" + deptId));
        accessControlService.assertResourceVisibleTo(snapshot, null, deptId);
    }

    /* ============================ 内部工具 ============================ */

    /**
     * 整集替换用户角色。
     *
     * <p>唯一键 {@code uk_user_role(user_id, role_id)} 是纯唯一键、逻辑删除行占位，
     * 故必须「复活 / 停用 / 新增」三分类（详见 {@link UserRoleMapper}）。</p>
     */
    private void changeUserRoles(AccessSnapshot snapshot, Long userId, Set<Long> roleIds, Long operatorId) {
        Set<Long> desired = new LinkedHashSet<>(roleIds);
        if (!desired.isEmpty()) {
            List<SysRole> roles = roleMapper.selectBatchIds(desired);
            if (roles.size() != desired.size()) {
                throw new BusinessException(ErrorCode.ROLE_NOT_FOUND, "存在无效的角色 ID");
            }
            assertRolesAssignable(snapshot, roles);
        }
        replaceUserRoles(userId, desired, operatorId);
        invalidateAfterCommit(userId);
    }

    private void replaceUserRoles(Long userId, Set<Long> desired, Long operatorId) {
        Set<Long> pendingInsert = new LinkedHashSet<>(desired);
        for (SysUserRole row : userRoleMapper.selectAllByUserIdIncludingDeleted(userId)) {
            boolean wanted = pendingInsert.remove(row.getRoleId());
            if (wanted) {
                if (isDeleted(row)) {
                    userRoleMapper.markRestored(row.getId(), operatorId);
                }
            } else if (!isDeleted(row)) {
                userRoleMapper.markDeleted(row.getId(), operatorId);
            }
        }
        for (Long roleId : pendingInsert) {
            SysUserRole fresh = new SysUserRole();
            fresh.setUserId(userId);
            fresh.setRoleId(roleId);
            fresh.setCreateBy(operatorId);
            userRoleMapper.insert(fresh);
        }
    }

    private void invalidateAfterCommit(Long userId) {
        AfterCommitUtils.run(() -> permissionService.invalidate(userId));
    }

    private UserRow requireUser(Long userId) {
        return userAdminPort.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
    }

    private SysRole findRoleByCode(String code) {
        return roleMapper.selectOne(Wrappers.<SysRole>lambdaQuery().eq(SysRole::getCode, code));
    }

    private List<UserRoleRow> userRoleRows(Long userId) {
        return loadRolesByUser(List.of(userId)).getOrDefault(userId, List.of());
    }

    private Map<Long, List<UserRoleRow>> loadRolesByUser(Collection<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return Map.of();
        }
        return userRoleMapper.selectRolesByUserIds(userIds).stream()
                .collect(Collectors.groupingBy(UserRoleRow::userId));
    }

    private Map<Long, String> deptNameMap() {
        return userAdminPort.listDeptOptions().stream()
                .collect(Collectors.toMap(DeptRow::id, DeptRow::name, (a, b) -> a));
    }

    private UserVO toVO(UserRow row, List<UserRoleRow> roleRows, Map<Long, String> deptNames) {
        return new UserVO(
                row.id(),
                row.username(),
                row.nickname(),
                row.email(),
                row.mobile(),
                row.deptId(),
                row.deptId() == null ? null : deptNames.get(row.deptId()),
                row.status(),
                isProtected(row),
                row.lastLoginTime(),
                row.createTime(),
                roleRows.stream().map(UserRoleRow::roleId).toList(),
                roleRows.stream().map(UserRoleRow::roleCode).toList());
    }

    private boolean isProtected(UserRow row) {
        return row.username() != null
                && SystemAdminConstants.PROTECTED_USERNAME.equalsIgnoreCase(row.username());
    }

    private Set<Long> normalizeIds(List<Long> ids) {
        if (ids == null) {
            return new LinkedHashSet<>();
        }
        return ids.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private boolean isDeleted(SysUserRole row) {
        return row.getDeleted() != null && row.getDeleted() == 1;
    }

    private long clampCurrent(long current) {
        return Math.max(current, 1L);
    }

    private long clampSize(long pageSize) {
        return Math.min(Math.max(pageSize, 1L), SystemAdminConstants.MAX_PAGE_SIZE);
    }

    private String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String normalize(String keyword) {
        return emptyToNull(keyword);
    }
}
