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
import com.anttransfer.file.config.ShareProperties;
import com.anttransfer.file.model.entity.ShareLink;
import com.anttransfer.file.model.vo.ShareTicketVO;
import com.anttransfer.file.util.SecureTokens;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * 访客一次性票据服务：签发 + GETDEL 核销。
 *
 * <p><b>票据语义</b>：访客通过「令牌 → 有效期 → 提取码 → 次数」校验链后得到的短期取件凭证，
 * 绑定 {@code shareToken + fileId + accessType}，<b>取用即焚</b>（Redis {@code GETDEL}），
 * 因此同一票据无法被重放 / 并发复用（红队 [V-05]）。</p>
 *
 * <p><b>为何不落 DB</b>：票据是纯短期可丢失态——丢失只表现为访客需重新走一次校验链，
 * 不产生资损或越权（下载次数的正确性由 DB 原子扣减兜底，见 {@code ShareLinkMapper}）。
 * 用 Redis 避免为高频短生命周期对象写库。</p>
 *
 * <p><b>撤销链接后已签发票据的处理</b>：不遍历清理（无 token→ticket 索引，代价高），
 * 改为在核销时<b>二次校验链接状态</b>（见 {@code ShareAccessService#redeem}），
 * 保证撤销 / 过期 / 失效后票据立即不可用。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ShareTicketService {

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;
    private final ShareProperties shareProperties;

    /**
     * 签发一次性票据。
     *
     * @param link           链接实体（须为生效态）
     * @param accessType     download / preview
     * @param remainingCount 换票时的剩余次数快照（扣减发生在核销取件阶段，见 {@code ShareAccessService#redeem}）
     * @return 票据视图（含明文票据，仅此一次下发）
     */
    public ShareTicketVO issue(ShareLink link, String accessType, Integer remainingCount) {
        String ticket = SecureTokens.randomToken();
        LocalDateTime expireAt = LocalDateTime.now().plus(shareProperties.getTicketTtl());
        TicketPayload payload = new TicketPayload(link.getId(), link.getFileId(), accessType,
                expireAt.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli());
        try {
            stringRedisTemplate.opsForValue().set(RedisKeyConstants.shareTicketKey(ticket),
                    objectMapper.writeValueAsString(payload), shareProperties.getTicketTtl());
        } catch (Exception e) {
            // 序列化自身载荷失败属编程错误，不可静默放行
            log.error("签发分享票据失败：shareId={}, accessType={}", link.getId(), accessType, e);
            throw new IllegalStateException("签发分享票据失败", e);
        }
        log.debug("已签发分享票据：shareId={}, accessType={}, ttl={}s",
                link.getId(), accessType, shareProperties.getTicketTtl().toSeconds());
        return ShareTicketVO.builder()
                .ticket(ticket)
                .shareToken(link.getToken())
                .accessType(accessType)
                .expireAt(expireAt)
                .ttlSeconds(shareProperties.getTicketTtl().toSeconds())
                .remainingCount(remainingCount)
                .build();
    }

    /**
     * 核销票据（GETDEL 原子取用，一次即焚）。
     *
     * @param ticket 明文票据
     * @return 票据载荷；不存在 / 已核销 / 已过期返回 {@code null}
     */
    public TicketPayload redeem(String ticket) {
        String json = stringRedisTemplate.opsForValue().getAndDelete(RedisKeyConstants.shareTicketKey(ticket));
        if (json == null) {
            return null;
        }
        try {
            return objectMapper.readValue(json, TicketPayload.class);
        } catch (Exception e) {
            log.warn("票据载荷解析失败，按无效票据处理：ticketHash={}", Integer.toHexString(ticket.hashCode()), e);
            return null;
        }
    }

    /**
     * 票据载荷（Redis 值 JSON）。
     *
     * @param shareId    链接 ID
     * @param fileId     文件 ID
     * @param accessType download / preview
     * @param expireAt   到期时间戳（毫秒，冗余存储便于排障）
     */
    public record TicketPayload(Long shareId, Long fileId, String accessType, Long expireAt) {
    }
}
