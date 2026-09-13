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

import com.anttransfer.common.constant.RedisKeyConstants;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * 跨实例 WS 帧广播器——把「发给某用户」的帧投到 {@code at:ws:channel}。
 *
 * <p><b>为什么一律走 Redis，即使目标用户就在本机：</b>若先判本机在线就直接本地投递，
 * 就必须回答「本机没有该用户时，是否还要广播」——而本机没有 ≠ 全局没有，
 * 于是永远无法省略广播。干脆统一「先广播、由各实例筛选」这一条路径：
 * 只有一个代码分支、只有一种时序，滚动发布期间新旧实例也互不影响
 * （订阅端只认 {@code userId}，帧体不透明转发，见 {@link WsDelivery}）。</p>
 *
 * <p><b>代价与取舍：</b>多一次 Redis 往返（毫秒级）。换来的是「单实例与集群行为完全一致」——
 * 本地开发不会掩盖集群才暴露的 bug，这是这类功能最常见的翻车点。</p>
 *
 * <p><b>失败语义：</b>Redis 不可用时广播失败 → 仅记 WARN。消息<b>已在库中</b>，
 * 在线用户会退化为「下次连接补拉」，不丢消息；绝不因推送失败回滚业务事务。</p>
 *
 * @author AntTransfer CE
 */
@Component
public class WsBroadcaster {

    private static final Logger log = LoggerFactory.getLogger(WsBroadcaster.class);

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public WsBroadcaster(StringRedisTemplate redisTemplate, ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * 广播一帧给指定用户（其所有在线实例上的所有连接都会收到）。
     *
     * @param userId 目标用户 ID（为空直接忽略——系统通知允许无接收人时由调用方过滤）
     * @param frame  帧体
     */
    public void push(Long userId, WsFrame frame) {
        if (userId == null || frame == null) {
            return;
        }
        try {
            WsDelivery delivery = new WsDelivery(userId, objectMapper.valueToTree(frame));
            redisTemplate.convertAndSend(RedisKeyConstants.WS_CHANNEL,
                    objectMapper.writeValueAsString(delivery));
        } catch (Exception e) {
            // 消息已落库，推送失败只影响「实时性」，不影响「可查性」
            log.warn("WS 帧广播失败（消息已落库，将经补拉获得）：userId={}, type={}, cause={}",
                    userId, frame.type(), e.getMessage());
        }
    }
}
