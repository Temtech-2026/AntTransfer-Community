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
package com.anttransfer.gateway.error;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.catalina.Host;
import org.apache.catalina.Pipeline;
import org.apache.catalina.Valve;
import org.apache.catalina.valves.ErrorReportValve;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.context.WebServerInitializedEvent;
import org.springframework.boot.web.embedded.tomcat.TomcatWebServer;
import org.springframework.context.ApplicationListener;
import org.springframework.context.annotation.Configuration;

/**
 * 容器级错误统一化装配：把 Tomcat 自带的错误页阀门替换为 {@link JsonErrorReportValve}。
 *
 * <p><b>为什么在 {@link WebServerInitializedEvent} 里做</b>：Spring Boot 的
 * {@code TomcatServletWebServerFactory} 会在准备阶段向 Host pipeline 注入
 * {@code WhitelabelErrorReportValve}（{@code ErrorReportValve} 的子类）。
 * 只有在 Web 容器启动完成后替换，才能确保顺序上「后发制人」——
 * 既移除容器自带阀门，又避免与 Boot 的注入时机竞争。</p>
 *
 * <p>替换后，连接器级拒绝（非法 URI、超限请求头/请求行）不再返回
 * {@code HTTP Status 400 – Bad Request} 的 HTML 页，而是统一 {@code Result} JSON。</p>
 *
 * <p>容器无关性：仅当 Web 容器确为 Tomcat（{@code TomcatWebServer}）时生效；
 * 若后续切换 Undertow/Jetty，本类自动跳过，不影响启动。</p>
 *
 * @author AntTransfer CE
 */
@Configuration(proxyBeanMethods = false)
public class TomcatJsonErrorReportConfig implements ApplicationListener<WebServerInitializedEvent> {

    private static final Logger log = LoggerFactory.getLogger(TomcatJsonErrorReportConfig.class);

    private final ObjectMapper objectMapper;

    public TomcatJsonErrorReportConfig(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void onApplicationEvent(WebServerInitializedEvent event) {
        if (!(event.getWebServer() instanceof TomcatWebServer tomcatWebServer)) {
            log.debug("当前 Web 容器非 Tomcat，跳过容器级错误统一化装配");
            return;
        }
        install(tomcatWebServer);
    }

    private void install(TomcatWebServer tomcatWebServer) {
        Host host = tomcatWebServer.getTomcat().getHost();
        Pipeline pipeline = host.getPipeline();

        // 1. 移除容器自带错误页阀门（WhitelabelErrorReportValve / ErrorReportValve）
        //    getValves() 返回副本数组，边遍历边移除是安全的
        for (Valve valve : pipeline.getValves()) {
            if (valve instanceof ErrorReportValve) {
                pipeline.removeValve(valve);
                log.info("已移除容器默认错误页阀门：{}", valve.getClass().getName());
            }
        }

        // 2. 装载统一 Result 阀门；显式关闭服务器信息与内部报文，避免泄露实现细节
        JsonErrorReportValve valve = new JsonErrorReportValve(objectMapper);
        valve.setShowServerInfo(false);
        valve.setShowReport(false);
        pipeline.addValve(valve);
        log.info("已装载 JsonErrorReportValve：容器级错误（含连接器级拒绝）将统一返回 Result 结构");
    }
}
