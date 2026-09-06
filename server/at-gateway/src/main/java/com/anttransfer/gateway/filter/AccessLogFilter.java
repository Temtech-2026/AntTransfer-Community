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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 * 访问日志过滤器：为每个请求输出一行结构化 access log。
 *
 * <p>说明：</p>
 * <ul>
 *     <li>放置在 {@link TraceIdFilter} 之后（order=1），日志行可带 MDC traceId（logback pattern
 *         中 {@code %X{traceId}}），实现「响应体 traceId ↔ access log」双向检索（PRD §7 可观测）；</li>
 *     <li>记录：方法、URI（不含 query，避免误落敏感参数）、HTTP 状态、耗时、客户端 IP、
 *         以及 X-Trace-Id（供跨层串联）；</li>
 *     <li>请求抛出异常时按 500 记录并原样抛出，统一由全局异常处理兜底。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
public class AccessLogFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(AccessLogFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        long startNanos = System.nanoTime();
        String method = request.getMethod();
        // 不落 query：避免提取码 / 敏感查询参数进入日志（红队 [D-02] 脱敏口径）
        String uri = request.getRequestURI();
        String clientIp = resolveClientIp(request);
        try {
            filterChain.doFilter(request, response);
            logAccess(method, uri, response.getStatus(), elapsedMillis(startNanos), clientIp);
        } catch (Throwable t) {
            logAccess(method, uri, 500, elapsedMillis(startNanos), clientIp);
            throw t;
        }
    }

    private void logAccess(String method, String uri, int status, long costMillis, String clientIp) {
        // traceId 由 TraceUtils 写入 MDC，pattern 自动携带；此处额外输出便于关键字检索
        log.info("access method={} uri={} status={} cost={}ms clientIp={} traceId={}",
                method, uri, status, costMillis, clientIp, TraceUtils.getTraceId());
    }

    private long elapsedMillis(long startNanos) {
        return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startNanos);
    }

    /** 客户端 IP：优先取反向代理透传头（需按部署可信），兜底 remoteAddr */
    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            return (comma > 0 ? forwarded.substring(0, comma) : forwarded).trim();
        }
        return request.getRemoteAddr();
    }
}
