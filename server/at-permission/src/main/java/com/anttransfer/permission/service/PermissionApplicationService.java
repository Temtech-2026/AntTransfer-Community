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
import com.anttransfer.common.event.PermissionGrantEvent;
import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.notify.NotificationCommand;
import com.anttransfer.common.notify.NotificationPort;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.permission.config.ApprovalProperties;
import com.anttransfer.permission.extension.ApprovalNodeResolver;
import com.anttransfer.permission.extension.ApprovalNodeResolverChain;
import com.anttransfer.permission.model.ApprovalContext;
import com.anttransfer.permission.model.ApprovalEnums;
import com.anttransfer.permission.model.PermissionModels.AccessSnapshot;
import com.anttransfer.permission.model.dto.ApplicationCreateDTO;
import com.anttransfer.permission.model.dto.ApplicationDecisionDTO;
import com.anttransfer.permission.model.dto.ApplicationRejectDTO;
import com.anttransfer.permission.model.dto.ApplicationTransferDTO;
import com.anttransfer.permission.model.entity.ApprovalNode;
import com.anttransfer.permission.model.entity.ApprovalRequest;
import com.anttransfer.permission.model.entity.PermissionGrant;
import com.anttransfer.permission.model.vo.ApprovalRequestVO;
import com.anttransfer.permission.repository.ApprovalNodeMapper;
import com.anttransfer.permission.repository.ApprovalRequestMapper;
import com.anttransfer.permission.repository.PermissionGrantMapper;
import com.anttransfer.permission.security.AuthzContext;
import com.anttransfer.permission.util.AfterCommitUtils;
import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 权限申请与审批闭环（写侧）。
 *
 * <p>申请：四要素校验 → 显式 Deny 冲突（命中即拒）→ 已有生效授权 1008 → 进行中申请 1009（防重复）
 * → 按敏感等级解析审批人与 SLA → 落单并通知审批人。</p>
 *
 * <p>审批三件套：通过（可<b>缩小范围 / 缩短有效期</b>，同事务写 {@code sys_user_file_permission}，
 * 提交后发 {@link PermissionGrantEvent} 并失效 {@code at:perm} 缓存）；驳回（理由必填）；
 * 转审（状态 {@code PENDING → TRANSFERRED → PENDING}，节点留痕并通知新审批人）。</p>
 *
 * <p>所有状态迁移一律 CAS + 行数校验，禁止「查-判-改」（红线 P-1 / [C-06]）。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Service
public class PermissionApplicationService {

    private static final DateTimeFormatter NO_DATE = DateTimeFormatter.BASIC_ISO_DATE;

    private final ApprovalRequestMapper requestMapper;
    private final ApprovalNodeMapper nodeMapper;
    private final PermissionGrantMapper grantMapper;
    private final PermissionService permissionService;
    private final ApprovalNodeResolverChain resolverChain;
    private final ApprovalProperties properties;
    private final NotificationPort notificationPort;
    private final ApplicationEventPublisher eventPublisher;
    private final PermissionAuditLogger auditLogger;

    public PermissionApplicationService(ApprovalRequestMapper requestMapper,
                                        ApprovalNodeMapper nodeMapper,
                                        PermissionGrantMapper grantMapper,
                                        PermissionService permissionService,
                                        ApprovalNodeResolverChain resolverChain,
                                        ApprovalProperties properties,
                                        NotificationPort notificationPort,
                                        ApplicationEventPublisher eventPublisher,
                                        PermissionAuditLogger auditLogger) {
        this.requestMapper = requestMapper;
        this.nodeMapper = nodeMapper;
        this.grantMapper = grantMapper;
        this.permissionService = permissionService;
        this.resolverChain = resolverChain;
        this.properties = properties;
        this.notificationPort = notificationPort;
        this.eventPublisher = eventPublisher;
        this.auditLogger = auditLogger;
    }

    /* ============================== ① 申请 ============================== */

