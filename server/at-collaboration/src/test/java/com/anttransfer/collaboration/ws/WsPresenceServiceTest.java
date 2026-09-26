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
package com.anttransfer.collaboration.ws;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.anttransfer.collaboration.config.WsProperties;
import com.anttransfer.collaboration.model.vo.ChatPresenceStatus;
import com.anttransfer.collaboration.model.vo.ChatPresenceVO;
import com.anttransfer.common.constant.RedisKeyConstants;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.ZSetOperations;

/**
 * 在线状态服务单测。
 *
 * <p>覆盖四条口径：<b>三态判定</b>（无记录=离线 / 活跃新鲜=在线 / 活跃迟到=网络不佳）、
 * <b>迁移才推送</b>（正常心跳不推，上线与弱网恢复才推）、<b>清除只在真删到记录时广播</b>
 * （避免多标签页连续关闭时重复广播）、以及<b>Redis 异常一律降级不外抛</b>
 * （状态点是加速事实，不能影响消息收发）。</p>
 *
 * @author AntTransfer CE
 */
@ExtendWith(MockitoExtension.class)
class WsPresenceServiceTest {

    private static final long USER_ID = 900000000000000001L;
    private static final long WATCHER_ID = 900000000000000002L;
    /** 心跳超时（秒）：活跃记录的 TTL，与「连接判死」窗口同源 */
    private static final int HEARTBEAT_TIMEOUT_SECONDS = 90;
    /** 健康阈值（秒）：1.5 × 心跳间隔 */
    private static final int HEALTHY_SECONDS = 45;

    @Mock
    private StringRedisTemplate redisTemplate;
    @Mock
    private ValueOperations<String, String> valueOperations;
    @Mock
    private ZSetOperations<String, String> zSetOperations;
    @Mock
    private WsProperties properties;
    @Mock
    private WsBroadcaster broadcaster;

    private WsPresenceService service;

    @BeforeEach
    void setUp() {
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        lenient().when(redisTemplate.opsForZSet()).thenReturn(zSetOperations);
        lenient().when(properties.getHeartbeatTimeoutSeconds()).thenReturn(HEARTBEAT_TIMEOUT_SECONDS);
        lenient().when(properties.getPresenceHealthySeconds()).thenReturn(HEALTHY_SECONDS);
        service = new WsPresenceService(redisTemplate, properties, broadcaster);
    }

    @Test
    @DisplayName("首次活跃（无记录＝上线）：写活跃记录（TTL 与心跳超时同源），并给订阅者推 ONLINE")
    void markActiveFirstTimePushesOnline() {
        when(valueOperations.get(RedisKeyConstants.wsPresenceKey(USER_ID))).thenReturn(null);
        when(zSetOperations.rangeByScore(eq(RedisKeyConstants.wsPresenceWatchKey(USER_ID)),
                anyDouble(), anyDouble())).thenReturn(Set.of(String.valueOf(WATCHER_ID)));

        service.markActive(USER_ID);

        verify(valueOperations).set(eq(RedisKeyConstants.wsPresenceKey(USER_ID)), anyString(),
                eq((long) HEARTBEAT_TIMEOUT_SECONDS), eq(TimeUnit.SECONDS));
        assertThat(capturedPresence(USER_ID).status()).isEqualTo(ChatPresenceStatus.ONLINE);
    }

    @Test
    @DisplayName("正常心跳续期（旧活跃仍在健康窗口内）：只续期，不推送——否则每 30s 一帧纯噪声")
    void markActiveKeepsQuietWhenStillHealthy() {
        when(valueOperations.get(RedisKeyConstants.wsPresenceKey(USER_ID)))
                .thenReturn(String.valueOf(System.currentTimeMillis() - 5_000L));

        service.markActive(USER_ID);

        verify(valueOperations).set(eq(RedisKeyConstants.wsPresenceKey(USER_ID)), anyString(),
                eq((long) HEARTBEAT_TIMEOUT_SECONDS), eq(TimeUnit.SECONDS));
        verify(broadcaster, never()).push(any(), any());
    }

    @Test
    @DisplayName("弱网恢复（旧活跃已超出健康窗口）：续期并补推 ONLINE，让对端红点及时回绿")
    void markActivePushesOnlineAfterUnstable() {
        long staleActiveAt = System.currentTimeMillis() - (HEALTHY_SECONDS + 10) * 1000L;
        when(valueOperations.get(RedisKeyConstants.wsPresenceKey(USER_ID)))
                .thenReturn(String.valueOf(staleActiveAt));
        when(zSetOperations.rangeByScore(eq(RedisKeyConstants.wsPresenceWatchKey(USER_ID)),
                anyDouble(), anyDouble())).thenReturn(Set.of(String.valueOf(WATCHER_ID)));

        service.markActive(USER_ID);

        assertThat(capturedPresence(USER_ID).status()).isEqualTo(ChatPresenceStatus.ONLINE);
    }

    @Test
    @DisplayName("清除在线记录：推 OFFLINE，且不编造 lastActiveAt（离线就是没有活跃时刻）")
    void markOfflinePushesOffline() {
        when(redisTemplate.delete(RedisKeyConstants.wsPresenceKey(USER_ID))).thenReturn(true);
        when(zSetOperations.rangeByScore(eq(RedisKeyConstants.wsPresenceWatchKey(USER_ID)),
                anyDouble(), anyDouble())).thenReturn(Set.of(String.valueOf(WATCHER_ID)));

        service.markOffline(USER_ID);

        ChatPresenceVO payload = capturedPresence(USER_ID);
        assertThat(payload.status()).isEqualTo(ChatPresenceStatus.OFFLINE);
        assertThat(payload.lastActiveAt()).isNull();
    }

