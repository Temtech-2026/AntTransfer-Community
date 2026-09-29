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

import com.anttransfer.common.spi.transport.TransportStrategy;
import com.anttransfer.gateway.transport.HttpTransportStrategy;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 传输协议策略扩展点的 CE 默认装配。
 *
 * <p><b>为什么这里是 Bean <u>名称</u>级条件，而其它 SPI 是类型级</b>：{@code TransportStrategy}
 * 表达的是「协议<b>集合</b>」，不是单点能力。若按类型顶替，EE 只新增一个 QUIC 实现就会把 CE 的
 * HTTP 策略挤掉——部署随即失去 HTTP 通道，这是功能回退而不是差异化。故：</p>
 *
 * <ul>
 *     <li>EE 想<b>替换</b> HTTP 通道实现 → 声明名为 {@code httpTransportStrategy} 的 Bean，CE 让位；</li>
 *     <li>EE 想<b>新增</b>协议（QUIC / 私有隧道）→ 以任意 Bean 名声明，与 CE 的 HTTP 策略<b>共存</b>，
 *         由 {@code TransportStrategyRegistry} 按 {@code @Order} + 协议去重统一管理。</li>
 * </ul>
 *
 * <p>无论哪种方式，CE 部署「一份配置都不加」时必须能启动：本类保证容器内恒有至少一个
 * {@link TransportStrategy}，不出现启动期缺实现的 {@code NoSuchBeanDefinitionException}。</p>
 *
 * @author AntTransfer CE
 */
@Configuration(proxyBeanMethods = false)
public class TransportSpiConfig {

    /** CE 默认：HTTP/1.1 与 HTTP/2（TLS 由 {@code secure} 字段表达，不区分协议标识） */
    @Bean
    @ConditionalOnMissingBean(name = "httpTransportStrategy")
    public TransportStrategy httpTransportStrategy() {
        return new HttpTransportStrategy();
    }
}
