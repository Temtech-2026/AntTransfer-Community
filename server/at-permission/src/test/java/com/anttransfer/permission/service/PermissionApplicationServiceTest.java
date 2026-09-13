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

import com.anttransfer.common.event.PermissionGrantEvent;
import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.notify.NotificationCommand;
import com.anttransfer.common.notify.NotificationPort;
import com.anttransfer.common.notify.NotifyType;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.security.AuthenticatedUser;
import com.anttransfer.permission.MybatisPlusTestSupport;
import com.anttransfer.permission.config.ApprovalProperties;
import com.anttransfer.permission.extension.ApprovalNodeResolverChain;
import com.anttransfer.permission.extension.SingleNodeApprovalResolver;
import com.anttransfer.permission.model.ApprovalEnums;
import com.anttransfer.permission.model.PermissionModels.AccessSnapshot;
import com.anttransfer.permission.model.dto.ApplicationCreateDTO;
import com.anttransfer.permission.model.dto.ApplicationDecisionDTO;
import com.anttransfer.permission.model.dto.ApplicationRejectDTO;
import com.anttransfer.permission.model.dto.ApplicationTransferDTO;
import com.anttransfer.permission.model.entity.ApprovalNode;
import com.anttransfer.permission.model.entity.ApprovalRequest;
import com.anttransfer.permission.model.entity.PermissionGrant;
import com.anttransfer.permission.repository.ApprovalNodeMapper;
import com.anttransfer.permission.repository.ApprovalRequestMapper;
import com.anttransfer.permission.repository.PermissionGrantMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 权限申请审批闭环（写侧）单元测试：防重复、显式 Deny 冲突、状态机非法流转、审批三件套。
 *
 * <p>覆盖请求：① 创建 PENDING 前的冲突校验；② 通过（可缩小范围 / 缩短有效期）落库 + 事件发布；
 * ③ 驳回必填理由并通知申请人；④ 转审留痕并通知新审批人。</p>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("权限申请审批闭环 · 写侧")
class PermissionApplicationServiceTest {

    private static final long APPLICANT = 10L;
    private static final long APPROVER = 20L;
    private static final long TARGET_APPROVER = 30L;
    private static final long RESOURCE_ID = 100L;
    private static final long APPLICATION_ID = 1L;

    @Mock
    private ApprovalRequestMapper requestMapper;
    @Mock
    private ApprovalNodeMapper nodeMapper;
    @Mock
    private PermissionGrantMapper grantMapper;
    @Mock
    private PermissionService permissionService;
    @Mock
    private NotificationPort notificationPort;
    @Mock
    private ApplicationEventPublisher eventPublisher;
    @Mock
    private PermissionAuditLogger auditLogger;

    private ApprovalProperties properties;
    private PermissionApplicationService service;

    @BeforeAll
    static void initMybatisPlus() {
        MybatisPlusTestSupport.initTableInfo();
    }

