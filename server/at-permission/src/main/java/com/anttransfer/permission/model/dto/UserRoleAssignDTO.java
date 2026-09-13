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
package com.anttransfer.permission.model.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * 分配用户角色入参（整集替换语义）。
 *
 * <p>对应 {@code PUT /api/v1/system/users/{id}/roles}（需 {@code system:user:assign-role}）。</p>
 *
 * <p><b>整集替换而非增量：</b>增量语义下「撤权」需要单独的删除接口，容易出现
 * 「前端只提交新增、撤权被遗忘」的授权残留。整集替换让最终态一目了然。
 * 传空列表表示摘除全部角色。</p>
 *
 * <p>禁止对当前操作者自身调用：自己给自己加角色是最直接的提权路径
 * （1023 SELF_OPERATION_FORBIDDEN），必须由另一名管理员操作。</p>
 *
 * @param roleIds 目标角色 ID 全集
 * @author AntTransfer CE
 */
public record UserRoleAssignDTO(

        @NotEmpty(message = "至少分配一个角色")
        List<Long> roleIds) {
}
