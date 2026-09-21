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
package com.anttransfer.auth.model.vo;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

import java.util.List;

/**
 * 认证接口出参视图对象（VO，仅承载 Controller 出站响应）。
 *
 * @author AntTransfer CE
 */
public final class AuthVos {

    private AuthVos() {
    }

    /**
     * 登录用户摘要（不含敏感字段）。
     *
     * <p><b>ID 以字符串过线：</b>19 位雪花 ID 超出 JS {@code Number.MAX_SAFE_INTEGER}，
     * 以 JSON number 下发会被 {@code JSON.parse} 静默取整。{@code currentUser.id} 在前端参与
     * 「是否本人发送」「消息归属」等判断，也可能被回传后端做已读 / 资料操作，丢精度即表现为
     * 「操作对不上人」。漏标注由 {@code PlatformIdJsonContractTest} 拦截。</p>
     */
    public record UserSummary(
            @JsonSerialize(using = ToStringSerializer.class)
            Long id,
            String username,
            String nickname,
            String avatarUrl,
            List<String> roles) {
    }

    /** 令牌对响应（access + refresh） */
    public record TokenResponse(String accessToken, String refreshToken, String tokenType,
                                long expiresIn, UserSummary user) {
    }
}
