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

import com.anttransfer.gateway.filter.TraceIdFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 网关 Web 横切配置。
 *
 * <p>职责：注册链路追踪过滤器、统一 CORS 跨域策略。
 * 该类位于 at-gateway，随 at-bootstrap 的组件扫描
 * （scanBasePackages = com.anttransfer）自动装配。</p>
 *
 * <p>说明：CORS 在生产环境建议收敛为配置化白名单
 * （可将 allowedOriginPatterns 改为读取配置项），当前提供开发期全放开策略。</p>
 *
 * @author AntTransfer CE
 */
@Configuration
public class GatewayWebConfig implements WebMvcConfigurer {

    /**
     * 注册链路追踪过滤器为最高优先级，保证所有请求先打上 traceId。
     */
    @Bean
    public FilterRegistrationBean<TraceIdFilter> traceIdFilterRegistration() {
        FilterRegistrationBean<TraceIdFilter> registration = new FilterRegistrationBean<>(new TraceIdFilter());
        registration.addUrlPatterns("/*");
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        return registration;
    }

    /**
     * 全局 CORS：开发阶段放开所有来源 / 方法 / 头（携带凭证场景需用 allowedOriginPatterns）。
     */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);
    }
}
