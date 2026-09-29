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
package com.anttransfer.file.job;

import com.anttransfer.common.constant.RedisKeyConstants;
import com.anttransfer.common.notify.NotificationCommand;
import com.anttransfer.common.notify.NotificationPort;
import com.anttransfer.common.notify.NotifyType;
import com.anttransfer.file.config.ShareProperties;
import com.anttransfer.file.model.entity.FileObject;
import com.anttransfer.file.model.entity.ShareLink;
import com.anttransfer.file.repository.FileObjectMapper;
import com.anttransfer.file.repository.ShareLinkMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.anyInt;
import static org.mockito.Mockito.anyString;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * 外发链接「到期前提醒」定时任务的单测（{@link ShareExpireNotifyScheduler}）。
 *
 * <p>本任务是全系统里<b>唯一</b>由扫描产生的外发提醒——链接到期是静默失效，
 * 没有任何请求会触达服务端，所以它的失败模式不是「报错」而是「安静地少发一条」。
 * 测试因此围绕三条不可退让的口径展开：</p>
 * <ol>
 *   <li><b>幂等但宁重勿漏</b>：落库事实（{@code existsForBiz}）优先于 Redis 占位；
 *       占位抢不到就跳过，但<b>发送失败必须释放占位</b>，否则「占位成功 + 发送失败」= 永久漏提醒。</li>
 *   <li><b>降级只降速不失准</b>：Redis 不可用（占位抛异常）时放行发送，靠落库兜底防重。</li>
 *   <li><b>单条失败不中断整批</b>：一条脏数据不能让后面所有链接都收不到提醒。</li>
 * </ol>
 *
 * <p>纯 POJO + Mockito，不起 Spring 上下文。</p>
 *
 * @author AntTransfer CE
 */
class ShareExpireNotifySchedulerTest {

    private static final long OWNER = 7L;
    private static final long FILE_ID = 99L;
    private static final LocalDateTime EXPIRE_AT = LocalDateTime.of(2026, 9, 30, 18, 0);
    private static final String EXPIRED_TEXT = "2026-09-30 18:00";

    private ShareLinkMapper shareLinkMapper;
    private FileObjectMapper fileObjectMapper;
    private ShareProperties shareProperties;
    private NotificationPort notificationPort;
    private StringRedisTemplate stringRedisTemplate;
    private ValueOperations<String, String> valueOps;

    private ShareExpireNotifyScheduler scheduler;

    @BeforeEach
    void setUp() {
        shareLinkMapper = mock(ShareLinkMapper.class);
        fileObjectMapper = mock(FileObjectMapper.class);
        shareProperties = new ShareProperties();
        notificationPort = mock(NotificationPort.class);
        stringRedisTemplate = mock(StringRedisTemplate.class);

        @SuppressWarnings("unchecked")
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        valueOps = ops;
        when(stringRedisTemplate.opsForValue()).thenReturn(ops);

        scheduler = new ShareExpireNotifyScheduler(shareLinkMapper, fileObjectMapper, shareProperties,
                notificationPort, stringRedisTemplate);
    }

    @Test
    @DisplayName("扫描命中候选：逐条给创建者发 SHARE_EXPIRE_SOON，文案含文件名与到期时刻")
    void notifyExpiringSoon_shouldNotifyEveryCandidate() {
        givenCandidates(link(1L), link(2L));
        givenMarkAcquired();
        when(fileObjectMapper.selectById(FILE_ID)).thenReturn(file("合同.pdf"));
        when(notificationPort.send(any())).thenReturn(1L);

        scheduler.notifyExpiringSoon();

        ArgumentCaptor<NotificationCommand> captor = ArgumentCaptor.forClass(NotificationCommand.class);
        verify(notificationPort, times(2)).send(captor.capture());
        for (NotificationCommand cmd : captor.getAllValues()) {
            assertEquals(NotifyType.SHARE_EXPIRE_SOON, cmd.notifyType());
            assertEquals(OWNER, cmd.recipientUserId());
            assertEquals(NotificationCommand.BIZ_SHARE, cmd.bizType());
            assertTrue(cmd.content().contains("合同.pdf"));
            assertTrue(cmd.content().contains(EXPIRED_TEXT), "实际文案：" + cmd.content());
        }
    }

    @Test
    @DisplayName("落库事实已在：不再重复提醒，连幂等占位都不去抢")
    void notifyExpiringSoon_whenAlreadyNotified_shouldSkipBeforeMark() {
        givenCandidates(link(1L));
        when(notificationPort.existsForBiz(NotificationCommand.BIZ_SHARE, 1L, NotifyType.SHARE_EXPIRE_SOON))
                .thenReturn(true);

        scheduler.notifyExpiringSoon();

        verify(notificationPort, never()).send(any());
        verifyNoInteractions(stringRedisTemplate);
    }

    @Test
    @DisplayName("幂等占位抢不到（并发 / 同窗口已发）：跳过发送")
    void notifyExpiringSoon_whenMarkNotAcquired_shouldSkip() {
        givenCandidates(link(1L));
        when(valueOps.setIfAbsent(anyString(), eq("1"), any(Duration.class))).thenReturn(false);

        scheduler.notifyExpiringSoon();

        verify(notificationPort, never()).send(any());
    }

