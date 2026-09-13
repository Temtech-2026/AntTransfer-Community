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

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 审批「驳回」入参：<b>驳回理由必填</b>（将通知申请人）。
 *
 * @param opinion 驳回理由（必填，≤500 字）
 * @author AntTransfer CE
 */
public record ApplicationRejectDTO(

        @NotBlank(message = "驳回理由不能为空")
        @Size(max = 500, message = "驳回理由不超过 500 字")
        String opinion) {
}
