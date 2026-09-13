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
package com.anttransfer.permission.controller;

import com.anttransfer.common.result.PageResult;
import com.anttransfer.common.result.Result;
import com.anttransfer.permission.model.dto.ApplicationCreateDTO;
import com.anttransfer.permission.model.dto.ApplicationDecisionDTO;
import com.anttransfer.permission.model.dto.ApplicationRejectDTO;
import com.anttransfer.permission.model.dto.ApplicationTransferDTO;
import com.anttransfer.permission.model.vo.ApprovalRequestVO;
import com.anttransfer.permission.model.vo.PermissionMapView;
import com.anttransfer.permission.security.AuthzContext;
import com.anttransfer.permission.service.PermissionApplicationService;
import com.anttransfer.permission.service.PermissionQueryService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 权限申请与审批端点（use-case-flows §2.3）。
 *
 * <p>身份一律由登录态（{@link AuthzContext}）推导，<b>不信任请求体中的申请人 / 审批人字段</b>；
 * 分页上界由 {@link PermissionQueryService} 统一收敛。</p>
 *
 * @author AntTransfer CE
 */
@RestController
@RequestMapping("/v1/permission")
public class PermissionApplicationController {

    private final PermissionApplicationService applicationService;
    private final PermissionQueryService queryService;

    public PermissionApplicationController(PermissionApplicationService applicationService,
                                           PermissionQueryService queryService) {
        this.applicationService = applicationService;
        this.queryService = queryService;
    }

    /** 提交权限申请（冲突校验 1008/1009 以流程码返回，前端按提示处理）。 */
    @PostMapping("/applications")
    public Result<ApprovalRequestVO> create(@Valid @RequestBody ApplicationCreateDTO dto) {
        return Result.ok(applicationService.create(dto, null));
    }

    /** 审批通过（可缩小授权范围 / 缩短有效期）。 */
    @PostMapping("/applications/{id}/approve")
    public Result<ApprovalRequestVO> approve(@PathVariable Long id,
                                             @Valid @RequestBody ApplicationDecisionDTO dto) {
        return Result.ok(applicationService.approve(id, dto));
    }

    /** 审批驳回（理由必填）。 */
    @PostMapping("/applications/{id}/reject")
    public Result<ApprovalRequestVO> reject(@PathVariable Long id,
                                            @Valid @RequestBody ApplicationRejectDTO dto) {
        return Result.ok(applicationService.reject(id, dto));
    }

    /** 转审给其他可审批人。 */
    @PostMapping("/applications/{id}/transfer")
    public Result<ApprovalRequestVO> transfer(@PathVariable Long id,
                                              @Valid @RequestBody ApplicationTransferDTO dto) {
        return Result.ok(applicationService.transfer(id, dto));
    }

    /** 待我审批（分页）。 */
    @GetMapping("/applications/pending")
    public Result<PageResult<ApprovalRequestVO>> pending(
            @RequestParam(defaultValue = "1") long current,
            @RequestParam(defaultValue = "20") long pageSize) {
        Long userId = AuthzContext.currentUser().getId();
        return Result.ok(queryService.pagePendingForApprover(userId, current, pageSize));
    }

    /** 我发起的申请（分页）。 */
    @GetMapping("/applications/mine")
    public Result<PageResult<ApprovalRequestVO>> mine(
            @RequestParam(defaultValue = "1") long current,
            @RequestParam(defaultValue = "20") long pageSize) {
        Long userId = AuthzContext.currentUser().getId();
        return Result.ok(queryService.pageMine(userId, current, pageSize));
    }

    /** 我的权限地图：角色继承 + 审批获得（实时过滤已过期授权）。 */
    @GetMapping("/map")
    public Result<PermissionMapView> permissionMap() {
        Long userId = AuthzContext.currentUser().getId();
        return Result.ok(queryService.permissionMap(userId));
    }
}
