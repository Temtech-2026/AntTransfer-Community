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
package com.anttransfer.collaboration.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 通知与 IM 配置：{@code anttransfer.collaboration.notify.*}。
 *
 * <p><b>渠道开关的分层：</b>站内信是 P0 持久通道，无开关（关掉它等于关掉通知本身，
 * 那不是「配置」而是「故障」）；邮件是 P1 附加通道，由 {@link #emailEnabled} 控制，
 * 默认关闭——CE 默认无 SMTP 依赖可用，打开时须由运维显式配置 {@code spring.mail.*}。</p>
 *
 * <p><b>为什么把「离线补拉条数」也放这里：</b>它是<compensate>「长连接不可靠」</compensate>
 * 这一事实的兜底参数——补拉一次给多少条直接决定重连体验与响应体大小，属运维可调策略，
 * 不宜写死在代码里。</p>
 *
 * @author AntTransfer CE
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "anttransfer.collaboration.notify")
public class NotifyProperties {

    /**
     * 会话消息保留期下限（天）。
     *
     * <p>PRD §4 P1「站内轻 IM」把「消息持久化 ≥ 30 天」写成了对用户的产品承诺，
     * 因此它不是可自由下调的运维参数：配置低于本值时，清理任务按本值执行
     * （钳制点在 {@code ChatRetentionScheduler}，理由见 {@link #messageRetentionDays}）。
     * 声明为 {@code public} 常量是为了让清理任务与单测引用同一处口径，而不是各自写一个 30。</p>
     */
    public static final int MIN_MESSAGE_RETENTION_DAYS = 30;

    /** 邮件渠道开关（P1，默认关闭；打开时须配置 spring.mail.host，否则仅降级记录日志） */
    private boolean emailEnabled = false;

    /** 邮件发件人（仅邮件渠道启用时生效） */
    private String from = "no-reply@anttransfer.local";

    /** 离线补拉单次返回条数上限（防重连时一次性拉爆内存 / 响应体） */
    private int offlinePullLimit = 50;

    /** 会话历史单次返回条数上限（聊天记录向上翻页的硬上限，防一次性拉爆响应体） */
    private int chatHistoryLimit = 50;

    /**
     * 会话列表单次返回条数上限（聊天页左侧栏的硬上限）。
     *
     * <p>与 {@link #chatHistoryLimit} 分开配置而非共用一个值：两者的「合适的量级」不同——
     * 历史消息是「一次翻页」，50 条已足够；会话列表是「一眼总览」，活跃用户可能有上百个会话，
     * 调大它不该顺带把单次翻页的响应体一起放大。</p>
     */
    private int chatConversationLimit = 50;

    /** 通知正文长度上限（对齐 {@code sys_notify_message.content} 的 varchar(1000)，超出截断） */
    private int contentMaxLength = 1000;

    /** 通知标题长度上限（对齐 {@code sys_notify_message.title} 的 varchar(128)，超出截断） */
    private int titleMaxLength = 128;

    /**
     * 会话消息保留期（天）——PRD §4 P1「消息持久化 ≥ 30 天」的落地参数。
     *
     * <p><b>它是「可上调的下限」而不是「想设多少就多少」</b>：默认 30 天即
     * {@link #MIN_MESSAGE_RETENTION_DAYS}，调大永远安全（只多花存储），
     * 调小于 30 会被清理任务钳回 30（钳制点在 {@code ChatRetentionScheduler}）。
     * 保护刻意不写在这里的 setter 里：让「配置文件写了什么」与「实际按什么执行」
     * 在排查时能分别看到——若在 setter 里静默改写，运维在配置文件里看到的就永远是一个
     * 与实际行为不符的数字，而这恰恰是最难自查的一类问题。</p>
     *
     * <p><b>为什么放在通知配置下而不是单开一个 {@code im.*} 前缀：</b>会话消息与站内通知
     * 共用 {@code sys_notify_message} 一张表（见 {@code NotifyMessage} 类注），
     * 保留期、条数上限、正文长度这些「这张表的量级与生命周期参数」本就该在一起，
     * 拆开只会让「调消息表策略」需要在两个配置前缀之间来回找。</p>
     */
    private int messageRetentionDays = MIN_MESSAGE_RETENTION_DAYS;

    /**
     * 保留期清理单批删除行数。
     *
     * <p>分批的理由见 {@code NotifyMessageMapper#deleteExpiredChatMessages}：
     * 单批过大等于「一次长事务 + 长时间行锁」，过小则批次数量上升、任务跑得久。
     * 1000 是「单事务在毫秒级完成」与「一天内能清完百万级积压」之间的折中——
     * 任务按 {@code MAX_ROUNDS} 循环，单次触发的上限为
     * {@code 1000 × 100 = 10 万行}，足够追上日常增量。</p>
     */
    private int messageCleanupBatchSize = 1000;
}
