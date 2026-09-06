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

import com.anttransfer.common.constant.RedisKeyConstants;
import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.permission.config.PermissionProperties;
import com.anttransfer.permission.mapper.RbacAccessMapper;
import com.anttransfer.permission.model.PermissionModels.AccessSnapshot;
import com.anttransfer.permission.model.PermissionModels.RoleGrant;
import com.anttransfer.permission.security.AuthzContext;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 权限解析与判定（RBAC：多角色取并集；显式 Deny 优先）。
 *
 * <p>数据源与缓存（P-8）：角色 / 权限点以 DB 为准（sys_role_permission 并集）；
 * 解析结果缓存于 {@code at:perm:{userId}}（TTL 30 min，RedisKeyConstants.PERM_TTL_SECONDS），
 * Redis 丢失 / 抖动时回源 DB 重算——角色或授权变更后调用 {@link #invalidate(Long)} 主动失效，
 * 保证「分配角色后无需重新登录即时生效」（PRD US-04）。</p>
 *
 * <p>判定语义：先查<b>显式 Deny</b>（角色黑名单，{@code anttransfer.permission.role-deny}），
 * 命中即拒绝（Deny 优先，即使其他角色已授予）；再查多角色授权的 <b>并集</b>。</p>
 *
 * @author AntTransfer CE
 */
@Service
public class PermissionService {

    private static final Logger log = LoggerFactory.getLogger(PermissionService.class);

    private final RbacAccessMapper mapper;
    private final PermissionProperties properties;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    public PermissionService(RbacAccessMapper mapper,
                             PermissionProperties properties,
                             StringRedisTemplate redis,
                             ObjectMapper objectMapper) {
        this.mapper = mapper;
        this.properties = properties;
        this.redis = redis;
        this.objectMapper = objectMapper;
    }

    /**
     * 解析当前登录用户权限快照（缓存命中直接返回；miss 回源 DB）。
     */
    public AccessSnapshot current() {
        return resolve(AuthzContext.currentUser().getId());
    }

    /**
     * 解析指定用户权限快照。
     */
    public AccessSnapshot resolve(Long userId) {
        AccessSnapshot cached = readCache(userId);
        if (cached != null) {
            return cached;
        }
        AccessSnapshot snapshot = loadFromDb(userId);
        writeCache(userId, snapshot);
        return snapshot;
    }

    /**
     * 校验当前登录用户是否具备指定权限点；不满足抛 {@code AuthException(NO_AUTH)}（HTTP 403）。
     */
    public void requirePerm(String permCode) {
        requirePerm(List.of(permCode), false, "", current());
    }

    /**
     * 校验当前登录用户权限（{@code any=true} 满足其一，否则须全部）。
     */
    public void requirePerm(List<String> required, boolean any, String message) {
        requirePerm(required, any, message, current());
    }

    /**
     * 判定核心：不依赖 SecurityContext，面向显式传入的快照（内部复用 / 单元测试）。
     */
    public void requirePerm(List<String> required, boolean any, String message,
                            AccessSnapshot snapshot) {
        // Deny 优先：显式拒绝命中即 403（即使其他角色已授予）
        for (String perm : required) {
            if (snapshot.deniedPermCodes().contains(perm)) {
                throw deny(perm, message);
            }
        }
        Set<String> allowed = new LinkedHashSet<>(snapshot.permCodes());
        if (any ? required.stream().noneMatch(allowed::contains)
                : !allowed.containsAll(required)) {
            throw deny(String.join(",", required), message);
        }
    }

    /**
     * 授权 / 角色变更后的主动失效（调用方：权限管理写操作、角色分配、账号停用）。
     */
    public void invalidate(Long userId) {
        try {
            redis.delete(RedisKeyConstants.permKey(userId));
        } catch (Exception e) {
            log.warn("清理权限缓存失败 userId={}（不影响下次解析回源自愈）", userId, e);
        }
    }

    /* ============================ 私有实现 ============================ */

    /** 从 DB 计算：多角色授权并集 + 显式 Deny 剔除 + 最大数据范围 */
    private AccessSnapshot loadFromDb(Long userId) {
        List<RoleGrant> grants = mapper.selectRoles(userId);
        Set<String> roles = new LinkedHashSet<>();
        Set<String> denied = new LinkedHashSet<>();
        int dataScope = 1;
        for (RoleGrant grant : grants) {
            roles.add(grant.roleCode());
            denied.addAll(properties.deniedOf(grant.roleCode()));
            dataScope = Math.max(dataScope, grant.dataScope());
        }
        Set<String> allowed = new LinkedHashSet<>(mapper.selectPermCodes(userId));
        // 显式 Deny 剔除出放行集（Deny 优先）
        allowed.removeAll(denied);

        return new AccessSnapshot(
                userId,
                new ArrayList<>(roles),
                new ArrayList<>(allowed),
                new ArrayList<>(denied),
                dataScope);
    }

    private AccessSnapshot readCache(Long userId) {
        try {
            String json = redis.opsForValue().get(RedisKeyConstants.permKey(userId));
            if (json == null) {
                return null;
            }
            return objectMapper.readValue(json, AccessSnapshot.class);
        } catch (Exception e) {
            // 反序列化失败（版本变更）按 miss 回源 DB
            log.warn("读取权限缓存失败，回源 DB: userId={}", userId, e.getMessage());
            return null;
        }
    }

    private void writeCache(Long userId, AccessSnapshot snapshot) {
        try {
            redis.opsForValue().set(
                    RedisKeyConstants.permKey(userId),
                    objectMapper.writeValueAsString(snapshot),
                    Duration.ofSeconds(RedisKeyConstants.PERM_TTL_SECONDS));
        } catch (Exception e) {
            log.warn("写入权限缓存失败（不影响本次判定）: userId={}", userId, e.getMessage());
        }
    }

    private AuthException deny(String perm, String message) {
        if (message != null && !message.isBlank()) {
            return new AuthException(ErrorCode.NO_AUTH, message);
        }
        return new AuthException(ErrorCode.NO_AUTH,
                "无操作权限：" + perm + "（" + ErrorCode.NO_AUTH.getMessage() + "）");
    }
}
