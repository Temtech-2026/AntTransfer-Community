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
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 紧急审批通道（P1，开关 {@code anttransfer.permission.approval.emergency.enabled}，默认关闭）。
 *
 * <p>对<b>中敏感及以下</b>（{@code level <= 2}）且在<b>创建 1h 内</b>的活动态申请单，向审批人发送
 * 强提醒，缩短响应链路。高敏感（level=3）<b>不参与</b>本通道——高密级必须走常规审批节奏，
 * 不允许被「紧急」名义催办（PRD §8 边界）。</p>
 *
 * <p>仅为提醒加速，不改变审批流程与状态机；未开启开关时本 Bean 不装配、任务不注册。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "anttransfer.permission.approval.emergency",
        name = "enabled", havingValue = "true")
public class EmergencyApprovalScheduler {

    private final ApprovalRequestMapper requestMapper;
    private final ApprovalProperties properties;
    private final NotificationPort notificationPort;
    private final StringRedisTemplate redisTemplate;

    public EmergencyApprovalScheduler(ApprovalRequestMapper requestMapper,
                                      ApprovalProperties properties,
                                      NotificationPort notificationPort,
                                      StringRedisTemplate redisTemplate) {
        this.requestMapper = requestMapper;
        this.properties = properties;
        this.notificationPort = notificationPort;
        this.redisTemplate = redisTemplate;
    }

    /** 强提醒窗口内的中低敏感申请单。 */
    @Scheduled(cron = "${anttransfer.permission.approval.emergency.cron:0 */10 * * * ?}")
    public void remindWithinWindow() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime windowStart = now.minus(properties.getEmergency().getWindow());
        List<ApprovalRequest> candidates = requestMapper.selectList(Wrappers.<ApprovalRequest>lambdaQuery()
                .in(ApprovalRequest::getStatus,
                        ApprovalRequest.STATUS_PENDING, ApprovalRequest.STATUS_TRANSFERRED)
                .le(ApprovalRequest::getLevel, ApprovalEnums.LEVEL_MEDIUM)
                .ge(ApprovalRequest::getCreateTime, windowStart)
                .orderByAsc(ApprovalRequest::getCreateTime)
                .last("limit " + Math.max(properties.getScanBatchSize(), 1)));
        if (candidates.isEmpty()) {
            return;
        }
        int reminded = 0;
        for (ApprovalRequest request : candidates) {
            if (request.getApproverId() == null) {
                continue;
            }
            if (!acquireIdempotentKey(request.getId())) {
                continue;
            }
            notificationPort.send(new NotificationCommand(
                    request.getApproverId(), NotifyType.APPROVAL_TODO,
                    "【紧急】权限申请待审批",
                    "申请单 " + request.getApplicationNo() + " 处于紧急通道窗口内，请优先处理",
                    NotificationCommand.BIZ_APPLICATION, request.getId()));
            reminded++;
        }
        if (reminded > 0) {
            log.info("[permission] 紧急通道强提醒完成: 扫描={}, 提醒={}", candidates.size(), reminded);
        }
    }

    /** Redis SETNX 幂等：同一申请单在幂等窗口内只强提醒一次。 */
    private boolean acquireIdempotentKey(Long applicationId) {
        Boolean first = redisTemplate.opsForValue().setIfAbsent(
                RedisKeyConstants.permEmergencyKey(applicationId),
                "1", properties.getEmergency().getIdempotentWindow());
        return Boolean.TRUE.equals(first);
    }
}
