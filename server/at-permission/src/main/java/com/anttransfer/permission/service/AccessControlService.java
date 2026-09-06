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
import com.anttransfer.permission.mapper.RbacAccessMapper;
import com.anttransfer.permission.model.PermissionModels.AccessSnapshot;
import org.springframework.stereotype.Service;

/**
 * 对象级 / 数据级访问控制（红队 V-01 的单一入口，防水平越权）。
 *
 * <p>职责：所有「按 ID 访问资源」的业务方法在放行前调用本服务的守卫方法——
 * 只校验「登录」是不够的，改一个 fileId / spaceId 不应看到别人的资源。</p>
 *
 * <p>判定口径（数据范围三维，PRD US-04 / system-design §3）：</p>
 * <ol>
 *     <li>资源 Owner 即当前用户 → 放行（含「本人」数据范围）；</li>
 *     <li>数据范围 = 3（全部，内置 SUPER_ADMIN/AUDITOR）→ 放行；</li>
 *     <li>数据范围 = 2（本部门及以下，DEPT_ADMIN）→ 仅当资源归属部门 == 本部门
 *         或在其子树内（sys_dept.ancestors 祖先链判定）放行；</li>
 *     <li>其余一律拒绝（默认 Deny，红队 V-06）→ 403（1004）。</li>
 * </ol>
 *
 * <p>功能权限（操作点）用 {@code @RequiresPerm}；本类只做「这个数据能不能看」。</p>
 *
 * @author AntTransfer CE
 */
// ===================== TODO[AT-DIFF-03] 待整体完工后裁决 =====================
// 差异：外部计划要求「部门管理员只能查本部门数据」由【MyBatis 拦截器自动注入
// 数据范围条件】；当前实现是行级守卫（本类 assertResourceVisible），列表查询仍需
// 各业务 Service 显式携带范围条件（如 dept_id in 子树 或 owner_id = 当前用户）。
// 拦截器方案（如决定落地，按此设计）：
//   1) 自定义注解 @DataScope(tableAlias = "f") 标注在 Mapper 方法 / Service 查询上；
//   2) 实现 MyBatis InnerInterceptor（like PaginationInnerInterceptor），在
//      beforeQuery / 方法级注解驱动处，解析当前用户 dataScope（PermissionService.current）：
//        dataScope=3 全部 → 不追加；
//        dataScope=2 本部门及以下 → 对目标 SQL 追加 WHERE 片段
//          "f.dept_id = ? OR EXISTS(SELECT 1 FROM sys_dept d WHERE d.id = f.dept_id
//            AND d.ancestors LIKE '/myDeptId/%')"（参数化，复用祖先链口径）；
//        dataScope=1 本人 → 追加 "f.create_by = 当前用户ID"；
//   3) 风险与约束：全局 SQL 改写易漏 join/子查询别名、难覆盖 UNION；建议限定为
//      「列表/分页主查询 + 显式表别名」的受控场景，行级点查仍走本类守卫，两者并存；
//   4) 附注：审计员(dataScope=3)与超管一样可看全量（但仅 audit:log:read 权限点，
//      不具文件读写，功能层依旧受限）。
// 若外部计划仅要求「给出实现思路」，本文档即满足；是否落代码待整体排期裁决。
// ======================================================================
@Service
public class AccessControlService {

    /** 数据范围：本人 */
    public static final int SCOPE_SELF = 1;
    /** 数据范围：本部门及以下 */
    public static final int SCOPE_DEPT = 2;
    /** 数据范围：全部 */
    public static final int SCOPE_ALL = 3;

    private final PermissionService permissionService;
    private final RbacAccessMapper mapper;

    public AccessControlService(PermissionService permissionService, RbacAccessMapper mapper) {
        this.permissionService = permissionService;
        this.mapper = mapper;
    }

    /**
     * 断言当前用户可见指定资源。
     *
     * @param ownerUserId          资源 Owner 用户 ID（水平越权主防线：owner == 当前用户即放行）
     * @param resourceOwnerDeptId  资源归属部门 ID（数据范围 2 时用于部门子树判定，可为 null）
     */
    public void assertResourceVisible(Long ownerUserId, Long resourceOwnerDeptId) {
        assertResourceVisibleTo(permissionService.current(), ownerUserId, resourceOwnerDeptId);
    }

    /**
     * 同上，面向显式传入的授权快照（内部复用 / 单元测试）。
     */
    public void assertResourceVisibleTo(AccessSnapshot snapshot, Long ownerUserId,
                                        Long resourceOwnerDeptId) {
        // ① 本人资源（含「本人」范围：只能看自己的）
        if (ownerUserId != null && ownerUserId.equals(snapshot.userId())) {
            return;
        }
        // ② 数据范围 3：全部
        if (snapshot.dataScope() >= SCOPE_ALL) {
            return;
        }
        // ③ 数据范围 2：本部门及以下（sys_dept.ancestors 祖先链）
        if (snapshot.dataScope() == SCOPE_DEPT) {
            if (resourceOwnerDeptId != null && deptInOwnScope(snapshot.userId(), resourceOwnerDeptId)) {
                return;
            }
        }
        // ④ 其余一律拒绝（默认 Deny）
        throw new AuthException(ErrorCode.NO_AUTH, "无权访问该资源（数据范围不足或非资源归属人）");
    }

    /**
     * 仅当资源归属部门 = 本部门或在其子树（祖先链前缀匹配）时可见。
     */
    private boolean deptInOwnScope(Long userId, Long resourceDeptId) {
        Long myDeptId = mapper.selectUserDeptId(userId);
        if (myDeptId == null) {
            return false;
        }
        if (myDeptId.equals(resourceDeptId)) {
            return true;
        }
        String myAncestors = mapper.selectDeptAncestors(myDeptId);
        String safeAncestors = myAncestors == null || myAncestors.isBlank() ? "/" : myAncestors;
        if (!safeAncestors.endsWith("/")) {
            safeAncestors = safeAncestors + "/";
        }
        // 本人部门子树前缀：/0/12/34/（34 的子孙部门 ancestors 均以此开头）
        String prefix = safeAncestors + myDeptId + "/";
        String targetAncestors = mapper.selectDeptAncestors(resourceDeptId);
        return targetAncestors != null && targetAncestors.startsWith(prefix);
    }
}
