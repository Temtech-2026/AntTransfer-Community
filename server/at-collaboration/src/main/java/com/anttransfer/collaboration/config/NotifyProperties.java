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
}
