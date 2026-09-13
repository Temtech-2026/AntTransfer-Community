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
package com.anttransfer.auth.security;

import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.common.result.Result;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * 认证入口点：未认证访问受保护接口时输出统一 {@code Result}（而非容器默认 401 页）。
 *
 * <p>错误码取自 {@link JwtAuthenticationFilter} 写入的请求属性——区分
 * 「未登录 1001」「过期 1002（前端静默刷新）」「令牌无效 1006（跳登录）」；
 * 无该属性（根本没带令牌）默认 1001。</p>
 *
 * @author AntTransfer CE
 */
@Component
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    public RestAuthenticationEntryPoint(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        Object attr = request.getAttribute(JwtAuthenticationFilter.ATTR_AUTH_ERROR_CODE);
        ErrorCode errorCode = ErrorCode.NOT_LOGIN;
        if (attr instanceof Integer code) {
            // 该属性由过滤器写入、属不可信输入：用 find 显式降级，未知码回退「未登录」不阻断响应
            errorCode = ErrorCode.find(code).orElse(ErrorCode.NOT_LOGIN);
        }

        response.setStatus(errorCode.getHttpStatus());
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), Result.fail(errorCode));
    }
}
