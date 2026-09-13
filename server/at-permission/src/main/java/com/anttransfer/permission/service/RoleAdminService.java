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
import com.anttransfer.permission.security.AuthzContext;
import com.anttransfer.permission.util.AfterCommitUtils;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 角色管理（系统管理面）：角色 CRUD + 角色权限点分配。
 *
 * <p>表族归属：{@code sys_role / sys_permission / sys_role_permission / sys_user_role}
 * 由 at-permission 自持（architecture.md §1.2.2），故本服务直接读写，
 * 不经 SPI——与用户主数据的写侧必须绕道 {@code UserAdminPort} 形成对照。</p>
 *
 * <h3>四条红线（都在本类落实，均在 docs 与 V9 脚本中登记）</h3>
 * <ol>
 *     <li><b>内置角色不可删</b>（{@link ErrorCode#BUILT_IN_ROLE_PROTECTED}）：
 *         SUPER_ADMIN / AUDITOR / DEPT_ADMIN / USER 是安全基线，删掉即丢语义；</li>
 *     <li><b>AUDITOR 权限集锁定只读</b>（{@link ErrorCode#AUDITOR_PERM_LOCKED}）：
 *         任何对审计员角色的权限变更一律拒绝（三权分立锚点，数据层 V9 也不给它授权）；</li>
 *     <li><b>防提权</b>（{@link ErrorCode#PRIVILEGE_ESCALATION}）：数据范围非「全部」时，
 *         只能授予操作者自身持有的权限点、且只能把角色的数据范围改到不超过自身范围；</li>
 *     <li><b>防自锁</b>（{@link ErrorCode#ADMIN_SELF_LOCKOUT}）：不允许把「角色授权 / 用户管理」
 *         这几个管理能力从 SUPER_ADMIN 的空集里移除——一旦移除就再也授不回来了。</li>
 * </ol>
 *
 * <p>授权变更后按「角色 → 持有该角色的用户」广播式失效权限缓存
 * （{@code at:perm:{userId}}），保证「改完即时生效，无需重新登录」。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Service
public class RoleAdminService {

    private final RoleAdminMapper roleMapper;
    private final RolePermissionMapper rolePermissionMapper;
    private final UserRoleMapper userRoleMapper;
    private final PermissionPointMapper permissionPointMapper;
    private final PermissionService permissionService;
    private final PermissionAuditLogger auditLogger;

    public RoleAdminService(RoleAdminMapper roleMapper,
                            RolePermissionMapper rolePermissionMapper,
                            UserRoleMapper userRoleMapper,
                            PermissionPointMapper permissionPointMapper,
                            PermissionService permissionService,
                            PermissionAuditLogger auditLogger) {
        this.roleMapper = roleMapper;
        this.rolePermissionMapper = rolePermissionMapper;
        this.userRoleMapper = userRoleMapper;
        this.permissionPointMapper = permissionPointMapper;
        this.permissionService = permissionService;
        this.auditLogger = auditLogger;
    }

    /* ============================ 查询 ============================ */

    /**
     * 角色分页（关键字匹配角色编码 / 名称）。
     */
    public PageResult<RoleVO> pageRoles(String keyword, long current, long pageSize) {
        String kw = normalize(keyword);
        IPage<SysRole> page = roleMapper.selectPage(newPage(current, pageSize),
                Wrappers.<SysRole>lambdaQuery()
                        .and(kw != null, w -> w.like(SysRole::getCode, kw).or().like(SysRole::getName, kw))
                        .orderByDesc(SysRole::getBuiltIn)
                        .orderByAsc(SysRole::getId));
        return PageResult.of(page.getRecords().stream().map(this::toVO).toList(),
                page.getTotal(), page.getCurrent(), page.getSize());
    }

    /**
     * 全部角色（下拉选项，内置在前）。供用户分配角色选单使用。
     */
    public List<RoleVO> listRoleOptions() {
        return roleMapper.selectList(Wrappers.<SysRole>lambdaQuery()
                        .orderByDesc(SysRole::getBuiltIn)
                        .orderByAsc(SysRole::getId))
                .stream()
                .map(this::toVO)
                .toList();
    }

    /**
     * 角色详情。
     */
    public RoleVO getRole(Long roleId) {
        return toVO(requireRole(roleId));
    }

    /**
     * 角色已生效的权限点 ID 集合（授权弹窗回显）。
     */
    public List<Long> listPermissionIds(Long roleId) {
        requireRole(roleId);
        return rolePermissionMapper.selectPermissionIdsByRoleId(roleId);
    }

    /**
     * 权限点全树（授权弹窗的勾选数据源），按 parent_id / sort_no 组织。
     */
    public List<PermissionPointVO> permissionPointTree() {
        List<SysPermission> all = permissionPointMapper.selectList(
                Wrappers.<SysPermission>lambdaQuery()
                        .orderByAsc(SysPermission::getParentId)
                        .orderByAsc(SysPermission::getSortNo));
        Map<Long, PermissionPointVO> nodes = new LinkedHashMap<>();
        for (SysPermission permission : all) {
            nodes.put(permission.getId(), PermissionPointVO.of(permission));
        }
        List<PermissionPointVO> roots = new ArrayList<>();
        for (SysPermission permission : all) {
            PermissionPointVO node = nodes.get(permission.getId());
            Long parentId = permission.getParentId();
            if (parentId == null || parentId == 0L || !nodes.containsKey(parentId)) {
                roots.add(node);
            } else {
                nodes.get(parentId).children().add(node);
            }
        }
        return roots;
    }

    /* ============================ 写操作 ============================ */

    /**
     * 创建角色（自建角色的 built_in 恒为 0，无法通过接口伪装成内置角色）。
     */
    @Transactional(rollbackFor = Exception.class)
    public RoleVO createRole(RoleCreateDTO dto) {
        Long operatorId = currentUserId();
        String code = dto.code();
        if (roleMapper.countByCodeAnyState(code, null) > 0) {
            throw new BusinessException(ErrorCode.ROLE_CODE_CONFLICT, "角色编码已存在：" + code);
        }
        assertDataScopeWithinOwnRange(dto.dataScope());

        SysRole role = new SysRole();
        role.setCode(code);
        role.setName(dto.name());
        role.setDataScope(dto.dataScope());
        role.setBuiltIn(SysRole.NOT_BUILT_IN);
        role.setRemark(dto.remark());
        role.setCreateBy(operatorId);
        roleMapper.insert(role);

        Map<String, Object> audit = new LinkedHashMap<>();
        audit.put("code", code);
        audit.put("name", dto.name());
        audit.put("dataScope", dto.dataScope());
        auditLogger.success(OperationLog.ACTION_ROLE_CREATE, OperationLog.TARGET_ROLE, role.getId(), audit);
        log.info("[system] 创建角色: id={}, code={}, operator={}", role.getId(), code, operatorId);
        return toVO(role);
    }

    /**
     * 编辑角色（名称 / 数据范围 / 备注）；内置角色的数据范围不可变更。
     */
    @Transactional(rollbackFor = Exception.class)
    public RoleVO updateRole(Long roleId, RoleUpdateDTO dto) {
        Long operatorId = currentUserId();
        SysRole role = requireRole(roleId);
        Integer dataScopeBefore = role.getDataScope();

        if (role.isBuiltIn() && !Objects.equals(role.getDataScope(), dto.dataScope())) {
            throw new BusinessException(ErrorCode.BUILT_IN_ROLE_PROTECTED,
                    "内置角色的数据范围不可变更：" + role.getCode());
        }
        if (!role.isBuiltIn()) {
            assertDataScopeWithinOwnRange(dto.dataScope());
            role.setDataScope(dto.dataScope());
        }
        role.setName(dto.name());
        role.setRemark(dto.remark());
        role.setUpdateBy(operatorId);
        roleMapper.updateById(role);

        // 数据范围可能变化（非内置角色），持有该角色的用户需重新解析
        invalidateRoleHolders(roleId);
        Map<String, Object> audit = new LinkedHashMap<>();
        audit.put("code", role.getCode());
        audit.put("dataScopeFrom", dataScopeBefore);
        audit.put("dataScopeTo", role.getDataScope());
        auditLogger.success(OperationLog.ACTION_ROLE_UPDATE, OperationLog.TARGET_ROLE, roleId, audit);
        log.info("[system] 编辑角色: id={}, operator={}", roleId, operatorId);
        return toVO(role);
    }

    /**
     * 删除角色：内置角色受保护；仍被用户占用的角色需先解除分配。
     */
    @Transactional(rollbackFor = Exception.class)
    public void deleteRole(Long roleId) {
        Long operatorId = currentUserId();
        SysRole role = requireRole(roleId);
        if (role.isBuiltIn()) {
            throw new BusinessException(ErrorCode.BUILT_IN_ROLE_PROTECTED, "内置角色不可删除：" + role.getCode());
        }
        if (userRoleMapper.countByRoleId(roleId) > 0) {
            throw new BusinessException(ErrorCode.ROLE_IN_USE, "该角色已分配给用户，请先解除分配");
        }
        role.setUpdateBy(operatorId);
        roleMapper.updateById(role);
        roleMapper.deleteById(roleId);
        invalidateRoleHolders(roleId);
        auditLogger.success(OperationLog.ACTION_ROLE_DELETE, OperationLog.TARGET_ROLE, roleId,
                Map.of("code", role.getCode()));
        log.info("[system] 删除角色: id={}, code={}, operator={}", roleId, role.getCode(), operatorId);
    }

    /**
     * 分配角色权限点（整集替换）。
     *
     * <p>执行顺序刻意是「先校验后落库」：AUDITOR 锁定 → 权限点存在性 → 防提权 → 防自锁，
     * 任何一步失败都在事务里抛出、不产生半套授权。</p>
     */
    @Transactional(rollbackFor = Exception.class)
    public void assignPermissions(Long roleId, List<Long> permissionIds) {
        Long operatorId = currentUserId();
        SysRole role = requireRole(roleId);

        // 红线②：审计员权限集锁定只读（数据层 V9 也一个 system:* 都没给它，双保险）
        if (SystemAdminConstants.ROLE_AUDITOR.equals(role.getCode())) {
            throw new BusinessException(ErrorCode.AUDITOR_PERM_LOCKED,
                    "审计员角色权限锁定只读，不可变更其权限集");
        }

        Set<Long> desired = normalizeIds(permissionIds);
        List<SysPermission> permissions = desired.isEmpty()
                ? List.of()
                : permissionPointMapper.selectBatchIds(desired);
        if (permissions.size() != desired.size()) {
            throw new BusinessException(ErrorCode.PERMISSION_NOT_FOUND, "存在无效的权限点 ID");
        }
        Set<String> requestedCodes = permissions.stream()
                .map(SysPermission::getPermCode)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        assertNoPrivilegeEscalation(requestedCodes);
        if (SystemAdminConstants.ROLE_SUPER_ADMIN.equals(role.getCode())) {
            assertSuperAdminKeepsControl(requestedCodes);
        }

        List<Long> before = rolePermissionMapper.selectPermissionIdsByRoleId(roleId);
        replaceRolePermissions(roleId, desired, operatorId);
        invalidateRoleHolders(roleId);
        Map<String, Object> audit = new LinkedHashMap<>();
        audit.put("code", role.getCode());
        audit.put("beforeCount", before.size());
        audit.put("afterCount", desired.size());
        audit.put("added", diff(desired, before));
        audit.put("removed", diff(before, desired));
        auditLogger.success(OperationLog.ACTION_ROLE_PERM_ASSIGN, OperationLog.TARGET_ROLE, roleId, audit);
        log.info("[system] 角色授权: roleId={}, 权限点={}, operator={}", roleId, desired.size(), operatorId);
    }

    /** 求差集 a - b（保持顺序，供审计 diff 阅读）。 */
    private Set<Long> diff(Collection<Long> a, Collection<Long> b) {
        Set<Long> result = new LinkedHashSet<>(a);
        result.removeAll(b);
        return result;
    }

    /* ============================ 红线守卫 ============================ */

    /**
     * 防提权（角色数据范围维度）：数据范围非「全部」的操作者，不能造出比自己更大的范围。
     */
    private void assertDataScopeWithinOwnRange(int targetDataScope) {
        AccessSnapshot snapshot = permissionService.current();
        if (snapshot.dataScope() < AccessControlService.SCOPE_ALL
                && targetDataScope > snapshot.dataScope()) {
            throw new BusinessException(ErrorCode.PRIVILEGE_ESCALATION,
                    "不能创建或编辑数据范围超过自身范围的角色");
        }
    }

    /**
     * 防提权（权限点维度）：数据范围非「全部」的操作者，只能授予自身持有的权限点。
     */
    private void assertNoPrivilegeEscalation(Set<String> requestedCodes) {
        AccessSnapshot snapshot = permissionService.current();
        if (snapshot.dataScope() >= AccessControlService.SCOPE_ALL) {
            return;
        }
        if (!new HashSet<>(snapshot.permCodes()).containsAll(requestedCodes)) {
            throw new BusinessException(ErrorCode.PRIVILEGE_ESCALATION,
                    "不能授予自身不具备的权限点");
        }
    }

    /**
     * 防自锁（角色权限维度）：SUPER_ADMIN 必须始终保留最小管理能力集合。
     */
    private void assertSuperAdminKeepsControl(Set<String> requestedCodes) {
        if (!requestedCodes.containsAll(SystemAdminConstants.SUPER_ADMIN_REQUIRED_PERMS)) {
            Set<String> missing = new LinkedHashSet<>(SystemAdminConstants.SUPER_ADMIN_REQUIRED_PERMS);
            missing.removeAll(requestedCodes);
            throw new BusinessException(ErrorCode.ADMIN_SELF_LOCKOUT,
                    "超级管理员必须保留管理能力，不可移除：" + String.join(",", missing));
        }
    }

    /* ============================ 内部工具 ============================ */

    /**
     * 整集替换角色权限点。
     *
     * <p>唯一键 {@code uk_role_permission(role_id, permission_id)} 是纯唯一键，
     * 逻辑删除行占位，故必须「复活 / 停用 / 新增」三分类（详见 {@link RolePermissionMapper}）。</p>
     */
    private void replaceRolePermissions(Long roleId, Set<Long> desired, Long operatorId) {
        Set<Long> pendingInsert = new LinkedHashSet<>(desired);
        for (SysRolePermission row : rolePermissionMapper.selectAllByRoleIdIncludingDeleted(roleId)) {
            boolean wanted = pendingInsert.remove(row.getPermissionId());
            if (wanted) {
                if (isDeleted(row)) {
                    rolePermissionMapper.markRestored(row.getId(), operatorId);
                }
            } else if (!isDeleted(row)) {
                rolePermissionMapper.markDeleted(row.getId(), operatorId);
            }
        }
        for (Long permissionId : pendingInsert) {
            SysRolePermission fresh = new SysRolePermission();
            fresh.setRoleId(roleId);
            fresh.setPermissionId(permissionId);
            fresh.setCreateBy(operatorId);
            rolePermissionMapper.insert(fresh);
        }
    }

    /**
     * 角色变更后失效其全部持有者的权限缓存（提交后执行，避免事务回滚留下幻影失效）。
     */
    private void invalidateRoleHolders(Long roleId) {
        List<Long> userIds = userRoleMapper.selectUserIdsByRoleId(roleId);
        if (userIds.isEmpty()) {
            return;
        }
        AfterCommitUtils.run(() -> userIds.forEach(permissionService::invalidate));
    }

    private SysRole requireRole(Long roleId) {
        SysRole role = roleMapper.selectById(roleId);
        if (role == null) {
            throw new BusinessException(ErrorCode.ROLE_NOT_FOUND);
        }
        return role;
    }

    private RoleVO toVO(SysRole role) {
        return RoleVO.of(role, SystemAdminConstants.ROLE_AUDITOR.equals(role.getCode()));
    }

    private Page<SysRole> newPage(long current, long pageSize) {
        long safeCurrent = Math.max(current, 1L);
        long safeSize = Math.min(Math.max(pageSize, 1L), SystemAdminConstants.MAX_PAGE_SIZE);
        return new Page<>(safeCurrent, safeSize);
    }

    private Set<Long> normalizeIds(List<Long> ids) {
        if (ids == null) {
            return new LinkedHashSet<>();
        }
        return ids.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private boolean isDeleted(SysRolePermission row) {
        return row.getDeleted() != null && row.getDeleted() == 1;
    }

    private String normalize(String keyword) {
        if (keyword == null) {
            return null;
        }
        String trimmed = keyword.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private Long currentUserId() {
        return AuthzContext.currentUser().getId();
    }
}
