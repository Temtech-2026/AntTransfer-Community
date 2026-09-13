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
package com.anttransfer.file.config;

import com.anttransfer.common.constant.RedisKeyConstants;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;

/**
 * 外发分享配置：{@code anttransfer.file.share.*}。
 *
 * <p>设计取向：<b>策略可配、不写死在代码里</b>——后缀黑名单、默认 / 上限次数、有效期、锁定阈值
 * 均为运维可调项；与 PRD US-03「有效期 / 提取码 / 次数」三要素对应。</p>
 *
 * <p><b>锁定阈值与时长口径</b>：默认 5 次 / 30 min，默认值直接取自
 * {@link RedisKeyConstants#SHARE_LOCK_TTL_SECONDS}，其需求权威源为 PRD US-03
 * （与 system-design §5.3 / §7.1、红队 [C-08] 及 CHANGELOG D-8 裁定一致：
 * 「15 min 系与 {@code at:login:fail} 串行误抄」，故 <b>外发分享不采用 15 min</b>）。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "anttransfer.file.share")
public class ShareProperties {

    /** 总开关：关闭后创建 / 撤销 / 查询 / 访客校验全部拒绝（熔断用，不影响已生成链接的取件） */
    private boolean enabled = true;

    /** 提取码最小长度（PRD US-03：≥ 6 位字母数字） */
    private int extractCodeMinLength = 6;

    /** 提取码最大长度（防御性上限，避免 BCrypt 输入过长导致 CPU 抖动） */
    private int extractCodeMaxLength = 32;

    /** 默认下载次数上限（未显式指定时使用） */
    private int defaultDownloadLimit = 10;

    /** 下载次数上限的硬上限（显式指定超过则以 2005 拒绝，防「无限次」外发） */
    private int maxDownloadLimit = 1000;

    /** 默认有效期（未显式指定时使用） */
    private Duration defaultExpire = Duration.ofDays(7);

    /** 有效期硬上限（显式指定超过则以 2005 拒绝；PRD US-03 由管理员配置约束） */
    private Duration maxExpire = Duration.ofDays(30);

    /** 提取码连续错误阈值（达到即临时锁定） */
    private int maxCodeErrors = 5;

    /** 提取码锁定 / 计数窗口时长；默认 30 min（D-8 裁定口径，非 15 min） */
    private Duration codeLockDuration = Duration.ofSeconds(RedisKeyConstants.SHARE_LOCK_TTL_SECONDS);

    /** 一次性下载 / 预览票据 TTL（仅需覆盖「校验 → 取件」间隔，越短越安全） */
    private Duration ticketTtl = Duration.ofSeconds(RedisKeyConstants.SHARE_TICKET_TTL_SECONDS);

    /** 内容扫描总开关：false 时后缀 / 敏感词 / EE 扫描器全部不生效（应急放行用，默认 true） */
    private boolean contentScanEnabled = true;

    /**
     * 外发后缀黑名单（不区分大小写，按扩展名比对）。
     *
     * <p>默认阻断可直接执行 / 安装的格式：{@code exe / sh / bat / msi / com / scr}
     * （红队 [V-04]：黑名单为最低要求，企业版应改为「白名单 + 真实内容嗅探」）。</p>
     */
    private List<String> blockedExtensions = List.of("exe", "sh", "bat", "msi", "com", "scr");

    /**
     * 文件名敏感词（不区分大小写，命中即拦截）。
     *
     * <p>CE 仅做「文件名」级别简单规则（默认阻断「机密 / 绝密 / 身份证 / 薪酬」四类高频敏感文件名），
     * 真正的文档内容 DLP 由 EE 的 {@code ContentScanInterceptor} 实现接管。</p>
     *
     * <p>该名单<b>可在配置中置空</b>（{@code sensitive-words: []}）以关闭本规则——例如内网
     * 合规要求不高、又频繁误伤正常业务文件名时。留空即「不做文件名敏感词判定」，不代表关闭后缀黑名单。</p>
     */
    private List<String> sensitiveWords = List.of("机密", "绝密", "身份证", "薪酬");
}
