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
package com.anttransfer.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 生产 profile 必须开启 CORS 严格模式的配置守卫（红队 [D-01]）。
 *
 * <p><b>为什么用「读 yml 断言」而不是起上下文：</b>这条约束的失效方式是有人把
 * {@code strict: true} 从 prod 配置里删掉（或复制配置时漏掉）。那样做不会让任何构建、
 * 任何接口测试变红——只会在生产静默放开跨域凭证读取。启动上下文测试依赖 Testcontainers
 * 的 MySQL/Redis，成本高且与「配置值对不对」无关；直接解析 yml 是最贴近事实的守卫。</p>
 *
 * <p>校验逻辑本身的正确性由 at-gateway 的
 * {@code GatewayWebConfigCorsStrictTest} 覆盖，两者互补。</p>
 *
 * @author AntTransfer CE
 */
class ProdProfileCorsStrictConfigTest {

    private static final String STRICT_KEY = "anttransfer.cors.strict";

    @Test
    @DisplayName("application-prod.yml 将 anttransfer.cors.strict 置为 true")
    void prodProfileEnablesCorsStrictMode() throws IOException {
        assertThat(loadProdStrictValue())
                .as("生产环境必须开启 CORS 严格模式：否则白名单为 * 时会静默放开携带凭证的跨域读取")
                .isEqualTo(Boolean.TRUE);
    }

    /** 解析 classpath 下的 application-prod.yml，取出 strict 键的值（可为 null）。 */
    private Object loadProdStrictValue() throws IOException {
        List<PropertySource<?>> sources = new YamlPropertySourceLoader()
                .load("application-prod", new ClassPathResource("application-prod.yml"));
        assertThat(sources).as("application-prod.yml 必须存在于 at-bootstrap classpath").isNotEmpty();
        for (PropertySource<?> source : sources) {
            Object value = source.getProperty(STRICT_KEY);
            if (value != null) {
                return value;
            }
        }
        return null;
    }
}
