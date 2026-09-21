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

import com.anttransfer.common.audit.OperationLog;
import com.anttransfer.common.constant.RedisKeyConstants;
import com.anttransfer.common.exception.AuthException;
import com.anttransfer.file.config.ShareProperties;
import com.anttransfer.file.extension.ContentScanChain;
import com.anttransfer.file.repository.FileObjectMapper;
import com.anttransfer.file.repository.ShareLinkMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 批量 / 一键失效外发链接的单测（{@link ShareLinkService#revokeBatch}、{@link ShareLinkService#revokeAll}）。
 *
 * <p>这两条路径与单条 {@code revoke} 的差别不只是「一次多条」，语义上有四条不可退让的口径：</p>
 * <ol>
 *   <li><b>归属人只来自登录主体</b>：令牌是客户端传的、不可信，所以 {@code ownerUserId} 必须原样
 *       进入 SQL 的 {@code WHERE}；测试从入参侧钉死这一点（令牌集合无法改变作用域）。</li>
 *   <li><b>幂等且可解释</b>：返回的是<b>实际失效条数</b>，非生效态条目静默跳过——
 *       用户重复点「失效全部」不该收到错误，但也不该被告知「撤了 3 条」（其实一条没动）。</li>
 *   <li><b>零事实变化 = 零副作用</b>：没有条目真的被撤销时，不写审计、不清缓存镜像。</li>
 *   <li><b>批量留痕不刷表</b>：一次操作一条审计，用 {@code scope / revoked / requested}
 *       说明作用域与「意图 vs 实际」的差异，而不是逐条 insert。</li>
 * </ol>
 *
 * <p>纯 POJO + Mockito，不起 Spring 上下文。</p>
 *
 * @author AntTransfer CE
 */
class ShareLinkBulkRevokeTest {

    private static final long ME = 7L;
    private static final String IP = "10.0.0.1";
    private static final String UA = "Mozilla/5.0";

    private ShareLinkMapper shareLinkMapper;
    private ShareAuditLogger auditLogger;
    private ShareProperties shareProperties;
    private StringRedisTemplate stringRedisTemplate;
    private ShareLinkService service;

    @BeforeEach
    void setUp() {
        shareLinkMapper = mock(ShareLinkMapper.class);
        auditLogger = mock(ShareAuditLogger.class);
        shareProperties = mock(ShareProperties.class);
        stringRedisTemplate = mock(StringRedisTemplate.class);
        when(shareProperties.isEnabled()).thenReturn(true);
        service = new ShareLinkService(shareLinkMapper, mock(FileObjectMapper.class), mock(ContentScanChain.class),
                auditLogger, shareProperties, stringRedisTemplate);
    }

    private List<String> activeTokens(String... tokens) {
        return List.of(tokens);
    }

    /* ======================= 失效所选（批量） ======================= */

    @Test
    @DisplayName("批量撤销：失效范围由登录主体决定，返回实际失效条数并清理对应配额镜像")
    void revokeBatch_shouldScopeToLoginOwnerAndClearMirror() {
        when(shareLinkMapper.revokeBatch(eq(ME), any(), any(LocalDateTime.class))).thenReturn(2);

        int revoked = service.revokeBatch(ME, List.of("t1", "t2", "t3"), IP, UA);

        assertEquals(2, revoked);
        // 归属人必须原样进入 SQL：令牌可以来自请求，所有者不可以
        verify(shareLinkMapper).revokeBatch(eq(ME), any(), any(LocalDateTime.class));
        verify(stringRedisTemplate).delete(List.of(
                RedisKeyConstants.shareCountKey("t1"),
                RedisKeyConstants.shareCountKey("t2"),
                RedisKeyConstants.shareCountKey("t3")));
        verify(auditLogger).success(eq(OperationLog.ACTION_SHARE_REVOKE), eq(ME), isNull(), eq(IP), eq(UA), any());
    }

    @Test
    @DisplayName("批量撤销：重复 / 空白 / null 令牌在查库前被规整，避免同一条被重复计数")
    void revokeBatch_shouldNormalizeTokensBeforeUpdate() {
        when(shareLinkMapper.revokeBatch(eq(ME), any(), any(LocalDateTime.class))).thenReturn(1);

        service.revokeBatch(ME, Arrays.asList(" t1 ", "t1", "", "   ", null, "t2"), IP, UA);

        verify(shareLinkMapper).revokeBatch(eq(ME), eq(List.of("t1", "t2")), any(LocalDateTime.class));
    }

    @Test
    @DisplayName("批量撤销：条目已全部处于终态 → 返回 0，且不写审计、不动缓存镜像")
    void revokeBatch_whenNothingRevoked_shouldStaySilent() {
        when(shareLinkMapper.revokeBatch(eq(ME), any(), any(LocalDateTime.class))).thenReturn(0);

        int revoked = service.revokeBatch(ME, List.of("t1"), IP, UA);

        assertEquals(0, revoked);
        verifyNoInteractions(stringRedisTemplate, auditLogger);
    }

    @Test
    @DisplayName("批量撤销：令牌全为空白 → 返回 0，不产生一次必然零行的 UPDATE")
    void revokeBatch_withOnlyBlankTokens_shouldNotTouchDatabase() {
        int revoked = service.revokeBatch(ME, List.of(" ", ""), IP, UA);

        assertEquals(0, revoked);
        verifyNoInteractions(shareLinkMapper, stringRedisTemplate, auditLogger);
    }

    /* ======================= 失效全部（一键） ======================= */

    @Test
    @DisplayName("一键失效：清空该用户全部生效链接，返回实际失效条数并清理全部配额镜像")
    void revokeAll_shouldRevokeEveryActiveLinkOfLoginOwner() {
        when(shareLinkMapper.selectActiveTokens(ME)).thenReturn(activeTokens("t1", "t2", "t3"));
        when(shareLinkMapper.revokeAllActive(eq(ME), any(LocalDateTime.class))).thenReturn(3);

        int revoked = service.revokeAll(ME, IP, UA);

        assertEquals(3, revoked);
        verify(shareLinkMapper).revokeAllActive(eq(ME), any(LocalDateTime.class));
        verify(stringRedisTemplate).delete(List.of(
                RedisKeyConstants.shareCountKey("t1"),
                RedisKeyConstants.shareCountKey("t2"),
                RedisKeyConstants.shareCountKey("t3")));
    }

    @Test
    @DisplayName("一键失效：没有生效中的链接 → 返回 0，连 UPDATE 都不执行")
    void revokeAll_whenNoActiveLink_shouldNotUpdate() {
        when(shareLinkMapper.selectActiveTokens(ME)).thenReturn(List.of());

        int revoked = service.revokeAll(ME, IP, UA);

        assertEquals(0, revoked);
        verify(shareLinkMapper, never()).revokeAllActive(any(), any(LocalDateTime.class));
        verifyNoInteractions(stringRedisTemplate, auditLogger);
    }

    @Test
    @DisplayName("审计口径：一次批量操作只留一条痕，用 scope/revoked/requested 说明范围与实际差异")
    void revokeAll_shouldWriteSingleAggregateAuditEntry() {
        when(shareLinkMapper.selectActiveTokens(ME)).thenReturn(activeTokens("t1", "t2"));
        when(shareLinkMapper.revokeAllActive(eq(ME), any(LocalDateTime.class))).thenReturn(1);

        service.revokeAll(ME, IP, UA);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> extra = ArgumentCaptor.forClass(Map.class);
        // verify(...) 本身即「恰好一次」：逐条审计会把审计表刷满，这里把它钉死
        verify(auditLogger).success(eq(OperationLog.ACTION_SHARE_REVOKE), eq(ME), isNull(), eq(IP), eq(UA),
                extra.capture());
        assertEquals("all", extra.getValue().get("scope"));
        assertEquals(1, extra.getValue().get("revoked"));
        assertEquals(2, extra.getValue().get("requested"));
    }

    /* ======================= 熔断开关 ======================= */

    @Test
    @DisplayName("总开关关闭：批量与一键两处入口都先拒后查，不产生任何数据副作用")
    void whenShareDisabled_shouldRejectBeforeAnyQuery() {
        when(shareProperties.isEnabled()).thenReturn(false);

        assertThrows(AuthException.class, () -> service.revokeBatch(ME, List.of("t1"), IP, UA));
        assertThrows(AuthException.class, () -> service.revokeAll(ME, IP, UA));

        verifyNoInteractions(shareLinkMapper, stringRedisTemplate, auditLogger);
    }
}
