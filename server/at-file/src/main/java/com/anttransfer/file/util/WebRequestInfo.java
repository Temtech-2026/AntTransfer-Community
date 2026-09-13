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
package com.anttransfer.file.util;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * 从当前请求上下文提取审计所需的来源信息（IP / UA），供接口层复用。
 *
 * <p>与 at-gateway 访问日志同一口径：IP 优先取反向代理透传的 {@code X-Forwarded-For} 首段
 * （需部署侧可信），兜底 {@code remoteAddr}；UA 截断以适配 {@code sys_operation_log} 字段上限。
 * 非 Servlet 上下文（如单测 / 定时任务）返回 {@code unknown} / {@code null}，不抛异常。</p>
 *
 * @author AntTransfer CE
 */
public final class WebRequestInfo {

    private static final String UNKNOWN = "unknown";
    private static final int MAX_UA_LENGTH = 512;

    private WebRequestInfo() {
    }

    /** 来源 IP；取不到时返回 {@code unknown}（非空，便于审计落库） */
    public static String clientIp() {
        HttpServletRequest request = currentRequest();
        if (request == null) {
            return UNKNOWN;
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            String ip = (comma > 0 ? forwarded.substring(0, comma) : forwarded).trim();
            if (!ip.isEmpty()) {
                return ip;
            }
        }
        String remote = request.getRemoteAddr();
        return remote == null || remote.isBlank() ? UNKNOWN : remote;
    }

    /** 来源 UA；取不到返回 {@code null}（审计侧按缺失处理） */
    public static String userAgent() {
        HttpServletRequest request = currentRequest();
        if (request == null) {
            return null;
        }
        String ua = request.getHeader("User-Agent");
        if (ua == null) {
            return null;
        }
        ua = ua.trim();
        if (ua.isEmpty()) {
            return null;
        }
        return ua.length() > MAX_UA_LENGTH ? ua.substring(0, MAX_UA_LENGTH) : ua;
    }

    private static HttpServletRequest currentRequest() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
            return attrs.getRequest();
        }
        return null;
    }
}