    @Test
    @DisplayName("清除时记录已不存在（多标签页连续关闭 / 已随心跳超时过期）：不重复广播")
    void markOfflineStaysQuietWhenNothingRemoved() {
        when(redisTemplate.delete(RedisKeyConstants.wsPresenceKey(USER_ID))).thenReturn(false);

        service.markOffline(USER_ID);

        verify(broadcaster, never()).push(any(), any());
    }

    @Test
    @DisplayName("三态判定：无记录＝离线、活跃新鲜＝在线、活跃迟到＝网络不佳")
    void statusResolvesThreeStates() {
        when(valueOperations.get(RedisKeyConstants.wsPresenceKey(USER_ID))).thenReturn(null);
        assertThat(service.status(USER_ID).status()).isEqualTo(ChatPresenceStatus.OFFLINE);
        assertThat(service.status(USER_ID).lastActiveAt()).isNull();

        long fresh = System.currentTimeMillis() - 10_000L;
        when(valueOperations.get(RedisKeyConstants.wsPresenceKey(USER_ID)))
                .thenReturn(String.valueOf(fresh));
        ChatPresenceVO online = service.status(USER_ID);
        assertThat(online.status()).isEqualTo(ChatPresenceStatus.ONLINE);
        assertThat(online.lastActiveAt()).isEqualTo(fresh);

        when(valueOperations.get(RedisKeyConstants.wsPresenceKey(USER_ID)))
                .thenReturn(String.valueOf(System.currentTimeMillis() - 60_000L));
        assertThat(service.status(USER_ID).status()).isEqualTo(ChatPresenceStatus.UNSTABLE);
    }

    @Test
    @DisplayName("脏数据（活跃记录不是时间戳）：按离线处理，不让状态点把接口打成 500")
    void statusTreatsGarbageAsOffline() {
        when(valueOperations.get(RedisKeyConstants.wsPresenceKey(USER_ID))).thenReturn("not-a-millis");

        assertThat(service.status(USER_ID).status()).isEqualTo(ChatPresenceStatus.OFFLINE);
    }

    @Test
    @DisplayName("Redis 异常降级：续期不外抛（消息收发必须照常），读取按离线返回")
    void degradesWithoutThrowingWhenRedisFails() {
        when(valueOperations.get(anyString())).thenThrow(new RuntimeException("redis down"));

        service.markActive(USER_ID);
        service.markOffline(USER_ID);

        assertThat(service.status(USER_ID).status()).isEqualTo(ChatPresenceStatus.OFFLINE);
    }

    @Test
    @DisplayName("订阅：写入订阅名单（分值=续订时刻）并续期整键 TTL，同时返回对端当前状态")
    void watchRegistersSubscriberAndReturnsStatus() {
        when(valueOperations.get(RedisKeyConstants.wsPresenceKey(USER_ID)))
                .thenReturn(String.valueOf(System.currentTimeMillis()));

        ChatPresenceVO status = service.watch(WATCHER_ID, USER_ID);

        verify(zSetOperations).add(eq(RedisKeyConstants.wsPresenceWatchKey(USER_ID)),
                eq(String.valueOf(WATCHER_ID)), anyDouble());
        verify(redisTemplate).expire(eq(RedisKeyConstants.wsPresenceWatchKey(USER_ID)),
                eq(RedisKeyConstants.WS_PRESENCE_WATCH_TTL_SECONDS), eq(TimeUnit.SECONDS));
        assertThat(status.status()).isEqualTo(ChatPresenceStatus.ONLINE);
    }

    @Test
    @DisplayName("推送名单：只按「续订窗口内」取成员，并跳过被观察者本人（防御自订阅）")
    void notifyWatchersSkipsObservedUser() {
        when(valueOperations.get(RedisKeyConstants.wsPresenceKey(USER_ID))).thenReturn(null);
        when(zSetOperations.rangeByScore(eq(RedisKeyConstants.wsPresenceWatchKey(USER_ID)),
                anyDouble(), anyDouble()))
                .thenReturn(Set.of(String.valueOf(USER_ID), String.valueOf(WATCHER_ID)));

        service.markActive(USER_ID);

        ArgumentCaptor<Long> recipients = ArgumentCaptor.forClass(Long.class);
        verify(broadcaster).push(recipients.capture(), any());
        assertThat(recipients.getValue()).isEqualTo(WATCHER_ID);
    }

    /** 抓取推给观察者的 PRESENCE 帧载荷（并顺带校验帧类型）。 */
    private ChatPresenceVO capturedPresence(long observedUserId) {
        ArgumentCaptor<WsFrame> frames = ArgumentCaptor.forClass(WsFrame.class);
        verify(broadcaster).push(eq(WATCHER_ID), frames.capture());
        WsFrame frame = frames.getValue();
        assertThat(frame.type()).isEqualTo(WsProtocol.TYPE_PRESENCE);
        ChatPresenceVO payload = (ChatPresenceVO) frame.data();
        assertThat(payload.userId()).isEqualTo(observedUserId);
        return payload;
    }
}
