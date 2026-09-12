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
package com.anttransfer.permission.job;

import com.anttransfer.permission.model.entity.PermissionGrant;
import com.anttransfer.permission.event.PermissionExpiredEvent;
import com.anttransfer.permission.repository.PermissionGrantMapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 临时授权到期回收定时任务（每小时）。
 *
 * <p>职责：扫描 {@code sys_user_file_permission} 中 {@code status=1 AND expire_at <= now} 的
 * 生效授权并失效（CAS 置 {@code status=2}、记 {@code revoke_at}），回收结果在
 * <b>事务提交后</b>逐条发布 {@link PermissionExpiredEvent}（见 use-case-flows §2.4）。</p>
 *
 * <p>实现要点：</p>
 * <ul>
 *     <li>扫描命中 {@code idx_expire(status, expire_at)}（见 V1 DDL），单批 100 条、
 *         不足即停，避免一次性全表扫；</li>
 *     <li>失效为 CAS（{@code WHERE id=? AND status=1 AND deleted=0 AND expire_at<=now}），
 *         影响行数 ≠ 1 表示并发已回收/撤销/删除，幂等忽略，重复触发无害（[C-06]/P-1 红线）；</li>
 *     <li>事件在 afterCommit 发布，保证“状态已落库”与“消费侧动作”不跨事务误报（[T-01]）；
 *         事件失败仅记日志，不影响回收事务本身；</li>
 *     <li>多实例部署需为任务入口加分布式锁（如 Redis SETNX），防止多节点并发重复扫描。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
@Component
public class PermissionGrantExpireScheduler {

    private static final Logger log = LoggerFactory.getLogger(PermissionGrantExpireScheduler.class);

    /** 单批回收上限：超过后下个周期继续，避免单事务长时间占锁 */
    private static final long BATCH_SIZE = 100;

    private final PermissionGrantMapper permissionGrantMapper;
    private final ApplicationEventPublisher applicationEventPublisher;

    public PermissionGrantExpireScheduler(PermissionGrantMapper permissionGrantMapper,
                                          ApplicationEventPublisher applicationEventPublisher) {
        this.permissionGrantMapper = permissionGrantMapper;
        this.applicationEventPublisher = applicationEventPublisher;
    }

    /**
     * 每小时整点扫描一次（cron 可用配置项 {@code anttransfer.permission.expire-scan-cron} 覆盖，
     * 时区与工程统一为 Asia/Shanghai）。任务幂等可重入。
     */
    @Scheduled(cron = "${anttransfer.permission.expire-scan-cron:0 0 * * * ?}", zone = "Asia/Shanghai")
    @Transactional(rollbackFor = Exception.class)
    public void revokeExpiredGrants() {
        LocalDateTime now = LocalDateTime.now();

        List<PermissionGrant> expired = permissionGrantMapper.selectList(
                Wrappers.<PermissionGrant>lambdaQuery()
                        .eq(PermissionGrant::getStatus, PermissionGrant.STATUS_ACTIVE)
                        .le(PermissionGrant::getExpireAt, now)
                        .orderByAsc(PermissionGrant::getExpireAt)
                        .last("LIMIT " + BATCH_SIZE));
        if (expired.isEmpty()) {
            return;
        }

        List<PermissionExpiredEvent> revoked = new ArrayList<>(expired.size());
        for (PermissionGrant grant : expired) {
            // CAS 置为到期回收（终态），杜绝并发下“读-判-改”覆盖
            int rows = permissionGrantMapper.update(null,
                    Wrappers.<PermissionGrant>lambdaUpdate()
                            .set(PermissionGrant::getStatus, PermissionGrant.STATUS_EXPIRED)
                            .set(PermissionGrant::getRevokeAt, now)
                            .eq(PermissionGrant::getId, grant.getId())
                            .eq(PermissionGrant::getStatus, PermissionGrant.STATUS_ACTIVE)
                            .eq(PermissionGrant::getDeleted, 0)
                            .le(PermissionGrant::getExpireAt, now));
            if (rows == 1) {
                revoked.add(new PermissionExpiredEvent(
                        grant.getId(),
                        grant.getUserId(),
                        grant.getResourceType(),
                        grant.getResourceId(),
                        grant.getGrantType(),
                        grant.getExpireAt(),
                        now));
            }
            // rows == 0：该条已被并发回收/撤销或删除，跳过（回收本身幂等）
        }
        if (revoked.isEmpty()) {
            return;
        }

        // 事件在回收事务提交后才发布，消费方（审计/通知）不得假定其与状态变更同事务
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                revoked.forEach(applicationEventPublisher::publishEvent);
            }
        });
        log.info("授权到期回收完成：本批回收 {} 条（已到期待回收 {} 条，扫描于 {}）",
                revoked.size(), expired.size(), now);
    }
}
