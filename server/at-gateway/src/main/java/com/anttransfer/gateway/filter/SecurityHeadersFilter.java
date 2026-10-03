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

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * 安全响应头过滤器（CSP / Referrer-Policy / Permissions-Policy 等）。
 *
 * <p>当前响应头只靠 Spring Security 默认值（nosniff / X-Frame-Options / HSTS / Cache-Control），
 * 缺失的三项恰是浏览器侧最后一道防线：CSP 挡住同源存储型 XSS 与外链脚本、
 * Referrer-Policy 防 Referer 泄露带 token 的分享链接、Permissions-Policy 收回设备能力。</p>
 *
 * <p><b>两处有意的折中（勿擅自收紧）：</b></p>
 * <ol>
 *     <li>{@code style-src} 保留 {@code 'unsafe-inline'}——前端为 Umi / React + antd，运行时注入内联
 *     {@code <style>}，收紧到 {@code 'self'} 会让页面无样式裸奔；待构建期抽出内联样式后再移除。</li>
 *     <li>不设 {@code Cross-Origin-Resource-Policy}——CE 的前端与 API 可能不同源（dev 下 8000 → 8080），
 *     设 {@code same-origin} 会直接阻断图片 / 附件加载，需按部署形态单独评估。</li>
 * </ol>
 *
 * <p>首次上线建议 {@code anttransfer.security.headers.report-only=true} 观察一周再切强制。</p>
 *
 * @author AntTransfer CE
 */
public class SecurityHeadersFilter extends OncePerRequestFilter {

    /** 强制生效的 CSP 头名。 */
    public static final String HEADER_CSP = "Content-Security-Policy";

    /** 仅观察不拦截的 CSP 头名。 */
    public static final String HEADER_CSP_REPORT_ONLY = "Content-Security-Policy-Report-Only";

    /**
     * 默认 CSP：脚本严格同源，禁止插件 / 内联框架被嵌，锁定 base-uri 与表单提交目标。
     * 前端为同源托管，故 {@code connect-src 'self'} 即可覆盖 API 调用。
     */
    public static final String DEFAULT_CSP = "default-src 'self'; script-src 'self'; "
            + "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; "
            + "connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; "
            + "frame-ancestors 'none'";

    private final boolean enabled;
    private final String csp;
    private final boolean reportOnly;

    /**
     * @param enabled    是否写入安全响应头
     * @param csp        CSP 策略串（空则由配置层回落到 {@link #DEFAULT_CSP}）
     * @param reportOnly true = 写 {@code Content-Security-Policy-Report-Only}（只报不拦）
     */
    public SecurityHeadersFilter(boolean enabled, String csp, boolean reportOnly) {
        this.enabled = enabled;
        this.csp = csp == null || csp.isBlank() ? DEFAULT_CSP : csp;
        this.reportOnly = reportOnly;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (enabled) {
            writeHeaders(response);
        }
        filterChain.doFilter(request, response);
    }

    /**
     * 写入安全响应头。全部使用「未设置才写」语义：允许下游（如 Spring Security 的
     * HeaderWriterFilter）覆盖为更严格的值，也避免同一头出现两个值。
     */
    private void writeHeaders(HttpServletResponse response) {
        String cspHeader = reportOnly ? HEADER_CSP_REPORT_ONLY : HEADER_CSP;
        writeIfAbsent(response, cspHeader, csp);
        writeIfAbsent(response, "X-Content-Type-Options", "nosniff");
        writeIfAbsent(response, "X-Frame-Options", "DENY");
        writeIfAbsent(response, "Referrer-Policy", "strict-origin-when-cross-origin");
        writeIfAbsent(response, "Permissions-Policy",
                "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
        writeIfAbsent(response, "X-Permitted-Cross-Domain-Policies", "none");
    }

    private void writeIfAbsent(HttpServletResponse response, String name, String value) {
        if (response.getHeader(name) == null) {
            response.setHeader(name, value);
        }
    }
}
