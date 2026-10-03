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
import org.springframework.core.env.EnumerablePropertySource;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 免登录元数据端点（{@code /actuator/health}、{@code /actuator/info}）的披露面白名单（R-17 / 越权用例 TC-H-10）。
 *
 * <p><b>为什么这两个端点需要「同一份字段白名单」的对待：</b>它们由 {@code SecurityConfig}
 * 内置白名单放行，即<b>任何未登录者都能直连</b>。这类端点的风险不是 403 被绕过，
 * 而是「本来就该 200，问题在于 200 里多带了什么」——一旦 {@code include} 里多一个端点，
 * 或 {@code show-details} 从 {@code never} 变成 {@code always}，披露面就会静默扩大，
 * 且<b>不会有任何编译错误或运行时告警</b>。</p>
 *
 * <p>三层断言，对应三种扩大披露面的路径：</p>
 * <ol>
 *   <li><b>暴露白名单精确相等</b>：{@code management.endpoints.web.exposure.include} 只能是
 *       {@code health,info}。加端点即变红，必须显式回答「未登录者能不能调」；</li>
 *   <li><b>配置键白名单精确相等</b>：所有 {@code management.*} 键必须命中受审清单——
 *       将来新增 actuator 旋钮（例如 {@code endpoint.health.show-components}）同样要显式过审；</li>
 *   <li><b>prod 不得放宽</b>：{@code application-prod.yml} 只允许收窄，不允许把开发期的
 *       宽松值带进生产。</li>
 * </ol>
 *
 * <p>字段层面的等价物：{@code show-details: never} 是「health 只回 {@code {"status":...}}」的
 * 唯一开关；{@code info} 侧则通过「只允许 {@code build} 子树为 true」把来源钉死——
 * {@code env} / {@code git} / {@code java} 一旦被打开就会带出配置值与主机信息。</p>
 *
 * @author AntTransfer CE
 */
@DisplayName("免登录元数据端点 · 披露面白名单")
class ActuatorMetadataMinimalityTest {

    private static final String EXPOSURE_INCLUDE = "management.endpoints.web.exposure.include";
    private static final String HEALTH_SHOW_DETAILS = "management.endpoint.health.show-details";
    private static final String INFO_BUILD_ENABLED = "management.info.build.enabled";

    /** 受审的 actuator 配置键：新增即变红，强制显式过审。 */
    private static final Set<String> ALLOWED_MANAGEMENT_KEYS = Set.of(
            EXPOSURE_INCLUDE, HEALTH_SHOW_DETAILS, INFO_BUILD_ENABLED);

    /** 严禁出现在暴露列表里的端点：它们能读出配置值、Bean 图、堆转储或直接关停进程。 */
    private static final Set<String> SENSITIVE_ENDPOINTS = Set.of(
            "env", "beans", "configprops", "heapdump", "threaddump", "shutdown",
            "mappings", "loggers", "sessions", "caches", "flyway", "liquibase");

    /** info 下除 build 之外的来源一律视为泄露（含宿主 / 进程 / 源码仓库信息）。 */
    private static final Set<String> FORBIDDEN_INFO_SOURCES = Set.of(
            "env", "git", "java", "os", "process", "ssl");

    @Test
    @DisplayName("暴露列表精确等于 health,info：不是「包含」，新增端点必须过审")
    void exposure_mustBeExactlyHealthAndInfo() throws IOException {
        Map<String, String> props = load("application.yml");

        Set<String> exposed = split(props.get(EXPOSURE_INCLUDE));
        assertThat(exposed)
                .as("两个免登录探针是刻意保留的最小集合；新增端点等于新增一个未登录可达面")
                .containsExactlyInAnyOrder("health", "info");
        assertThat(exposed)
                .as("'*' 会把 env / beans / heapdump 一并放出，等于把进程内部暴露给未登录者")
                .doesNotContain("*");
        assertThat(exposed)
                .as("敏感端点不得出现在免登录暴露列表里")
                .doesNotContainAnyElementsOf(SENSITIVE_ENDPOINTS);
    }

