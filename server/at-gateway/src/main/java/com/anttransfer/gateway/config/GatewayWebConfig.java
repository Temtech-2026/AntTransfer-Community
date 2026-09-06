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
package com.anttransfer.gateway.config;

import com.anttransfer.gateway.filter.AccessLogFilter;
import com.anttransfer.gateway.filter.TraceIdFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

/**
 * 网关 Web 横切配置。
 *
 * <p>职责：注册链路追踪过滤器、访问日志过滤器、统一 CORS 白名单。
 * 该类位于 at-gateway，随 at-bootstrap 的组件扫描
 * （scanBasePackages = com.anttransfer）自动装配。</p>
 *
 * <p>CORS 白名单（红队 [D-01]）：通过 {@code anttransfer.cors.allowed-origin-patterns}
 * 配置，默认放开（dev 前端 8000 直连），生产必须收敛为显式白名单，
 * 携带凭证（allowCredentials=true）场景禁止使用 {@code *} 通配。</p>
 *
 * @author AntTransfer CE
 */
@Configuration
public class GatewayWebConfig implements WebMvcConfigurer {

    /** CORS 允许来源白名单（Pattern）；dev 默认放开，生产经环境变量收紧 */
    @Value("${anttransfer.cors.allowed-origin-patterns:*}")
    private List<String> allowedOriginPatterns;

    /**
     * 链路追踪过滤器：最高优先级，保证所有请求先打上 traceId。
     */
    @Bean
    public FilterRegistrationBean<TraceIdFilter> traceIdFilterRegistration() {
        FilterRegistrationBean<TraceIdFilter> registration =
                new FilterRegistrationBean<>(new TraceIdFilter());
        registration.addUrlPatterns("/*");
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registration;
    }

    /**
     * 访问日志过滤器：紧邻 trace 之后（order=1），日志行带 MDC traceId。
     */
    @Bean
    public FilterRegistrationBean<AccessLogFilter> accessLogFilterRegistration() {
        FilterRegistrationBean<AccessLogFilter> registration =
                new FilterRegistrationBean<>(new AccessLogFilter());
        registration.addUrlPatterns("/*");
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 1);
        return registration;
    }

    /**
     * 全局 CORS：来源白名单配置化（生产收敛，禁止放开到 * 并携带凭证）。
     */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(resolveOriginPatterns())
                .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }

    private String[] resolveOriginPatterns() {
        List<String> list = allowedOriginPatterns == null
                ? List.of("*")
                : allowedOriginPatterns.stream()
                        .map(String::trim)
                        .filter(StringUtils::hasText)
                        .toList();
        return list.toArray(new String[0]);
    }
}
