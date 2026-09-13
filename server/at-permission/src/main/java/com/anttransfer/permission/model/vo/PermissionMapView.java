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
package com.anttransfer.permission.model.vo;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 「我的权限地图」视图：把用户实际持有的权限按<b>来源</b>拆开呈现。
 *
 * <ul>
 *     <li>{@code roleCodes} / {@code permCodes}：来自 RBAC 角色继承（静态，随角色变更）；</li>
 *     <li>{@code dataScope}：数据范围 1-本人 2-本部门及以下 3-全部；</li>
 *     <li>{@code approvalGrants}：来自审批获得的临时授权（动态，带到期时间 / 来源单号）。</li>
 * </ul>
 *
 * <p>两项并集即最终生效权限（use-case-flows §2.3-5）。</p>
 *
 * @param userId         用户 ID
 * @param roleCodes      角色编码集合（角色继承来源）
 * @param permCodes      角色继承的权限点编码集合
 * @param dataScope      数据范围：1-本人 2-本部门及以下 3-全部
 * @param approvalGrants 审批获得的临时授权明细
 * @author AntTransfer CE
 */
public record PermissionMapView(
        Long userId,
        List<String> roleCodes,
        List<String> permCodes,
        Integer dataScope,
        List<GrantItem> approvalGrants) {

    /**
     * 审批获得的单条授权明细。
     *
     * @param grantId       授权记录 ID
     * @param grantType     授权动作：ACCESS / DOWNLOAD / EDIT / SHARE
     * @param resourceType  资源类型
     * @param resourceId    资源 ID
     * @param expireAt      到期时刻（null = 长期有效）
     * @param applicationId 来源申请单 ID
     */
    public record GrantItem(
            Long grantId,
            String grantType,
            String resourceType,
            Long resourceId,
            LocalDateTime expireAt,
            Long applicationId) {
    }
}
