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
package com.anttransfer.auth.service;

import com.anttransfer.auth.model.entity.SysDept;
import com.anttransfer.auth.model.entity.SysUser;
import com.anttransfer.auth.repository.DeptMapper;
import com.anttransfer.auth.repository.UserMapper;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.result.PageResult;
import com.anttransfer.common.security.UserAdminPort;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * {@link UserAdminPort} 的 at-auth 实现：sys_user 表族是 at-auth 的领域，
 * 系统管理面（at-permission）的一切账号写入都经此收敛。
 *
 * <p><b>本类的职责边界：</b>只做「表主才知道怎么做」的事——密码散列、会话吊销纪元、
 * 用户名唯一性口径、逻辑删除与唯一键的相互作用、数据范围 SQL（部门子树）。
 * <b>不做</b>授权判断：调用方只会在自身数据范围校验通过后才会调到这里，
 * 授权口径的唯一真相源是 at-permission 的 {@code AccessControlService}
 * （见 {@link UserAdminPort} 类注）。</p>
 *
 * <p><b>事务语义：</b>全部写方法用 {@link Propagation#REQUIRED} 加入调用方事务。
 * 系统管理面的每个动作都是一次「用户表 + 角色关联表 + 授权回收」的跨表写入，
 * 必须同生共死：只写下 {@code sys_user_role} 而没写 {@code sys_user}，
 * 或停了账号却没回收其审批类授权，都会留下「看着对、其实漏一半」的状态。</p>
 *
 * <p><b>会话吊销走「同事务递增纪元」而非 {@code revokeAll}：</b>重置口令 / 停用 / 删除
 * 都要求旧令牌<b>即刻</b>失效（而不是等 access 自然过期）。这里统一调
 * {@link TokenSessionService#revokeAllInCurrentTransaction(Long)}——它在<b>调用方事务内</b>
 * 递增 {@code token_epoch} 并登记「提交后清 Redis 镜像」。
 * 不能改用 {@code revokeAll}（{@code REQUIRES_NEW}）：本方法此刻已持锁写了同一行
 * {@code sys_user}，内层新事务会去抢自己持有的行锁而自锁等待；也不能只递增纪元而不清缓存，
 * 否则纪元镜像仍是旧值，比对照样通过，吊销等于没做（GAP-02 的根因）。</p>
 *
 * <p><b>所有写操作都校验受影响行数：</b>0 行意味着目标已被并发删除，
 * 此时抛 {@code 1015} 而不是静默成功——静默成功会让调用方以为改完了，
 * 前端刷新后却发现没有任何变化，且审计链路无从判断到底发生过什么。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserAdminPortAdapter implements UserAdminPort {

    private final UserMapper userMapper;
    private final DeptMapper deptMapper;
    private final PasswordEncoder passwordEncoder;
    private final TokenSessionService sessionService;

    @Override
    public Optional<UserRow> findById(Long userId) {
        return Optional.ofNullable(userMapper.selectById(userId)).map(UserAdminPortAdapter::toRow);
    }

    @Override
    public Optional<DeptRow> findDept(Long deptId) {
        if (deptId == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(deptMapper.selectById(deptId)).map(UserAdminPortAdapter::toDeptRow);
    }

    @Override
    public boolean existsUsername(String username) {
        return userMapper.countUsernameAnyState(username) > 0;
    }

    @Override
    public boolean existsEmail(String email, Long excludeUserId) {
        if (email == null || email.isBlank()) {
            return false;
        }
        return userMapper.countEmailInUse(email, excludeUserId) > 0;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Long create(NewUser newUser) {
        SysUser user = new SysUser();
        user.setUsername(newUser.username());
        user.setPasswordHash(passwordEncoder.encode(newUser.rawPassword()));
        user.setNickname(newUser.nickname());
        user.setEmail(newUser.email());
        user.setMobile(newUser.mobile());
        user.setDeptId(newUser.deptId());
        user.setRemark(newUser.remark());
        user.setStatus(SysUser.STATUS_NORMAL);
        // 新建账号从纪元 0 起算：与 access token 的 ver claim 对得上，旧会话概念不存在
        user.setTokenEpoch(0L);
        user.setCreateBy(newUser.operatorId());
        user.setUpdateBy(newUser.operatorId());
        userMapper.insert(user);
        log.info("系统管理面建号：userId={}, username={}, operator={}",
                user.getId(), user.getUsername(), newUser.operatorId());
        return user.getId();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateProfile(Long userId, ProfilePatch patch) {
        SysUser update = new SysUser();
        update.setId(userId);
        update.setNickname(patch.nickname());
        update.setEmail(emptyToNull(patch.email()));
        update.setMobile(emptyToNull(patch.mobile()));
        update.setRemark(patch.remark());
        update.setUpdateBy(patch.operatorId());
        // 说明：MyBatis-Plus 只更新非 null 字段，故「把邮箱清空」需走空串→null 的显式语义，
        // 且无法把备注清成 NULL；这是刻意的保守取舍——管理面宁可「清不掉」也不要「误清」。
        requireAffected(userMapper.updateById(update), userId, "更新用户资料");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void resetPassword(Long userId, String rawPassword, Long operatorId) {
        String hash = passwordEncoder.encode(rawPassword);
        requireAffected(userMapper.updatePassword(userId, hash, operatorId), userId, "重置密码");
        // 改密必须吊销在途会话：否则旧 refresh token 仍能换出可用 access token，重置形同虚设。
        // 走同事务递增纪元 + 提交后清缓存，保证「提交那一刻」旧令牌就作废（见类注）。
        sessionService.revokeAllInCurrentTransaction(userId);
        log.info("系统管理面重置密码：userId={}, operator={}", userId, operatorId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void changeStatus(Long userId, int status, Long operatorId) {
        requireAffected(userMapper.updateStatus(userId, status, operatorId), userId, "变更账号状态");
        if (status == STATUS_DISABLED) {
            // 停用即吊销：纪元 +1 与「提交后清缓存」必须成对，只做前者等于没生效（GAP-02）
            sessionService.revokeAllInCurrentTransaction(userId);
        }
        log.info("系统管理面变更账号状态：userId={}, status={}, operator={}", userId, status, operatorId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void changeDept(Long userId, Long deptId, Long operatorId) {
        requireAffected(userMapper.updateDept(userId, deptId, operatorId), userId, "调整所属部门");
        log.info("系统管理面调岗：userId={}, deptId={}, operator={}", userId, deptId, operatorId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void softDelete(Long userId, Long operatorId) {
        requireAffected(userMapper.deleteById(userId), userId, "删除用户");
        // 已注销账号不得靠残留令牌继续访问（access 缓存里还留着旧纪元的镜像）
        sessionService.revokeAllInCurrentTransaction(userId);
        log.info("系统管理面删除用户：userId={}, operator={}", userId, operatorId);
    }

    @Override
    public PageResult<UserRow> page(UserQuery query) {
        Page<SysUser> page = new Page<>(query.current(), query.size());
        IPage<SysUser> result = userMapper.selectAdminPage(page, query.keyword(), query.status(),
                query.deptId(), query.includeSubtree(), query.restrictUserId());
        List<UserRow> rows = result.getRecords().stream().map(UserAdminPortAdapter::toRow).toList();
        return PageResult.of(rows, result.getTotal(), result.getCurrent(), result.getSize());
    }

    @Override
    public List<DeptRow> listDeptOptions() {
        return deptMapper.selectList(Wrappers.<SysDept>lambdaQuery()
                        .eq(SysDept::getStatus, SysDept.STATUS_ENABLED)
                        .orderByAsc(SysDept::getSortNo)
                        .orderByAsc(SysDept::getId))
                .stream()
                .map(UserAdminPortAdapter::toDeptRow)
                .toList();
    }

    /* ============================ 内部工具 ============================ */

    /** 写操作零行即目标已被并发删除：抛业务错误而非静默成功（见类注）。 */
    private void requireAffected(int affected, Long userId, String action) {
        if (affected == 0) {
            log.warn("系统管理面{}失败：目标不存在或已被删除，userId={}", action, userId);
            throw new BusinessException(ErrorCode.USER_NOT_FOUND);
        }
    }

    /** 空串与 null 在「未填写」语义上等价，统一收敛为 null，避免唯一性/去重判定出现两种空值。 */
    private static String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static UserRow toRow(SysUser user) {
        return new UserRow(user.getId(), user.getUsername(), user.getNickname(), user.getEmail(),
                user.getMobile(), user.getDeptId(), user.getStatus(), user.getLastLoginTime(),
                user.getCreateTime());
    }

    private static DeptRow toDeptRow(SysDept dept) {
        return new DeptRow(dept.getId(), dept.getParentId(), dept.getName(), dept.getStatus());
    }
}
