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

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * 权限审批配置（前缀 {@code anttransfer.permission.approval}）。
 *
 * <p>SLA 默认按敏感等级 低 24h / 中 12h / 高 4h（PRD §8）；审批人兜底、升级目标、
 * 通知渠道开关、紧急通道开关均在此集中。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "anttransfer.permission.approval")
public class ApprovalProperties {

    /** 低敏感 SLA（默认 24h） */
    private Duration slaLow = Duration.ofHours(24);

    /** 中敏感 SLA（默认 12h） */
    private Duration slaMedium = Duration.ofHours(12);

    /** 高敏感 SLA（默认 4h） */
    private Duration slaHigh = Duration.ofHours(4);

    /** 兜底审批人（安全管理员）；EE 用 ApprovalNodeResolver 动态解析时可不配 */
    private Long defaultApproverId;

    /** 升级提醒目标（上一级 / 安全负责人）；为空时回退 defaultApproverId */
    private Long escalationApproverId;

    /** 超时未审批扫描 cron（默认每 10 分钟） */
    private String escalationCron = "0 */10 * * * ?";

    /** 单次扫描最大处理条数（防长事务，分批处理） */
    private int scanBatchSize = 200;

    /** 升级提醒幂等窗口（同一申请单在该窗口内只提醒一次） */
    private Duration escalationIdempotentWindow = Duration.ofHours(24);

    // 注：原 `notify`（邮件通道开关）已随通知域迁移至 at-collaboration，
    // 由 anttransfer.collaboration.notify.* 承载——审批域只负责「什么时候该通知谁」，
    // 不负责「用哪个渠道发」，渠道开关放在通知域才不会出现两套并行的开关。

    /** 紧急通道配置（P1，默认关闭） */
    private Emergency emergency = new Emergency();

    /**
     * 按敏感等级取 SLA。
     *
     * @param level 归一化后的 1/2/3
     */
    public Duration slaOf(int level) {
        return switch (level) {
            case 3 -> slaHigh;
            case 2 -> slaMedium;
            default -> slaLow;
        };
    }

    /** 紧急审批通道（P1 开关；仅限中敏感及以下、创建 1h 内） */
    @Getter
    @Setter
    public static class Emergency {

        /** 紧急通道总开关，默认关闭 */
        private boolean enabled = false;

        /** 强提醒扫描 cron（默认每 10 分钟） */
        private String cron = "0 */10 * * * ?";

        /** 紧急判定窗口：申请单创建后该时长内视为紧急（默认 1h） */
        private Duration window = Duration.ofHours(1);

        /** 强提醒幂等窗口（避免重复轰炸） */
        private Duration idempotentWindow = Duration.ofMinutes(30);
    }
}
