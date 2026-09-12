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
package com.anttransfer.auth.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 认证接口入参传输对象（DTO，仅承载 Controller 入站请求）。
 *
 * <p>出参视图对象统一放 {@code com.anttransfer.auth.model.vo}（见 AuthVos）。</p>
 *
 * @author AntTransfer CE
 */
public final class AuthDtos {

    private AuthDtos() {
    }

    /** 登录请求：本地账号密码 */
    public record LoginRequest(
            @NotBlank(message = "账号不能为空")
            @Size(max = 64, message = "账号长度超出限制")
            String username,

            @NotBlank(message = "密码不能为空")
            @Size(max = 128, message = "密码长度超出限制")
            String password) {
    }

    /** 刷新令牌请求（refresh token 轮换换发新令牌对） */
    public record RefreshTokenRequest(
            @NotBlank(message = "refreshToken 不能为空")
            String refreshToken) {
    }
}
