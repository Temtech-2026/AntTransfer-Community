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
import com.anttransfer.common.exception.AuthException;
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.file.config.ShareProperties;
import com.anttransfer.file.model.dto.RedeemTicketRequest;
import com.anttransfer.file.model.dto.VerifyShareRequest;
import com.anttransfer.file.model.entity.FileObject;
import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.file.model.entity.ShareLink;
import com.anttransfer.file.model.vo.SharePayloadVO;
import com.anttransfer.file.model.vo.ShareTicketVO;
import com.anttransfer.file.repository.FileObjectMapper;
import com.anttransfer.file.repository.ShareLinkMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 外发分享访客侧服务（免登录）：校验链 → 换票 → 核销取件。
 *
 * <p><b>校验链（需求 #2，严格按序）</b>：令牌存在 → 未撤销 / 未过期 → 提取码（连错 5 次锁 30 min，
 * D-8 口径）→ 次数未耗尽 → 签发一次性票据。访客侧<b>不校验 {@code file:share}</b> 功能权限，
 * 访问控制完全由「令牌 + 提取码 + 次数 + 有效期」构成。</p>
 *
 * <p><b>下载次数的两段式裁决（需求 #3 / P-8）</b>：
 * 核销取件时先过 Redis {@code at:share:count:{token}} 前置闸（Lua <b>DECR</b>，挡掉已耗尽请求），
 * 再以 {@link ShareLinkMapper#consumeDownloadQuota} 的单条原子 UPDATE 作<b>唯一权威裁决</b>——
 * 影响行数 = 1 才放行。Redis 丢失 / 异常一律降级为「仅 DB 裁决」，只降速不失准；
 * DB 拒绝时回写镜像（{@code limit - count}）保证与 {@code sys_share_link} 最终一致。</p>
 *
 * <p><b>为何在核销时扣次数、而不是换票时</b>：票据 TTL 5 min，换票即扣会在「换票后未取件」时
 * 白白吃掉额度；改为换票只做<b>非扣减的耗尽预检</b>，核销时扣减 + 落审计，
 * 使「已用次数」与「实际取走次数」严格对应，审计动作也正好落在真实的取件瞬间。</p>
 *
 * <p><b>审计</b>：取件成功写 {@code SHARE_DOWNLOAD / SHARE_PREVIEW}（含 IP / UA / 时间，UA 落 detail）；
 * 提取码达阈值锁定写 {@code SHARE_CODE_LOCKED}。审计失败不阻断业务（见 {@link ShareAuditLogger}）。</p>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ShareAccessService {

    /** 访问类型：下载 */
    public static final String ACCESS_DOWNLOAD = "download";
    /** 访问类型：在线预览 */
    public static final String ACCESS_PREVIEW = "preview";

    /** 提取码比对失败时的固定话术（不透露任何服务端状态） */
    private static final String MSG_CODE_ERROR = "提取码错误";
    /** 票据失效话术：复用 4004（状态失效冲突，前端刷新后重走校验链，策略 F） */
    private static final String MSG_TICKET_INVALID = "取件票据无效、已过期或已被使用，请重新验证";

    /** 前置闸返回值：配额镜像不存在 → 跳过前置闸，回落 DB 裁决 */
    private static final long MIRROR_ABSENT = -1L;
    /** 前置闸返回值：镜像判定已耗尽（脚本已回补，无副作用） */
    private static final long MIRROR_EXHAUSTED = -2L;

    /** 配额前置闸：仅当镜像存在时 DECR；耗尽则回补并返回 -2；不存在返回 -1 */
    private static final DefaultRedisScript<Long> QUOTA_GATE_SCRIPT = new DefaultRedisScript<>(
            "if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end "
                    + "local remaining = redis.call('DECR', KEYS[1]) "
                    + "if remaining < 0 then redis.call('INCR', KEYS[1]) return -2 end "
                    + "return remaining",
            Long.class);

    /**
     * 提取码错误计数：INCR 原子自增（禁止读改写），并按窗口刷新 TTL。
     *
     * <p>ARGV[1] = 锁定时长(ms)，ARGV[2] = 错误阈值。{@code c == 1} 时开窗；
     * {@code c >= 阈值} 时把 TTL 重置为完整时长——使「锁 30 min」从<b>触发锁定那一刻</b>起算，
     * 而不是从第 1 次错误起算（否则第 5 次错误若发生在第 25 分钟，只剩余 5 分钟锁定，形同虚设）。</p>
     */
    private static final DefaultRedisScript<Long> CODE_ERROR_INCR_SCRIPT = new DefaultRedisScript<>(
            "local c = redis.call('INCR', KEYS[1]) "
                    + "if c == 1 or c >= tonumber(ARGV[2]) then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end "
                    + "return c",
            Long.class);

    private final ShareLinkService shareLinkService;
    private final ShareLinkMapper shareLinkMapper;
    private final FileObjectMapper fileObjectMapper;
    private final ShareTicketService shareTicketService;
    private final ShareAuditLogger auditLogger;
    private final ShareProperties shareProperties;
    private final StringRedisTemplate stringRedisTemplate;

    /** BCrypt 自带随机盐；本模块自持实例，不依赖其他模块的 PasswordEncoder Bean（模块自治） */
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    /**
     * 访客换票：走完校验链并签发一次性下载 / 预览票据。
     *
     * @param token     外发链接令牌
     * @param request   提取码 + 访问类型
     * @param clientIp  来源 IP（审计）
     * @param userAgent 来源 UA（审计）
     * @return 一次性票据视图
     */
    public ShareTicketVO verify(String token, VerifyShareRequest request, String clientIp, String userAgent) {
        requireEnabled();

        String extractCode = request == null ? null : request.getExtractCode();
        String accessType = normalizeAccessType(request == null ? null : request.getAccessType());
        ShareLink link = resolveUsableLink(token);

        if (isCodeLocked(link.getToken())) {
            throw new BusinessException(ErrorCode.SHARE_LOCKED);
        }
        if (!codeMatches(extractCode, link.getExtractCodeHash())) {
            throw codeError(link, clientIp, userAgent);
        }
        // 提取码正确即清零计数窗口（不含已锁定态——锁定中根本不会走到这里）
        resetCodeErrorCounter(link.getToken());

        return shareTicketService.issue(link, accessType, remainingOf(link));
    }

    /**
     * 访客核销票据取件：GETDEL 取用即焚 → 二次校验链接状态（撤销 / 过期即时生效）
     * → Redis 前置闸 DECR → DB 原子扣减 → 写审计 → 返回取件载荷。
     *
     * @param request   票据
     * @param clientIp  来源 IP（审计）
     * @param userAgent 来源 UA（审计，落 detail）
     * @return 取件载荷（不含存储路径，字节流由服务端凭 fileId 解析）
     */
    public SharePayloadVO redeem(RedeemTicketRequest request, String clientIp, String userAgent) {
        // 注意：取件不校验 shareProperties.enabled——总开关只熔断「新建 / 撤销 / 查询 / 换票」，
        // 已生成链接的既有取件能力不受影响（见 ShareProperties#enabled 约定）。
        ShareTicketService.TicketPayload payload = shareTicketService.redeem(request.getTicket());
        if (payload == null) {
            throw new BusinessException(ErrorCode.SHARE_EXPIRED_OR_LIMIT, MSG_TICKET_INVALID);
        }

        ShareLink link = resolveForRedeem(payload);
        FileObject file = requireReadableFile(link, payload.fileId());

        long gate = consumeQuotaMirror(link.getToken());
        if (gate == MIRROR_EXHAUSTED) {
            // 只拒绝、不置终态：镜像归零意味着「最后一次额度刚被并发放行」，此刻若把 status 改成 2，
            // 会连带把仍在途的那条成功 UPDATE（WHERE status = 0）一起拒掉 → 少发。终态由该最后一条
            // SQL 自己在同一语句内收敛（见 ShareLinkMapper#consumeDownloadQuota）；即便它因故未收敛，
            // 后续任何一次走到 DB 的请求也会经 reconcileQuotaReject 补上，最终一致。
            throw new BusinessException(ErrorCode.SHARE_EXPIRED_OR_LIMIT);
        }

        LocalDateTime now = LocalDateTime.now();
        if (shareLinkMapper.consumeDownloadQuota(link.getId(), now) != 1) {
            throw reconcileQuotaReject(link);
        }

        String accessType = normalizeAccessType(payload.accessType());
        int remaining = Math.max(remainingOf(link) - 1, 0);
        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("fileName", file.getOriginalName());
        extra.put("accessType", accessType);
        extra.put("remainingCount", remaining);
        auditLogger.success(actionOf(accessType), null, link.getId(), clientIp, userAgent, extra);
        log.info("外发取件成功：shareId={}, fileId={}, accessType={}, remaining={}",
                link.getId(), file.getId(), accessType, remaining);

        return SharePayloadVO.builder()
                .shareId(link.getId())
                .fileId(file.getId())
                .fileName(file.getOriginalName())
                .sizeBytes(file.getSizeBytes())
                .sha256(file.getSha256())
                .contentType(file.getContentType())
                .accessType(accessType)
                .build();
    }

    // ------------------------------------------------------------------ 内部方法

    private void requireEnabled() {
        if (!shareProperties.isEnabled()) {
            throw new AuthException(ErrorCode.NO_AUTH, "外发分享功能当前不可用");
        }
    }

    /** 换票侧链接校验：存在（4040）→ 未撤销（4012）→ 未过期 / 未耗尽（4004，CAS 收敛终态） */
    private ShareLink resolveUsableLink(String token) {
        ShareLink link = shareLinkService.findByToken(token);
        if (link == null) {
            throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "外发链接不存在或已失效");
        }
        if (isRevoked(link)) {
            throw new BusinessException(ErrorCode.SHARE_REVOKED);
        }
        LocalDateTime now = LocalDateTime.now();
        if (isExpired(link, now)) {
            invalidate(link, now);
            throw new BusinessException(ErrorCode.SHARE_EXPIRED_OR_LIMIT, "外发链接已过期");
        }
        if (remainingOf(link) <= 0) {
            invalidate(link, now);
            throw new BusinessException(ErrorCode.SHARE_EXPIRED_OR_LIMIT);
        }
        return link;
    }

    /** 取件侧链接校验：以票据内 shareId 回源，保证撤销 / 过期后票据立即失效 */
    private ShareLink resolveForRedeem(ShareTicketService.TicketPayload payload) {
        ShareLink link = shareLinkMapper.selectById(payload.shareId());
        if (link == null) {
            throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "外发链接不存在或已失效");
        }
        if (isRevoked(link)) {
            throw new BusinessException(ErrorCode.SHARE_REVOKED);
        }
        LocalDateTime now = LocalDateTime.now();
        if (isExpired(link, now)) {
            invalidate(link, now);
            throw new BusinessException(ErrorCode.SHARE_EXPIRED_OR_LIMIT, "外发链接已过期");
        }
        return link;
    }

    private FileObject requireReadableFile(ShareLink link, Long fileId) {
        FileObject file = fileId == null ? null : fileObjectMapper.selectById(fileId);
        // 文件不存在 / 已下线，或票据 fileId 与该链接的 fileId 不一致（票据被构造 / 串用）→ 4005
        if (file == null || !Objects.equals(0, file.getStatus())
                || !Objects.equals(link.getFileId(), file.getId())) {
            throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
        }
        return file;
    }

    /** DB 原子扣减被拒（并发耗尽 / 期间被撤销）：回源定性并修正镜像，保证最终一致 */
    private BusinessException reconcileQuotaReject(ShareLink stale) {
        ShareLink latest = shareLinkMapper.selectById(stale.getId());
        if (latest == null) {
            return new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "外发链接不存在或已失效");
        }
        if (isRevoked(latest)) {
            return new BusinessException(ErrorCode.SHARE_REVOKED);
        }
        invalidate(latest, LocalDateTime.now());
        rebuildQuotaMirror(latest);
        return new BusinessException(ErrorCode.SHARE_EXPIRED_OR_LIMIT);
    }

    /** CAS 收敛为终态；失败不影响对外错误语义（并发下可能已由他人收敛） */
    private void invalidate(ShareLink link, LocalDateTime now) {
        try {
            shareLinkMapper.markInvalidated(link.getId(), now);
        } catch (Exception e) {
            log.warn("收敛外发链接终态失败（不影响拒绝语义）：shareId={}", link.getId(), e);
        }
    }

    /* ==================== Redis 提取码锁定（INCR + EXPIRE，原子） ==================== */

    /**
     * 是否处于锁定态。
     *
     * <p><b>必须比阈值，不能只看键存在</b>：错误计数与锁定共用同一键（{@code INCR} 后即存在），
     * 若用 {@code hasKey} 判定，第 1 次输错就会被误判为锁定（该 bug 已由本集成测试捕获）。</p>
     */
    private boolean isCodeLocked(String token) {
        try {
            String raw = stringRedisTemplate.opsForValue().get(RedisKeyConstants.shareLockKey(token));
            if (raw == null || raw.isBlank()) {
                return false;
            }
            return Long.parseLong(raw.trim()) >= shareProperties.getMaxCodeErrors();
        } catch (NumberFormatException e) {
            // 键值异常（非计数）→ 视为未锁定，避免脏数据把链接永久锁死
            log.warn("提取码锁定计数非数字，按未锁定处理：tokenHash={}", tokenHash(token), e);
            return false;
        } catch (Exception e) {
            // P-8 降级：Redis 不可用时放宽锁定（BCrypt 成本 + 高熵提取码空间仍构成兜底）
            log.warn("读取提取码锁定态失败，降级放行：tokenHash={}", tokenHash(token), e);
            return false;
        }
    }

    private boolean codeMatches(String rawCode, String hash) {
        if (rawCode == null || rawCode.isBlank() || hash == null || hash.isBlank()) {
            // 缺省 / 空白提取码一律按「不匹配」计数，避免用空值探测并防绕过
            return false;
        }
        try {
            return passwordEncoder.matches(rawCode, hash);
        } catch (IllegalArgumentException e) {
            log.warn("提取码散列格式非法，按不匹配处理", e);
            return false;
        }
    }

    /** 提取码错误：计数 +1，达阈值转锁定（4011）并落审计，否则 4010 */
    private BusinessException codeError(ShareLink link, String clientIp, String userAgent) {
        long errors = increaseCodeErrorCount(link.getToken());
        if (errors >= shareProperties.getMaxCodeErrors()) {
            auditLogger.failure(OperationLog.ACTION_SHARE_CODE_LOCKED, null, link.getId(), clientIp, userAgent,
                    "提取码连续错误 " + errors + " 次，锁定 "
                            + shareProperties.getCodeLockDuration().toMinutes() + " 分钟");
            return new BusinessException(ErrorCode.SHARE_LOCKED);
        }
        return new BusinessException(ErrorCode.SHARE_CODE_ERROR, MSG_CODE_ERROR);
    }

    private long increaseCodeErrorCount(String token) {
        try {
            Long count = stringRedisTemplate.execute(CODE_ERROR_INCR_SCRIPT,
                    List.of(RedisKeyConstants.shareLockKey(token)),
                    String.valueOf(shareProperties.getCodeLockDuration().toMillis()),
                    String.valueOf(shareProperties.getMaxCodeErrors()));
            return count == null ? 0L : count;
        } catch (Exception e) {
            log.warn("提取码错误计数失败，降级不锁定：tokenHash={}", tokenHash(token), e);
            return 0L;
        }
    }

    private void resetCodeErrorCounter(String token) {
        try {
            stringRedisTemplate.delete(RedisKeyConstants.shareLockKey(token));
        } catch (Exception e) {
            log.warn("清除提取码错误计数失败（不影响本次放行）：tokenHash={}", tokenHash(token), e);
        }
    }

    /* ==================== Redis 配额前置闸 / 镜像修正 ==================== */

    /** 返回 {@link #MIRROR_ABSENT} / {@link #MIRROR_EXHAUSTED} / 扣减后的剩余次数 */
    private long consumeQuotaMirror(String token) {
        try {
            Long result = stringRedisTemplate.execute(QUOTA_GATE_SCRIPT,
                    List.of(RedisKeyConstants.shareCountKey(token)));
            return result == null ? MIRROR_ABSENT : result;
        } catch (Exception e) {
            log.warn("分享配额前置闸不可用，降级为仅 DB 裁决：tokenHash={}", tokenHash(token), e);
            return MIRROR_ABSENT;
        }
    }

    /** 用 DB 真值回写镜像（{@code limit - count}），修正并发拒绝造成的漂移，实现最终一致 */
    private void rebuildQuotaMirror(ShareLink link) {
        try {
            Duration ttl = Duration.between(LocalDateTime.now(), link.getExpireAt());
            stringRedisTemplate.opsForValue().set(RedisKeyConstants.shareCountKey(link.getToken()),
                    String.valueOf(remainingOf(link)),
                    ttl.isNegative() || ttl.isZero() ? Duration.ofSeconds(1) : ttl);
        } catch (Exception e) {
            log.warn("回写分享配额镜像失败（不影响正确性）：shareId={}", link.getId(), e);
        }
    }

    /* ==================== 纯函数 / 小工具 ==================== */

    private boolean isRevoked(ShareLink link) {
        return Objects.equals(ShareLink.STATUS_REVOKED, link.getStatus());
    }

    private boolean isExpired(ShareLink link, LocalDateTime now) {
        return Objects.equals(ShareLink.STATUS_EXPIRED, link.getStatus())
                || link.getExpireAt() == null || !link.getExpireAt().isAfter(now);
    }

    private int remainingOf(ShareLink link) {
        int limit = link.getDownloadLimit() == null ? 0 : link.getDownloadLimit();
        int used = link.getDownloadedCount() == null ? 0 : link.getDownloadedCount();
        return Math.max(limit - used, 0);
    }

    private String normalizeAccessType(String accessType) {
        return ACCESS_PREVIEW.equalsIgnoreCase(accessType == null ? "" : accessType.trim())
                ? ACCESS_PREVIEW : ACCESS_DOWNLOAD;
    }

    private String actionOf(String accessType) {
        return ACCESS_PREVIEW.equals(accessType)
                ? OperationLog.ACTION_SHARE_PREVIEW : OperationLog.ACTION_SHARE_DOWNLOAD;
    }

    /** 日志脱敏：令牌即凭证，日志只留不可逆摘要（不打印明文，避免日志侧泄露） */
    private String tokenHash(String token) {
        return token == null ? "null" : Integer.toHexString(token.hashCode());
    }
}
