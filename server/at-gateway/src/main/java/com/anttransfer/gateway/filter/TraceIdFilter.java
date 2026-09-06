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
package com.anttransfer.gateway.filter;

import com.anttransfer.common.trace.TraceUtils;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * 链路追踪过滤器。
 *
 * <p>职责（位于请求链最前端）：</p>
 * <ol>
 *     <li>优先透传上游网关 / 客户端下发的 {@code X-Trace-Id}，保证跨系统串联；</li>
 *     <li>缺失时自动生成 32 位 traceId，写入 {@link TraceUtils}（ThreadLocal + MDC）；</li>
 *     <li>通过响应头 {@code X-Trace-Id} 回传给调用方，便于问题反馈时带回 traceId；</li>
 *     <li>finally 中清理 ThreadLocal，杜绝 Tomcat 线程池复用导致 traceId 串号。</li>
 * </ol>
 *
 * <p>注册方式：由 {@code at.gateway.config.GatewayWebConfig} 以
 * {@code FilterRegistrationBean} 方式注册并置为最高优先级。</p>
 *
 * @author AntTransfer CE
 */
public class TraceIdFilter extends OncePerRequestFilter {

    /** 链路追踪 ID 的请求 / 响应头名称 */
    public static final String TRACE_ID_HEADER = "X-Trace-Id";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        // 1. 获取上游透传的 traceId，缺失则自动生成
        String traceId = request.getHeader(TRACE_ID_HEADER);
        if (traceId == null || traceId.isBlank()) {
            traceId = UUID.randomUUID().toString().replace("-", "");
        }
        // 2. 写入 ThreadLocal 与 MDC
        TraceUtils.setTraceId(traceId);
        // 3. 回传响应头，方便调用方带回问题
        response.setHeader(TRACE_ID_HEADER, traceId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            // 4. 清理线程上下文，避免复用线程串号
            TraceUtils.clear();
        }
    }
}
