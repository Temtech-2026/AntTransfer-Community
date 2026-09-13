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

import com.anttransfer.collaboration.config.NotifyProperties;
import com.anttransfer.collaboration.model.entity.NotifyMessage;
import com.anttransfer.common.security.UserLookupPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * 邮件渠道（P1，开关 {@code anttransfer.collaboration.notify.email-enabled}，默认关闭）。
 *
 * <p><b>为什么注入 {@link ObjectProvider} 而不是 {@link JavaMailSender}：</b>
 * Spring Boot 只在配置了 {@code spring.mail.host} 时才装配 {@code JavaMailSender}。
 * 若本类强依赖它，则「打开邮件开关但漏配 host」会让整个应用启动失败——为一个附加渠道
 * 拖垮主流程不可接受。用 {@code ObjectProvider} 后，缺失时仅在本渠道内降级记录日志，
 * 站内信与业务事务完全不受影响。</p>
 *
 * <p><b>收件地址来源：</b>{@code sys_user.email} 属 at-auth 表族，按架构铁律不得直查，
 * 只能经 {@link UserLookupPort}（读走 SPI）。查不到邮箱（用户未配置）时静默跳过——
 * 这是「该用户不可邮件触达」，不是错误。</p>
 *
 * <p>邮件属「尽力而为」的旁路通道：失败绝不影响站内信落库与业务状态。</p>
 *
 * @author AntTransfer CE
 */
@Component
@ConditionalOnProperty(prefix = "anttransfer.collaboration.notify",
        name = "email-enabled", havingValue = "true")
public class MailNotifier implements Notifier {

    /** 渠道标识 */
    public static final String CHANNEL = "EMAIL";

    private static final Logger log = LoggerFactory.getLogger(MailNotifier.class);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final UserLookupPort userLookupPort;
    private final NotifyProperties properties;

    public MailNotifier(ObjectProvider<JavaMailSender> mailSenderProvider,
                        UserLookupPort userLookupPort,
                        NotifyProperties properties) {
        this.mailSenderProvider = mailSenderProvider;
        this.userLookupPort = userLookupPort;
        this.properties = properties;
    }

    @Override
    public String channel() {
        return CHANNEL;
    }

    @Override
    public void send(NotifyMessage message) {
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            log.warn("[notify][email] 邮件渠道已开启但未配置 spring.mail.host，本条降级跳过：userId={}",
                    message.getRecipientUserId());
            return;
        }
        String to = resolveEmail(message.getRecipientUserId());
        if (to == null) {
            log.debug("[notify][email] 接收人未配置邮箱，跳过：userId={}", message.getRecipientUserId());
            return;
        }
        SimpleMailMessage mail = new SimpleMailMessage();
        mail.setFrom(properties.getFrom());
        mail.setTo(to);
        mail.setSubject(message.getTitle());
        mail.setText(message.getContent());
        mailSender.send(mail);
    }

    /** 经只读 SPI 取邮箱；查不到返回 null（调用方视为不可达，非错误）。 */
    private String resolveEmail(Long userId) {
        if (userId == null) {
            return null;
        }
        Map<Long, UserLookupPort.UserContact> contacts =
                userLookupPort.findContacts(List.of(userId));
        UserLookupPort.UserContact contact = contacts.get(userId);
        if (contact == null || contact.email() == null || contact.email().isBlank()) {
            return null;
        }
        return contact.email();
    }
}
