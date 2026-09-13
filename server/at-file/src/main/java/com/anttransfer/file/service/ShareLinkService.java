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
import com.anttransfer.common.result.PageResult;
import com.anttransfer.file.config.ShareProperties;
import com.anttransfer.file.extension.ContentScanChain;
import com.anttransfer.file.extension.ContentScanInterceptor;
import com.anttransfer.file.model.dto.CreateShareRequest;
import com.anttransfer.file.model.entity.FileObject;
import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.file.model.entity.ShareLink;
import com.anttransfer.file.model.vo.ShareLinkVO;
import com.anttransfer.file.repository.FileObjectMapper;
import com.anttransfer.file.repository.ShareLinkMapper;
import com.anttransfer.file.util.AfterCommitUtils;
import com.anttransfer.file.util.SecureTokens;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 外发分享管理服务（创建者侧）：创建 / 撤销 / 查询 / 我的分享。
 *
 * <p><b>职责边界</b>：本类只管「链接生命周期管理」；访客侧的校验与取件在
 * {@link ShareAccessService}，票据读写在一 {@link ShareTicketService}。</p>
 *
 * <p><b>安全要点</b>：</p>
 * <ul>
 *     <li>功能权限由接口层 {@code @RequiresPerm("file:share")} 声明；本类补充
 *         <b>数据范围</b>校验（仅能分享 / 撤销自己上传的文件），防水平越权（红队 [V-06]）；</li>
 *     <li>提取码 BCrypt 加盐散列，<b>全链路不回显</b>，日志亦不打印明文；</li>
 *     <li>外发前经 {@link ContentScanChain} 拦截（后缀黑名单 / 敏感词 / EE DLP），命中落审计。</li>
 * </ul>
 *
 * @author AntTransfer CE
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ShareLinkService {

    /** 分页上界（与全局口径一致，见 docs/api/README §3） */
    private static final long MAX_PAGE_SIZE = 100L;

    /** MySQL ER_DUP_ENTRY：token 唯一键冲突（256 bit 随机，概率可忽略，仅作兜底重试） */
    private final ShareLinkMapper shareLinkMapper;
    private final FileObjectMapper fileObjectMapper;
    private final ContentScanChain contentScanChain;
    private final ShareAuditLogger auditLogger;
    private final ShareProperties shareProperties;
    private final org.springframework.data.redis.core.StringRedisTemplate stringRedisTemplate;

    /** BCrypt 自带随机盐；本模块自持实例，不依赖其他模块的 PasswordEncoder Bean（模块自治） */
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    /**
     * 创建外发链接。
     *
     * @param ownerUserId 创建者（接口层登录主体）
     * @param request     创建参数（文件 + 提取码 + 可选次数 / 有效期）
     * @param clientIp    来源 IP（审计）
     * @param userAgent   来源 UA（审计）
     * @return 链接视图（<b>不含提取码</b>）
     */
    @Transactional(rollbackFor = Exception.class)
    public ShareLinkVO create(Long ownerUserId, CreateShareRequest request, String clientIp, String userAgent) {
        requireEnabled();

        FileObject file = requireOwnedFile(request.getFileId(), ownerUserId);
        int downloadLimit = resolveDownloadLimit(request.getDownloadLimit());
        LocalDateTime expireAt = resolveExpireAt(request.getExpireAt());
        String extractCode = normalizeAndValidateExtractCode(request.getExtractCode());

        // 外发内容闸门：后缀黑名单 / 文件名敏感词（CE）+ EE DLP；命中即拦截并留痕
        String extension = extensionOf(file.getOriginalName());
        ContentScanInterceptor.ScanResult scan = contentScanChain.scan(new ContentScanInterceptor.ScanContext(
                file.getId(), file.getOriginalName(), extension, file.getSizeBytes(), file.getUploadUserId()));
        if (scan.denied()) {
            Map<String, Object> extra = new LinkedHashMap<>();
            extra.put("fileName", file.getOriginalName());
            extra.put("extension", extension);
            extra.put("reason", scan.reason());
            auditLogger.log(OperationLog.ACTION_SHARE_BLOCKED, ownerUserId, null, clientIp, userAgent, false, extra);
            throw new BusinessException(ErrorCode.FILE_TYPE_NOT_ALLOWED, scan.reason());
        }

        ShareLink link = insertWithUniqueToken(ownerUserId, file.getId(), extractCode, downloadLimit, expireAt);

        // Redis 配额镜像必须在事务提交后建立，避免「事务回滚但镜像已存在」的假配额
        AfterCommitUtils.run(() -> initQuotaMirror(link));

        Map<String, Object> extra = new LinkedHashMap<>();
        extra.put("fileName", file.getOriginalName());
        extra.put("downloadLimit", downloadLimit);
        extra.put("expireAt", expireAt.toString());
        auditLogger.log(OperationLog.ACTION_SHARE_CREATE, ownerUserId, link.getId(), clientIp, userAgent, true, extra);

        log.info("创建外发链接成功：shareId={}, fileId={}, ownerUserId={}, downloadLimit={}, expireAt={}",
                link.getId(), file.getId(), ownerUserId, downloadLimit, expireAt);
        return toVO(link, file.getOriginalName());
    }

    /**
     * 撤销外发链接（终态迁移，不可恢复）。
     *
     * @param ownerUserId 创建者
     * @param token       链接令牌
     * @param clientIp    来源 IP（审计）
     * @param userAgent   来源 UA（审计）
     */
    @Transactional(rollbackFor = Exception.class)
    public void revoke(Long ownerUserId, String token, String clientIp, String userAgent) {
        requireEnabled();

        ShareLink link = requireOwnedLink(token, ownerUserId);
        if (!Objects.equals(ShareLink.STATUS_ACTIVE, link.getStatus())) {
            throw new BusinessException(ErrorCode.SHARE_REVOKED);
        }
        int rows = shareLinkMapper.revoke(link.getId(), LocalDateTime.now());
        if (rows != 1) {
            // CAS 失败：并发下已被他人 / 定时任务先行收敛为终态
            throw new BusinessException(ErrorCode.SHARE_REVOKED);
        }
        // 镜像清理同样推迟到提交后；已签发的票据无需遍历清理——核销时会二次校验链接状态
        AfterCommitUtils.run(() -> stringRedisTemplate.delete(RedisKeyConstants.shareCountKey(link.getToken())));
        auditLogger.log(OperationLog.ACTION_SHARE_REVOKE, ownerUserId, link.getId(), clientIp, userAgent, true, null);
        log.info("撤销外发链接成功：shareId={}, ownerUserId={}", link.getId(), ownerUserId);
    }

    /**
     * 查询单个外发链接详情（仅创建者可见）。
     *
     * @param ownerUserId 创建者
     * @param token       链接令牌
     * @return 链接视图
     */
    public ShareLinkVO detail(Long ownerUserId, String token) {
        requireEnabled();
        ShareLink link = requireOwnedLink(token, ownerUserId);
        FileObject file = fileObjectMapper.selectById(link.getFileId());
        return toVO(link, file == null ? null : file.getOriginalName());
    }

    /**
     * 「我的分享」分页（按创建时间倒序）。
     *
     * @param ownerUserId 创建者
     * @param current     页码（从 1 起）
     * @param pageSize    每页条数（上界 100）
     * @return 分页结果
     */
    public PageResult<ShareLinkVO> pageMine(Long ownerUserId, long current, long pageSize) {
        requireEnabled();
        long safeCurrent = Math.max(current, 1L);
        long safeSize = Math.min(Math.max(pageSize, 1L), MAX_PAGE_SIZE);
        Page<ShareLink> page = shareLinkMapper.selectPage(new Page<>(safeCurrent, safeSize),
                Wrappers.<ShareLink>lambdaQuery()
                        .eq(ShareLink::getOwnerUserId, ownerUserId)
                        .orderByDesc(ShareLink::getId));
        // 文件名批量补齐（避免 N+1：一次 in 查询）
        Map<Long, String> nameById = new LinkedHashMap<>();
        List<Long> fileIds = page.getRecords().stream().map(ShareLink::getFileId).distinct().toList();
        if (!fileIds.isEmpty()) {
            fileObjectMapper.selectBatchIds(fileIds)
                    .forEach(f -> nameById.put(f.getId(), f.getOriginalName()));
        }
        List<ShareLinkVO> records = page.getRecords().stream()
                .map(link -> toVO(link, nameById.get(link.getFileId())))
                .toList();
        return PageResult.of(records, page.getTotal(), page.getCurrent(), page.getSize());
    }

    /**
     * 按令牌加载链接（供 {@link ShareAccessService} 复用；不含归属校验）。
     *
     * @param token 链接令牌
     * @return 链接实体；不存在返回 {@code null}
     */
    ShareLink findByToken(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        return shareLinkMapper.selectOne(Wrappers.<ShareLink>lambdaQuery().eq(ShareLink::getToken, token));
    }

    // ------------------------------------------------------------------ 内部方法

    private void requireEnabled() {
        if (!shareProperties.isEnabled()) {
            throw new AuthException(ErrorCode.NO_AUTH, "外发分享功能当前不可用");
        }
    }

    private FileObject requireOwnedFile(Long fileId, Long ownerUserId) {
        FileObject file = fileObjectMapper.selectById(fileId);
        // 文件不存在 / 已下线统一 4005，不区分「不存在」与「无权」以免泄露他人文件存在性
        if (file == null || !Objects.equals(0, file.getStatus())) {
            throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
        }
        if (!Objects.equals(file.getUploadUserId(), ownerUserId)) {
            throw new AuthException(ErrorCode.NO_AUTH, "只能分享自己上传的文件");
        }
        return file;
    }

    private ShareLink requireOwnedLink(String token, Long ownerUserId) {
        ShareLink link = findByToken(token);
        if (link == null) {
            throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND);
        }
        if (!Objects.equals(link.getOwnerUserId(), ownerUserId)) {
            // 水平越权防护：不暴露「该链接属于他人」的细节，统一 403/1003
            throw new AuthException(ErrorCode.NO_AUTH, "无权操作他人的外发链接");
        }
        return link;
    }

    private int resolveDownloadLimit(Integer requested) {
        if (requested == null) {
            return shareProperties.getDefaultDownloadLimit();
        }
        if (requested <= 0 || requested > shareProperties.getMaxDownloadLimit()) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE,
                    "下载次数须在 1 ~ " + shareProperties.getMaxDownloadLimit() + " 之间");
        }
        return requested;
    }

    private LocalDateTime resolveExpireAt(LocalDateTime requested) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime maxExpireAt = now.plus(shareProperties.getMaxExpire());
        if (requested == null) {
            return now.plus(shareProperties.getDefaultExpire());
        }
        if (!requested.isAfter(now)) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE, "有效期必须晚于当前时间");
        }
        if (requested.isAfter(maxExpireAt)) {
            long maxDays = shareProperties.getMaxExpire().toDays();
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE, "有效期不得超过 " + maxDays + " 天");
        }
        return requested;
    }

    private String normalizeAndValidateExtractCode(String raw) {
        String code = raw == null ? "" : raw.trim();
        int min = shareProperties.getExtractCodeMinLength();
        int max = shareProperties.getExtractCodeMaxLength();
        if (code.length() < min || code.length() > max) {
            throw new BusinessException(ErrorCode.PARAM_OUT_OF_RANGE,
                    "提取码长度须在 " + min + " ~ " + max + " 位之间");
        }
        if (!code.matches("[A-Za-z0-9]+")) {
            throw new BusinessException(ErrorCode.PARAM_FORMAT_ERROR, "提取码仅支持字母与数字");
        }
        return code;
    }

    /**
     * 落库链接：token 唯一键冲突时重试（256 bit 随机，冲突概率可忽略，属防御性兜底）。
     */
    private ShareLink insertWithUniqueToken(Long ownerUserId, Long fileId, String extractCode,
                                            int downloadLimit, LocalDateTime expireAt) {
        for (int attempt = 1; attempt <= 3; attempt++) {
            ShareLink link = new ShareLink();
            link.setToken(SecureTokens.randomToken());
            link.setFileId(fileId);
            link.setOwnerUserId(ownerUserId);
            link.setExtractCodeHash(passwordEncoder.encode(extractCode));
            link.setExpireAt(expireAt);
            link.setDownloadLimit(downloadLimit);
            link.setDownloadedCount(0);
            link.setStatus(ShareLink.STATUS_ACTIVE);
            link.setCreateBy(ownerUserId);
            link.setUpdateBy(ownerUserId);
            try {
                shareLinkMapper.insert(link);
                return link;
            } catch (DuplicateKeyException e) {
                log.warn("外发链接 token 唯一键冲突，重试第 {} 次", attempt);
            }
        }
        throw new IllegalStateException("生成外发链接令牌失败：连续冲突");
    }

    /**
     * 初始化 Redis 配额镜像：{@code at:share:count:{token} = download_limit}，TTL 与链接同寿。
     *
     * <p>镜像仅作<b>前置快速失败</b>；真值以 DB 为准，镜像丢失只降速不失准。</p>
     */
    private void initQuotaMirror(ShareLink link) {
        try {
            Duration ttl = Duration.between(LocalDateTime.now(), link.getExpireAt());
            stringRedisTemplate.opsForValue().set(RedisKeyConstants.shareCountKey(link.getToken()),
                    String.valueOf(link.getDownloadLimit()), ttl.isNegative() ? Duration.ofSeconds(1) : ttl);
        } catch (Exception e) {
            // 镜像初始化失败不影响正确性（DB 兜底），仅损失快速失败能力
            log.warn("初始化分享配额镜像失败（不影响正确性）：shareId={}", link.getId(), e);
        }
    }

    private String extensionOf(String originalName) {
        if (originalName == null) {
            return "";
        }
        int dot = originalName.lastIndexOf('.');
        if (dot < 0 || dot == originalName.length() - 1) {
            return "";
        }
        return originalName.substring(dot + 1).toLowerCase(java.util.Locale.ROOT);
    }

    private ShareLinkVO toVO(ShareLink link, String fileName) {
        int limit = link.getDownloadLimit() == null ? 0 : link.getDownloadLimit();
        int used = link.getDownloadedCount() == null ? 0 : link.getDownloadedCount();
        return ShareLinkVO.builder()
                .token(link.getToken())
                .fileId(link.getFileId())
                .fileName(fileName)
                .expireAt(link.getExpireAt())
                .downloadLimit(limit)
                .downloadedCount(used)
                .remainingCount(Math.max(limit - used, 0))
                .status(link.getStatus())
                .revokeAt(link.getRevokeAt())
                .extractCodeRequired(true)
                .createTime(link.getCreateTime())
                .build();
    }
}
