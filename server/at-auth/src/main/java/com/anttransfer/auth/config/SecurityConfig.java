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
 *     <li>内置免登录白名单：认证入口 + <b>产品固有的匿名入口</b>（见
 *         {@link #BUILT_IN_PERMIT_ALL}），追加项经 {@code anttransfer.auth.permit-all}
 *         配置——<b>配置只有追加能力，删不掉内置项</b>；</li>
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

    /**
     * 内置免登录白名单（PathPattern 语法，不含 context-path）。
     *
     * <p><b>为什么这些写死在代码里，而不放 {@code anttransfer.auth.permit-all}？</b>
     * 下列路径分两类，共同点是<b>与运行环境无关</b>——任何 profile 下都必须放行。
     * 而 Spring Boot 的 profile 配置文档（{@code application-dev.yml} 等）优先级高于主文档，
     * 且 <b>List 属性是整体替换而非逐项合并</b>：只要任一 profile 写了一次
     * {@code permit-all}，主配置里的整份清单就被静默丢弃。曾经 dev profile 为放行 Swagger
     * 写了 4 条，本清单里的条目便随之在 dev 下全部失效——表现为 WebSocket 握手直接
     * 401(1001) 使前端永远停在「正在建立实时连接」、文件取件与分享核销一律 401，
     * 而 prod 却正常（prod 未写该键）。放进代码即从结构上消除「加配置反而删白名单」。</p>
     *
     * <p><b>⚠️ 放行访问路径 ≠ 免鉴权</b>：WebSocket 由 {@code WsHandshakeInterceptor}
     * 在 Upgrade 阶段校验 JWT，分享 / 取件由「令牌 + 短期票据」在服务层逐项复核。</p>
     */
    private static final List<String> BUILT_IN_PERMIT_ALL = List.of(
            // —— 认证入口：没有它们就没人能登录 ——
            "/v1/auth/token",         // 登录
            "/v1/auth/token/refresh", // 刷新令牌
            "/error",                 // 容器错误转发（否则错误页本身也要登录）

            // —— 产品固有的匿名入口：四处「浏览器无法携带 Authorization 头」的场景 ——
            // 外发分享访客侧：访客无登录态，凭「高熵令牌 + 提取码」自证身份；
            // 服务层逐项校验令牌 / 有效期 / 提取码 / 次数，另有 @RateLimit 抗爆破。
            "/v1/shares/*/verify",
            "/v1/shares/redeem",
            // 分享取件字节下发：与 /v1/files/*/content 同理——访客页的下载是浏览器原生 <a href>，
            // 「核销 + 换票」已在 /v1/shares/redeem 完成，此处凭短时取件票读字节（无 Authorization 头可带）。
            "/v1/shares/*/content",
            // 文件取件：<a href> 原生下载、<img src> 缩略图、播放器与下载工具都带不了头，
            // 凭证只能走查询串里的短时票据；权限判定前移到换票阶段（/v1/files/*/ticket）。
            "/v1/files/*/content",
            "/v1/files/*/thumbnail",
            // 会话附件取件：同一「浏览器带不了头」约束。判定（归属 / 撤销 / 有效期 / 用途档位 /
            // 次数原子扣减 / 审计）全部前移到登录态换票端点 /v1/chat-attachments/*/ticket，
            // 此处凭短时票据读字节，并回源复核「票据绑定 + 当前状态」（撤销即时生效）。
            "/v1/chat-attachments/*/content",
            // WebSocket 握手：浏览器 WebSocket 构造器不允许自定义请求头，令牌只能走查询串，
            // 在 Security 眼里是匿名请求；放行后由握手拦截器在 Upgrade 阶段完成 JWT 校验，
            // 未通过不升级为长连接——安全性不降级。
            "/ws/notify",
            // 用户头像直出：同样是「浏览器带不了头」的 <img src> 场景。
            //
            // ⚠️ 与上面几条的关键区别：本路径**没有服务层凭证复核**（查询串里的 v 只做缓存
            // 击穿，服务端不据此校验任何东西，取的始终是该用户的当前头像）。它是一条
            // **按设计公开**的读取路径，放行依据是三条同时成立：
            //   ① 内容低敏感——只回图片字节，不含账号 / 角色 / 部门等任何字段，
            //      响应头固定为图片类型 + nosniff，无法当作同源页面或脚本加载；
            //   ② ID 不可枚举——用户 ID 是雪花 ID（有序但跨度极大且带机器 / 序列位），
            //      无法按区间遍历；但**已知 ID 即可取到图像**，这一点必须承认；
            //   ③ 入口加 @RateLimit——把「拿已知 ID 批量拉取」的成本抬到可发现。
            // 因此**不得**在这条路径上追加任何返回体字段，也不得把头像换成含身份信息的
            // 内容（如工牌照片、带水印的证件图）；一旦内容升级，本放行必须改为「换票 + 票据」
            // 模式（照 /v1/files/*/content 的做法）。
            "/v1/users/*/avatar");

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
        List<String> whitelist = resolvePermitAll(properties);

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

    /**
     * 合并免登录白名单：内置项在前，配置追加项在后。
     *
     * <p>抽成静态方法是为了让单测能直接守住「配置只有追加能力、永远删不掉内置项」——
     * 这正是 dev profile 曾经踩中的坑（详见 {@link #BUILT_IN_PERMIT_ALL}）。</p>
     *
     * @param properties 配置项；{@code permit-all} 未配置时为 {@code null}，此处按空处理
     */
    static List<String> resolvePermitAll(AuthProperties properties) {
        List<String> whitelist = new ArrayList<>(BUILT_IN_PERMIT_ALL);
        List<String> configured = properties == null ? null : properties.getPermitAll();
        if (configured != null) {
            whitelist.addAll(configured);
        }
        return whitelist;
    }
}
