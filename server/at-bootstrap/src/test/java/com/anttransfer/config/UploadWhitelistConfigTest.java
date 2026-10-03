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

import com.anttransfer.common.security.FileUploadValidator;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.EnumerablePropertySource;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 上传扩展名白名单的配置守卫（红队 [R-02]）。
 *
 * <p><b>为什么需要这条守卫：</b>{@code FileProperties#allowedExtensions} 的代码默认值是
 * <b>空集 = 拒绝全部上传</b>（fail-closed）。这意味着白名单只存在于配置文件里：
 * 被误删或漏带时，后果是「所有上传都失败」——它会很快被发现，这是刻意的取向。
 * 真正危险的是反方向：有人为了「先跑通」往清单里塞 {@code html} / {@code exe}。
 * 校验器虽有硬编码黑名单兜底，但清单本身表达的是团队的放行意图，
 * 让「白名单里出现可执行 / 脚本后缀」在构建期就红掉，比指望运行时兜底可靠。</p>
 *
 * <p>读取刻意不假设 YAML 列表被拍平成什么形态（整表 {@code List} 值，还是
 * {@code key[0]}/ {@code key[1]} 索引键）：两种形态取决于加载器实现，测试关心的是
 * 「配置里到底声明了哪些后缀」，不是加载器的内部表示。</p>
 *
 * <p>校验逻辑与接线分别由 {@code FileUploadValidatorTest}（at-common）与
 * {@code FileContentServiceUploadGuardTest}（at-file）覆盖，三者互补。</p>
 *
 * @author AntTransfer CE
 */
class UploadWhitelistConfigTest {

    private static final String WHITELIST_KEY = "anttransfer.file.allowed-extensions";

    @Test
    @DisplayName("application.yml 必须给出非空且不含危险后缀的上传扩展名白名单")
    void shipsSafeNonEmptyUploadWhitelist() throws IOException {
        List<String> extensions = readWhitelistEntries();

        assertThat(extensions)
                .as("配置里找不到 %s：代码默认值是空集（拒绝全部上传），清单缺失等于上传功能不可用",
                        WHITELIST_KEY)
                .isNotEmpty();
        assertThat(extensions)
                .as("白名单表达的是放行意图，不得包含脚本 / 可执行 / 标记类后缀")
                .doesNotContainAnyElementsOf(FileUploadValidator.DANGEROUS_EXTENSIONS);
    }

    /**
     * 取出白名单里的全部条目。
     *
     * <p>同时兼容「整表是一个集合」与「按索引拍平成多个标量键」两种形态，
     * 避免测试因加载器表示差异而假红。</p>
     */
    private List<String> readWhitelistEntries() throws IOException {
        List<PropertySource<?>> sources = new YamlPropertySourceLoader()
                .load("application", new ClassPathResource("application.yml"));
        assertThat(sources).as("application.yml 必须存在于 at-bootstrap classpath").isNotEmpty();

        List<String> entries = new ArrayList<>();
        for (PropertySource<?> source : sources) {
            if (!(source instanceof EnumerablePropertySource<?> enumerable)) {
                continue;
            }
            for (String name : enumerable.getPropertyNames()) {
                if (!name.startsWith(WHITELIST_KEY)) {
                    continue;
                }
                Object value = enumerable.getProperty(name);
                if (value instanceof Collection<?> collection) {
                    collection.forEach(item -> entries.add(String.valueOf(item)));
                } else if (value != null) {
                    entries.add(String.valueOf(value));
                }
            }
        }
        return entries;
    }
}
