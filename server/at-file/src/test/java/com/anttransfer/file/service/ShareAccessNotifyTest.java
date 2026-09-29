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

import com.anttransfer.common.exception.BusinessException;
import com.anttransfer.common.notify.NotificationCommand;
import com.anttransfer.common.notify.NotificationPort;
import com.anttransfer.common.notify.NotifyType;
import com.anttransfer.file.config.ShareProperties;
import com.anttransfer.file.model.dto.RedeemTicketRequest;
import com.anttransfer.file.model.dto.VerifyShareRequest;
import com.anttransfer.file.model.entity.FileObject;
import com.anttransfer.file.model.entity.ShareLink;
import com.anttransfer.file.model.vo.SharePayloadVO;
import com.anttransfer.file.repository.FileObjectMapper;
import com.anttransfer.file.repository.ShareLinkMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.ArgumentMatchers;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.anyList;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 外发链接「访客侧 → 创建者」回执通知的单测（{@link ShareAccessService}）。
 *
 * <p>这些通知是 A 组「契约已备、发送方缺失」的收口点，全都是<b>旁路回执</b>，
 * 因此测试要同时钉死两件事，缺一不可：</p>
 * <ol>
 *   <li><b>该发时必须发</b>：取件成功 → {@code SHARE_ACCESSED}；提取码<b>恰好</b>跨过阈值 →
 *       {@code SHARE_LOCKED} 且仅一次。</li>
 *   <li><b>通知不得反过来影响主流程</b>：通知抛异常时取件仍成功、锁定语义不变；
 *       无归属（{@code ownerUserId} 为空）时不产生非法落库。</li>
 * </ol>
 *
 * <p>「恰好跨阈值才提醒」与「高于阈值不再提醒」是两条独立用例：前者防漏，后者防刷。
 * 若把条件写成 {@code >=}，脚本连打会把创建者收件箱刷满，而信息量始终只有「被锁了」。</p>
 *
 * <p>纯 POJO + Mockito，不起 Spring 上下文；{@link ShareProperties} 用真实对象，
 * 让「阈值 5 / 锁 30 min」由配置默认值驱动，而不是测试自己编的常量。</p>
 *
 * @author AntTransfer CE
 */
class ShareAccessNotifyTest {

    private static final long OWNER = 7L;
    private static final long SHARE_ID = 42L;
    private static final long FILE_ID = 99L;
    private static final String TOKEN = "tok-share-1";
    private static final String FILE_NAME = "季度报表.xlsx";
    private static final String CLIENT_IP = "10.0.0.9";
    private static final String UA = "Mozilla/5.0";

    private ShareLinkService shareLinkService;
    private ShareLinkMapper shareLinkMapper;
    private FileObjectMapper fileObjectMapper;
    private ShareTicketService shareTicketService;
    private ShareAuditLogger auditLogger;
    private ShareProperties shareProperties;
    private StringRedisTemplate stringRedisTemplate;
    private NotificationPort notificationPort;

    private ShareAccessService service;

    @BeforeEach
    void setUp() {
        shareLinkService = mock(ShareLinkService.class);
        shareLinkMapper = mock(ShareLinkMapper.class);
        fileObjectMapper = mock(FileObjectMapper.class);
        shareTicketService = mock(ShareTicketService.class);
        auditLogger = mock(ShareAuditLogger.class);
        // 真实配置对象：默认「阈值 5 次 / 锁 30 min」，避免逐项打桩掩盖口径漂移
        shareProperties = new ShareProperties();
        stringRedisTemplate = mock(StringRedisTemplate.class);
        notificationPort = mock(NotificationPort.class);

        @SuppressWarnings("unchecked")
        ValueOperations<String, String> valueOps = mock(ValueOperations.class);
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOps);

