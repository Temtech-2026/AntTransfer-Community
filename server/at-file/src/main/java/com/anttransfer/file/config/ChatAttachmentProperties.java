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

/**
 * 会话附件配置（映射 {@code anttransfer.file.chat-attachment}）。
 *
 * <p>前缀挂在 {@code anttransfer.file} 之下（与 {@code .share} 平级），语义上三者同属
 * 「文件被交给别人」的不同通道：{@code .share} 是站外匿名外发，{@code .chat-attachment}
 * 是站内指定同事取件，故共享 {@code anttransfer.file} 的存储与限速底座。</p>
 *
 * <p><b>为什么上限是硬上限而非提示：</b>{@link #maxExpireHours} 与 {@link #maxDownloadLimit}
 * 都在服务层做「超限即拒绝」（2002），而不是静默收敛成上限值。静默收敛会让发送方以为自己
 * 设的是「不限期 / 不限次」，实际拿到一个被悄悄收紧的授权——用户对「我给了多少权限」的
 * 认知必须是准确的，这类偏差在事后追责时无法解释。</p>
 *
 * <p>全部取值与代码默认值一致，并在 {@code application.yml} 显式列出（便于运维查阅），
 * 故这里<b>不需要</b>额外维护一份「文档默认值」。</p>
 *
 * @author AntTransfer CE
 * @see com.anttransfer.file.model.entity.ChatAttachment
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "anttransfer.file.chat-attachment")
public class ChatAttachmentProperties {

    /**
     * 总开关：关闭后「创建 / 撤销 / 换票 / 转存」全部拒绝（熔断），
     * 但<b>不影响</b>已签发票据的「凭票取件」——避免熔断瞬间让接收方手里正在下载的文件中断。
     * 与 {@code ShareProperties#enabled} 同口径。
     */
    private boolean enabled = true;

    /**
     * 用途档位缺省值：2（可下载）。
     *
     * <p>刻意缺省为「可下载」而不是「仅预览」或「可转发转存」：前者会让绝大多数正常取件
     * 被拒（用户必须先意识到要去改档位），后者把「转发转存」这一更高风险的能力设成默认。
     * 取中间档是「不打扰正常流程」与「不默认放大权限」的平衡点。</p>
     */
    private int defaultUsageMode = 2;

    /** 有效期缺省值（小时）：7 天。 */
    private int defaultExpireHours = 7 * 24;

    /**
     * 有效期硬上限（小时）：30 天。
     *
     * <p>刻意小于「永久」：会话附件面向的是「临时交给同事看一眼」，超过一个月的授权
     * 已脱离会话语境；需要长期可用应走文件域的正常授权（共享 / 具名授权），而不是一条
     * 藏在聊天记录里的隐式授权。</p>
     */
    private int maxExpireHours = 30 * 24;

    /** 是否允许「不限期」（{@code neverExpire=true}）。关闭后请求不限期以 2002 拒绝。 */
    private boolean allowNeverExpire = true;

    /** 下载次数上限的硬上限：超过以 2002 拒绝（防「限 999999 次」等于不限次）。 */
    private int maxDownloadLimit = 100;

    /**
     * 取件票据 TTL：仅需覆盖「换票 → 取件」的间隔。
     *
     * <p>缺省取 {@link RedisKeyConstants#CHAT_ATTACHMENT_TICKET_TTL_SECONDS}（5 分钟）。
     * 票据只进 URL 不进 Authorization 头，TTL 就是票据泄露后的可利用窗口，
     * 因此「够用就好」——长下载由 {@code Range} 在同一票据的有效期内完成。</p>
     */
    private Duration ticketTtl = Duration.ofSeconds(RedisKeyConstants.CHAT_ATTACHMENT_TICKET_TTL_SECONDS);
}
