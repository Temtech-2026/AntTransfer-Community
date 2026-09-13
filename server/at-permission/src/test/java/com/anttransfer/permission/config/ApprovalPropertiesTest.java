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
package com.anttransfer.permission.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link ApprovalProperties} 单元测试：敏感等级 → SLA 解析（24h / 12h / 4h）与通道开关默认值。
 *
 * @author AntTransfer CE
 */
@DisplayName("审批配置 · SLA 与通道开关")
class ApprovalPropertiesTest {

    @Test
    @DisplayName("默认 SLA：低 24h / 中 12h / 高 4h；越界等级回退低敏感")
    void shouldResolveDefaultSlaByLevel() {
        ApprovalProperties properties = new ApprovalProperties();

        assertThat(properties.slaOf(3)).isEqualTo(Duration.ofHours(4));
        assertThat(properties.slaOf(2)).isEqualTo(Duration.ofHours(12));
        assertThat(properties.slaOf(1)).isEqualTo(Duration.ofHours(24));
        // 越界等级按低敏感兜底（服务端已做归一化，此处保证防御性行为）
        assertThat(properties.slaOf(0)).isEqualTo(Duration.ofHours(24));
        assertThat(properties.slaOf(99)).isEqualTo(Duration.ofHours(24));
    }

    @Test
    @DisplayName("自定义 SLA 生效，未覆盖的等级保持默认")
    void shouldHonourCustomSla() {
        ApprovalProperties properties = new ApprovalProperties();
        properties.setSlaHigh(Duration.ofMinutes(30));

        assertThat(properties.slaOf(3)).isEqualTo(Duration.ofMinutes(30));
        assertThat(properties.slaOf(2)).isEqualTo(Duration.ofHours(12));
        assertThat(properties.slaOf(1)).isEqualTo(Duration.ofHours(24));
    }

    @Test
    @DisplayName("P1 紧急通道默认：关闭且窗口 1h（邮件等渠道开关已迁至通知域，不在此断言）")
    void shouldExposeChannelDefaults() {
        ApprovalProperties properties = new ApprovalProperties();

        assertThat(properties.getEmergency().isEnabled()).isFalse();
        assertThat(properties.getEmergency().getWindow()).isEqualTo(Duration.ofHours(1));
    }
}