    @BeforeEach
    void setUp() {
        properties = new ApprovalProperties();
        properties.setDefaultApproverId(APPROVER);
        service = newService(properties);
        authenticate(APPLICANT);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    /* ==================== 创建 / 防重复 / Deny 冲突 ==================== */

    @Test
    @DisplayName("创建：申请类型非法 → 2005，且不触碰冲突校验")
    void create_shouldRejectUnsupportedApplyType() {
        ApplicationCreateDTO dto = new ApplicationCreateDTO("DELETE", "FILE", RESOURCE_ID, 1, "取证", null);

        BusinessException ex = assertThrows(BusinessException.class, () -> service.create(dto, null));

        assertThat(ex.getCode()).isEqualTo(ErrorCode.PARAM_OUT_OF_RANGE.getCode());
        verifyNoInteractions(grantMapper);
    }

    @Test
    @DisplayName("创建：资源类型非法 → 2005")
    void create_shouldRejectUnsupportedResourceType() {
        ApplicationCreateDTO dto = new ApplicationCreateDTO("ACCESS", "MAIL", RESOURCE_ID, 1, "取证", null);

        BusinessException ex = assertThrows(BusinessException.class, () -> service.create(dto, null));

        assertThat(ex.getCode()).isEqualTo(ErrorCode.PARAM_OUT_OF_RANGE.getCode());
    }

    @Test
    @DisplayName("创建：显式 Deny 冲突命中 → 1003（Deny 优先，命中即拒）")
    void create_shouldRejectOnExplicitDenyConflict() {
        snapshot(List.of("file:download"));
        ApplicationCreateDTO dto = new ApplicationCreateDTO("DOWNLOAD", "FILE", RESOURCE_ID, 2, "取证", null);

        AuthException ex = assertThrows(AuthException.class, () -> service.create(dto, null));

        assertThat(ex.getCode()).isEqualTo(ErrorCode.NO_AUTH.getCode());
        verify(requestMapper, never()).insert(any(ApprovalRequest.class));
    }

    @Test
    @DisplayName("创建：已有生效授权 → 1008（流程分支，不新增申请单）")
    void create_shouldRejectWhenAlreadyGranted() {
        snapshot(List.of());
        when(grantMapper.countActiveGrant(APPLICANT, "FILE", RESOURCE_ID, "ACCESS")).thenReturn(1L);
        ApplicationCreateDTO dto = new ApplicationCreateDTO("ACCESS", "FILE", RESOURCE_ID, 1, "取证", null);

        BusinessException ex = assertThrows(BusinessException.class, () -> service.create(dto, null));

        assertThat(ex.getCode()).isEqualTo(ErrorCode.GRANT_ALREADY_ACTIVE.getCode());
        verify(requestMapper, never()).insert(any(ApprovalRequest.class));
    }

    @Test
    @DisplayName("创建：存在进行中申请（防重复 PENDING）→ 1009")
    void create_shouldRejectDuplicatePending() {
        snapshot(List.of());
        when(grantMapper.countActiveGrant(APPLICANT, "FILE", RESOURCE_ID, "ACCESS")).thenReturn(0L);
        when(requestMapper.countActive(APPLICANT, "FILE", RESOURCE_ID)).thenReturn(1L);
        ApplicationCreateDTO dto = new ApplicationCreateDTO("ACCESS", "FILE", RESOURCE_ID, 1, "取证", null);

        BusinessException ex = assertThrows(BusinessException.class, () -> service.create(dto, null));

        assertThat(ex.getCode()).isEqualTo(ErrorCode.APPLICATION_DUPLICATE.getCode());
        verify(requestMapper, never()).insert(any(ApprovalRequest.class));
    }

    @Test
    @DisplayName("创建：成功落单 PENDING + 节点留痕 + 通知审批人；等级越界归一为 LOW")
    void create_shouldPersistPendingNodeAndNotify() {
        snapshot(List.of());
        when(grantMapper.countActiveGrant(anyLong(), any(), any(), any())).thenReturn(0L);
        when(requestMapper.countActive(anyLong(), any(), any())).thenReturn(0L);
        doAnswer(inv -> {
            inv.getArgument(0, ApprovalRequest.class).setId(APPLICATION_ID);
            return 1;
        }).when(requestMapper).insert(any(ApprovalRequest.class));

        ApplicationCreateDTO dto = new ApplicationCreateDTO("ACCESS", "FILE", RESOURCE_ID, null, "取证", null);
        service.create(dto, TARGET_APPROVER);

        ArgumentCaptor<ApprovalRequest> saved = ArgumentCaptor.forClass(ApprovalRequest.class);
        verify(requestMapper).insert(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(ApprovalRequest.STATUS_PENDING);
        assertThat(saved.getValue().getLevel()).isEqualTo(ApprovalEnums.LEVEL_LOW);
        assertThat(saved.getValue().getApplicantId()).isEqualTo(APPLICANT);
        assertThat(saved.getValue().getApproverId()).isEqualTo(TARGET_APPROVER);
        assertThat(saved.getValue().getApplicationNo()).startsWith("AP");

        ArgumentCaptor<ApprovalNode> node = ArgumentCaptor.forClass(ApprovalNode.class);
        verify(nodeMapper).insert(node.capture());
        assertThat(node.getValue().getApproverId()).isEqualTo(TARGET_APPROVER);
        assertThat(node.getValue().getNodeSeq()).isEqualTo(1);
        assertThat(node.getValue().getStatus()).isEqualTo(ApprovalNode.STATUS_PENDING);

        ArgumentCaptor<NotificationCommand> sent = ArgumentCaptor.forClass(NotificationCommand.class);
        verify(notificationPort).send(sent.capture());
        assertThat(sent.getValue().recipientUserId()).isEqualTo(TARGET_APPROVER);
        assertThat(sent.getValue().notifyType()).isEqualTo(NotifyType.APPROVAL_TODO);
    }

    @Test
    @DisplayName("创建：无可用审批人（建议/兜底皆空）→ approver_id=null 落单，不通知、不静默放行")
    void create_shouldPersistWithoutApproverWhenUnresolved() {
        ApprovalProperties noFallback = new ApprovalProperties();
        noFallback.setDefaultApproverId(null);
        PermissionApplicationService local = newService(noFallback);
        snapshot(List.of());
        when(grantMapper.countActiveGrant(anyLong(), any(), any(), any())).thenReturn(0L);
        when(requestMapper.countActive(anyLong(), any(), any())).thenReturn(0L);
        doAnswer(inv -> {
            inv.getArgument(0, ApprovalRequest.class).setId(APPLICATION_ID);
            return 1;
        }).when(requestMapper).insert(any(ApprovalRequest.class));

        local.create(new ApplicationCreateDTO("ACCESS", "FILE", RESOURCE_ID, 1, "取证", null), null);

        ArgumentCaptor<ApprovalRequest> saved = ArgumentCaptor.forClass(ApprovalRequest.class);
        verify(requestMapper).insert(saved.capture());
        assertThat(saved.getValue().getApproverId()).isNull();
        verify(nodeMapper, never()).insert(any(ApprovalNode.class));
        verify(notificationPort, never()).send(any(NotificationCommand.class));
    }

    /* ==================== 通过：缩小范围 / 缩短有效期 ==================== */

    @Test
    @DisplayName("通过：允许缩小授权范围并缩短有效期，落库来源 APPROVAL + 提交后发布事件、失效缓存")
    void approve_shouldShrinkGrantAndShortenExpiry() {
        ApprovalRequest request = pendingRequest();
        authenticate(APPROVER);
        when(requestMapper.selectById(APPLICATION_ID)).thenReturn(request);
        when(requestMapper.update(any(), any())).thenReturn(1);
        doAnswer(inv -> {
            inv.getArgument(0, PermissionGrant.class).setId(555L);
            return 1;
        }).when(grantMapper).insert(any(PermissionGrant.class));

        LocalDateTime approvedExpire = LocalDateTime.now().plusDays(1);
        service.approve(APPLICATION_ID, new ApplicationDecisionDTO(ApprovalEnums.APPLY_ACCESS, approvedExpire, "同意缩小"));

        ArgumentCaptor<PermissionGrant> grant = ArgumentCaptor.forClass(PermissionGrant.class);
        verify(grantMapper).insert(grant.capture());
        assertThat(grant.getValue().getGrantType()).isEqualTo(ApprovalEnums.APPLY_ACCESS);
        assertThat(grant.getValue().getExpireAt()).isEqualTo(approvedExpire);
        assertThat(grant.getValue().getExpireAt()).isBefore(request.getDesiredExpireAt());
        assertThat(grant.getValue().getGrantSource()).isEqualTo(PermissionGrant.SOURCE_APPROVAL);
        assertThat(grant.getValue().getStatus()).isEqualTo(PermissionGrant.STATUS_ACTIVE);
        assertThat(grant.getValue().getUserId()).isEqualTo(APPLICANT);
        assertThat(grant.getValue().getApproveBy()).isEqualTo(APPROVER);
        assertThat(grant.getValue().getApplicationId()).isEqualTo(APPLICATION_ID);

        ArgumentCaptor<Object> published = ArgumentCaptor.forClass(Object.class);
        verify(eventPublisher).publishEvent(published.capture());
        assertThat(published.getValue()).isInstanceOf(PermissionGrantEvent.class);
        PermissionGrantEvent event = (PermissionGrantEvent) published.getValue();
        assertThat(event.grantId()).isEqualTo(555L);
        assertThat(event.userId()).isEqualTo(APPLICANT);
        assertThat(event.expireAt()).isEqualTo(approvedExpire);

        verify(permissionService).invalidate(APPLICANT);
        verify(notificationPort).send(any(NotificationCommand.class));
    }

    @Test
    @DisplayName("通过：批复有效期晚于申请人期望 → 取更早者（只可缩短，不可放宽）")
    void approve_shouldTakeEarlierExpiry() {
        ApprovalRequest request = pendingRequest();
        LocalDateTime desired = LocalDateTime.now().plusDays(2);
        request.setDesiredExpireAt(desired);
        authenticate(APPROVER);
        when(requestMapper.selectById(APPLICATION_ID)).thenReturn(request);
        when(requestMapper.update(any(), any())).thenReturn(1);
        doAnswer(inv -> 1).when(grantMapper).insert(any(PermissionGrant.class));

        service.approve(APPLICATION_ID,
                new ApplicationDecisionDTO(ApprovalEnums.APPLY_EDIT, LocalDateTime.now().plusDays(5), "同意"));

        ArgumentCaptor<PermissionGrant> grant = ArgumentCaptor.forClass(PermissionGrant.class);
        verify(grantMapper).insert(grant.capture());
        assertThat(grant.getValue().getExpireAt()).isEqualTo(desired);
    }

    @Test
    @DisplayName("通过：放大授权范围（申请 ACCESS 批复 SHARE）→ 2005")
    void approve_shouldRejectAmplifiedGrantType() {
        ApprovalRequest request = pendingRequest();
        request.setApplyType(ApprovalEnums.APPLY_ACCESS);
        authenticate(APPROVER);
        when(requestMapper.selectById(APPLICATION_ID)).thenReturn(request);

        BusinessException ex = assertThrows(BusinessException.class, () -> service.approve(APPLICATION_ID,
                new ApplicationDecisionDTO(ApprovalEnums.APPLY_SHARE, null, "越权")));

        assertThat(ex.getCode()).isEqualTo(ErrorCode.PARAM_OUT_OF_RANGE.getCode());
        verify(grantMapper, never()).insert(any(PermissionGrant.class));
    }

    @Test
    @DisplayName("通过：批复到期时刻已过去 → 2005")
    void approve_shouldRejectExpiredApprovalTime() {
        ApprovalRequest request = pendingRequest();
        authenticate(APPROVER);
        when(requestMapper.selectById(APPLICATION_ID)).thenReturn(request);

        BusinessException ex = assertThrows(BusinessException.class, () -> service.approve(APPLICATION_ID,
                new ApplicationDecisionDTO(ApprovalEnums.APPLY_ACCESS, LocalDateTime.now().minusHours(1), "过期")));

        assertThat(ex.getCode()).isEqualTo(ErrorCode.PARAM_OUT_OF_RANGE.getCode());
    }

    @Test
    @DisplayName("通过：申请单已终态 → 1011（非法状态流转）")
    void approve_shouldRejectWhenRequestNotActive() {
        ApprovalRequest request = pendingRequest();
        request.setStatus(ApprovalRequest.STATUS_APPROVED);
        authenticate(APPROVER);
        when(requestMapper.selectById(APPLICATION_ID)).thenReturn(request);

        BusinessException ex = assertThrows(BusinessException.class, () -> service.approve(APPLICATION_ID,
                new ApplicationDecisionDTO(null, null, "重复审批")));

        assertThat(ex.getCode()).isEqualTo(ErrorCode.APPROVAL_STATE_ERROR.getCode());
    }

    @Test
    @DisplayName("通过：非当前审批人操作 → 1003")
    void approve_shouldRejectWhenNotCurrentApprover() {
        ApprovalRequest request = pendingRequest();
        request.setApproverId(999L);
        authenticate(APPROVER);
        when(requestMapper.selectById(APPLICATION_ID)).thenReturn(request);

        AuthException ex = assertThrows(AuthException.class, () -> service.approve(APPLICATION_ID,
                new ApplicationDecisionDTO(null, null, "越权审批")));

        assertThat(ex.getCode()).isEqualTo(ErrorCode.NO_AUTH.getCode());
    }

    @Test
    @DisplayName("通过：申请单不存在 → 4040")
    void approve_shouldRejectWhenRequestMissing() {
        authenticate(APPROVER);
        when(requestMapper.selectById(APPLICATION_ID)).thenReturn(null);

        BusinessException ex = assertThrows(BusinessException.class, () -> service.approve(APPLICATION_ID,
                new ApplicationDecisionDTO(null, null, "无此单")));

        assertThat(ex.getCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND.getCode());
    }

    @Test
    @DisplayName("通过：CAS 抢单失败（并发已流转）→ 1011，不写授权")
    void approve_shouldRejectWhenCasLoses() {
        ApprovalRequest request = pendingRequest();
        authenticate(APPROVER);
        when(requestMapper.selectById(APPLICATION_ID)).thenReturn(request);
        when(requestMapper.update(any(), any())).thenReturn(0);

        BusinessException ex = assertThrows(BusinessException.class, () -> service.approve(APPLICATION_ID,
                new ApplicationDecisionDTO(null, null, "并发")));

        assertThat(ex.getCode()).isEqualTo(ErrorCode.APPROVAL_STATE_ERROR.getCode());
        verify(grantMapper, never()).insert(any(PermissionGrant.class));
    }

    /* ==================== 驳回 / 转审 ==================== */

    @Test
    @DisplayName("驳回：写终态并通知申请人（含驳回理由）")
    void reject_shouldNotifyApplicant() {
        ApprovalRequest request = pendingRequest();
        authenticate(APPROVER);
        when(requestMapper.selectById(APPLICATION_ID)).thenReturn(request);
        when(requestMapper.update(any(), any())).thenReturn(1);

        service.reject(APPLICATION_ID, new ApplicationRejectDTO("材料不足，请补充用途说明"));

        verify(requestMapper).update(any(), any());
        ArgumentCaptor<NotificationCommand> sent = ArgumentCaptor.forClass(NotificationCommand.class);
        verify(notificationPort).send(sent.capture());
        assertThat(sent.getValue().recipientUserId()).isEqualTo(APPLICANT);
        assertThat(sent.getValue().notifyType()).isEqualTo(NotifyType.APPROVAL_RESULT);
        assertThat(sent.getValue().content()).contains("材料不足");
        verify(grantMapper, never()).insert(any(PermissionGrant.class));
    }

    @Test
    @DisplayName("驳回：申请单已终态 → 1011")
    void reject_shouldRejectWhenRequestNotActive() {
        ApprovalRequest request = pendingRequest();
        request.setStatus(ApprovalRequest.STATUS_REJECTED);
        authenticate(APPROVER);
        when(requestMapper.selectById(APPLICATION_ID)).thenReturn(request);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.reject(APPLICATION_ID, new ApplicationRejectDTO("重复驳回")));

        assertThat(ex.getCode()).isEqualTo(ErrorCode.APPROVAL_STATE_ERROR.getCode());
    }

    @Test
    @DisplayName("转审：转给自己 → 1010")
    void transfer_shouldRejectSelf() {
        ApprovalRequest request = pendingRequest();
        authenticate(APPROVER);
        when(requestMapper.selectById(APPLICATION_ID)).thenReturn(request);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.transfer(APPLICATION_ID, new ApplicationTransferDTO(APPROVER, "自转")));

        assertThat(ex.getCode()).isEqualTo(ErrorCode.REASSIGN_INVALID.getCode());
    }

