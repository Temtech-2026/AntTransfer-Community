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

import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.permission.MybatisPlusTestSupport;
import com.anttransfer.common.event.PermissionExpiredEvent;
import com.anttransfer.permission.extension.AccessRuleContext;
import com.anttransfer.permission.extension.AccessRuleDecision;
import com.anttransfer.permission.extension.AccessRuleResolver;
import com.anttransfer.permission.extension.AccessRuleResolverChain;
import com.anttransfer.permission.model.entity.PermissionGrant;
import com.anttransfer.permission.repository.PermissionGrantMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 授权判定与回收单元测试：<b>expire_at 实时判断</b>（不依赖定时任务）、Deny 规则、调岗/离职重评估。
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("授权判定与重评估 · 实时过期")
class PermissionGrantServiceTest {

    private static final long USER_ID = 10L;
    private static final String RESOURCE_TYPE = "FILE";
    private static final long RESOURCE_ID = 100L;
    private static final String GRANT_TYPE = "ACCESS";

    @Mock
    private PermissionGrantMapper grantMapper;
    @Mock
    private PermissionService permissionService;
    @Mock
    private ApplicationEventPublisher eventPublisher;
    @Mock
    private PermissionAuditLogger auditLogger;

    private PermissionGrantService service;

    @BeforeAll
    static void initMybatisPlus() {
        MybatisPlusTestSupport.initTableInfo();
    }

    @BeforeEach
    void setUp() {
        service = new PermissionGrantService(grantMapper, permissionService, eventPublisher,
                new AccessRuleResolverChain(List.of()), auditLogger);
    }

    @Test
    @DisplayName("实时过期：连续两次判定分别返回 生效 → 到期，证明每次均实时回源、不缓存过期结果")
    void hasActiveGrant_shouldReEvaluateOnEveryCall() {
        when(grantMapper.countActiveGrant(USER_ID, RESOURCE_TYPE, RESOURCE_ID, GRANT_TYPE))
                .thenReturn(1L, 0L);

        assertThat(service.hasActiveGrant(USER_ID, RESOURCE_TYPE, RESOURCE_ID, GRANT_TYPE)).isTrue();
        // 定时任务尚未跑，但 expire_at 已过 → 第二次立刻判定为无权限
        assertThat(service.hasActiveGrant(USER_ID, RESOURCE_TYPE, RESOURCE_ID, GRANT_TYPE)).isFalse();
    }

    @Test
    @DisplayName("实时过期：expire_at 已过期（mapper 返回 0）→ hasActiveGrant=false")
    void hasActiveGrant_shouldBeFalseWhenExpired() {
        when(grantMapper.countActiveGrant(any(), any(), any(), any())).thenReturn(0L);

        assertThat(service.hasActiveGrant(USER_ID, RESOURCE_TYPE, RESOURCE_ID, GRANT_TYPE)).isFalse();
    }

    @Test
    @DisplayName("实时过期：参数缺失（资源/动作）→ 直接判无权限")
    void hasActiveGrant_shouldBeFalseWhenArgsIncomplete() {
        assertThat(service.hasActiveGrant(USER_ID, RESOURCE_TYPE, null, GRANT_TYPE)).isFalse();
        assertThat(service.hasActiveGrant(USER_ID, RESOURCE_TYPE, RESOURCE_ID, null)).isFalse();
    }

    @Test
    @DisplayName("断言：授权已过期 → 1003（无权限），不触发 ABAC 规则")
    void assertActiveGrant_shouldThrowWhenExpired() {
        when(grantMapper.countActiveGrant(any(), any(), any(), any())).thenReturn(0L);

        AuthException ex = assertThrows(AuthException.class,
                () -> service.assertActiveGrant(USER_ID, RESOURCE_TYPE, RESOURCE_ID, GRANT_TYPE));

        assertThat(ex.getCode()).isEqualTo(ErrorCode.NO_AUTH.getCode());
    }

