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

import com.anttransfer.common.event.PermissionExpiredEvent;
import com.anttransfer.permission.MybatisPlusTestSupport;
import com.anttransfer.permission.model.ApprovalEnums;
import com.anttransfer.permission.model.entity.PermissionGrant;
import com.anttransfer.permission.repository.PermissionGrantMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
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
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 临时授权「到期回收」定时任务单测。
 *
 * <p>本类盯的是两条最容易写错、且事故面很大的契约：</p>
 * <ol>
 *     <li><b>CAS 幂等</b>：回收必须是 {@code WHERE id=? AND status=1 AND deleted=0 AND expire_at<=now}
 *         的条件更新；影响行数为 0 说明并发已被撤销/回收，必须静默跳过而不是照样发事件——
 *         否则会通知「权限已到期」，而实际是「已被管理员撤销」。</li>
 *     <li><b>afterCommit 时序</b>：{@link PermissionExpiredEvent} 只能在回收事务提交后发布。
 *         这里用 {@link TransactionSynchronizationManager} 显式模拟事务边界，验证
 *         「未提交 → 零事件」「提交 → 事件数 = 成功回收条数」，把时序红线钉在测试里。</li>
 * </ol>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PermissionGrantExpireSchedulerTest {

    private static final long USER_ID = 5005L;
    private static final long RESOURCE_ID = 7007L;

    @Mock
    private PermissionGrantMapper permissionGrantMapper;
    @Mock
    private ApplicationEventPublisher applicationEventPublisher;

    private PermissionGrantExpireScheduler scheduler;

    @BeforeAll
    static void initTableInfo() {
        // Wrappers.lambdaQuery()/lambdaUpdate() 需要实体列名缓存
        MybatisPlusTestSupport.initTableInfo();
    }

    @BeforeEach
    void setUp() {
        scheduler = new PermissionGrantExpireScheduler(permissionGrantMapper, applicationEventPublisher);
    }

    @AfterEach
    void clearTransactionBoundary() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    /* ==================== 主干：CAS 成功后 afterCommit 逐条发布 ==================== */

    @Test
    @DisplayName("到期回收：CAS 成功后仅在事务提交时逐条发布事件，提交前不得发布")
    void revokeExpiredGrants_shouldPublishOnlyAfterCommit() {
        PermissionGrant first = activeGrant(11L, ApprovalEnums.RESOURCE_FILE, "ACCESS",
                LocalDateTime.now().minusMinutes(5));
        PermissionGrant second = activeGrant(12L, ApprovalEnums.RESOURCE_SPACE, "DOWNLOAD",
                LocalDateTime.now().minusMinutes(1));
        when(permissionGrantMapper.selectList(any())).thenReturn(List.of(first, second));
        when(permissionGrantMapper.update(isNull(), any())).thenReturn(1);

        TransactionSynchronizationManager.initSynchronization();
        scheduler.revokeExpiredGrants();

        // 每条都走了一次条件更新（CAS 而非 updateById）
        verify(permissionGrantMapper, times(2)).update(isNull(), any());
        // 关键：事务未提交 → 一个事件都不能发
        verifyNoInteractions(applicationEventPublisher);

        commit();

        ArgumentCaptor<PermissionExpiredEvent> captor = ArgumentCaptor.forClass(PermissionExpiredEvent.class);
        verify(applicationEventPublisher, times(2)).publishEvent(captor.capture());
        List<PermissionExpiredEvent> events = captor.getAllValues();

        assertThat(events).extracting(PermissionExpiredEvent::grantId).containsExactly(11L, 12L);
        assertThat(events).extracting(PermissionExpiredEvent::resourceType)
                .containsExactly(ApprovalEnums.RESOURCE_FILE, ApprovalEnums.RESOURCE_SPACE);
        assertThat(events).extracting(PermissionExpiredEvent::grantType)
                .containsExactly("ACCESS", "DOWNLOAD");
        assertThat(events).allSatisfy(e -> {
            assertThat(e.userId()).isEqualTo(USER_ID);
            assertThat(e.resourceId()).isEqualTo(RESOURCE_ID);
            assertThat(e.expireAt()).isNotNull();
            assertThat(e.revokedAt()).isNotNull();
        });
    }

    @Test
    @DisplayName("CAS 影响行数为 0（并发已撤销/回收）：静默跳过，不得发布误导性「已到期」事件")
    void revokeExpiredGrants_whenCasLoses_shouldNotPublish() {
        PermissionGrant grant = activeGrant(21L, ApprovalEnums.RESOURCE_FILE, "ACCESS",
                LocalDateTime.now().minusMinutes(5));
        when(permissionGrantMapper.selectList(any())).thenReturn(List.of(grant));
        // 扫描看到了它，但 CAS 时已被并发修改 → rows == 0
        when(permissionGrantMapper.update(isNull(), any())).thenReturn(0);

        TransactionSynchronizationManager.initSynchronization();
        scheduler.revokeExpiredGrants();
        commit();

        verifyNoInteractions(applicationEventPublisher);
    }

    @Test
    @DisplayName("无到期待回收授权：不产生任何更新、不注册事务回调")
    void revokeExpiredGrants_withoutExpired_shouldBeNoOp() {
        when(permissionGrantMapper.selectList(any())).thenReturn(List.of());

        TransactionSynchronizationManager.initSynchronization();
        scheduler.revokeExpiredGrants();

        verify(permissionGrantMapper, never()).update(isNull(), any());
        verify(permissionGrantMapper, never()).updateById(any(PermissionGrant.class));
        verifyNoInteractions(applicationEventPublisher);
        assertThat(TransactionSynchronizationManager.getSynchronizations()).isEmpty();
    }

    @Test
    @DisplayName("整批 CAS 全部失败：不注册回调、不发事件（避免空批提交后触发消费侧动作）")
    void revokeExpiredGrants_whenAllCasLose_shouldNotRegisterCallback() {
        PermissionGrant grant = activeGrant(31L, ApprovalEnums.RESOURCE_FILE, "EDIT",
                LocalDateTime.now().minusMinutes(5));
        when(permissionGrantMapper.selectList(any())).thenReturn(List.of(grant));
        when(permissionGrantMapper.update(isNull(), any())).thenReturn(0);

        TransactionSynchronizationManager.initSynchronization();
        scheduler.revokeExpiredGrants();

        assertThat(TransactionSynchronizationManager.getSynchronizations()).isEmpty();
        commit();
        verifyNoInteractions(applicationEventPublisher);
    }

    /* ==================== 事件载荷保真（参数化） ==================== */

    static Stream<Arguments> payloadMatrix() {
        LocalDateTime past = LocalDateTime.now().minusHours(1);
        return Stream.of(
                Arguments.of(ApprovalEnums.RESOURCE_FILE, "ACCESS", past),
                Arguments.of(ApprovalEnums.RESOURCE_FILE, "DOWNLOAD", past),
                Arguments.of(ApprovalEnums.RESOURCE_FILE, "EDIT", past),
                Arguments.of(ApprovalEnums.RESOURCE_FILE, "SHARE", past),
                Arguments.of(ApprovalEnums.RESOURCE_SPACE, "ACCESS", past),
                Arguments.of(ApprovalEnums.RESOURCE_GROUP, "EDIT", past)
        );
    }

    @ParameterizedTest(name = "资源={0}, 授权={1} → 事件载荷原样透传")
    @MethodSource("payloadMatrix")
    @DisplayName("事件载荷逐字段取自被回收行（不得复用循环变量/写死常量）")
    void revokeExpiredGrants_shouldCarryRowPayload(String resourceType, String grantType,
                                                   LocalDateTime expireAt) {
        PermissionGrant grant = activeGrant(41L, resourceType, grantType, expireAt);
        when(permissionGrantMapper.selectList(any())).thenReturn(List.of(grant));
        when(permissionGrantMapper.update(isNull(), any())).thenReturn(1);

        TransactionSynchronizationManager.initSynchronization();
        scheduler.revokeExpiredGrants();
        commit();

        ArgumentCaptor<PermissionExpiredEvent> captor = ArgumentCaptor.forClass(PermissionExpiredEvent.class);
        verify(applicationEventPublisher).publishEvent(captor.capture());
        PermissionExpiredEvent event = captor.getValue();

        assertThat(event.grantId()).isEqualTo(41L);
        assertThat(event.userId()).isEqualTo(USER_ID);
        assertThat(event.resourceId()).isEqualTo(RESOURCE_ID);
        assertThat(event.resourceType()).isEqualTo(resourceType);
        assertThat(event.grantType()).isEqualTo(grantType);
        assertThat(event.expireAt()).isEqualTo(expireAt);
        // revokedAt 被 Now 覆盖为实际回收时刻，必须晚于原定过期时间
        assertThat(event.revokedAt()).isAfterOrEqualTo(expireAt);
    }

    @Test
    @DisplayName("多行混合结果：只有 CAS 成功的行发事件，且事件与行一一对应")
    void revokeExpiredGrants_shouldPublishOnlySuccessfulRows() {
        PermissionGrant ok1 = activeGrant(51L, ApprovalEnums.RESOURCE_FILE, "ACCESS",
                LocalDateTime.now().minusMinutes(30));
        PermissionGrant lost = activeGrant(52L, ApprovalEnums.RESOURCE_FILE, "DOWNLOAD",
                LocalDateTime.now().minusMinutes(20));
        PermissionGrant ok2 = activeGrant(53L, ApprovalEnums.RESOURCE_SPACE, "EDIT",
                LocalDateTime.now().minusMinutes(10));
        when(permissionGrantMapper.selectList(any())).thenReturn(List.of(ok1, lost, ok2));
        // 第二行 CAS 失败，其余成功
        when(permissionGrantMapper.update(isNull(), any())).thenReturn(1, 0, 1);

        TransactionSynchronizationManager.initSynchronization();
        scheduler.revokeExpiredGrants();
        commit();

        ArgumentCaptor<PermissionExpiredEvent> captor = ArgumentCaptor.forClass(PermissionExpiredEvent.class);
        verify(applicationEventPublisher, times(2)).publishEvent(captor.capture());
        assertThat(captor.getAllValues()).extracting(PermissionExpiredEvent::grantId)
                .containsExactly(51L, 53L);
    }

    /* ============================ 辅助方法 ============================ */

    /** 触发已注册的事务同步回调，模拟「事务提交」。 */
    private static void commit() {
        List<TransactionSynchronization> syncs = TransactionSynchronizationManager.getSynchronizations();
        syncs.forEach(TransactionSynchronization::afterCommit);
    }

    private static PermissionGrant activeGrant(long id, String resourceType, String grantType,
                                               LocalDateTime expireAt) {
        PermissionGrant grant = new PermissionGrant();
        grant.setId(id);
        grant.setUserId(USER_ID);
        grant.setResourceType(resourceType);
        grant.setResourceId(RESOURCE_ID);
        grant.setGrantType(grantType);
        grant.setExpireAt(expireAt);
        grant.setStatus(PermissionGrant.STATUS_ACTIVE);
        grant.setDeleted(0);
        return grant;
    }
}
