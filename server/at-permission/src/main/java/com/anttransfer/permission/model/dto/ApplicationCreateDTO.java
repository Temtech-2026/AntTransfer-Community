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
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

/**
 * 权限申请入参（四要素：权限类型 / 目标资源 / 使用目的 / 期望有效期）。
 *
 * <p>对应 {@code POST /api/v1/permission/applications}（use-case-flows §2.3-2）。
 * 敏感等级 {@code level} 可由前端按资源带出，缺省按 LOW 处理。</p>
 *
 * @param applyType       申请类型：ACCESS / DOWNLOAD / EDIT / SHARE
 * @param resourceType    目标资源类型：FILE / SPACE / GROUP
 * @param resourceId      目标资源 ID
 * @param level           资源敏感级别：1-低 2-中 3-高（可空，缺省 LOW）
 * @param purpose         使用目的 / 理由（必填，≤500 字）
 * @param desiredExpireAt 期望有效期（到期时刻；null = 不指定，由审批人批复）
 * @author AntTransfer CE
 */
public record ApplicationCreateDTO(

        @NotBlank(message = "申请类型不能为空")
        String applyType,

        @NotBlank(message = "目标资源类型不能为空")
        String resourceType,

        @NotNull(message = "目标资源 ID 不能为空")
        Long resourceId,

        @Min(value = 1, message = "敏感级别取值 1-3")
        @Max(value = 3, message = "敏感级别取值 1-3")
        Integer level,

        @NotBlank(message = "使用目的不能为空")
        @Size(max = 500, message = "使用目的不超过 500 字")
        String purpose,

        LocalDateTime desiredExpireAt) {
}
