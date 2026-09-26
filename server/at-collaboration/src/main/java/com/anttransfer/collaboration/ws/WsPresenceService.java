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

import com.anttransfer.collaboration.config.WsProperties;
import com.anttransfer.collaboration.model.vo.ChatPresenceStatus;
import com.anttransfer.collaboration.model.vo.ChatPresenceVO;
import com.anttransfer.common.constant.RedisKeyConstants;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * 在线状态服务：把「这条连接还活着吗」的 WS 通道事实，翻译成对端可见的三态。
 *
 * <p><b>为什么权威记录必须放 Redis，而不是复用 {@link WsSessionRegistry}：</b>
 * 会话注册表刻意只记「本机连接」（见其类注：它不作为在线状态的权威源，因为「本机没有」
 * 不等于「全局没有」）。而「A 在不在线」是一个<b>跨实例</b>的事实——A 连在实例 1、
 * B 连在实例 2 时，B 必须能看到 A 的绿点。因此三态的载体是 Redis 里的活跃记录，
 * 每个实例只负责续期「自己这侧」的活跃时刻。</p>
 *
 * <p><b>续期时机（写入方）：</b>
 * <ul>
 *     <li>握手成功：{@code WsNotifyHandler#afterConnectionEstablished}；</li>
 *     <li>每个上行帧：{@code WsNotifyHandler#handleTextMessage}——注意这包括客户端对服务端
 *         心跳探测的 {@code PONG} 应答，所以浏览器把后台标签页的定时器降频到 1 次/分钟时，
 *         活跃时刻依然由「探测→应答」这条链路保持新鲜，不会误判弱网；</li>
 *     <li>连接关闭：不在本方法续期，而是走 {@link #markOffline} 显式清除。</li>
 * </ul></p>
 *
 * <p><b>三态判定只用「本地时钟 + 活跃时刻」，没有第二处真相：</b>
 * 键不存在 → {@code OFFLINE}；活跃时刻在健康窗口内 → {@code ONLINE}；否则 {@code UNSTABLE}。
 * 于是「心跳超时判死」（{@link WsHeartbeatScheduler}）与「状态点变灰」共用同一时间窗口，
 * 不可能出现「界面说在线、其实连接已被清理」的窗口期。</p>
 *
 * <p><b>推送只在状态迁移时发生：</b>续期是每 30s 一次的高频动作，若每次都广播，等于给每个
 * 正在看会话的人每 30s 发一帧噪声。故 {@link #markActive} 先读旧值、算出旧状态，
 * 仅当「从无到有」（上线）或「由不健康回到健康」（弱网恢复）时才推。</p>
 *
 * <p><b>降级规则（P-8：Redis 为加速，不是正确性裁决）：</b>本类所有方法在 Redis 异常时
 * 一律不外抛——续期失败仅记 WARN（消息收发必须照常），查询失败按 {@code OFFLINE} 返回
 * （「无法确认在线」与「离线」在 UI 上是同一个灰点：都不承诺实时可达）。
 * 绝不因为状态点取不到而让会话功能报错。</p>
 *
 * <p><b>已知边界：</b>连接关闭时的清除是「本机无该用户其他连接才清」。若同一用户在多实例
 * 各有一条连接，先关的那台会误清一次，由另一条连接的下一次心跳（≤30s）自动写回。
 * 单实例部署（当前 Compose 基线）下不存在该窗口；集群下表现为「对方状态可能闪一次灰」，
 * 属可自愈的显示抖动，不影响任何消息路径。</p>
 *
 * @author AntTransfer CE
 */
@Component
public class WsPresenceService {

    private static final Logger log = LoggerFactory.getLogger(WsPresenceService.class);

    private final StringRedisTemplate redisTemplate;
    private final WsProperties properties;
    private final WsBroadcaster broadcaster;

    public WsPresenceService(StringRedisTemplate redisTemplate, WsProperties properties,
                             WsBroadcaster broadcaster) {
        this.redisTemplate = redisTemplate;
        this.properties = properties;
        this.broadcaster = broadcaster;
    }

    /**
     * 续期某用户的活跃时刻（握手成功、以及每个上行帧调用）。
     *
     * <p>仅在状态发生迁移时向订阅者推送：无记录 → 上线；旧记录已超出健康窗口 → 弱网恢复。
     * 旧记录仍健康（正常心跳）时不推。</p>
     *
     * @param userId 用户 ID
     */
    public void markActive(long userId) {
        long now = System.currentTimeMillis();
        try {
            String key = RedisKeyConstants.wsPresenceKey(userId);
            String previous = redisTemplate.opsForValue().get(key);
            redisTemplate.opsForValue().set(key, Long.toString(now),
                    properties.getHeartbeatTimeoutSeconds(), TimeUnit.SECONDS);

            Long previousActiveAt = parseMillis(previous);
            if (previousActiveAt == null
                    || statusOf(previousActiveAt, now) != ChatPresenceStatus.ONLINE) {
                notifyWatchers(userId, ChatPresenceStatus.ONLINE, now);
            }
        } catch (Exception e) {
            // 状态点是加速事实，绝不能因为 Redis 抖动而影响消息收发（P-8）
            log.warn("在线状态续期失败（仅影响状态点显示）：userId={}, cause={}", userId, e.getMessage());
        }
    }

    /**
     * 清除某用户的在线记录（连接关闭、且本机已无该用户的其他连接时调用）。
     *
     * <p>只在<b>确实删掉了一条活跃记录</b>时推送 {@code OFFLINE}：记录本就不存在时状态已是
     * 离线（多标签页连续关闭、或连接被判死后才走到这里），重复广播没有意义。</p>
     *
     * @param userId 用户 ID
     */
    public void markOffline(long userId) {
        try {
            Boolean removed = redisTemplate.delete(RedisKeyConstants.wsPresenceKey(userId));
            if (!Boolean.TRUE.equals(removed)) {
                return;
            }
            notifyWatchers(userId, ChatPresenceStatus.OFFLINE, null);
        } catch (Exception e) {
            log.warn("在线状态清除失败（记录将随心跳超时自然过期）：userId={}, cause={}",
                    userId, e.getMessage());
        }
    }

    /**
     * 读取某用户此刻的在线三态。
     *
     * @param userId 用户 ID
     * @return 状态视图；无记录或 Redis 异常均为 {@code OFFLINE}（{@code lastActiveAt} 为 null）
     */
    public ChatPresenceVO status(long userId) {
        try {
            Long activeAt = readActiveAt(userId);
            if (activeAt == null) {
                return new ChatPresenceVO(userId, ChatPresenceStatus.OFFLINE, null);
            }
            return new ChatPresenceVO(userId, statusOf(activeAt, System.currentTimeMillis()), activeAt);
        } catch (Exception e) {
            log.warn("在线状态读取失败（按离线返回）：userId={}, cause={}", userId, e.getMessage());
            return new ChatPresenceVO(userId, ChatPresenceStatus.OFFLINE, null);
        }
    }

    /**
     * 声明「我正在看着 targetId 的会话」，并立即返回其当前状态。
     *
     * <p>订阅关系是<b>状态变更推送的投递名单</b>：没有订阅就不会收到 {@code PRESENCE} 帧，
     * 只能靠轮询。客户端在会话打开期间每 30s 续订一次（{@code WS_PRESENCE_WATCH_TTL_SECONDS}
     * 是续订窗口），关闭会话即停止续订、订阅自然过期。</p>
     *
     * <p>本方法同时充当「读取状态」的入口：订阅与读取合并为一次往返，客户端一个调用就够——
     * 分成两个端点只会让客户端每次都发两个请求，且订阅与否与「要不要显示状态点」永远是同一个决定。</p>
     *
     * @param watcherId 订阅者（看的人）用户 ID
     * @param targetId  被观察者（被看的人）用户 ID
     * @return 被观察者当前状态（Redis 异常时按 {@code OFFLINE} 返回，见类注降级规则）
     */
    public ChatPresenceVO watch(long watcherId, long targetId) {
        try {
            String key = RedisKeyConstants.wsPresenceWatchKey(targetId);
            redisTemplate.opsForZSet().add(key, Long.toString(watcherId),
                    System.currentTimeMillis());
            redisTemplate.expire(key, RedisKeyConstants.WS_PRESENCE_WATCH_TTL_SECONDS,
                    TimeUnit.SECONDS);
        } catch (Exception e) {
            log.warn("在线状态订阅失败（本次只读不回推，下次轮询重试）：watcherId={}, targetId={}, cause={}",
                    watcherId, targetId, e.getMessage());
        }
        return status(targetId);
    }

    /** 活跃记录里的最近活跃时刻；无记录返回 null。 */
    private Long readActiveAt(long userId) {
        return parseMillis(redisTemplate.opsForValue().get(RedisKeyConstants.wsPresenceKey(userId)));
    }

    /**
     * 向「仍在续订窗口内」的订阅者推送状态帧。
     *
     * <p>订阅集合是 ZSET（成员=订阅者，分值=最近续订时刻），因此这里按分值过滤即可得到
     * 有效名单——过期的成员只是不再被选中，无需清理（键级 TTL 兜底回收整键）。</p>
     */
    private void notifyWatchers(long userId, ChatPresenceStatus status, Long lastActiveAt) {
        Set<Long> watchers = watchersOf(userId);
        if (watchers.isEmpty()) {
            return;
        }
        ChatPresenceVO payload = new ChatPresenceVO(userId, status, lastActiveAt);
        for (Long watcher : watchers) {
            if (watcher != null && watcher != userId) {
                // 防御：自聊在入口即被拒（ChatService），订阅集合理论上不含被观察者本人；
                // 真出现时跳过，免得把自己的状态变化帧发给自己
                broadcaster.push(watcher, WsFrame.of(WsProtocol.TYPE_PRESENCE, payload));
            }
        }
    }

    /** 仍在续订窗口内的订阅者 ID 集合（ZSET 按分值区间取，过期的自然不在结果里）。 */
    private Set<Long> watchersOf(long targetId) {
        long expireBefore = System.currentTimeMillis()
                - RedisKeyConstants.WS_PRESENCE_WATCH_TTL_SECONDS * 1000L;
        Set<String> members = redisTemplate.opsForZSet().rangeByScore(
                RedisKeyConstants.wsPresenceWatchKey(targetId), expireBefore, Double.MAX_VALUE);
        if (members == null || members.isEmpty()) {
            return Set.of();
        }
        Set<Long> watchers = new LinkedHashSet<>(members.size());
        for (String member : members) {
            Long watcher = parseMillis(member);
            if (watcher != null) {
                watchers.add(watcher);
            }
        }
        return watchers;
    }

    /** 三态判定：活跃时刻距今不超过健康窗口即在线，否则「连接还在但心跳迟到」＝网络不佳。 */
    private ChatPresenceStatus statusOf(long activeAt, long now) {
        long healthyMillis = properties.getPresenceHealthySeconds() * 1000L;
        return now - activeAt <= healthyMillis
                ? ChatPresenceStatus.ONLINE
                : ChatPresenceStatus.UNSTABLE;
    }

    /** 宽松解析毫秒时间戳：非数字（脏数据 / 手工写入）一律按「无记录」处理，不让状态点 500。 */
    private static Long parseMillis(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(raw.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
