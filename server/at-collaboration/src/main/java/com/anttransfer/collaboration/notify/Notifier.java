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
package com.anttransfer.collaboration.notify;

import com.anttransfer.collaboration.model.entity.NotifyMessage;

/**
 * 通知投递渠道抽象（SPI）——把「消息已落库」与「还能怎么送达」拆开。
 *
 * <p>本模块的通知域内部约定：<b>落库是权威、渠道是尽力而为</b>。</p>
 * <ul>
 *     <li><b>P0</b> {@link InboxNotifier}：站内信，写 {@code sys_notify_message}，常开。
 *         它是 {@link #persistent()} 返回 {@code true} 的<b>唯一</b>渠道，负责给消息分配 ID；
 *         {@code NotificationDispatcher} 依赖这一份落库结果才能做提交后推送。</li>
 *     <li><b>P1</b> {@link MailNotifier}：SMTP 邮件，由
 *         {@code anttransfer.collaboration.notify.email-enabled} 控制，默认关闭。</li>
 *     <li>EE 可再实现短信 / 企业 IM 渠道，注册为 Bean 即自动接入分发。</li>
 * </ul>
 *
 * <p><b>实现约定：</b>渠道实现<b>不得抛出异常打断调用方业务事务</b>。分发器对非持久渠道
 * 逐个 try/catch 降级；持久渠道（落库）失败则应向上抛——查不到的通知等于没发，
 * 必须由调用方事务决策，不能静默吞掉。</p>
 *
 * @author AntTransfer CE
 */
public interface Notifier {

    /** 渠道标识（日志 / 观测用），如 {@code INBOX}、{@code EMAIL}。 */
    String channel();

    /**
     * 是否为持久化通道（消息落库的权威写入方）。
     *
     * <p>默认 {@code false}：绝大多数渠道（邮件 / 短信）只是「把已落库的消息再送一份」，
     * 不该影响落库语义。</p>
     */
    default boolean persistent() {
        return false;
    }

    /**
     * 发送一条通知。
     *
     * @param message 已构造完成的消息实体（持久渠道负责 INSERT 并回填 ID）
     */
    void send(NotifyMessage message);
}
