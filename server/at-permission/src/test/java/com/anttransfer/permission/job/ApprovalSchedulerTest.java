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

import com.anttransfer.common.notify.NotificationCommand;
import com.anttransfer.common.notify.NotificationPort;
import com.anttransfer.permission.MybatisPlusTestSupport;
import com.anttransfer.permission.config.ApprovalProperties;
import com.anttransfer.permission.model.ApprovalEnums;
import com.anttransfer.permission.model.entity.ApprovalRequest;
import com.anttransfer.permission.repository.ApprovalRequestMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 审批「超时升级（P0）」与「紧急通道（P1）」两个扫描任务的参数化单测。
 *
 * <p><b>为什么要参数化</b>：超时判定是「按敏感等级取不同 SLA」的分段函数
 * （低 24h / 中 12h / 高 4h），最容易被写成一条写死的比较。用等级 × 申请时长的
 * 矩阵把三段 SLA 的两侧边界一次性钉住，任何把 SLA 配错、或把等级归一化弄丢的改动
 * 都会立刻红。</p>
 *
 * <p><b>注意这是「只读扫描」任务</b>：它只发提醒、绝不动状态机。因此断言集中在
 * 「提醒对象 / 提醒次数 / 幂等键」，并显式验证「不改状态」这层隐含契约。</p>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ApprovalSchedulerTest {

    private static final long APPLICANT_ID = 1001L;
    private static final long APPROVER_ID = 2002L;
    private static final long ESCALATION_ID = 3003L;
    private static final long DEFAULT_APPROVER_ID = 4004L;
    private static final long APPLICATION_ID = 900_001L;

    @Mock
    private ApprovalRequestMapper requestMapper;
    @Mock
    private NotificationPort notificationPort;
    @Mock
    private StringRedisTemplate redisTemplate;
    @Mock
    private ValueOperations<String, String> valueOperations;

    private ApprovalProperties properties;
    private ApprovalEscalationScheduler escalationScheduler;
    private EmergencyApprovalScheduler emergencyScheduler;

    @BeforeAll
    static void initTableInfo() {
        // Wrappers.lambdaQuery() 需要实体列名缓存；纯单测无 Spring 启动流程
        MybatisPlusTestSupport.initTableInfo();
    }

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        // 默认幂等键可获取（首次提醒）
        when(valueOperations.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(true);

        properties = new ApprovalProperties();
        properties.setEscalationApproverId(ESCALATION_ID);
        properties.setDefaultApproverId(DEFAULT_APPROVER_ID);

        escalationScheduler = new ApprovalEscalationScheduler(
                requestMapper, properties, notificationPort, redisTemplate);
        emergencyScheduler = new EmergencyApprovalScheduler(
                requestMapper, properties, notificationPort, redisTemplate);
    }

    /* ==================== P0：超时未审批 → 升级提醒上一级 ==================== */

    @Nested
    @DisplayName("P0 超时升级（ApprovalEscalationScheduler）")
    class P0Escalation {

        /** 等级 × 申请已过时长 → 是否应升级。三段 SLA 的两侧边界各取一条。 */
        static Stream<Arguments> slaBoundaryMatrix() {
            return Stream.of(
                    // 低敏感（24h）：23h 未超、25h 已超
                    Arguments.of(ApprovalEnums.LEVEL_LOW, Duration.ofHours(23), false),
                    Arguments.of(ApprovalEnums.LEVEL_LOW, Duration.ofHours(25), true),
                    // 中敏感（12h）
                    Arguments.of(ApprovalEnums.LEVEL_MEDIUM, Duration.ofHours(11), false),
                    Arguments.of(ApprovalEnums.LEVEL_MEDIUM, Duration.ofHours(13), true),
                    // 高敏感（4h）
                    Arguments.of(ApprovalEnums.LEVEL_HIGH, Duration.ofHours(3), false),
                    Arguments.of(ApprovalEnums.LEVEL_HIGH, Duration.ofHours(5), true),
                    // 非法 / 缺省等级归一为低敏感，不得因脏数据漏提醒或误提醒
                    Arguments.of((Object) null, Duration.ofHours(25), true),
                    Arguments.of(99, Duration.ofHours(25), true)
            );
        }

        @ParameterizedTest(name = "等级={0}, 已过={1} → 应升级={2}")
        @MethodSource("slaBoundaryMatrix")
        @DisplayName("按敏感等级分段 SLA 判定超时，边界两侧行为正确")
        void escalate_shouldRespectPerLevelSla(Object level, Duration age, boolean shouldEscalate) {
            ApprovalRequest request = pendingRequest(level, LocalDateTime.now().minus(age));
            when(requestMapper.selectList(any())).thenReturn(List.of(request));

            escalationScheduler.escalateOverdue();

            if (!shouldEscalate) {
                verifyNoInteractions(notificationPort);
                return;
            }
            NotificationCommand sent = captureSingleNotification();
            assertThat(sent.recipientUserId()).isEqualTo(ESCALATION_ID);
            assertThat(sent.bizId()).isEqualTo(APPLICATION_ID);
            assertThat(sent.bizType()).isEqualTo(NotificationCommand.BIZ_APPLICATION);
            assertThat(sent.title()).contains("超时升级");
            // 正文必须带该等级的 SLA 分钟数，便于审批人判断紧急程度
            assertThat(sent.content()).contains(String.valueOf(properties.slaOf(ApprovalEnums.normalizeLevel(
                    level instanceof Integer i ? i : null)).toMinutes()));
        }

        @Test
        @DisplayName("无候选申请单：不得触碰 Redis、不得发通知（避免空扫描产生副作用）")
        void escalate_withoutCandidates_shouldDoNothing() {
            when(requestMapper.selectList(any())).thenReturn(List.of());

            escalationScheduler.escalateOverdue();

            verifyNoInteractions(notificationPort);
            verifyNoInteractions(redisTemplate);
        }

        @Test
        @DisplayName("幂等键已被占用：同一申请单在窗口内不重复提醒")
        void escalate_whenIdempotentKeyHeld_shouldSkip() {
            ApprovalRequest request = pendingRequest(ApprovalEnums.LEVEL_HIGH,
                    LocalDateTime.now().minusHours(6));
            when(requestMapper.selectList(any())).thenReturn(List.of(request));
            when(valueOperations.setIfAbsent(anyString(), anyString(), any(Duration.class)))
                    .thenReturn(false);

            escalationScheduler.escalateOverdue();

            verifyNoInteractions(notificationPort);
        }

        @Test
        @DisplayName("未配置升级人：回退兜底审批人；两者都空则回退当前审批人")
        void escalate_shouldFallbackApproverChain() {
            ApprovalRequest request = pendingRequest(ApprovalEnums.LEVEL_HIGH,
                    LocalDateTime.now().minusHours(6));
            when(requestMapper.selectList(any())).thenReturn(List.of(request));

            // ① 配了升级人 → 优先升级人
            escalationScheduler.escalateOverdue();
            assertThat(lastNotification().recipientUserId()).isEqualTo(ESCALATION_ID);

            // ② 未配升级人 → 兜底审批人
            properties.setEscalationApproverId(null);
            escalationScheduler.escalateOverdue();
            assertThat(lastNotification().recipientUserId()).isEqualTo(DEFAULT_APPROVER_ID);

            // ③ 都未配 → 当前审批人
            properties.setDefaultApproverId(null);
            escalationScheduler.escalateOverdue();
            assertThat(lastNotification().recipientUserId()).isEqualTo(APPROVER_ID);
        }

        @Test
        @DisplayName("升级链全为空：跳过该条且不抛异常（脏配置不得中断整批扫描）")
        void escalate_withoutAnyTarget_shouldSkipWithoutFailing() {
            properties.setEscalationApproverId(null);
            properties.setDefaultApproverId(null);
            ApprovalRequest request = pendingRequest(ApprovalEnums.LEVEL_HIGH,
                    LocalDateTime.now().minusHours(6));
            request.setApproverId(null);
            when(requestMapper.selectList(any())).thenReturn(List.of(request));

            escalationScheduler.escalateOverdue();

            verifyNoInteractions(notificationPort);
        }

        @Test
        @DisplayName("只扫描不改状态：任务不得回写审批单状态（状态迁移只由审批人 CAS 驱动）")
        void escalate_shouldNeverMutateRequestState() {
            ApprovalRequest request = pendingRequest(ApprovalEnums.LEVEL_HIGH,
                    LocalDateTime.now().minusHours(6));
            request.setStatus(ApprovalRequest.STATUS_PENDING);
            when(requestMapper.selectList(any())).thenReturn(List.of(request));

            escalationScheduler.escalateOverdue();

            verify(requestMapper, never()).update(any(), any());
            verify(requestMapper, never()).updateById(any(ApprovalRequest.class));
            assertThat(request.getStatus()).isEqualTo(ApprovalRequest.STATUS_PENDING);
        }

        @Test
        @DisplayName("多条超时申请：逐条提醒（提醒次数 = 申请条数）")
        void escalate_shouldRemindEachOverdueRequest() {
            ApprovalRequest first = pendingRequest(ApprovalEnums.LEVEL_HIGH,
                    LocalDateTime.now().minusHours(6));
            ApprovalRequest second = pendingRequest(ApprovalEnums.LEVEL_MEDIUM,
                    LocalDateTime.now().minusHours(20));
            second.setId(APPLICATION_ID + 1);
            when(requestMapper.selectList(any())).thenReturn(List.of(first, second));

            escalationScheduler.escalateOverdue();

            verify(notificationPort, times(2)).send(any());
        }
    }

    /* ==================== P1：紧急通道强提醒 ==================== */

    @Nested
    @DisplayName("P1 紧急通道（EmergencyApprovalScheduler）")
    class P1Emergency {

        @Test
        @DisplayName("窗口内的申请单：向审批人发强提醒，业务关联指向申请单")
        void remind_shouldNotifyApproverWithinWindow() {
            ApprovalRequest request = pendingRequest(ApprovalEnums.LEVEL_MEDIUM,
                    LocalDateTime.now().minusMinutes(10));
            when(requestMapper.selectList(any())).thenReturn(List.of(request));

            emergencyScheduler.remindWithinWindow();

            NotificationCommand sent = captureSingleNotification();
            assertThat(sent.recipientUserId()).isEqualTo(APPROVER_ID);
            assertThat(sent.bizId()).isEqualTo(APPLICATION_ID);
            assertThat(sent.title()).contains("紧急");
        }

        @Test
        @DisplayName("幂等键占用：同一申请单在幂等窗口内不重复强提醒")
        void remind_whenIdempotentKeyHeld_shouldSkip() {
            ApprovalRequest request = pendingRequest(ApprovalEnums.LEVEL_MEDIUM,
                    LocalDateTime.now().minusMinutes(10));
            when(requestMapper.selectList(any())).thenReturn(List.of(request));
            when(valueOperations.setIfAbsent(anyString(), anyString(), any(Duration.class)))
                    .thenReturn(false);

            emergencyScheduler.remindWithinWindow();

            verifyNoInteractions(notificationPort);
        }

        @Test
        @DisplayName("审批人为空：跳过（紧急通道不得把通知丢进虚空）")
        void remind_withoutApprover_shouldSkip() {
            ApprovalRequest request = pendingRequest(ApprovalEnums.LEVEL_MEDIUM,
                    LocalDateTime.now().minusMinutes(10));
            request.setApproverId(null);
            when(requestMapper.selectList(any())).thenReturn(List.of(request));

            emergencyScheduler.remindWithinWindow();

            verifyNoInteractions(notificationPort);
        }

        @Test
        @DisplayName("无候选：不触碰 Redis")
        void remind_withoutCandidates_shouldDoNothing() {
            when(requestMapper.selectList(any())).thenReturn(List.of());

            emergencyScheduler.remindWithinWindow();

            verifyNoInteractions(notificationPort);
            verifyNoInteractions(redisTemplate);
        }
    }

    /* ============================ 辅助方法 ============================ */

    private static ApprovalRequest pendingRequest(Object level, LocalDateTime createTime) {
        ApprovalRequest request = new ApprovalRequest();
        request.setId(APPLICATION_ID);
        request.setApplicationNo("AP20260914001");
        request.setApplicantId(APPLICANT_ID);
        request.setApproverId(APPROVER_ID);
        request.setLevel(level instanceof Integer i ? i : null);
        request.setStatus(ApprovalRequest.STATUS_PENDING);
        request.setCreateTime(createTime);
        return request;
    }

    private NotificationCommand captureSingleNotification() {
        ArgumentCaptor<NotificationCommand> captor = ArgumentCaptor.forClass(NotificationCommand.class);
        verify(notificationPort, times(1)).send(captor.capture());
        return captor.getValue();
    }

    /** 多次调用后取最后一次通知（用于验证「回退链」的逐级切换）。 */
    private NotificationCommand lastNotification() {
        ArgumentCaptor<NotificationCommand> captor = ArgumentCaptor.forClass(NotificationCommand.class);
        verify(notificationPort, atLeastOnce()).send(captor.capture());
        List<NotificationCommand> all = captor.getAllValues();
        return all.get(all.size() - 1);
    }
}