    @Test
    @DisplayName("所有 management.* 配置键必须命中受审白名单（与 VO 字段白名单同一纪律）")
    void managementKeys_mustStayOnTheReviewedWhitelist() throws IOException {
        Map<String, String> props = load("application.yml");

        Set<String> managementKeys = props.keySet().stream()
                .filter(key -> key.startsWith("management."))
                .collect(Collectors.toSet());

        assertThat(managementKeys)
                .as("新增 actuator 配置等于新增一条披露路径；请先确认它不会把未登录可达面放大，"
                        + "再把键加入本测试的白名单——而不是顺手关掉断言")
                .containsExactlyInAnyOrderElementsOf(ALLOWED_MANAGEMENT_KEYS);
    }

    @Test
    @DisplayName("health 永不返回组件明细：show-details 必须是 never")
    void health_mustNeverShowComponentDetails() throws IOException {
        Map<String, String> props = load("application.yml");

        assertThat(props.get(HEALTH_SHOW_DETAILS))
                .as("always / when_authorized 会带出数据源地址、磁盘路径、Redis 版本等组件明细，"
                        + "而该端点对未登录者开放")
                .isEqualToIgnoringCase("never");
    }

    @Test
    @DisplayName("info 只允许 build 子树：env / git / java / os / process 一律不得开启")
    void info_mustExposeBuildMetadataOnly() throws IOException {
        Map<String, String> props = load("application.yml");

        Set<String> enabledInfoKeys = props.entrySet().stream()
                .filter(entry -> entry.getKey().startsWith("management.info."))
                .filter(entry -> "true".equalsIgnoreCase(entry.getValue()))
                .map(Map.Entry::getKey)
                .collect(Collectors.toSet());

        assertThat(enabledInfoKeys)
                .as("info 免登录可达，只允许 build（版本号 / 提交号 / 构建时间）")
                .containsExactly(INFO_BUILD_ENABLED);

        Set<String> enabledSources = enabledInfoKeys.stream()
                .map(key -> key.substring("management.info.".length()))
                .map(source -> source.split("\\.")[0])
                .map(source -> source.toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
        assertThat(enabledSources)
                .as("info 来源中出现环境 / 仓库 / 主机信息，等于免费公开内部拓扑")
                .doesNotContainAnyElementsOf(FORBIDDEN_INFO_SOURCES);
    }

    @Test
    @DisplayName("prod profile 只能收窄：不得放宽暴露面，也不得打开 health 明细")
    void prodProfile_mustNotLoosenActuatorSurface() throws IOException {
        Map<String, String> prod = load("application-prod.yml");

        prod.forEach((key, value) -> {
            if (key.startsWith("management.endpoints.web.exposure")) {
                Set<String> exposed = split(value);
                assertThat(exposed)
                        .as("prod 只允许比主配置更窄；出现 '*' 或敏感端点即视为放宽")
                        .isSubsetOf(Set.of("health", "info"))
                        .doesNotContain("*");
            }
            if (HEALTH_SHOW_DETAILS.equals(key)) {
                assertThat(value)
                        .as("prod 不得把 health 明细打开")
                        .isEqualToIgnoringCase("never");
            }
        });
    }

    /* ======================== 辅助 ======================== */

    private Set<String> split(String value) {
        assertThat(value)
                .as("暴露列表必须显式声明（缺省等于交给框架默认值，不可审计）")
                .isNotBlank();
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(item -> !item.isEmpty())
                .collect(Collectors.toSet());
    }

    /**
     * 读取 classpath 下的 YAML，同时兼容「整表是集合」与「按索引拍平」两种表示形态；
     * 只保留标量值，嵌套结构由各自的键前缀体现。
     */
    private Map<String, String> load(String resourceName) throws IOException {
        List<PropertySource<?>> sources = new YamlPropertySourceLoader()
                .load(resourceName, new ClassPathResource(resourceName));
        assertThat(sources).as("%s 必须存在于 at-bootstrap classpath", resourceName).isNotEmpty();

        Map<String, String> props = new LinkedHashMap<>();
        for (PropertySource<?> source : sources) {
            if (!(source instanceof EnumerablePropertySource<?> enumerable)) {
                continue;
            }
            for (String name : enumerable.getPropertyNames()) {
                Object value = enumerable.getProperty(name);
                if (value != null && !(value instanceof Iterable<?>)) {
                    props.put(name, String.valueOf(value));
                }
            }
        }
        return props;
    }
}
