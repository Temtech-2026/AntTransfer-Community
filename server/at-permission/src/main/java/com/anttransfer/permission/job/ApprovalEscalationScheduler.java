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

import com.anttransfer.common.constant.RedisKeyConstants;
import com.anttransfer.common.notify.NotificationCommand;
import com.anttransfer.common.notify.NotificationPort;
import com.anttransfer.common.notify.NotifyType;
import com.anttransfer.permission.config.ApprovalProperties;
import com.anttransfer.permission.model.ApprovalEnums;
import com.anttransfer.permission.model.entity.ApprovalRequest;
import com.anttransfer.permission.repository.ApprovalRequestMapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 超时未审批扫描任务（P0）：每 10 分钟扫描一次，超过敏感等级 SLA 仍未处置的申请单
 * <b>升级提醒上一级</b>（{@code escalation-approver-id} → 兜底 {@code default-approver-id} → 当前审批人）。
 *
 * <p>实现要点：</p>
 * <ul>
 *     <li><b>粗筛 + 精判</b>：DB 侧以最窄 SLA（高敏感 4h）粗筛活动态申请单（命中
 *         {@code idx_status_created}），再按各自等级精确判定是否超期，避免按等级写多条 OR 条件；</li>
 *     <li><b>幂等抑制</b>：以 Redis {@code at:perm:escalate:{applicationId}} SETNX 抑制重复提醒
 *         （默认 24h）。该键丢失只会多提醒一次，<b>不影响审批状态正确性</b>（P-8）；</li>
 *     <li>本任务只提醒、不改状态——状态迁移始终由审批人 CAS 动作驱动。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Component
public class ApprovalEscalationScheduler {

    private final ApprovalRequestMapper requestMapper;
    private final ApprovalProperties properties;
    private final NotificationPort notificationPort;
    private final StringRedisTemplate redisTemplate;

    public ApprovalEscalationScheduler(ApprovalRequestMapper requestMapper,
                                       ApprovalProperties properties,
                                       NotificationPort notificationPort,
                                       StringRedisTemplate redisTemplate) {
        this.requestMapper = requestMapper;
        this.properties = properties;
        this.notificationPort = notificationPort;
        this.redisTemplate = redisTemplate;
    }

    /** 每小时（默认每 10 分钟）扫描超时未审批申请单并升级提醒上一级。 */
    @Scheduled(cron = "${anttransfer.permission.approval.escalation-cron:0 */10 * * * ?}")
    public void escalateOverdue() {
        LocalDateTime now = LocalDateTime.now();
        List<ApprovalRequest> candidates = loadCandidates(now);
        if (candidates.isEmpty()) {
            return;
        }
        int escalated = 0;
        for (ApprovalRequest request : candidates) {
            if (request.getCreateTime() == null) {
                continue;
            }
            int level = ApprovalEnums.normalizeLevel(request.getLevel());
            Duration sla = properties.slaOf(level);
            LocalDateTime deadline = request.getCreateTime().plus(sla);
            if (deadline.isAfter(now)) {
                continue;
            }
            Long target = escalationTarget(request);
            if (target == null) {
                log.warn("[permission] 申请单超时但无升级提醒对象（未配置升级人/兜底审批人）: no={}",
                        request.getApplicationNo());
                continue;
            }
            if (!acquireIdempotentKey(request.getId())) {
                continue;
            }
            notificationPort.send(new NotificationCommand(
                    target, NotifyType.APPROVAL_TODO,
                    "【超时升级】权限申请待审批",
                    "申请单 " + request.getApplicationNo() + " 已超过该敏感等级 SLA（"
                            + sla.toMinutes() + " 分钟）仍未审批，请尽快处理",
                    NotificationCommand.BIZ_APPLICATION, request.getId()));
            escalated++;
        }
        if (escalated > 0) {
            log.info("[permission] 超时未审批升级提醒完成: 扫描={}, 提醒={}", candidates.size(), escalated);
        }
    }

    /** 以最窄 SLA 粗筛活动态申请单（高敏感 4h 内即可能超期），再逐条精判。 */
    private List<ApprovalRequest> loadCandidates(LocalDateTime now) {
        return requestMapper.selectList(Wrappers.<ApprovalRequest>lambdaQuery()
                .in(ApprovalRequest::getStatus,
                        ApprovalRequest.STATUS_PENDING, ApprovalRequest.STATUS_TRANSFERRED)
                .le(ApprovalRequest::getCreateTime, now.minus(properties.getSlaHigh()))
                .orderByAsc(ApprovalRequest::getCreateTime)
                .last("limit " + Math.max(properties.getScanBatchSize(), 1)));
    }

    /** 升级提醒对象：上一级 → 兜底审批人 → 当前审批人。 */
    private Long escalationTarget(ApprovalRequest request) {
        if (properties.getEscalationApproverId() != null) {
            return properties.getEscalationApproverId();
        }
        if (properties.getDefaultApproverId() != null) {
            return properties.getDefaultApproverId();
        }
        return request.getApproverId();
    }

    /** Redis SETNX 幂等：拿到键才提醒（避免每分钟轰炸）。 */
    private boolean acquireIdempotentKey(Long applicationId) {
        Boolean first = redisTemplate.opsForValue().setIfAbsent(
                RedisKeyConstants.permEscalationKey(applicationId),
                "1", properties.getEscalationIdempotentWindow());
        return Boolean.TRUE.equals(first);
    }
}
