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

import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

/**
 * 审批「通过」入参：允许审批人在申请人诉求基础上<b>缩小授权范围 / 缩短有效期</b>后下发。
 *
 * <ul>
 *     <li>{@code grantType}：最终授权动作（可低于申请动作，如申请 EDIT 批 ACCESS）；缺省取申请动作；</li>
 *     <li>{@code expireAt}：最终到期时刻，<b>不得晚于</b>申请人期望有效期（只可缩短，不可放宽）；
 *         两者皆空表示长期有效；</li>
 *     <li>{@code opinion}：审批意见（可选）。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
public record ApplicationDecisionDTO(

        String grantType,

        LocalDateTime expireAt,

        @Size(max = 500, message = "审批意见不超过 500 字")
        String opinion) {
}
