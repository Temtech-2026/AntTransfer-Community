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
package com.anttransfer.auth.config;

import com.anttransfer.auth.security.JwtAuthenticationFilter;
import com.anttransfer.auth.security.JwtTokenProvider;
import com.anttransfer.auth.security.RestAccessDeniedHandler;
import com.anttransfer.auth.security.RestAuthenticationEntryPoint;
import com.anttransfer.auth.service.TokenSessionService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.ArrayList;
import java.util.List;

/**
 * Spring Security 配置（at-auth 内自建，at-bootstrap 组件扫描装配）。
 *
 * <p>要点：</p>
 * <ul>
 *     <li>无状态会话（STATELESS），CSRF 关闭；</li>
 *     <li>内置免登录白名单：登录 / 刷新 / 错误页（追加项经
 *         {@code anttransfer.auth.permit-all} 配置）；</li>
 *     <li>其余请求一律 {@code authenticated()}——默认拒绝（红队 V-06）；
 *         未认证经 {@link RestAuthenticationEntryPoint} 输出统一 Result
 *         （1001/1002/1006 由 {@link JwtAuthenticationFilter} 标记），
 *         越权经 {@link RestAccessDeniedHandler} 输出 1003；</li>
 *     <li>{@link JwtAuthenticationFilter} 挂在用户名密码过滤器之前，
 *         并以 {@link FilterRegistrationBean#setEnabled(false)} 阻止 Boot 二次
 *         注册为 Servlet 过滤器（避免每个请求执行两遍）；</li>
 *     <li>密码散列统一 BCrypt cost=10（与 V2 admin 初始密文一致）。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
@Configuration
public class SecurityConfig {

    /**
     * CORS 允许来源白名单（与 at-gateway GatewayWebConfig 同源配置键）：
     * dev 默认放开，生产收敛为显式白名单并禁止携带凭证 + {@code *}。
     */
    @Value("${anttransfer.cors.allowed-origin-patterns:*}")
    private List<String> allowedOriginPatterns;

    /** 内置免登录白名单（PathPattern 语法，不含 context-path） */
    private static final List<String> BUILT_IN_PERMIT_ALL = List.of(
            "/v1/auth/token",         // 登录
            "/v1/auth/token/refresh", // 刷新令牌
            "/error");

    @Bean
    public PasswordEncoder passwordEncoder() {
        // cost=10：与 sql/V2__init_data.sql admin 初始密文强度一致
        return new BCryptPasswordEncoder(10);
    }

    @Bean
    public JwtAuthenticationFilter jwtAuthenticationFilter(JwtTokenProvider tokenProvider,
                                                           TokenSessionService sessionService) {
        return new JwtAuthenticationFilter(tokenProvider, sessionService);
    }

    /**
     * 阻止 Boot 把 JwtAuthenticationFilter 自动注册为全局 Servlet 过滤器：
     * 它只应在 SecurityFilterChain 内执行一次（避免与容器层重复执行 / 双写 SecurityContext）。
     */
    @Bean
    public FilterRegistrationBean<JwtAuthenticationFilter> jwtFilterRegistration(
            JwtAuthenticationFilter filter) {
        FilterRegistrationBean<JwtAuthenticationFilter> registration =
                new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        List<String> patterns = allowedOriginPatterns == null
                ? List.of()
                : allowedOriginPatterns.stream().map(String::trim).filter(s -> !s.isEmpty()).toList();
        // 空白名单 = 不放行任何跨域来源（同源部署不受影响）；默认 * 仅用于 dev
        config.setAllowedOriginPatterns(patterns);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            AuthProperties properties,
            JwtAuthenticationFilter jwtFilter,
            RestAuthenticationEntryPoint entryPoint,
            RestAccessDeniedHandler accessDeniedHandler) throws Exception {
        List<String> whitelist = new ArrayList<>(BUILT_IN_PERMIT_ALL);
        whitelist.addAll(properties.getPermitAll());

        http.csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> {
                    auth.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll();
                    for (String pattern : whitelist) {
                        auth.requestMatchers(pattern).permitAll();
                    }
                    auth.anyRequest().authenticated();
                })
                .exceptionHandling(exception -> exception
                        .authenticationEntryPoint(entryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