    /** 创建权限申请单（suggestedApproverId 为调用方建议审批人，如资源属主，可为 null）。 */
    @Transactional
    public ApprovalRequestVO create(ApplicationCreateDTO dto, Long suggestedApproverId) {
        Long applicantId = AuthzContext.currentUser().getId();
        String applyType = normalize(dto.applyType());
        String resourceType = normalize(dto.resourceType());
        if (!ApprovalEnums.isValidApplyType(applyType)) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE, "不支持的申请类型：" + dto.applyType());
        }
        if (!ApprovalEnums.isValidResourceType(resourceType)) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE, "不支持的资源类型：" + dto.resourceType());
        }
        int level = ApprovalEnums.normalizeLevel(dto.level());

        // 校验 1：显式 Deny 冲突（Deny 优先，命中即拒）
        assertNotDenied(applicantId, applyType);
        // 校验 2：已有生效授权（流程分支码 1008）
        if (grantMapper.countActiveGrant(applicantId, resourceType, dto.resourceId(), applyType) > 0) {
            throw new BusinessException(ErrorCode.GRANT_ALREADY_ACTIVE);
        }
        // 校验 3：防重复——同人同资源已有进行中申请（流程分支码 1009）
        if (requestMapper.countActive(applicantId, resourceType, dto.resourceId()) > 0) {
            throw new BusinessException(ErrorCode.APPLICATION_DUPLICATE);
        }

        ApprovalContext context = new ApprovalContext(
                null, applicantId, applyType, resourceType, dto.resourceId(), level, suggestedApproverId);
        List<ApprovalNodeResolver.ResolvedNode> resolved = resolverChain.resolve(context);
        Long approverId = resolved.isEmpty() ? null : resolved.get(0).approverId();

        ApprovalRequest request = new ApprovalRequest();
        request.setApplicationNo(nextApplicationNo());
        request.setApplicantId(applicantId);
        request.setApplyType(applyType);
        request.setResourceType(resourceType);
        request.setResourceId(dto.resourceId());
        request.setLevel(level);
        request.setPurpose(dto.purpose());
        request.setDesiredExpireAt(dto.desiredExpireAt());
        request.setStatus(ApprovalRequest.STATUS_PENDING);
        request.setApproverId(approverId);
        requestMapper.insert(request);

        if (approverId != null) {
            ApprovalNodeResolver.ResolvedNode first = resolved.get(0);
            insertNode(request.getId(), first.nodeSeq(), first.nodeType(), approverId,
                    ApprovalNode.STATUS_PENDING, null);
            notificationPort.send(NotificationCommand.approvalTodo(
                    approverId, request.getId(), request.getApplicationNo(), summary(request)));
        } else {
            // 不静默放行：落库待管理员认领，由超时任务升级提醒
            log.warn("[permission] 申请单未解析出审批人，待认领: no={}, applicant={}, level={}, sla={}",
                    request.getApplicationNo(), applicantId, level, properties.slaOf(level));
        }
        Map<String, Object> audit = new LinkedHashMap<>();
        audit.put("no", request.getApplicationNo());
        audit.put("applyType", applyType);
        audit.put("resourceType", resourceType);
        audit.put("resourceId", dto.resourceId());
        audit.put("level", level);
        audit.put("approverId", approverId);
        auditLogger.success(OperationLog.ACTION_APPLY, OperationLog.TARGET_APPLICATION, request.getId(), audit);
        log.info("[permission] 申请单已创建: no={}, applicant={}, {}:{}, level={}, approver={}",
                request.getApplicationNo(), applicantId, resourceType, dto.resourceId(), level, approverId);
        return ApprovalRequestVO.of(request);
    }

    /* ============================== ② 审批三件套 ============================== */

    /** 审批通过：可缩小授权范围 / 缩短有效期，同事务下发授权并在提交后发布授权事件。 */
    @Transactional
    public ApprovalRequestVO approve(Long applicationId, ApplicationDecisionDTO dto) {
        Long approverId = AuthzContext.currentUser().getId();
        ApprovalRequest request = loadActiveRequestOwnedBy(applicationId, approverId);

        String grantType = resolveFinalGrantType(request, dto.grantType());
        LocalDateTime expireAt = resolveExpireAt(dto.expireAt(), request.getDesiredExpireAt());
        if (expireAt != null && expireAt.isBefore(LocalDateTime.now())) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE, "授权有效期不能早于当前时间");
        }

        ApprovalStateMachine.assertTransit(request.getStatus(), ApprovalRequest.STATUS_APPROVED);
        LocalDateTime now = LocalDateTime.now();
        int rows = requestMapper.update(null, Wrappers.<ApprovalRequest>lambdaUpdate()
                .eq(ApprovalRequest::getId, applicationId)
                .in(ApprovalRequest::getStatus,
                        ApprovalRequest.STATUS_PENDING, ApprovalRequest.STATUS_TRANSFERRED)
                .eq(ApprovalRequest::getApproverId, approverId)
                .set(ApprovalRequest::getStatus, ApprovalRequest.STATUS_APPROVED)
                .set(ApprovalRequest::getOpinion, dto.opinion())
                .set(ApprovalRequest::getDecidedAt, now));
        if (rows != 1) {
            throw new BusinessException(ErrorCode.APPROVAL_STATE_ERROR);
        }

        PermissionGrant grant = new PermissionGrant();
        grant.setApplicationId(applicationId);
        grant.setUserId(request.getApplicantId());
        grant.setResourceType(request.getResourceType());
        grant.setResourceId(request.getResourceId());
        grant.setGrantType(grantType);
        grant.setGrantSource(PermissionGrant.SOURCE_APPROVAL);
        grant.setLevel(request.getLevel());
        grant.setApproveBy(approverId);
        grant.setExpireAt(expireAt);
        grant.setStatus(PermissionGrant.STATUS_ACTIVE);
        grantMapper.insert(grant);

        markNode(applicationId, approverId, ApprovalNode.STATUS_AGREED, dto.opinion(), now);
        // 与授权落库同事务写入（red-team T-06）：通知是「必达」类，不能依赖提交后的事件监听器补写
        notificationPort.send(NotificationCommand.approvalResult(
                request.getApplicantId(), applicationId, request.getApplicationNo(),
                "已通过（授权动作 " + grantType + "，" + expireText(expireAt) + "）"));

        PermissionGrantEvent event = new PermissionGrantEvent(
                applicationId, grant.getId(), request.getApplicantId(), request.getResourceType(),
                request.getResourceId(), grantType, expireAt, approverId);
        AfterCommitUtils.run(() -> {
            eventPublisher.publishEvent(event);
            permissionService.invalidate(request.getApplicantId());
        });

        Map<String, Object> audit = new LinkedHashMap<>();
        audit.put("no", request.getApplicationNo());
        audit.put("applicantId", request.getApplicantId());
        audit.put("resourceType", request.getResourceType());
        audit.put("resourceId", request.getResourceId());
        audit.put("grantType", grantType);
        audit.put("expireAt", expireText(expireAt));
        audit.put("grantId", grant.getId());
        auditLogger.success(OperationLog.ACTION_APPROVE, OperationLog.TARGET_APPLICATION, applicationId, audit);
        // 授权落地独立记一条：审计上「申请单」与「授权记录」是两个对象，
        // 单查 GRANT 即可回答「谁在何时把什么权限授给了谁」。
        Map<String, Object> grantAudit = new LinkedHashMap<>();
        grantAudit.put("no", request.getApplicationNo());
        grantAudit.put("userId", request.getApplicantId());
        grantAudit.put("resourceType", request.getResourceType());
        grantAudit.put("resourceId", request.getResourceId());
        grantAudit.put("grantType", grantType);
        grantAudit.put("expireAt", expireText(expireAt));
        grantAudit.put("source", PermissionGrant.SOURCE_APPROVAL);
        auditLogger.success(OperationLog.ACTION_GRANT, OperationLog.TARGET_GRANT, grant.getId(), grantAudit);
        log.info("[permission] 审批通过: no={}, applicant={}, grantType={}, expireAt={}, approver={}",
                request.getApplicationNo(), request.getApplicantId(), grantType, expireAt, approverId);
        return ApprovalRequestVO.of(requestMapper.selectById(applicationId));
    }

    /** 审批驳回：理由必填（入参已校验），通知申请人。 */
    @Transactional
    public ApprovalRequestVO reject(Long applicationId, ApplicationRejectDTO dto) {
        Long approverId = AuthzContext.currentUser().getId();
        ApprovalRequest request = loadActiveRequestOwnedBy(applicationId, approverId);

        ApprovalStateMachine.assertTransit(request.getStatus(), ApprovalRequest.STATUS_REJECTED);
        LocalDateTime now = LocalDateTime.now();
        int rows = requestMapper.update(null, Wrappers.<ApprovalRequest>lambdaUpdate()
                .eq(ApprovalRequest::getId, applicationId)
                .in(ApprovalRequest::getStatus,
                        ApprovalRequest.STATUS_PENDING, ApprovalRequest.STATUS_TRANSFERRED)
                .eq(ApprovalRequest::getApproverId, approverId)
                .set(ApprovalRequest::getStatus, ApprovalRequest.STATUS_REJECTED)
                .set(ApprovalRequest::getOpinion, dto.opinion())
                .set(ApprovalRequest::getDecidedAt, now));
        if (rows != 1) {
            throw new BusinessException(ErrorCode.APPROVAL_STATE_ERROR);
        }

        markNode(applicationId, approverId, ApprovalNode.STATUS_REJECTED, dto.opinion(), now);
        notificationPort.send(NotificationCommand.approvalResult(
                request.getApplicantId(), applicationId, request.getApplicationNo(),
                "已驳回，理由：" + dto.opinion()));
        Map<String, Object> audit = new LinkedHashMap<>();
        audit.put("no", request.getApplicationNo());
        audit.put("applicantId", request.getApplicantId());
        audit.put("opinion", dto.opinion());
        auditLogger.success(OperationLog.ACTION_REJECT, OperationLog.TARGET_APPLICATION, applicationId, audit);
        log.info("[permission] 审批驳回: no={}, applicant={}, approver={}",
                request.getApplicationNo(), request.getApplicantId(), approverId);
        return ApprovalRequestVO.of(requestMapper.selectById(applicationId));
    }

    /** 审批转审：改指审批人（TRANSFERRED 后回到 PENDING），节点留痕并通知新审批人。 */
    @Transactional
    public ApprovalRequestVO transfer(Long applicationId, ApplicationTransferDTO dto) {
        Long approverId = AuthzContext.currentUser().getId();
        ApprovalRequest request = loadActiveRequestOwnedBy(applicationId, approverId);

        Long target = dto.targetApproverId();
        if (target.equals(request.getApplicantId())) {
            throw new BusinessException(ErrorCode.REASSIGN_INVALID, "不能转审给申请人本人");
        }
        if (target.equals(approverId)) {
            throw new BusinessException(ErrorCode.REASSIGN_INVALID, "不能转审给自己");
        }

        ApprovalStateMachine.assertTransit(request.getStatus(), ApprovalRequest.STATUS_TRANSFERRED);
        int toTransferred = requestMapper.update(null, Wrappers.<ApprovalRequest>lambdaUpdate()
                .eq(ApprovalRequest::getId, applicationId)
                .in(ApprovalRequest::getStatus,
                        ApprovalRequest.STATUS_PENDING, ApprovalRequest.STATUS_TRANSFERRED)
                .eq(ApprovalRequest::getApproverId, approverId)
                .set(ApprovalRequest::getStatus, ApprovalRequest.STATUS_TRANSFERRED)
                .set(ApprovalRequest::getApproverId, target)
                .set(ApprovalRequest::getOpinion, dto.opinion()));
        if (toTransferred != 1) {
            throw new BusinessException(ErrorCode.APPROVAL_STATE_ERROR);
        }

        ApprovalStateMachine.assertTransit(
                ApprovalRequest.STATUS_TRANSFERRED, ApprovalRequest.STATUS_PENDING);
        int backToPending = requestMapper.update(null, Wrappers.<ApprovalRequest>lambdaUpdate()
                .eq(ApprovalRequest::getId, applicationId)
                .eq(ApprovalRequest::getStatus, ApprovalRequest.STATUS_TRANSFERRED)
                .eq(ApprovalRequest::getApproverId, target)
                .set(ApprovalRequest::getStatus, ApprovalRequest.STATUS_PENDING));
        if (backToPending != 1) {
            throw new BusinessException(ErrorCode.APPROVAL_STATE_ERROR);
        }

        insertNode(applicationId, 1, ApprovalNodeResolver.ResolvedNode.TYPE_SINGLE, target,
                ApprovalNode.STATUS_TRANSFERRED,
                "由用户 " + approverId + " 转审" + (dto.opinion() == null ? "" : "：" + dto.opinion()));
        notificationPort.send(NotificationCommand.approvalTodo(
                target, applicationId, request.getApplicationNo(), summary(request)));
        Map<String, Object> audit = new LinkedHashMap<>();
        audit.put("no", request.getApplicationNo());
        audit.put("from", approverId);
        audit.put("to", target);
        audit.put("opinion", dto.opinion());
        auditLogger.success(OperationLog.ACTION_TRANSFER, OperationLog.TARGET_APPLICATION, applicationId, audit);
        log.info("[permission] 审批转审: no={}, from={}, to={}",
                request.getApplicationNo(), approverId, target);
        return ApprovalRequestVO.of(requestMapper.selectById(applicationId));
    }

    /* ============================== 私有实现 ============================== */

    /** 取申请单并校验：存在、活动态、当前用户即其审批人。 */
    private ApprovalRequest loadActiveRequestOwnedBy(Long applicationId, Long approverId) {
        ApprovalRequest request = requestMapper.selectById(applicationId);
        if (request == null) {
            throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "申请单不存在");
        }
        if (!ApprovalStateMachine.isActive(request.getStatus())) {
            throw new BusinessException(ErrorCode.APPROVAL_STATE_ERROR, "申请单已办结，无法再次处理");
        }
        if (request.getApproverId() == null || !request.getApproverId().equals(approverId)) {
            throw new AuthException(ErrorCode.NO_AUTH, "你不是该申请单的当前审批人");
        }
        return request;
    }

    /** Deny 优先：申请人所属角色的显式拒绝权限点命中即拒。 */
    private void assertNotDenied(Long applicantId, String applyType) {
        AccessSnapshot snapshot = permissionService.resolve(applicantId);
        String permCode = permCodeOf(applyType);
        if (snapshot.deniedPermCodes().contains(permCode)) {
            throw new AuthException(ErrorCode.NO_AUTH,
                    "该操作已被安全策略显式禁止（Deny 优先），无法申请：" + permCode);
        }
    }

    /** 申请动作 → 权限点（用于 Deny 黑名单比对）。 */
    private String permCodeOf(String applyType) {
        return switch (applyType) {
            case ApprovalEnums.APPLY_DOWNLOAD -> "file:download";
            case ApprovalEnums.APPLY_EDIT -> "file:edit";
            case ApprovalEnums.APPLY_SHARE -> "file:share";
            default -> "file:preview";
        };
    }

    /** 最终授权动作：缺省取申请动作；显式给出时不得强于申请动作（审批不得放大范围）。 */
    private String resolveFinalGrantType(ApprovalRequest request, String requested) {
        String applyType = request.getApplyType();
        if (requested == null || requested.isBlank()) {
            return applyType;
        }
        String finalType = normalize(requested);
        if (!ApprovalEnums.isValidApplyType(finalType)) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE, "不支持的授权动作：" + requested);
        }
        if (actionRank(finalType) > actionRank(applyType)) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE,
                    "审批不得放大授权范围：" + applyType + " → " + finalType);
        }
        return finalType;
    }

    /** 动作强度序：ACCESS < DOWNLOAD < EDIT < SHARE。 */
    private int actionRank(String action) {
        return switch (action) {
            case ApprovalEnums.APPLY_EDIT -> 2;
            case ApprovalEnums.APPLY_SHARE -> 3;
            case ApprovalEnums.APPLY_DOWNLOAD -> 1;
            default -> 0;
        };
    }

    /** 最终有效期：只可缩短——取「批复值」与「申请人期望值」中较早者（null 表示长期）。 */
    private LocalDateTime resolveExpireAt(LocalDateTime approved, LocalDateTime desired) {
        if (approved == null) {
            return desired;
        }
        if (desired == null) {
            return approved;
        }
        return approved.isBefore(desired) ? approved : desired;
    }

    /** 结束当前审批节点（CAS：待处理 → 目标态）。 */
    private void markNode(Long applicationId, Long approverId, int status, String opinion,
                          LocalDateTime actedAt) {
        nodeMapper.update(null, Wrappers.<ApprovalNode>lambdaUpdate()
                .eq(ApprovalNode::getApprovalId, applicationId)
                .eq(ApprovalNode::getApproverId, approverId)
                .eq(ApprovalNode::getStatus, ApprovalNode.STATUS_PENDING)
                .set(ApprovalNode::getStatus, status)
                .set(ApprovalNode::getOpinion, opinion)
                .set(ApprovalNode::getActedAt, actedAt));
    }

    /** 追加节点留痕（转审 / 后续多级审批）。 */
    private void insertNode(Long applicationId, int nodeSeq, int nodeType, Long approverId,
                            int status, String opinion) {
        ApprovalNode node = new ApprovalNode();
        node.setApprovalId(applicationId);
        node.setNodeSeq(nodeSeq);
        node.setNodeType(nodeType);
        node.setApproverId(approverId);
        node.setStatus(status);
        node.setOpinion(opinion);
        node.setActedAt(status == ApprovalNode.STATUS_PENDING ? null : LocalDateTime.now());
        nodeMapper.insert(node);
    }

    /** 申请单号：AP + 日期 + 雪花 ID 的 36 进制（跨日全局唯一，无需 Redis 计数）。 */
    private String nextApplicationNo() {
        return "AP" + LocalDate.now().format(NO_DATE)
                + Long.toString(IdWorker.getId(), 36).toUpperCase(Locale.ROOT);
    }

    /** 通知摘要。 */
    private String summary(ApprovalRequest request) {
        return request.getApplyType() + " " + request.getResourceType() + "#" + request.getResourceId();
    }

    private String expireText(LocalDateTime expireAt) {
        return expireAt == null ? "长期有效" : expireAt.toString();
    }

    private String normalize(String value) {
        return value == null ? null : value.trim().toUpperCase(Locale.ROOT);
    }
}
