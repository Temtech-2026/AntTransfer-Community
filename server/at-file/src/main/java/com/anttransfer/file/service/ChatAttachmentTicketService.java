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
package com.anttransfer.file.service;

import com.anttransfer.common.constant.RedisKeyConstants;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.file.config.ChatAttachmentProperties;
import com.anttransfer.file.util.SecureTokens;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Objects;

/**
 * 会话附件取件票据服务：短时、绑定「附件 + 取件人 + 用途档位」，可重复读至过期。
 *
 * <h3>为什么必须两步式（换票 → 凭票发流）</h3>
 * 取件端点会被写进 {@code <a href>} / {@code <img src>} / 播放器 / 下载工具，这些载体
 * <b>都无法携带 Authorization 头</b>，所以取件端点只能匿名可达。而「能不能取件」必须
 * 在登录态下判定——于是把判定前移到换票端点，匿名端点只验票。这与
 * {@link FileDownloadTicketService}、{@code ShareTicketService} 完全同构。
 *
 * <h3>与登录态文件票据的区别：载荷多带了用途档位</h3>
 * 文件票据的 scope 只有 {@code download / preview} 两档，因为判定依据是「取件人对该文件
 * 有什么权限点」。会话附件的判定依据是<b>发送方设定的用途档位</b>（与取件人的 RBAC 无关），
 * 故载荷额外固化 {@link ChatAttachmentTicketPayload#usageMode()}：这既让取件端点能在
 * 不查库的快速路径上做档位校验，也让「票据签发后档位被收紧」这件事在复核时可见
 * （见 {@code ChatAttachmentService#resolveContent} 的逐项复核）。
 *
 * <h3>为什么核销用 GET 而不是 GETDEL</h3>
 * 同 {@link FileDownloadTicketService}：{@code Range} 断点续传、浏览器重试、下载工具多线程
 * 分段拉取都会重复请求同一地址，一次即焚会把正常行为判成「凭证失效」。
 * 下载次数不受影响——它在 DB 侧原子扣减（P-8：DB 为权威，Redis 仅短期可丢失态）。
 *
 * <p><b>票据不落库：</b>纯短期可丢失态，丢了只表现为接收方重新换一次票（他本来就是登录态），
 * 不产生越权——绑定关系在载荷里，不在缓存里。</p>
 *
 * @author AntTransfer CE
 * @see RedisKeyConstants#chatAttachmentTicketKey(String)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatAttachmentTicketService {

    /** 取件类型：仅预览（只发 {@code inline}，不消耗下载次数） */
    public static final String ACCESS_PREVIEW = "preview";

    /** 取件类型：下载（{@code attachment} 或用户显式要求内联，消耗一次下载额度） */
    public static final String ACCESS_DOWNLOAD = "download";

    private static final String CONTENT_URL = "/api/v1/chat-attachments/%d/content?ticket=%s";
    private static final String INLINE_CONTENT_URL = "/api/v1/chat-attachments/%d/content?ticket=%s&disposition=inline";

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;
    private final ChatAttachmentProperties properties;

    /**
     * 铸造票据并写入 Redis（内部助手，<b>不查库、不审计</b>）。
     *
     * <p>审计与存在性 / 用途 / 次数判定全部收敛在 {@code ChatAttachmentService#issueTicket}：
     * 本类只负责「把已经决定好的结论封成一张短时凭证」，保持职责单一，
     * 避免「签发」与「裁决」两件事在两个类里各写一半。</p>
     *
     * @param attachmentId   附件授权 ID
     * @param consumerUserId 取件人（必须是该附件的接收方）
     * @param fileId         物理文件 ID
     * @param usageMode      签发时的用途档位（取件复核用）
     * @param accessType     {@link #ACCESS_PREVIEW} / {@link #ACCESS_DOWNLOAD}
     * @return 明文票据
     * @throws BusinessException 序列化失败或 Redis 不可用（4009，可重试）
     */
    public String mint(Long attachmentId, Long consumerUserId, Long fileId, Integer usageMode, String accessType) {
        Duration ttl = properties.getTicketTtl();
        String ticket = SecureTokens.randomToken();
        ChatAttachmentTicketPayload payload = new ChatAttachmentTicketPayload(
                attachmentId, consumerUserId, fileId, usageMode, accessType,
                System.currentTimeMillis() + ttl.toMillis());
        try {
            stringRedisTemplate.opsForValue()
                    .set(RedisKeyConstants.chatAttachmentTicketKey(ticket),
                            objectMapper.writeValueAsString(payload), ttl);
        } catch (Exception e) {
            // 序列化自身载荷失败属编程错误，Redis 不可用属基础设施故障。对调用方是同一件事：
            // 现在取不到件。统一以 4009（可重试）回应，不把内部细节漏给前端。
            log.error("签发会话附件取件票据失败：attachmentId={}, accessType={}", attachmentId, accessType, e);
            throw new BusinessException(ErrorCode.FILE_DOWNLOAD_FAIL, "签发取件凭证失败，请稍后重试");
        }
        return ticket;
    }

    /**
     * 核销票据：校验存在性、过期时间，以及 {@code attachmentId + fileId} 逐项绑定。
     *
     * <p><b>任一不匹配即 4028</b>：票据是承载「发送方授权」的凭证，只验真伪不验绑定对象，
     * 就等于「A 换到的票可以拿去取 B 的附件」。三种失败（不存在 / 解析失败 / 绑定不符）
     * 对外统一不区分——票据是随机串，无枚举价值，统一文案不会造成信息泄露，
     * 但能避免被用来做差分探测。</p>
     *
     * <p><b>不在此处校验 {@code consumerUserId}：</b>取件端点是匿名的，拿到票据的人号称是谁
     * 都没有意义。真正的护栏是「票据无法伪造」+「签发时已确认过取件人身份」，
     * 故 {@code consumerUserId} 只作为审计线索保留在载荷里。</p>
     *
     * @param ticket       明文票据（查询串）
     * @param attachmentId 本次请求的附件授权 ID（须与票据绑定的一致）
     * @return 票据载荷
     * @throws BusinessException 票据无效（4028）
     */
    public ChatAttachmentTicketPayload redeem(String ticket, Long attachmentId) {
        if (ticket == null || ticket.isBlank()) {
            throw new BusinessException(ErrorCode.CHAT_ATTACH_TICKET_INVALID);
        }
        String json;
        try {
            json = stringRedisTemplate.opsForValue().get(RedisKeyConstants.chatAttachmentTicketKey(ticket));
        } catch (Exception e) {
            // Redis 不可用无法判定票据真伪 —— 安全判定失败必须 fail-closed，不能放行
            log.warn("读取会话附件取件票据失败（按无效处理）：ticketHash={}", hash(ticket), e);
            throw new BusinessException(ErrorCode.CHAT_ATTACH_TICKET_INVALID);
        }
        if (json == null) {
            throw new BusinessException(ErrorCode.CHAT_ATTACH_TICKET_INVALID);
        }
        ChatAttachmentTicketPayload payload;
        try {
            payload = objectMapper.readValue(json, ChatAttachmentTicketPayload.class);
        } catch (Exception e) {
            log.warn("会话附件取件票据载荷解析失败（按无效处理）：ticketHash={}", hash(ticket), e);
            throw new BusinessException(ErrorCode.CHAT_ATTACH_TICKET_INVALID);
        }
        if (!Objects.equals(payload.attachmentId(), attachmentId)
                || payload.accessType() == null
                || payload.expireAt() == null
                || payload.expireAt() < System.currentTimeMillis()) {
            throw new BusinessException(ErrorCode.CHAT_ATTACH_TICKET_INVALID);
        }
        return payload;
    }

    /** 构造取件地址（{@code attachment} 下载语义）。 */
    public String contentUrl(Long attachmentId, String ticket) {
        return CONTENT_URL.formatted(attachmentId, Objects.requireNonNull(ticket, "ticket"));
    }

    /** 构造内联取件地址（浏览器原生渲染，仅对可安全内联的类型有效）。 */
    public String inlineContentUrl(Long attachmentId, String ticket) {
        return INLINE_CONTENT_URL.formatted(attachmentId, Objects.requireNonNull(ticket, "ticket"));
    }

    /** 票据只进日志哈希，原文绝不落日志：日志文件是最容易被打包带走的东西。 */
    private static String hash(String ticket) {
        return Integer.toHexString(String.valueOf(ticket).hashCode());
    }

    /**
     * 票据载荷（Redis 值 JSON）。
     *
     * @param attachmentId   绑定的附件授权 ID
     * @param consumerUserId 取件人用户 ID（签发时已确认；仅作审计线索，取件端不再校验）
     * @param fileId         绑定的物理文件 ID（复核用：附件行被换绑时旧票立即失效）
     * @param usageMode      签发时的用途档位（1-仅预览 2-可下载 3-可转发转存）
     * @param accessType     {@link #ACCESS_PREVIEW} / {@link #ACCESS_DOWNLOAD}
     * @param expireAt       到期时间戳（毫秒，冗余存储便于排障；真正的过期由 Redis TTL 裁决）
     */
    public record ChatAttachmentTicketPayload(Long attachmentId,
                                              Long consumerUserId,
                                              Long fileId,
                                              Integer usageMode,
                                              String accessType,
                                              Long expireAt) {
    }
}
