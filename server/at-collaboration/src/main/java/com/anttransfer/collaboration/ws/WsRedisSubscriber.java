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

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;

import java.nio.charset.StandardCharsets;

/**
 * {@code at:ws:channel} 订阅者——把广播帧「过滤出本机连接的用户」并投递。
 *
 * <p>这是需求「多实例广播，收到消息后<b>只推给本机连接用户</b>」的落点：
 * 每个实例都收到全量广播，但只有「目标用户在本机有连接」的实例会真正写出网络帧，
 * 其余实例静默丢弃（{@link WsSessionRegistry#sendToLocal} 返回 0，属预期路径不告警）。</p>
 *
 * <p><b>幂等 / 顺序：</b>Redis Pub/Sub 是 at-most-once（不持久化、不重投），
 * 因此不存在「同一帧被投递两次」的正常路径；若实例重启期间有广播，那些帧直接丢失——
 * 这正是「离线补拉」存在的意义（{@code GET /v1/notifications/offline}）。
 * 顺序上，Redis 单频道内保序，跨实例出帧顺序可能与入库顺序略有偏差，
 * 故帧内携带 {@code ts}，客户端按需做乱序丢弃。</p>
 *
 * <p><b>异常隔离：</b>反序列化失败（如收到非本协议报文 / 版本不兼容）只记 WARN 并丢弃当前帧，
 * 绝不向上抛——{@code RedisMessageListenerContainer} 在监听器抛异常时会持续重试/刷日志，
 * 一条脏消息会拖垮整个订阅通道。</p>
 *
 * @author AntTransfer CE
 */
public class WsRedisSubscriber implements MessageListener {

    private static final Logger log = LoggerFactory.getLogger(WsRedisSubscriber.class);

    private final WsSessionRegistry registry;
    private final ObjectMapper objectMapper;

    public WsRedisSubscriber(WsSessionRegistry registry, ObjectMapper objectMapper) {
        this.registry = registry;
        this.objectMapper = objectMapper;
    }

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String body = new String(message.getBody(), StandardCharsets.UTF_8);
        WsDelivery delivery;
        try {
            delivery = objectMapper.readValue(body, WsDelivery.class);
        } catch (Exception e) {
            log.warn("WS 广播报文解析失败，已丢弃该帧：cause={}", e.getMessage());
            return;
        }
        if (delivery.frame() == null) {
            return;
        }
        try {
            String json = objectMapper.writeValueAsString(delivery.frame());
            if (delivery.userId() == null) {
                // 全员广播（userId 为 null）：投给本机所有连接，不做用户筛选。
                // 旧实例收到这类报文会走上面那条 `frame == null` 之外的旧分支被丢弃，
                // 属滚动发布期间的可接受降级（那几端等下次拉取时更新）。
                registry.broadcastToAllLocal(json);
            } else {
                // 只对本机连接的该用户投递；不在本机 → 返回 0（正常，无需日志噪音）
                registry.sendToLocal(delivery.userId(), json);
            }
        } catch (Exception e) {
            log.warn("WS 本地投递失败：userId={}, cause={}", delivery.userId(), e.getMessage());
        }
    }
}