    @Test
    @DisplayName("发送失败必须释放占位：否则下一轮永远抢不到，提醒被静默漏掉")
    void notifyExpiringSoon_whenSendFails_shouldReleaseMarkForRetry() {
        givenCandidates(link(1L));
        givenMarkAcquired();
        when(notificationPort.send(any())).thenReturn(null);

        scheduler.notifyExpiringSoon();

        verify(stringRedisTemplate).delete(RedisKeyConstants.SHARE_EXPIRE_NOTIFY_PREFIX + 1L);
    }

    @Test
    @DisplayName("发送成功后不释放占位：本链接在幂等窗口内不再打扰")
    void notifyExpiringSoon_whenSendSucceeds_shouldKeepMark() {
        givenCandidates(link(1L));
        givenMarkAcquired();
        when(fileObjectMapper.selectById(FILE_ID)).thenReturn(file("合同.pdf"));
        when(notificationPort.send(any())).thenReturn(1L);

        scheduler.notifyExpiringSoon();

        verify(stringRedisTemplate, never()).delete(anyString());
    }

    @Test
    @DisplayName("Redis 占位不可用（P-8 降级）：放行发送，防重交给落库兜底")
    void notifyExpiringSoon_whenRedisUnavailable_shouldStillSend() {
        givenCandidates(link(1L));
        when(valueOps.setIfAbsent(anyString(), eq("1"), any(Duration.class)))
                .thenThrow(new RuntimeException("redis down"));
        when(fileObjectMapper.selectById(FILE_ID)).thenReturn(file("合同.pdf"));
        when(notificationPort.send(any())).thenReturn(1L);

        scheduler.notifyExpiringSoon();

        verify(notificationPort).send(any());
    }

    @Test
    @DisplayName("扫描失败：本轮整体跳过，不产生任何通知（下轮会重新扫到同一批，不会漏）")
    void notifyExpiringSoon_whenScanFails_shouldSkipWholeRound() {
        when(shareLinkMapper.selectExpiringActive(any(LocalDateTime.class), any(LocalDateTime.class), anyInt()))
                .thenThrow(new RuntimeException("db down"));

        scheduler.notifyExpiringSoon();

        verify(notificationPort, never()).send(any());
        verifyNoInteractions(stringRedisTemplate);
    }

    @Test
    @DisplayName("没有候选：整轮零副作用，不碰 Redis 也不碰通知域")
    void notifyExpiringSoon_whenNoCandidate_shouldStaySilent() {
        givenCandidates();

        scheduler.notifyExpiringSoon();

        verify(notificationPort, never()).send(any());
        verifyNoInteractions(stringRedisTemplate);
    }

    @Test
    @DisplayName("无归属链接（历史脏数据）：无人可提醒，跳过且不占据位")
    void notifyExpiringSoon_whenOwnerUnknown_shouldSkip() {
        ShareLink orphan = link(1L);
        orphan.setOwnerUserId(null);
        givenCandidates(orphan);

        scheduler.notifyExpiringSoon();

        verify(notificationPort, never()).send(any());
        verifyNoInteractions(stringRedisTemplate);
    }

    @Test
    @DisplayName("单条失败不中断整批：前一条抛异常，后一条仍要发出去")
    void notifyExpiringSoon_whenOneLinkFails_shouldContinueRemaining() {
        givenCandidates(link(1L), link(2L));
        givenMarkAcquired();
        when(fileObjectMapper.selectById(FILE_ID)).thenReturn(file("合同.pdf"));
        when(notificationPort.send(any()))
                .thenThrow(new RuntimeException("notify boom"))
                .thenReturn(1L);

        scheduler.notifyExpiringSoon();

        ArgumentCaptor<NotificationCommand> captor = ArgumentCaptor.forClass(NotificationCommand.class);
        verify(notificationPort, times(2)).send(captor.capture());
        assertEquals(2L, captor.getAllValues().get(1).bizId(), "第二条不应被前一条的失败带停");
        // 失败那条的占位要释放，成功那条保留
        verify(stringRedisTemplate).delete(RedisKeyConstants.SHARE_EXPIRE_NOTIFY_PREFIX + 1L);
    }

    /* ======================= 测试夹具 ======================= */

    private void givenCandidates(ShareLink... links) {
        when(shareLinkMapper.selectExpiringActive(any(LocalDateTime.class), any(LocalDateTime.class), anyInt()))
                .thenReturn(List.of(links));
    }

    private void givenMarkAcquired() {
        when(valueOps.setIfAbsent(anyString(), eq("1"), any(Duration.class))).thenReturn(true);
    }

    private ShareLink link(long id) {
        ShareLink link = new ShareLink();
        link.setId(id);
        link.setToken("tok-" + id);
        link.setFileId(FILE_ID);
        link.setOwnerUserId(OWNER);
        link.setStatus(ShareLink.STATUS_ACTIVE);
        link.setExpireAt(EXPIRE_AT);
        return link;
    }

    private FileObject file(String name) {
        FileObject file = new FileObject();
        file.setId(FILE_ID);
        file.setOriginalName(name);
        file.setStatus(0);
        return file;
    }
}
