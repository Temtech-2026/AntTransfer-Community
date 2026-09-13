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
import com.anttransfer.file.config.FileProperties;
import com.anttransfer.file.model.entity.FileNode;
import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.file.model.vo.DownloadTicketVO;
import com.anttransfer.file.security.FileOwnershipGuard;
import com.anttransfer.file.util.SecureTokens;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * 登录用户下载票据服务：短时、绑定用户与文件、可重复使用至过期。
 *
 * <h3>为什么需要票据，而不是让下载直接带 access token</h3>
 * 取件链接会被写进 {@code <a href>} / {@code <img src>} / 播放器 / 下载工具 / 浏览器历史。
 * 这些载体<b>都无法设置 Authorization 头</b>，于是凭证只能出现在 URL 里——而 URL 是最易泄露的地方
 * （Referer、日志、截图、聊天转发）。把长期 access token 放进去，一次转发就等于交出账号；
 * 换成「5 分钟、绑定单个文件、绑定用户」的票据，泄露窗口被压到分钟级且不可横向使用。
 *
 * <h3>为什么核销用 GET 而不是 GETDEL</h3>
 * 分享域的访客票据是<b>一次即焚</b>（GETDEL），因为访客的「次数」是业务约束、必须按次裁决。
 * 登录用户的下载则是「同一份文件本来就该能下」——重试、断点续传、多线程分段拉取都会重复取件，
 * 一次即焚会把正常行为判成失效。故本票据只校验不销毁，由 TTL 兜底过期。
 *
 * <h3>scope：把「签发时的权限判定」带进免登录的取件端点</h3>
 * 取件端点必须放行匿名请求（浏览器原生载体的硬约束），因此它们拿不到登录态、也无法做 {@code @RequiresPerm}。
 * 解法是把权限判定前移到<b>签发</b>这一步：{@link #SCOPE_DOWNLOAD} 由 {@code file:download} 签发，
 * {@link #SCOPE_PREVIEW} 由 {@code file:preview} 签发，取件端点只认票办事——
 * 预览票只能取缩略图与可安全内联的类型，拿不到「attachment 下载」这一档能力。
 *
 * <p><b>票据不落库：</b>纯短期可丢失态。丢了只表现为用户重新换一次票，
 * 不产生越权（绑定关系在载荷里，不在内存缓存里）。</p>
 *
 * @author AntTransfer CE
 * @see RedisKeyConstants#fileTicketKey(String)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class FileDownloadTicketService {

    /** 取件范围：完整取件（含 {@code attachment} 下载），由 {@code file:download} 签发 */
    public static final String SCOPE_DOWNLOAD = "download";

    /** 取件范围：仅预览取件（缩略图 + 可内联类型），由 {@code file:preview} 签发 */
    public static final String SCOPE_PREVIEW = "preview";

    private static final String CONTENT_URL = "/api/v1/files/%d/content?ticket=%s";
    private static final String INLINE_CONTENT_URL = "/api/v1/files/%d/content?ticket=%s&disposition=inline";
    private static final String THUMBNAIL_URL = "/api/v1/files/%d/thumbnail?ticket=%s";

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;
    private final FileProperties properties;
    private final FileOwnershipGuard ownershipGuard;
    private final FileAuditLogger auditLogger;

    /**
     * 签发下载票据（控制器入口，带归属校验与审计）。
     *
     * <p><b>回收站中的条目同样可换票取件</b>：删除是用户的整理动作而非安全隔离，
     * 强制「先还原再下载」只会让用户多做一轮操作并污染审计。归属校验已保证只有本人可取。
     * 彻底销毁的条目会被逻辑删除过滤掉（{@code selectById} 返回 null），此时是 4005。</p>
     *
     * @param ownerUserId 当前登录用户
     * @param nodeId      文件条目 ID
     * @return 票据视图（含明文票据与取件地址）
     * @throws BusinessException 条目不存在或不属于该用户（4005）
     */
    public DownloadTicketVO issue(Long ownerUserId, Long nodeId) {
        FileNode node = ownershipGuard.requireOwnedNode(nodeId, ownerUserId);
        String ticket = mint(ownerUserId, node, SCOPE_DOWNLOAD);

        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("name", node.getName());
        extra.put("sizeBytes", node.getSizeBytes());
        extra.put("scope", SCOPE_DOWNLOAD);
        auditLogger.success(OperationLog.ACTION_FILE_TICKET_ISSUE, OperationLog.TARGET_FILE, node.getId(), extra);

        DownloadTicketVO vo = new DownloadTicketVO();
        vo.setTicket(ticket);
        vo.setNodeId(node.getId());
        vo.setExpiresInSeconds(properties.getDownloadTicketTtl().toSeconds());
        vo.setDownloadUrl(CONTENT_URL.formatted(node.getId(), ticket));
        return vo;
    }

    /**
     * 铸造票据并写入 Redis（内部助手，不写审计）。
     *
     * <p>供预览链路取缩略图 / 内联地址使用：预览本身已记一条 {@code FILE_PREVIEW} 审计，
     * 若取缩略图 URL 时再记一条 {@code FILE_TICKET_ISSUE}，会让「一次预览」在审计里变成两条不相关的事件。</p>
     *
     * @param ownerUserId 票据绑定的用户
     * @param node        绑定的文件条目
     * @param scope       取件范围（{@link #SCOPE_DOWNLOAD} / {@link #SCOPE_PREVIEW}）
     * @return 明文票据
     */
    public String mint(Long ownerUserId, FileNode node, String scope) {
        Duration ttl = properties.getDownloadTicketTtl();
        String ticket = SecureTokens.randomToken();
        FileTicketPayload payload = new FileTicketPayload(ownerUserId, node.getId(), node.getFileId(), scope,
                System.currentTimeMillis() + ttl.toMillis());
        try {
            stringRedisTemplate.opsForValue()
                    .set(RedisKeyConstants.fileTicketKey(ticket), objectMapper.writeValueAsString(payload), ttl);
        } catch (Exception e) {
            // 序列化自身载荷失败属编程错误；Redis 不可用属基础设施故障。两者都表现为「发不出票」，
            // 对调用方是同一件事：现在下载不了。故统一以 4009（可重试）回应，不把内部细节漏给前端。
            log.error("签发下载票据失败：nodeId={}, scope={}", node.getId(), scope, e);
            throw new BusinessException(ErrorCode.FILE_DOWNLOAD_FAIL, "签发下载凭证失败，请稍后重试");
        }
        return ticket;
    }

    /**
     * 核销票据：校验存在性、过期时间，以及 {@code userId + nodeId} 逐项绑定。
     *
     * <p><b>任一不匹配即 4018</b>：票据是承载权限的凭证，只验真伪不验绑定对象，
     * 就等于「A 换到的票可以拿去取 B 的文件」。故绑定项必须逐项比对，且失败原因对外统一不区分
     * （票据是随机串，无枚举价值，统一文案不会造成信息泄露，但能避免被用来做差分探测）。</p>
     *
     * <p><b>缺失与越界刻意不区分：</b>三种失败（不存在 / 解析失败 / 绑定不符）对外都是同一句
     * 「下载凭证无效或已过期」，避免调用方据此区分「票存在但绑定错」与「票不存在」。</p>
     *
     * @param ticket 明文票据（查询串）
     * @param nodeId 本次请求的文件条目 ID（须与票据绑定的一致）
     * @return 票据载荷
     * @throws BusinessException 票据无效（4018）
     */
    public FileTicketPayload redeem(String ticket, Long nodeId) {
        if (ticket == null || ticket.isBlank()) {
            throw new BusinessException(ErrorCode.FILE_TICKET_INVALID);
        }
        String json;
        try {
            json = stringRedisTemplate.opsForValue().get(RedisKeyConstants.fileTicketKey(ticket));
        } catch (Exception e) {
            // Redis 不可用无法判定票据真伪 —— 安全判定失败必须 fail-closed，不能放行
            log.warn("读取下载票据失败（按无效处理）：ticketHash={}", hash(ticket), e);
            throw new BusinessException(ErrorCode.FILE_TICKET_INVALID);
        }
        if (json == null) {
            throw new BusinessException(ErrorCode.FILE_TICKET_INVALID);
        }
        FileTicketPayload payload;
        try {
            payload = objectMapper.readValue(json, FileTicketPayload.class);
        } catch (Exception e) {
            log.warn("下载票据载荷解析失败（按无效处理）：ticketHash={}", hash(ticket), e);
            throw new BusinessException(ErrorCode.FILE_TICKET_INVALID);
        }
        if (!Objects.equals(payload.nodeId(), nodeId)
                || payload.userId() == null
                || payload.expireAt() == null
                || payload.expireAt() < System.currentTimeMillis()) {
            throw new BusinessException(ErrorCode.FILE_TICKET_INVALID);
        }
        return payload;
    }

    /** 构造取件地址（{@code attachment} 下载）。 */
    public String contentUrl(Long nodeId, String ticket) {
        return CONTENT_URL.formatted(nodeId, ticket);
    }

    /** 构造内联取件地址（浏览器原生渲染，仅对可内联类型有效）。 */
    public String inlineContentUrl(Long nodeId, String ticket) {
        return INLINE_CONTENT_URL.formatted(nodeId, ticket);
    }

    /** 构造缩略图地址。 */
    public String thumbnailUrl(Long nodeId, String ticket) {
        return THUMBNAIL_URL.formatted(nodeId, ticket);
    }

    /** 票据只进日志哈希，原文绝不落日志：日志文件是最容易被打包带走的东西。 */
    private static String hash(String ticket) {
        return Integer.toHexString(ticket.hashCode());
    }

    /**
     * 票据载荷（Redis 值 JSON）。
     *
     * @param userId   票据所属用户（取件端点据此复核条目归属）
     * @param nodeId   绑定的文件条目 ID
     * @param fileId   绑定的物理文件 ID（冗余存储，便于排障与后续一致性校验）
     * @param scope    取件范围：{@link #SCOPE_DOWNLOAD} / {@link #SCOPE_PREVIEW}
     * @param expireAt 到期时间戳（毫秒，冗余存储便于排障；真正的过期由 Redis TTL 裁决）
     */
    public record FileTicketPayload(Long userId, Long nodeId, Long fileId, String scope, Long expireAt) {
    }
}