        service = new ShareAccessService(shareLinkService, shareLinkMapper, fileObjectMapper,
                shareTicketService, auditLogger, shareProperties, stringRedisTemplate, notificationPort);
    }

    /* ======================= 取件回执（SHARE_ACCESSED） ======================= */

    @Test
    @DisplayName("取件成功：给创建者发一条 SHARE_ACCESSED，含访问动作、文件名与剩余额度")
    void redeem_success_shouldSendAccessedReceiptToOwner() {
        givenRedeemable(ShareAccessService.ACCESS_DOWNLOAD);
        when(notificationPort.send(any())).thenReturn(1L);

        SharePayloadVO payload = service.redeem(redeemRequest(), CLIENT_IP, UA);

        assertNotNull(payload);
        NotificationCommand cmd = captureSingleNotification();
        assertEquals(NotifyType.SHARE_ACCESSED, cmd.notifyType());
        assertEquals(OWNER, cmd.recipientUserId());
        assertEquals(NotificationCommand.BIZ_SHARE, cmd.bizType());
        assertEquals(SHARE_ID, cmd.bizId());
        assertTrue(cmd.title().contains("取件"), "标题应让创建者一眼看出「有人取走了」");
        assertTrue(cmd.content().contains("下载"), "应区分下载 / 预览");
        assertTrue(cmd.content().contains(FILE_NAME));
        // 额度上限 10、本次取走后 9：回执把「还剩几次」一并带出，省去创建者再点进去查
        assertTrue(cmd.content().contains("剩余可取件 9 次"), "实际文案：" + cmd.content());
    }

    @Test
    @DisplayName("取件回执：预览动作在文案里是「预览」而不是「下载」")
    void redeem_whenPreview_shouldSayPreview() {
        givenRedeemable(ShareAccessService.ACCESS_PREVIEW);
        when(notificationPort.send(any())).thenReturn(1L);

        service.redeem(redeemRequest(), CLIENT_IP, UA);

        NotificationCommand cmd = captureSingleNotification();
        assertTrue(cmd.content().contains("预览"), "实际文案：" + cmd.content());
    }

    @Test
    @DisplayName("通知失败不得污染取件：send 抛异常时取件照常成功返回")
    void redeem_whenNotifyFails_shouldStillReturnPayload() {
        givenRedeemable(ShareAccessService.ACCESS_DOWNLOAD);
        when(notificationPort.send(any())).thenThrow(new RuntimeException("通知域不可用"));

        SharePayloadVO payload = assertDoesNotThrow(() -> service.redeem(redeemRequest(), CLIENT_IP, UA));

        assertNotNull(payload);
        verify(notificationPort).send(any());
    }

    @Test
    @DisplayName("无归属链接（ownerUserId 为空）：不发送，避免把非法报文送进通知域")
    void redeem_whenOwnerUnknown_shouldNotNotify() {
        ShareLink link = givenRedeemable(ShareAccessService.ACCESS_DOWNLOAD);
        link.setOwnerUserId(null);

        service.redeem(redeemRequest(), CLIENT_IP, UA);

        verify(notificationPort, never()).send(any());
    }

    /* ======================= 提取码锁定提醒（SHARE_LOCKED） ======================= */

    @Test
    @DisplayName("提取码恰好跨过阈值：发一次 SHARE_LOCKED，带文件名与锁定时长")
    void verify_codeErrorAtThreshold_shouldNotifyLockedOnce() {
        givenWrongCodeAttempt();
        stubCodeErrors(shareProperties.getMaxCodeErrors());   // 恰好第 5 次
        when(fileObjectMapper.selectById(FILE_ID)).thenReturn(readableFile());
        when(notificationPort.send(any())).thenReturn(1L);

        assertThrows(BusinessException.class,
                () -> service.verify(TOKEN, wrongCodeRequest(), CLIENT_IP, UA));

        NotificationCommand cmd = captureSingleNotification();
        assertEquals(NotifyType.SHARE_LOCKED, cmd.notifyType());
        assertEquals(OWNER, cmd.recipientUserId());
        assertEquals(SHARE_ID, cmd.bizId());
        assertTrue(cmd.content().contains(FILE_NAME));
        assertTrue(cmd.content().contains("30 分钟"), "锁定时长取配置默认值，实际文案：" + cmd.content());
    }

    @Test
    @DisplayName("提取码超过阈值：继续试探不再重复提醒，防止脚本把收件箱刷满")
    void verify_codeErrorAboveThreshold_shouldNotNotifyAgain() {
        givenWrongCodeAttempt();
        stubCodeErrors(shareProperties.getMaxCodeErrors() + 1L);
        when(fileObjectMapper.selectById(FILE_ID)).thenReturn(readableFile());

        assertThrows(BusinessException.class,
                () -> service.verify(TOKEN, wrongCodeRequest(), CLIENT_IP, UA));

        verify(notificationPort, never()).send(any());
    }

    @Test
    @DisplayName("提取码未达阈值：只计数不提醒，避免每一次输错都打扰创建者")
    void verify_codeErrorBelowThreshold_shouldNotNotify() {
        givenWrongCodeAttempt();
        stubCodeErrors(1L);

        assertThrows(BusinessException.class,
                () -> service.verify(TOKEN, wrongCodeRequest(), CLIENT_IP, UA));

        verify(notificationPort, never()).send(any());
    }

    @Test
    @DisplayName("锁定提醒回源文件名失败（文件已删）：仍提醒，文案用兜底名而非字面量 null")
    void verify_whenFileGone_shouldNotifyWithFallbackName() {
        givenWrongCodeAttempt();
        stubCodeErrors(shareProperties.getMaxCodeErrors());
        when(fileObjectMapper.selectById(FILE_ID)).thenReturn(null);
        when(notificationPort.send(any())).thenReturn(1L);

        assertThrows(BusinessException.class,
                () -> service.verify(TOKEN, wrongCodeRequest(), CLIENT_IP, UA));

        NotificationCommand cmd = captureSingleNotification();
        assertTrue(cmd.content().contains("（文件已删除）"), "实际文案：" + cmd.content());
    }

    /* ======================= 测试夹具 ======================= */

    /** 装配「一次可成功核销的取件」：票据 → 链接 → 文件 → 原子扣减放行。 */
    private ShareLink givenRedeemable(String accessType) {
        ShareLink link = activeLink();
        when(shareTicketService.redeem("ticket-1"))
                .thenReturn(new ShareTicketService.TicketPayload(SHARE_ID, FILE_ID, accessType, null));
        when(shareLinkMapper.selectById(SHARE_ID)).thenReturn(link);
        when(fileObjectMapper.selectById(FILE_ID)).thenReturn(readableFile());
        when(shareLinkMapper.consumeDownloadQuota(eq(SHARE_ID), any(LocalDateTime.class))).thenReturn(1);
        return link;
    }

    /** 装配「提取码校验失败」的前置链路（真实 BCrypt 散列 + 必然不匹配的输入）。 */
    private void givenWrongCodeAttempt() {
        ShareLink link = activeLink();
        link.setExtractCodeHash(new BCryptPasswordEncoder().encode("right-code"));
        when(shareLinkService.findByToken(TOKEN)).thenReturn(link);
    }

    private ShareLink activeLink() {
        ShareLink link = new ShareLink();
        link.setId(SHARE_ID);
        link.setToken(TOKEN);
        link.setFileId(FILE_ID);
        link.setOwnerUserId(OWNER);
        link.setStatus(ShareLink.STATUS_ACTIVE);
        link.setExpireAt(LocalDateTime.now().plusDays(1));
        link.setDownloadLimit(10);
        link.setDownloadedCount(0);
        return link;
    }

    private FileObject readableFile() {
        FileObject file = new FileObject();
        file.setId(FILE_ID);
        file.setOriginalName(FILE_NAME);
        file.setStatus(0);
        file.setSizeBytes(1024L);
        return file;
    }

    private RedeemTicketRequest redeemRequest() {
        RedeemTicketRequest request = new RedeemTicketRequest();
        request.setTicket("ticket-1");
        return request;
    }

    private VerifyShareRequest wrongCodeRequest() {
        VerifyShareRequest request = new VerifyShareRequest();
        request.setExtractCode("wrong-code");
        request.setAccessType(ShareAccessService.ACCESS_DOWNLOAD);
        return request;
    }

    /** 打桩「错误计数 INCR 脚本」的返回值（计数是服务端权威，测试只喂结果）。 */
    private void stubCodeErrors(long errors) {
        when(stringRedisTemplate.execute(ArgumentMatchers.<RedisScript<Long>>any(), anyList(), any(), any()))
                .thenReturn(errors);
    }

    private NotificationCommand captureSingleNotification() {
        ArgumentCaptor<NotificationCommand> captor = ArgumentCaptor.forClass(NotificationCommand.class);
        // verify(...) 本身即「恰好一次」
        verify(notificationPort).send(captor.capture());
        return captor.getValue();
    }
}
