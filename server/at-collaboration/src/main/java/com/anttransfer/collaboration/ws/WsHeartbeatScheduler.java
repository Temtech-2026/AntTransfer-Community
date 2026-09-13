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
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

/**
 * 心跳调度：每 {@code heartbeat-interval-seconds}（默认 30s）探测一次，并清理超时连接。
 *
 * <p><b>为什么需要服务端主动探测，而不是只靠客户端：</b>TCP 对「对端断电 / 断网 / 拔网线」
 * 是无感的——不会收到 FIN/RST，连接会一直处于 ESTABLISHED，服务端注册表持续累积僵尸会话，
 * 推送一直「成功」却永远送不到。只有服务端按「最近活跃时间」主动判定，才能把僵尸清出去。</p>
 *
 * <p><b>心跳为什么走注册表广播而不是一个个发：</b>探测帧内容完全相同（仅 {@code ts} 不同），
 * 逐连接序列化纯属浪费；注册表内部按用户逐个投递，但仍复用同一份 JSON，
 * 且发送失败会自动注销坏连接，与业务推送共用同一条健壮性路径。</p>
 *
 * <p><b>清理与探测的顺序：</b>先探测再清理。反过来的话，一条刚好在本次超时判定前
 * 收到 PONG 的连接可能被误清；先发 PING（刷新不了自己的活跃时间，只有对端回帧才算），
 * 再按「清理时刻 - 超时」判定，语义更直观。</p>
 *
 * <p><b>集群注意：</b>每个实例只清理<b>本机</b>连接——Redis 广播的作用域是「发帧给用户」，
 * 而心跳是「实例 ↔ 自己持有的连接」的局部事实，无需也不应跨实例协调。</p>
 *
 * @author AntTransfer CE
 */
@Component
public class WsHeartbeatScheduler {

    private static final Logger log = LoggerFactory.getLogger(WsHeartbeatScheduler.class);

    private final WsSessionRegistry registry;
    private final WsProperties properties;
    private final ObjectMapper objectMapper;

    public WsHeartbeatScheduler(WsSessionRegistry registry,
                                WsProperties properties,
                                ObjectMapper objectMapper) {
        this.registry = registry;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    /**
     * 心跳任务。
     *
     * <p>{@code fixedDelay}（非 {@code fixedRate}）：上一轮执行完再等一个间隔，
     * 避免连接数极多时任务重叠执行、把心跳线程池打满。</p>
     */
    @Scheduled(fixedDelayString = "${anttransfer.collaboration.ws.heartbeat-interval-seconds:30}",
            timeUnit = TimeUnit.SECONDS)
    public void heartbeat() {
        int active = registry.localSessionCount();
        if (active == 0) {
            // 空跑直接返回：绝大多数单体实例在没有用户时无需构造探测帧
            return;
        }
        sendPing();
        int evicted = registry.evictIdle(properties.getHeartbeatTimeoutSeconds() * 1000L);
        if (evicted > 0) {
            log.info("WS 心跳：探测 {} 条连接，清理超时 {} 条", active, evicted);
        } else {
            log.debug("WS 心跳：探测 {} 条连接，无超时", active);
        }
    }

    private void sendPing() {
        try {
            registry.broadcastToAllLocal(
                    objectMapper.writeValueAsString(WsFrame.signal(WsProtocol.TYPE_PING)));
        } catch (Exception e) {
            // 序列化失败属程序错误，但不该让整个心跳任务停摆（下次照常）
            log.warn("WS 心跳探测帧构造失败：cause={}", e.getMessage());
        }
    }
}
