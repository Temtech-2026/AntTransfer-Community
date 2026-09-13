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

import com.anttransfer.common.result.PageResult;
import com.anttransfer.permission.model.PermissionModels.AccessSnapshot;
import com.anttransfer.permission.model.entity.ApprovalRequest;
import com.anttransfer.permission.model.vo.ApprovalRequestVO;
import com.anttransfer.permission.model.vo.PermissionMapView;
import com.anttransfer.permission.repository.ApprovalRequestMapper;
import com.anttransfer.permission.repository.PermissionGrantMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 权限审批查询（读侧）：待我审批 / 我发起的申请分页、我的权限地图。
 *
 * <p>与写侧 {@link PermissionApplicationService} 分离，读接口不受写事务边界影响。</p>
 *
 * @author AntTransfer CE
 */
@Service
public class PermissionQueryService {

    /** 分页上界（API 契约 §9：单页最大 100，防大页拖库） */
    private static final long MAX_PAGE_SIZE = 100L;

    private final ApprovalRequestMapper requestMapper;
    private final PermissionGrantMapper grantMapper;
    private final PermissionService permissionService;

    public PermissionQueryService(ApprovalRequestMapper requestMapper,
                                  PermissionGrantMapper grantMapper,
                                  PermissionService permissionService) {
        this.requestMapper = requestMapper;
        this.grantMapper = grantMapper;
        this.permissionService = permissionService;
    }

    /** 待我审批（含待审 0 与转审后仍待处理的 3），按创建时间倒序。 */
    public PageResult<ApprovalRequestVO> pagePendingForApprover(Long approverId, long current, long pageSize) {
        IPage<ApprovalRequest> page = requestMapper.selectPage(newPage(current, pageSize),
                Wrappers.<ApprovalRequest>lambdaQuery()
                        .eq(ApprovalRequest::getApproverId, approverId)
                        .in(ApprovalRequest::getStatus,
                                ApprovalRequest.STATUS_PENDING, ApprovalRequest.STATUS_TRANSFERRED)
                        .orderByDesc(ApprovalRequest::getCreateTime));
        return toPageResult(page);
    }

    /** 我发起的申请（全状态），按创建时间倒序。 */
    public PageResult<ApprovalRequestVO> pageMine(Long applicantId, long current, long pageSize) {
        IPage<ApprovalRequest> page = requestMapper.selectPage(newPage(current, pageSize),
                Wrappers.<ApprovalRequest>lambdaQuery()
                        .eq(ApprovalRequest::getApplicantId, applicantId)
                        .orderByDesc(ApprovalRequest::getCreateTime));
        return toPageResult(page);
    }

    /**
     * 我的权限地图：角色继承（静态）+ 审批获得（动态，实时过滤已过期）。
     *
     * <p>审批获得的授权以「实时」为准（{@code expire_at > now}），不等定时回收任务收敛状态。</p>
     */
    public PermissionMapView permissionMap(Long userId) {
        AccessSnapshot snapshot = permissionService.resolve(userId);
        LocalDateTime now = LocalDateTime.now();
        List<PermissionMapView.GrantItem> grants = grantMapper.selectActiveApprovalGrants(userId).stream()
                .filter(grant -> grant.getExpireAt() == null || grant.getExpireAt().isAfter(now))
                .map(grant -> new PermissionMapView.GrantItem(
                        grant.getId(), grant.getGrantType(), grant.getResourceType(),
                        grant.getResourceId(), grant.getExpireAt(), grant.getApplicationId()))
                .toList();
        return new PermissionMapView(userId, snapshot.roles(), snapshot.permCodes(),
                snapshot.dataScope(), grants);
    }

    private Page<ApprovalRequest> newPage(long current, long pageSize) {
        long safeCurrent = Math.max(current, 1L);
        long safeSize = Math.min(Math.max(pageSize, 1L), MAX_PAGE_SIZE);
        return new Page<>(safeCurrent, safeSize);
    }

    private PageResult<ApprovalRequestVO> toPageResult(IPage<ApprovalRequest> page) {
        List<ApprovalRequestVO> records = page.getRecords().stream()
                .map(ApprovalRequestVO::of)
                .toList();
        return PageResult.of(records, page.getTotal(), page.getCurrent(), page.getSize());
    }
}
