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

import com.anttransfer.permission.MybatisPlusTestSupport;
import com.anttransfer.permission.model.ApprovalEnums;
import com.anttransfer.permission.model.PermissionModels.AccessSnapshot;
import com.anttransfer.permission.model.entity.PermissionGrant;
import com.anttransfer.permission.model.vo.PermissionMapView;
import com.anttransfer.permission.repository.ApprovalRequestMapper;
import com.anttransfer.permission.repository.PermissionGrantMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 「我的权限地图」对临时授权的<b>过期实时判断</b>单测。
 *
 * <p><b>为什么必须实时判、不能等定时回收</b>：定时回收每小时才跑一次，
 * 存在最长 1 小时的时间窗——授权已过期但 {@code status} 仍是「生效」。
 * 若权限地图直接透传 DB 行，用户会在过期的这一小时里看到（并据此尝试使用）
 * 一个已经不该生效的权限，前端据此渲染的按钮必然产生 403 体验倒挂。
 * 因此判定必须以 {@code expire_at > now} 为准，定时回收只负责把状态收敛。</p>
 *
 * <p>本类把这条规则写成参数化的到期时刻矩阵，并把「等于当前时刻即视为过期」
 * 这一边界钉死。</p>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PermissionQueryRealtimeExpiryTest {

    private static final long USER_ID = 6006L;
    private static final long RESOURCE_ID = 8008L;
    private static final long APPLICATION_ID = 910_000L;

    @Mock
    private ApprovalRequestMapper requestMapper;
    @Mock
    private PermissionGrantMapper grantMapper;
    @Mock
    private PermissionService permissionService;

    private PermissionQueryService queryService;

    @BeforeAll
    static void initTableInfo() {
        MybatisPlusTestSupport.initTableInfo();
    }

    @BeforeEach
    void setUp() {
        queryService = new PermissionQueryService(requestMapper, grantMapper, permissionService);
    }

    /* ==================== 到期矩阵 ==================== */

    static Stream<Arguments> expireAtMatrix() {
        return Stream.of(
                Arguments.of(Duration.ofSeconds(-1), false, "已过期 → 必须实时过滤"),
                Arguments.of(Duration.ZERO, false, "恰好在当前时刻 → isAfter 为 false，视为已过期"),
                Arguments.of(Duration.ofMinutes(1), true, "尚未过期 → 保留"),
                Arguments.of(Duration.ofHours(48), true, "远期到期 → 保留"),
                Arguments.of(null, true, "长期有效（无到期时间）→ 保留")
        );
    }

    @ParameterizedTest(name = "{2}")
    @MethodSource("expireAtMatrix")
    @DisplayName("授权地图按 expire_at 实时过滤：过期（含等于当前时刻）不出现，未过期/长期有效出现")
    void permissionMap_shouldFilterByRealtimeExpiry(Duration offset, boolean visible, String scenario) {
        LocalDateTime expireAt = offset == null ? null : LocalDateTime.now().plus(offset);
        // 前提：这些行的 status 仍是「生效」——定时回收尚未收敛
        PermissionGrant grant = activeGrant(expireAt);
        when(permissionService.resolve(USER_ID)).thenReturn(
                new AccessSnapshot(USER_ID, List.of("ROLE_USER"), List.of("file:read"), List.of(), 1));
        when(grantMapper.selectActiveApprovalGrants(USER_ID)).thenReturn(List.of(grant));

        PermissionMapView view = queryService.permissionMap(USER_ID);

        if (visible) {
            assertThat(view.approvalGrants()).hasSize(1);
            PermissionMapView.GrantItem item = view.approvalGrants().get(0);
            assertThat(item.grantId()).isEqualTo(99L);
            assertThat(item.grantType()).isEqualTo("DOWNLOAD");
            assertThat(item.resourceType()).isEqualTo(ApprovalEnums.RESOURCE_FILE);
            assertThat(item.resourceId()).isEqualTo(RESOURCE_ID);
            assertThat(item.expireAt()).isEqualTo(expireAt);
            assertThat(item.applicationId()).isEqualTo(APPLICATION_ID);
        } else {
            assertThat(view.approvalGrants()).isEmpty();
        }
    }

    @Test
    @DisplayName("混合场景：同一用户多条授权中只保留未过期的，且不改变顺序")
    void permissionMap_shouldKeepOnlyNonExpiredAmongMixed() {
        PermissionGrant expired = activeGrant(LocalDateTime.now().minusMinutes(30));
        expired.setId(1L);
        PermissionGrant forever = activeGrant(null);
        forever.setId(2L);
        PermissionGrant future = activeGrant(LocalDateTime.now().plusHours(3));
        future.setId(3L);

        when(permissionService.resolve(USER_ID)).thenReturn(
                new AccessSnapshot(USER_ID, List.of(), List.of(), List.of(), 1));
        when(grantMapper.selectActiveApprovalGrants(USER_ID))
                .thenReturn(List.of(expired, forever, future));

        PermissionMapView view = queryService.permissionMap(USER_ID);

        assertThat(view.approvalGrants()).extracting(PermissionMapView.GrantItem::grantId)
                .containsExactly(2L, 3L);
    }

    /* ==================== 角色继承透传 + 并集语义 ==================== */

    @Test
    @DisplayName("角色继承部分原样透传，与审批授权构成并集（两类来源互不覆盖）")
    void permissionMap_shouldExposeRoleInheritanceAlongsideApprovalGrants() {
        AccessSnapshot snapshot = new AccessSnapshot(USER_ID,
                List.of("ROLE_AUDITOR", "ROLE_USER"),
                List.of("audit:log:read", "file:read"),
                List.of(), 2);
        when(permissionService.resolve(USER_ID)).thenReturn(snapshot);
        when(grantMapper.selectActiveApprovalGrants(USER_ID))
                .thenReturn(List.of(activeGrant(LocalDateTime.now().plusHours(1))));

        PermissionMapView view = queryService.permissionMap(USER_ID);

        assertThat(view.userId()).isEqualTo(USER_ID);
        assertThat(view.roleCodes()).containsExactly("ROLE_AUDITOR", "ROLE_USER");
        assertThat(view.permCodes()).containsExactly("audit:log:read", "file:read");
        assertThat(view.dataScope()).isEqualTo(2);
        assertThat(view.approvalGrants()).hasSize(1);
        verify(permissionService).resolve(USER_ID);
    }

    @Test
    @DisplayName("无审批授权：地图只含角色继承部分，不得报错也不得伪造空对象")
    void permissionMap_withoutApprovalGrants_shouldReturnRolePartOnly() {
        when(permissionService.resolve(USER_ID)).thenReturn(
                new AccessSnapshot(USER_ID, List.of("ROLE_USER"), List.of("file:read"), List.of(), 1));
        when(grantMapper.selectActiveApprovalGrants(USER_ID)).thenReturn(List.of());

        PermissionMapView view = queryService.permissionMap(USER_ID);

        assertThat(view.approvalGrants()).isEmpty();
        assertThat(view.permCodes()).containsExactly("file:read");
    }

    /* ==================== 只读红线 ==================== */

    @Test
    @DisplayName("只读红线：查询权限地图不得写回授权状态（回收只由定时任务 CAS 驱动）")
    void permissionMap_shouldNeverMutateGrantState() {
        when(permissionService.resolve(USER_ID)).thenReturn(
                new AccessSnapshot(USER_ID, List.of(), List.of(), List.of(), 1));
        when(grantMapper.selectActiveApprovalGrants(USER_ID))
                .thenReturn(List.of(activeGrant(LocalDateTime.now().minusMinutes(1))));

        queryService.permissionMap(USER_ID);

        // 过期的授权只被「过滤」，绝不在读路径上被顺手改成 EXPIRED
        verify(grantMapper, never()).update(any(), any());
        verify(grantMapper, never()).updateById(any(PermissionGrant.class));
        verify(requestMapper, never()).update(any(), any());
    }

    /* ============================ 辅助方法 ============================ */

    private static PermissionGrant activeGrant(LocalDateTime expireAt) {
        PermissionGrant grant = new PermissionGrant();
        grant.setId(99L);
        grant.setUserId(USER_ID);
        grant.setResourceType(ApprovalEnums.RESOURCE_FILE);
        grant.setResourceId(RESOURCE_ID);
        grant.setGrantType("DOWNLOAD");
        grant.setExpireAt(expireAt);
        grant.setApplicationId(APPLICATION_ID);
        grant.setStatus(PermissionGrant.STATUS_ACTIVE);
        grant.setDeleted(0);
        return grant;
    }
}
