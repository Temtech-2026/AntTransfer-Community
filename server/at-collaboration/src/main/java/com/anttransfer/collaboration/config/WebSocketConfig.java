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
package com.anttransfer.collaboration.config;

import com.anttransfer.collaboration.service.NotifyMessageService;
import com.anttransfer.collaboration.ws.WsHandshakeInterceptor;
import com.anttransfer.collaboration.ws.WsNotifyHandler;
import com.anttransfer.collaboration.ws.WsPresenceService;
import com.anttransfer.collaboration.ws.WsProtocol;
import com.anttransfer.collaboration.ws.WsSessionRegistry;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

import java.util.List;

/**
 * WebSocket 端点装配：把 {@code /ws/notify} 映射到 {@link WsNotifyHandler}，
 * 并挂上握手鉴权拦截器。
 *
 * <p><b>路径与 context-path：</b>此处注册的是 <b>相对路径</b>，实际完整地址为
 * {@code ws(s)://host/api/ws/notify}（{@code server.servlet.context-path=/api}）。
 * 前端只需知道 {@code /api/ws/notify} 这一个常量。</p>
 *
 * <p><b>为什么必须把 {@code /ws/**} 加进 Spring Security 白名单：</b>
 * 浏览器的 {@code WebSocket} 构造器无法设置 {@code Authorization} 头，令牌只能走查询串；
 * 而 {@code JwtAuthenticationFilter} 只解析请求头，于是握手请求在 Security 眼里是「匿名」，
 * 会被 {@code anyRequest().authenticated()} 拦成 401，根本走不到本配置。
 * 放行后由 {@link WsHandshakeInterceptor} 在握手阶段完成 JWT 校验——
 * <b>安全性不降级</b>：未通过鉴权的连接不会升级为长连接。
 * 该路径的放行配置见 {@code anttransfer.auth.permit-all}。</p>
 *
 * <p><b>跨域来源复用 CORS 白名单同键</b>（{@code anttransfer.cors.allowed-origin-patterns}），
 * 不另立一份：多一份白名单就多一处可能配漏、且不随 CORS 收紧而收紧的隐患。</p>
 *
 * <p>{@link EnableScheduling} 在此开启：本模块的心跳（{@link com.anttransfer.collaboration.ws.WsHeartbeatScheduler}）
 * 依赖定时任务。多个 {@code @EnableScheduling} 并存无副作用（幂等），
 * 但让模块自包含可确保「只引入 at-collaboration 也能跑」。</p>
 *
 * <p><b>已知边界——连接建立后不复检令牌：</b>鉴权只在握手阶段做一次。access token
 * 过期（默认 30min）或账号被登出后，<b>已建立</b>的长连接不会自动断开，仍会继续接收推送。
 * 这是「握手即鉴权」模型的固有边界（帧不携带凭证，逐帧校验需在协议层额外承载并复验令牌）。
 * 影响面有限：连接只能接收<b>本人</b>的消息，且重连时必然被拒；如需强一致吊销，
 * EE 可扩展 {@code AccessTokenVerifier} 暴露令牌剩余有效期，由心跳顺带踢除超期连接。</p>
 *
 * @author AntTransfer CE
 */
@Configuration
@EnableWebSocket
@EnableScheduling
public class WebSocketConfig implements WebSocketConfigurer {

    /**
     * 允许的跨域来源（与 at-auth / at-gateway 同配置键）。
     * dev 默认 {@code *}；生产收敛为显式来源。
     */
    @Value("${anttransfer.cors.allowed-origin-patterns:*}")
    private List<String> allowedOriginPatterns;

    private final WsSessionRegistry wsSessionRegistry;
    private final WsHandshakeInterceptor wsHandshakeInterceptor;
    private final NotifyMessageService notifyMessageService;
    private final WsPresenceService wsPresenceService;
    private final WsProperties wsProperties;
    private final ObjectMapper objectMapper;

    public WebSocketConfig(WsSessionRegistry wsSessionRegistry,
                           WsHandshakeInterceptor wsHandshakeInterceptor,
                           NotifyMessageService notifyMessageService,
                           WsPresenceService wsPresenceService,
                           WsProperties wsProperties,
                           ObjectMapper objectMapper) {
        this.wsSessionRegistry = wsSessionRegistry;
        this.wsHandshakeInterceptor = wsHandshakeInterceptor;
        this.notifyMessageService = notifyMessageService;
        this.wsPresenceService = wsPresenceService;
        this.wsProperties = wsProperties;
        this.objectMapper = objectMapper;
    }

    @Bean
    public WsNotifyHandler wsNotifyHandler() {
        return new WsNotifyHandler(wsSessionRegistry, notifyMessageService, wsPresenceService,
                wsProperties, objectMapper);
    }

    /**
     * 容器级 WebSocket 参数：单帧文本上限。
     *
     * <p>为什么必须经 {@link ServletServerContainerFactoryBean} 而不能在 Handler 里设置：
     * 缓冲区上限是 Tomcat {@code WsServerContainer} 的属性，帧在进入 Handler 之前就已被容器
     * 按此值处理——放到 Handler 里为时已晚（超大帧此刻已读入内存，防爆内存的意义就没了）。
     * 手写协议的服务端是「下行主导」，上行只有心跳，因此 64KB 上限足够宽松且能挡住异常大帧。</p>
     */
    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(wsProperties.getTextMessageSizeLimitBytes());
        return container;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(wsNotifyHandler(), WsProtocol.PATH)
                .addInterceptors(wsHandshakeInterceptor)
                .setAllowedOriginPatterns(allowedOriginPatterns.toArray(String[]::new));
    }
}
