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
package com.anttransfer.gateway.transport;

import com.anttransfer.common.spi.transport.TransportStrategy;
import com.anttransfer.gateway.config.TransportSpiConfig;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.annotation.Order;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 传输协议接缝：CE 默认装配 + 装配期去重门禁 + EE 扩展方式。
 *
 * <p>该测试锁住 C 组差异化的核心口径：<b>能力差异只由 Bean 是否存在表达</b>——
 * CE 不加任何配置即可启动；EE <b>新增</b>协议不与 CE 的 HTTP 冲突；EE <b>替换</b> HTTP 走 Bean 名顶替。</p>
 */
class TransportStrategyRegistryTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(TransportSpiConfig.class, TransportStrategyRegistry.class);

    /** EE 的 QUIC 策略桩：只认领 quic scheme，优先级高于 CE 的 HTTP */
    @Order(10)
    static class QuicStub implements TransportStrategy {

        @Override
        public String protocol() {
            return "quic";
        }

        @Override
        public boolean supports(TransportRequest request) {
            return request != null && "quic".equalsIgnoreCase(request.scheme());
        }
    }

    /** EE 想换掉 HTTP 通道承载方式时的实现桩（同协议 http） */
    static class TunneledHttpStub implements TransportStrategy {

        @Override
        public String protocol() {
            return "http";
        }

        @Override
        public boolean supports(TransportRequest request) {
            return true;
        }
    }

    /* ==================== CE 默认装配 ==================== */

    @Test
    void ceDefaults_shouldProvideHttpStrategyAndStart() {
        runner.run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).hasSingleBean(TransportStrategy.class);
            assertThat(context.getBean(TransportStrategy.class)).isInstanceOf(HttpTransportStrategy.class);

            TransportStrategyRegistry registry = context.getBean(TransportStrategyRegistry.class);
            assertThat(registry.availableProtocols()).containsExactly("http");
            assertThat(registry.select(new TransportStrategy.TransportRequest("https", 443, true)))
                    .isPresent()
                    .get()
                    .extracting(TransportStrategy::protocol)
                    .isEqualTo("http");
        });
    }

    /* ==================== EE 扩展方式 ==================== */

    @Test
    void eeAddingNewProtocol_shouldCoexistWithCeHttp() {
        runner.withBean("quicTransportStrategy", TransportStrategy.class, QuicStub::new)
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    TransportStrategyRegistry registry = context.getBean(TransportStrategyRegistry.class);

                    // 新增协议不得把 CE 的 HTTP 挤掉：否则 EE 部署会失去 HTTP 通道
                    assertThat(registry.availableProtocols()).containsExactlyInAnyOrder("http", "quic");
                    assertThat(registry.select(new TransportStrategy.TransportRequest("quic", -1, true)))
                            .isPresent()
                            .get()
                            .extracting(TransportStrategy::protocol)
                            .isEqualTo("quic");
                    assertThat(registry.select(new TransportStrategy.TransportRequest("https", 443, true)))
                            .isPresent()
                            .get()
                            .extracting(TransportStrategy::protocol)
                            .isEqualTo("http");
                });
    }

    @Test
    void eeReplacingHttpByName_shouldTakeOverCeDefault() {
        runner.withBean("httpTransportStrategy", TransportStrategy.class, TunneledHttpStub::new)
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    assertThat(context).hasSingleBean(TransportStrategy.class);
                    assertThat(context.getBean(TransportStrategy.class)).isInstanceOf(TunneledHttpStub.class);
                });
    }

    /* ==================== 装配门禁 ==================== */

    @Test
    void duplicateProtocol_shouldFailFastAtStartup() {
        // 不同 Bean 名、同 protocol ⇒ 配置错误，必须在启动期炸出来而不是让请求随机走一个实现
        runner.withBean("duplicateHttp", TransportStrategy.class, TunneledHttpStub::new)
                .run(context -> {
                    assertThat(context).hasFailed();
                    assertThat(context.getStartupFailure())
                            .hasStackTraceContaining("传输协议策略重复注册");
                });
    }

    @Test
    void registry_shouldRejectBlankProtocol() {
        TransportStrategy blank = new TransportStrategy() {
            @Override
            public String protocol() {
                return " ";
            }

            @Override
            public boolean supports(TransportRequest request) {
                return true;
            }
        };

        assertThatThrownBy(() -> new TransportStrategyRegistry(List.of(blank)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("未声明 protocol()");
    }

    /* ==================== HttpTransportStrategy 判定边界 ==================== */

    @Test
    void httpStrategy_shouldCoverHttpHttpsAndUnknownScheme() {
        HttpTransportStrategy http = new HttpTransportStrategy();

        assertThat(http.protocol()).isEqualTo("http");
        assertThat(http.supports(new TransportStrategy.TransportRequest("http", 80, false))).isTrue();
        assertThat(http.supports(new TransportStrategy.TransportRequest("HTTPS", 443, true))).isTrue();
        // scheme 缺失（未经反向代理透传 X-Forwarded-Proto）：按 CE 唯一通道兜底，而不是「无可用协议」
        assertThat(http.supports(new TransportStrategy.TransportRequest(null, -1, false))).isTrue();
        assertThat(http.supports(null)).isTrue();
        assertThat(http.supports(new TransportStrategy.TransportRequest("quic", -1, true))).isFalse();
    }

    @Test
    void select_shouldReturnEmptyWhenNoStrategySupports() {
        TransportStrategyRegistry registry = new TransportStrategyRegistry(List.of(new QuicStub()));

        assertThat(registry.select(new TransportStrategy.TransportRequest("http", 80, false))).isEmpty();
    }
}
