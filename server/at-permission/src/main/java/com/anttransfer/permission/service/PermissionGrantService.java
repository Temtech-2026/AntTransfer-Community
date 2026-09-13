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
import com.anttransfer.common.event.PermissionExpiredEvent;
import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.permission.extension.AccessRuleContext;
import com.anttransfer.permission.extension.AccessRuleDecision;
import com.anttransfer.permission.extension.AccessRuleResolverChain;
import com.anttransfer.permission.model.entity.PermissionGrant;
import com.anttransfer.permission.repository.PermissionGrantMapper;
import com.anttransfer.permission.util.AfterCommitUtils;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 授权生效判定与权限重评估。
 *
 * <h3>① 实时过期判断（不依赖定时任务）</h3>
 * 判据恒为 {@code status=1 AND (expire_at IS NULL OR expire_at > now())}，其中 {@code now()} 由
 * <b>数据库时钟</b>给出——见 {@link PermissionGrantMapper#countActiveGrant}。定时回收任务只负责
 * 「把已过期记录收敛为 2 并通知」，不是放行判定的前置条件，因此不存在「已过期但任务未跑」的放行窗口
 * （[T-02] 口径）。
 *
 * <h3>② 调岗 / 离职权限重评估</h3>
 * {@link #revokeApprovalGrants(Long)} 回收该用户<b>来源为审批获得</b>（{@code grant_source=2}）
 * 的全部生效授权，CAS 置 {@code 3-撤销}，事务提交后发 {@link PermissionExpiredEvent}
 * 供审计 / 通知侧消费。角色继承授权（{@code grant_source=1}）随 RBAC 角色变更失效，不在本入口处理。
 * 供 at-user（4.6 用户管理）在调岗 / 离职时调用。
 *
 * @author AntTransfer CE
 */
@Slf4j
@Service
public class PermissionGrantService {

    private final PermissionGrantMapper grantMapper;
    private final PermissionService permissionService;
    private final ApplicationEventPublisher eventPublisher;
    private final AccessRuleResolverChain accessRuleResolverChain;
    private final PermissionAuditLogger auditLogger;

    public PermissionGrantService(PermissionGrantMapper grantMapper,
                                  PermissionService permissionService,
                                  ApplicationEventPublisher eventPublisher,
                                  AccessRuleResolverChain accessRuleResolverChain,
                                  PermissionAuditLogger auditLogger) {
        this.grantMapper = grantMapper;
        this.permissionService = permissionService;
        this.eventPublisher = eventPublisher;
        this.accessRuleResolverChain = accessRuleResolverChain;
        this.auditLogger = auditLogger;
    }

    /**
     * 实时判定：用户对指定资源是否持有指定动作的生效授权。
     *
     * <p>过期判断交给数据库时钟，授权刚过期即刻不再放行，无需等待回收任务。</p>
     */
    public boolean hasActiveGrant(Long userId, String resourceType, Long resourceId, String grantType) {
        if (userId == null || resourceId == null || grantType == null) {
            return false;
        }
        return grantMapper.countActiveGrant(userId, resourceType, resourceId, grantType) > 0;
    }

    /**
     * 断言持有生效授权，否则抛 {@code 1003}（无权限）。
     *
     * <p>供业务模块在对象级访问控制中调用（与 RBAC 权限点判定互补）。</p>
     */
    public void assertActiveGrant(Long userId, String resourceType, Long resourceId, String grantType) {
        assertActiveGrant(userId, resourceType, resourceId, grantType, null, null);
    }

    /**
     * 断言持有生效授权 + 通过 ABAC 规则（时间 / IP 等），否则抛 {@code 1003}（无权限）。
     *
     * <p>ABAC 为 P1 扩展点：CE 未注册任何 {@link AccessRuleResolverChain} 解析器时结论恒为
     * {@link AccessRuleDecision#ABSTAIN}，行为与四参版本一致；EE 注册解析器后 Deny 优先生效。</p>
     *
     * @param clientIp    客户端 IP（可空）
     * @param requestTime 访问时刻（为空以服务端当前时间为准）
     */
    public void assertActiveGrant(Long userId, String resourceType, Long resourceId, String grantType,
                                  String clientIp, LocalDateTime requestTime) {
        if (!hasActiveGrant(userId, resourceType, resourceId, grantType)) {
            throw new AuthException(ErrorCode.NO_AUTH,
                    "无该资源授权或授权已过期：" + resourceType + "/" + resourceId + ":" + grantType);
        }
        LocalDateTime at = requestTime == null ? LocalDateTime.now() : requestTime;
        AccessRuleContext context = new AccessRuleContext(userId, grantType, resourceType, resourceId, clientIp, at);
        if (accessRuleResolverChain.evaluate(context) == AccessRuleDecision.DENY) {
            throw new AuthException(ErrorCode.NO_AUTH,
                    "ABAC 规则拒绝该访问：" + resourceType + "/" + resourceId + ":" + grantType);
        }
    }

    /**
     * 权限重评估：回收指定用户全部「审批获得」的生效授权（调岗 / 离职场景）。
     *
     * <p>逐条 CAS（{@code status=1 → 3}）避免读改写；提交后统一发事件 + 失效权限缓存。</p>
     *
     * @param userId 被重评估用户 ID
     * @return 实际回收条数
     */
    @Transactional
    public int revokeApprovalGrants(Long userId) {
        List<PermissionGrant> grants = grantMapper.selectActiveApprovalGrants(userId);
        if (grants.isEmpty()) {
            return 0;
        }
        LocalDateTime now = LocalDateTime.now();
        List<PermissionExpiredEvent> events = new ArrayList<>(grants.size());
        List<Long> revokedIds = new ArrayList<>(grants.size());
        for (PermissionGrant grant : grants) {
            int rows = grantMapper.update(null, Wrappers.<PermissionGrant>lambdaUpdate()
                    .eq(PermissionGrant::getId, grant.getId())
                    .eq(PermissionGrant::getStatus, PermissionGrant.STATUS_ACTIVE)
                    .set(PermissionGrant::getStatus, PermissionGrant.STATUS_REVOKED)
                    .set(PermissionGrant::getRevokeAt, now));
            if (rows == 1) {
                events.add(new PermissionExpiredEvent(
                        grant.getId(), grant.getUserId(), grant.getResourceType(),
                        grant.getResourceId(), grant.getGrantType(), grant.getExpireAt(), now));
                revokedIds.add(grant.getId());
            }
        }
        // 授权回收是安全关键动作：即使调用方（用户管理）已记一条 USER_UPDATE，
        // 这里仍按「授权对象」单独留痕，便于追溯哪几条授权被谁回收、回收了几条。
        Map<String, Object> audit = new LinkedHashMap<>();
        audit.put("userId", userId);
        audit.put("matched", grants.size());
        audit.put("revoked", revokedIds.size());
        audit.put("grantIds", revokedIds);
        audit.put("reason", "调岗/离职审批授权重评估");
        auditLogger.success(OperationLog.ACTION_REVOKE, OperationLog.TARGET_USER, userId, audit);
        log.info("[permission] 权限重评估完成: userId={}, 命中={}, 实际回收={}",
                userId, grants.size(), events.size());
        AfterCommitUtils.run(() -> {
            events.forEach(eventPublisher::publishEvent);
            permissionService.invalidate(userId);
        });
        return events.size();
    }
}
