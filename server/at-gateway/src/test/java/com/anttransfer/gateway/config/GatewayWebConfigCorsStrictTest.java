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

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * CORS 严格模式启动校验的契约测试（红队 [D-01]）。
 *
 * <p><b>守的是什么：</b>CORS 配错是「静默开放」型缺陷——请求照常返回 200，只有浏览器侧的
 * 跨域读取被额外授权，服务端日志里看不出任何异常。因此 {@code strict} 开启时必须在
 * <b>启动期</b>就因「携带凭证 + 通配来源」拒绝启动；本条契约一旦被改坏（校验被删、
 * 或异常类型改掉导致启动器吞掉），线上就会在无人察觉的情况下对任意站点开放凭证读取。</p>
 *
 * <p>另外两处消费同一配置键（at-auth 的 {@code SecurityConfig}、at-collaboration 的
 * {@code WebSocketConfig}）不各自校验：三者读的是同一个 {@code allowed-origin-patterns}，
 * 网关这里通过了，就意味着分发给其余两处的也一定是显式来源。</p>
 *
 * @author AntTransfer CE
 */
class GatewayWebConfigCorsStrictTest {

    /** 直接构造并注入字段，绕过 Spring 容器——被测的是校验逻辑本身，不是装配。 */
    private GatewayWebConfig configWith(List<String> patterns, boolean strict) {
        GatewayWebConfig config = new GatewayWebConfig();
        ReflectionTestUtils.setField(config, "allowedOriginPatterns", patterns);
        ReflectionTestUtils.setField(config, "corsStrict", strict);
        return config;
    }

    @Test
    @DisplayName("严格模式 + 通配来源：启动即失败（fail-closed）")
    void strictModeRejectsWildcardOrigin() {
        GatewayWebConfig config = configWith(List.of("*"), true);

        assertThatThrownBy(config::validateCorsOriginPatterns)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("禁止通配来源");
    }

    @Test
    @DisplayName("严格模式 + 显式白名单：正常启动")
    void strictModeAllowsExplicitOrigins() {
        GatewayWebConfig config = configWith(
                List.of("https://pan.example.com", "https://*.corp.example.com"), true);

        assertThatCode(config::validateCorsOriginPatterns).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("非严格模式（dev 默认）：通配来源不阻断启动")
    void nonStrictModeAllowsWildcardOrigin() {
        GatewayWebConfig config = configWith(List.of("*"), false);

        assertThatCode(config::validateCorsOriginPatterns).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("严格模式 + 空白名单：不放行任何跨域来源，但正常启动")
    void strictModeAllowsBlankList() {
        GatewayWebConfig config = configWith(List.of(), true);

        assertThatCode(config::validateCorsOriginPatterns).doesNotThrowAnyException();
    }
}