    @Test
    @DisplayName("断言：授权生效且无 ABAC 规则（ABSTAIN）→ 放行")
    void assertActiveGrant_shouldPassWhenActive() {
        when(grantMapper.countActiveGrant(any(), any(), any(), any())).thenReturn(1L);

        assertThatCode(() -> service.assertActiveGrant(USER_ID, RESOURCE_TYPE, RESOURCE_ID, GRANT_TYPE))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("ABAC：规则拒绝 → 1003（P1 扩展点，Deny 优先）")
    void assertActiveGrant_shouldDenyWhenAbacRuleDenies() {
        when(grantMapper.countActiveGrant(any(), any(), any(), any())).thenReturn(1L);
        PermissionGrantService withRule = new PermissionGrantService(grantMapper, permissionService,
                eventPublisher, new AccessRuleResolverChain(List.of(denyAll())), auditLogger);

        AuthException ex = assertThrows(AuthException.class, () -> withRule.assertActiveGrant(
                USER_ID, RESOURCE_TYPE, RESOURCE_ID, GRANT_TYPE, "10.0.0.1", LocalDateTime.now()));

        assertThat(ex.getCode()).isEqualTo(ErrorCode.NO_AUTH.getCode());
    }

    @Test
    @DisplayName("调岗/离职重评估：无审批来源授权 → 返回 0，不发事件、不失效缓存")
    void revokeApprovalGrants_shouldBeNoopWhenNone() {
        when(grantMapper.selectActiveApprovalGrants(USER_ID)).thenReturn(List.of());

        assertThat(service.revokeApprovalGrants(USER_ID)).isZero();
        verifyNoInteractions(eventPublisher);
        verify(permissionService, never()).invalidate(any());
    }

    @Test
    @DisplayName("调岗/离职重评估：逐条 CAS 回收 APPROVAL 授权并发布 PermissionExpiredEvent + 失效缓存")
    void revokeApprovalGrants_shouldRevokeAndPublishEvents() {
        when(grantMapper.selectActiveApprovalGrants(USER_ID))
                .thenReturn(List.of(activeGrant(1L), activeGrant(2L)));
        when(grantMapper.update(any(), any())).thenReturn(1);

        assertThat(service.revokeApprovalGrants(USER_ID)).isEqualTo(2);

        verify(eventPublisher, times(2)).publishEvent(any(PermissionExpiredEvent.class));
        verify(permissionService).invalidate(USER_ID);
    }

    @Test
    @DisplayName("调岗/离职重评估：CAS 抢单失败（已被回收）→ 不重复发事件")
    void revokeApprovalGrants_shouldSkipEventWhenCasLoses() {
        when(grantMapper.selectActiveApprovalGrants(USER_ID)).thenReturn(List.of(activeGrant(1L)));
        when(grantMapper.update(any(), any())).thenReturn(0);

        assertThat(service.revokeApprovalGrants(USER_ID)).isZero();
        verify(eventPublisher, never()).publishEvent(any(PermissionExpiredEvent.class));
    }

    /* ==================== 夹具 ==================== */

    private PermissionGrant activeGrant(long id) {
        PermissionGrant grant = new PermissionGrant();
        grant.setId(id);
        grant.setUserId(USER_ID);
        grant.setResourceType(RESOURCE_TYPE);
        grant.setResourceId(RESOURCE_ID);
        grant.setGrantType(GRANT_TYPE);
        grant.setGrantSource(PermissionGrant.SOURCE_APPROVAL);
        grant.setStatus(PermissionGrant.STATUS_ACTIVE);
        return grant;
    }

    private AccessRuleResolver denyAll() {
        return new AccessRuleResolver() {
            @Override
            public boolean supports(AccessRuleContext context) {
                return true;
            }

            @Override
            public AccessRuleDecision evaluate(AccessRuleContext context) {
                return AccessRuleDecision.DENY;
            }
        };
    }
}
