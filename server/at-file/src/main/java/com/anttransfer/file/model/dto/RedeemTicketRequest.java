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
package com.anttransfer.file.model.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 访客核销一次性票据请求（免登录）。
 *
 * @author AntTransfer CE
 */
@Data
public class RedeemTicketRequest {

    /** 一次性票据（由 {@code POST /v1/shares/{token}/verify} 下发，GETDEL 取用即焚） */
    @NotBlank(message = "票据不能为空")
    private String ticket;
}
