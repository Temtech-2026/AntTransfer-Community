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

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * 启用 / 停用用户入参。
 *
 * <p>对应 {@code PATCH /api/v1/system/users/{id}/status}（需 {@code system:user:status}）。</p>
 *
 * <p>停用（{@code status=1}）会使在途会话立即失效（表主侧 {@code token_epoch}+1），
 * 并触发权限重评估回收审批类授权——「离职/停用即回收」是审批授权的最小闭环。</p>
 *
 * @param status 目标状态：0-正常 1-禁用（与 {@code UserAdminPort.STATUS_*} 对齐）
 * @author AntTransfer CE
 */
public record UserStatusDTO(

        @NotNull(message = "目标状态不能为空")
        @Min(value = 0, message = "状态取值 0-1")
        @Max(value = 1, message = "状态取值 0-1")
        Integer status) {
}