    @Test
    @DisplayName("转审：转给申请人本人 → 1010（禁止自审）")
    void transfer_shouldRejectApplicant() {
        ApprovalRequest request = pendingRequest();
        authenticate(APPROVER);
        when(requestMapper.selectById(APPLICATION_ID)).thenReturn(request);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.transfer(APPLICATION_ID, new ApplicationTransferDTO(APPLICANT, "自审")));

        assertThat(ex.getCode()).isEqualTo(ErrorCode.REASSIGN_INVALID.getCode());
    }

    @Test
    @DisplayName("转审：成功改指审批人 + 节点留痕 + 通知新审批人")
    void transfer_shouldReassignAndNotify() {
        ApprovalRequest request = pendingRequest();
        authenticate(APPROVER);
        when(requestMapper.selectById(APPLICATION_ID)).thenReturn(request);
        when(requestMapper.update(any(), any())).thenReturn(1);

        service.transfer(APPLICATION_ID, new ApplicationTransferDTO(TARGET_APPROVER, "请王五处理"));

        // 两段 CAS：PENDING → TRANSFERRED → PENDING（改指审批人）
        verify(requestMapper, times(2)).update(any(), any());

        ArgumentCaptor<ApprovalNode> node = ArgumentCaptor.forClass(ApprovalNode.class);
        verify(nodeMapper).insert(node.capture());
        assertThat(node.getValue().getApproverId()).isEqualTo(TARGET_APPROVER);
        assertThat(node.getValue().getStatus()).isEqualTo(ApprovalNode.STATUS_TRANSFERRED);

        ArgumentCaptor<NotificationCommand> sent = ArgumentCaptor.forClass(NotificationCommand.class);
        verify(notificationPort).send(sent.capture());
        assertThat(sent.getValue().recipientUserId()).isEqualTo(TARGET_APPROVER);
        assertThat(sent.getValue().notifyType()).isEqualTo(NotifyType.APPROVAL_TODO);
    }

    @Test
    @DisplayName("转审：CAS 抢单失败 → 1011")
    void transfer_shouldRejectWhenCasLoses() {
        ApprovalRequest request = pendingRequest();
        authenticate(APPROVER);
        when(requestMapper.selectById(APPLICATION_ID)).thenReturn(request);
        when(requestMapper.update(any(), any())).thenReturn(0);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.transfer(APPLICATION_ID, new ApplicationTransferDTO(TARGET_APPROVER, "并发")));

        assertThat(ex.getCode()).isEqualTo(ErrorCode.APPROVAL_STATE_ERROR.getCode());
    }

    /* ==================== 夹具 ==================== */

    private PermissionApplicationService newService(ApprovalProperties props) {
        ApprovalNodeResolverChain chain =
                new ApprovalNodeResolverChain(List.of(new SingleNodeApprovalResolver(props)));
        return new PermissionApplicationService(requestMapper, nodeMapper, grantMapper,
                permissionService, chain, props, notificationPort, eventPublisher, auditLogger);
    }

    private void authenticate(long userId) {
        AuthenticatedUser principal = mock(AuthenticatedUser.class);
        when(principal.getId()).thenReturn(userId);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null));
    }

    private void snapshot(List<String> deniedPermCodes) {
        AccessSnapshot snapshot = new AccessSnapshot(APPLICANT, List.of(), List.of(), deniedPermCodes, 1);
        when(permissionService.resolve(anyLong())).thenReturn(snapshot);
    }

    private ApprovalRequest pendingRequest() {
        ApprovalRequest request = new ApprovalRequest();
        request.setId(APPLICATION_ID);
        request.setApplicationNo("AP20260913001");
        request.setApplicantId(APPLICANT);
        request.setApplyType(ApprovalEnums.APPLY_EDIT);
        request.setResourceType(ApprovalEnums.RESOURCE_FILE);
        request.setResourceId(RESOURCE_ID);
        request.setLevel(ApprovalEnums.LEVEL_HIGH);
        request.setPurpose("取证");
        request.setDesiredExpireAt(LocalDateTime.now().plusDays(10));
        request.setStatus(ApprovalRequest.STATUS_PENDING);
        request.setApproverId(APPROVER);
        return request;
    }
}
