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
package com.anttransfer.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 认证接口请求 / 响应模型。
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

    /** 登录用户摘要（不含敏感字段） */
    public record UserSummary(Long id, String username, String nickname, String avatarUrl,
                              List<String> roles) {
    }

    /** 令牌对响应（access + refresh） */
    public record TokenResponse(String accessToken, String refreshToken, String tokenType,
                                long expiresIn, UserSummary user) {
    }
}
