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
import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.notify.NotificationPort;
import com.anttransfer.common.result.ErrorCode;
import com.anttransfer.file.config.ShareProperties;
import com.anttransfer.file.model.dto.VerifyShareRequest;
import com.anttransfer.file.model.entity.ShareLink;
import com.anttransfer.file.model.vo.ShareTicketVO;
import com.anttransfer.file.repository.FileObjectMapper;
import com.anttransfer.file.repository.ShareLinkMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.time.Duration;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 越权 / 防爆破用例 TC-AUTH-04「分享提取码暴力枚举」的可执行载体。
 *
 * <p>提取码是<b>低熵</b>凭证（4~6 位数字），没有失败锁定就等于把链接交给暴力枚举。
 * 本类钉死四件事：</p>
 * <ol>
 *   <li><b>锁定优先于比对</b>：已锁定的链接即使送来正确提取码也必须拒绝，且<b>不得再去累加计数</b>
 *       （否则持续试探会把锁定期无限续命，变成一次「合法」的永久拒绝服务）；</li>
 *   <li><b>阈值即锁</b>：第 {@code maxCodeErrors} 次错误直接转 4011，而不是等到下一次；</li>
 *   <li><b>话术固定</b>：未达阈值时统一「提取码错误」，不得透露服务端状态（次数、是否存在、是否临近锁定）；</li>
 *   <li><b>成功即清零</b>：提取码正确后必须清掉错误计数，否则历史错误会「滚雪球」——用户每隔几天输错一次，
 *       最终在自己毫无察觉的情况下被锁死。</li>
 * </ol>
 *
 * <p>纯 POJO + Mockito 测试，不起 Spring 上下文；提取码散列用真实 BCrypt（比对本就是被测语义，
 * mock 掉 PasswordEncoder 等于绕过一半校验链）。</p>
 *
 * @author AntTransfer CE
 */
class ShareCodeBruteForceLockTest {

    private static final String TOKEN = "TK-abc123";
    private static final String CORRECT_CODE = "2468";
    private static final String LOCK_KEY = RedisKeyConstants.shareLockKey(TOKEN);
    private static final int MAX_CODE_ERRORS = 5;

    /** 真实 BCrypt 散列（每次构造带随机盐，与生产同构）。 */
    private static final String CODE_HASH = new BCryptPasswordEncoder().encode(CORRECT_CODE);

    private ShareAccessService service;
    private ShareLinkService shareLinkService;
    private ShareTicketService shareTicketService;
    private ShareAuditLogger auditLogger;
    private StringRedisTemplate redis;
    private ValueOperations<String, String> valueOps;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        shareLinkService = mock(ShareLinkService.class);
        shareTicketService = mock(ShareTicketService.class);
        auditLogger = mock(ShareAuditLogger.class);
        redis = mock(StringRedisTemplate.class);
        valueOps = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(valueOps);

        ShareProperties properties = mock(ShareProperties.class);
        when(properties.isEnabled()).thenReturn(true);
        when(properties.getMaxCodeErrors()).thenReturn(MAX_CODE_ERRORS);
        when(properties.getCodeLockDuration()).thenReturn(Duration.ofMinutes(30));

        service = new ShareAccessService(
                shareLinkService,
                mock(ShareLinkMapper.class),
                mock(FileObjectMapper.class),
                shareTicketService,
                auditLogger,
                properties,
                redis,
                mock(NotificationPort.class));
    }

    private ShareLink usableLink() {
        ShareLink link = new ShareLink();
        link.setId(9L);
        link.setToken(TOKEN);
        link.setStatus(ShareLink.STATUS_ACTIVE);
        link.setExpireAt(LocalDateTime.now().plusDays(1));
        link.setDownloadLimit(5);
        link.setDownloadedCount(0);
        link.setExtractCodeHash(CODE_HASH);
        link.setFileId(77L);
        return link;
    }

    private VerifyShareRequest request(String code) {
        VerifyShareRequest request = new VerifyShareRequest();
        request.setExtractCode(code);
        request.setAccessType(ShareAccessService.ACCESS_DOWNLOAD);
        return request;
    }

    private void givenLink() {
        when(shareLinkService.findByToken(TOKEN)).thenReturn(usableLink());
    }

    @Test
    @DisplayName("TC-AUTH-04 已锁定：即便提取码正确也拒绝，且不再累加计数（防止试探续命锁定期）")
    void lockedLink_rejectsEvenCorrectCodeWithoutIncrementingCounter() {
        givenLink();
        when(valueOps.get(LOCK_KEY)).thenReturn(String.valueOf(MAX_CODE_ERRORS));

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.verify(TOKEN, request(CORRECT_CODE), "1.2.3.4", "ua"));

        assertEquals(ErrorCode.SHARE_LOCKED.getCode(), ex.getCode());
        // 锁定态下继续 INCR 会把 30 min 锁定一次次续期，等于把「限流」变成「永久拒绝服务」
        verify(redis, never()).execute(any(RedisScript.class), anyList(), any(), any());
    }

    @Test
    @DisplayName("TC-AUTH-04 未达阈值的错误：4010 且话术固定，不透露剩余次数等任何服务端状态")
    void wrongCodeBelowThreshold_returnsFixedMessage() {
        givenLink();
        when(valueOps.get(LOCK_KEY)).thenReturn(null);
        when(redis.execute(any(RedisScript.class), anyList(), any(), any())).thenReturn(2L);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.verify(TOKEN, request("9999"), "1.2.3.4", "ua"));

        assertEquals(ErrorCode.SHARE_CODE_ERROR.getCode(), ex.getCode());
        // 话术若带上「还剩 3 次」，攻击者就能据此刻度化枚举节奏
        assertEquals("提取码错误", ex.getMessage());
    }

    @Test
    @DisplayName("TC-AUTH-04 恰好达到阈值：本次即锁（4011），并留下锁定审计")
    void wrongCodeAtThreshold_locksImmediately() {
        givenLink();
        when(valueOps.get(LOCK_KEY)).thenReturn(null);
        when(redis.execute(any(RedisScript.class), anyList(), any(), any())).thenReturn((long) MAX_CODE_ERRORS);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.verify(TOKEN, request("9999"), "1.2.3.4", "ua"));

        assertEquals(ErrorCode.SHARE_LOCKED.getCode(), ex.getCode());
        verify(auditLogger).failure(eq(OperationLog.ACTION_SHARE_CODE_LOCKED), isNull(), eq(9L),
                eq("1.2.3.4"), eq("ua"), anyString());
    }

    @Test
    @DisplayName("TC-AUTH-04 提取码正确：清零错误计数并签发票据（防「历史错误滚雪球」式误锁）")
    void correctCode_clearsCounterAndIssuesTicket() {
        givenLink();
        when(valueOps.get(LOCK_KEY)).thenReturn(String.valueOf(MAX_CODE_ERRORS - 1));
        when(shareTicketService.issue(any(), anyString(), anyInt()))
                .thenReturn(ShareTicketVO.builder().ticket("one-shot").build());

        ShareTicketVO ticket = service.verify(TOKEN, request(CORRECT_CODE), "1.2.3.4", "ua");

        assertNotNull(ticket);
        assertEquals("one-shot", ticket.getTicket());
        verify(redis).delete(LOCK_KEY);
    }
}
