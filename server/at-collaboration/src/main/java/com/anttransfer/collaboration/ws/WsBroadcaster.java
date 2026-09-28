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

    /**
     * 广播一帧给<b>所有在线连接</b>（不区分用户）。
     *
     * <p><b>用在哪：</b>只用于「这条事实与看到它的每个人都相关，且无法预先算出收件人集合」的少数帧。
     * 当前唯一用例是资料变更（{@code PROFILE}）：某个人的头像换了，所有正在展示它的地方
     * （自己的顶栏与多端、会话对端、群成员列表、用户管理列表）都该立刻换图，而
     * 「谁正在展示这个人」是一张需要持续维护与对账的订阅表——为一个换头像动作引入它，
     * 复杂度远大于收益。</p>
     *
     * <p><b>准入条件（新增调用方自问）：</b>① 载荷是否低敏感且不含对方未授权的字段
     * （本帧只有 userId + 头像直出地址，后者本就是免登录可读的公开路径）；
     * ② 频率是否足够低（换头像是低频人工动作，不是心跳或消息流——那类不得走全员广播）；
     * ③ 丢了是否只退化为「下次拉取时更新」（是，属加速通道）。三条不满足时，
     * 应当按用户扇出 {@link #push} 或引入真正的订阅集合。</p>
     *
     * @param frame 帧体
     */
    public void broadcast(WsFrame frame) {
        if (frame == null) {
            return;
        }
        try {
            // userId 为 null 即「全员」语义，订阅端据此投给本机全部连接（见 WsDelivery 类注）
            WsDelivery delivery = new WsDelivery(null, objectMapper.valueToTree(frame));
            redisTemplate.convertAndSend(RedisKeyConstants.WS_CHANNEL,
                    objectMapper.writeValueAsString(delivery));
        } catch (Exception e) {
            log.warn("WS 全员广播失败（事实已落库，各端将退化为下次拉取时更新）：type={}, cause={}",
                    frame.type(), e.getMessage());
        }
    }
}
