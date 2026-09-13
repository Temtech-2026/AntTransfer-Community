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

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 审批「转审」入参：把当前待办改指给另一位有审批权的用户，并留痕 + 通知新审批人。
 *
 * @param targetApproverId 转审目标审批人用户 ID（必填；不得为申请人本人）
 * @param opinion          转审说明（可选，≤500 字）
 * @author AntTransfer CE
 */
public record ApplicationTransferDTO(

        @NotNull(message = "转审目标审批人不能为空")
        Long targetApproverId,

        @Size(max = 500, message = "转审说明不超过 500 字")
        String opinion) {
}
