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

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 本机在线会话注册表（进程内，不跨实例）。
 *
 * <p><b>设计取舍——为什么不做全局在线表：</b>需求是「收到广播后只推给<b>本机</b>连接用户」，
 * 即「谁在线」这个事实<b>天然是实例局部的</b>。若再往 Redis 写一份
 * {@code at:ws:online:{userId}} 全局在线表，就必须处理实例崩溃后的幽灵在线
 * （需要 TTL + 续约 + 对账），复杂度陡增，收益仅是「省一次无人接收的 Pub/Sub 投递」。
 * 因此本表<b>只服务于投递筛选</b>，不作为在线状态权威源——这与「离线累计未读、
 * 上线补拉」的最终一致模型自洽：在线与否只影响「实时帧是否到达」，不影响消息是否可查。</p>
 *
 * <p><b>并发模型：</b>三层 {@link ConcurrentHashMap}：{@code userId → (sessionId → session)}、
 * {@code sessionId → userId}、{@code sessionId → 最近活跃时刻}。全部按 <b>sessionId（String）</b>
 * 作键而不是按 {@link WebSocketSession} 对象——因为 Handler 会用
 * {@code ConcurrentWebSocketSessionDecorator} 包一层再注册，而 {@code getId()} 是透传的，
 * 用 ID 作键可保证「注册用装饰器、注销用原始会话」也能对上。</p>
 *
 * <p><b>发送并发：</b>Tomcat 的 {@code WebSocketSession#sendMessage} 非线程安全，
 * 同一会话被「定时探测」与「业务推送」并发写会抛
 * {@code IllegalStateException: TEXT_PARTIAL_WRITING}。故注册前必须用
 * {@code ConcurrentWebSocketSessionDecorator} 包装（见 {@code WsNotifyHandler}），
 * 本类只负责转发与筛除，不重复加锁。</p>
 *
 * @author AntTransfer CE
 */
@Component
public class WsSessionRegistry {

    private static final Logger log = LoggerFactory.getLogger(WsSessionRegistry.class);

    /** userId → (sessionId → session) */
    private final Map<Long, Map<String, WebSocketSession>> sessionsByUser = new ConcurrentHashMap<>();

    /** sessionId → userId（注销时反向定位用户，避免遍历全部用户） */
    private final Map<String, Long> ownerBySession = new ConcurrentHashMap<>();

    /** sessionId → 最近活跃时刻（epoch millis），心跳超时清理依据 */
    private final Map<String, Long> lastActiveAt = new ConcurrentHashMap<>();

    /**
     * 注册一条已通过鉴权的连接。
     *
     * @param userId  已鉴权用户 ID
     * @param session 连接会话（调用方应已用 {@code ConcurrentWebSocketSessionDecorator} 包装）
     */
    public void register(Long userId, WebSocketSession session) {
        Map<String, WebSocketSession> sessions =
                sessionsByUser.computeIfAbsent(userId, k -> new ConcurrentHashMap<>());
        sessions.put(session.getId(), session);
        ownerBySession.put(session.getId(), userId);
        lastActiveAt.put(session.getId(), System.currentTimeMillis());
        log.debug("WS 注册：userId={}, sessionId={}, 本机该用户连接数={}",
                userId, session.getId(), sessions.size());
    }

    /**
     * 注销连接（幂等：重复调用返回 null）。
     *
     * @return 该会话归属的用户 ID；会话不存在时返回 null
     */
    public Long unregister(WebSocketSession session) {
        return unregister(session.getId());
    }

    /**
     * 按 sessionId 注销（半开连接被清理时无法拿到原会话对象，只能按 ID 定位）。
     *
     * @return 该会话归属的用户 ID；不存在时返回 null
     */
    public Long unregister(String sessionId) {
        Long userId = ownerBySession.remove(sessionId);
        lastActiveAt.remove(sessionId);
        if (userId == null) {
            return null;
        }
        Map<String, WebSocketSession> sessions = sessionsByUser.get(userId);
        if (sessions != null) {
            sessions.remove(sessionId);
            if (sessions.isEmpty()) {
                // 最后一个连接断开：移除整条用户记录，避免 Map 随历史用户数无限增长
                sessionsByUser.remove(userId, sessions);
            }
        }
        return userId;
    }

    /**
     * 刷新活跃时间——收到任何帧（含客户端 PING）都算存活，
     * 避免把「只收不发」的纯接收端误判超时。
     */
    public void touch(WebSocketSession session) {
        lastActiveAt.put(session.getId(), System.currentTimeMillis());
    }

    /**
     * 该用户在本机是否有活跃连接。
     */
    public boolean isOnlineLocally(Long userId) {
        Map<String, WebSocketSession> sessions = sessionsByUser.get(userId);
        return sessions != null && !sessions.isEmpty();
    }

    /**
     * 向本机某用户的<b>全部</b>连接投递同一帧（多标签页 / 多设备同时在线）。
     *
     * <p>单条发送失败不会中断其余会话：逐个隔离并注销坏连接。</p>
     *
     * @return 实际投递成功的连接数（0 表示该用户不在本机——属正常情况，无需告警）
     */
    public int sendToLocal(Long userId, String json) {
        Map<String, WebSocketSession> sessions = sessionsByUser.get(userId);
        if (sessions == null || sessions.isEmpty()) {
            return 0;
        }
        int delivered = 0;
        for (WebSocketSession session : new ArrayList<>(sessions.values())) {
            if (safeSend(session, json)) {
                delivered++;
            }
        }
        return delivered;
    }

    /**
     * 向<b>单条</b>连接投递（按 sessionId 精确定位）——用于协议应答（如 PONG）
     * 只需回给发问的那一条连接，而非该用户的所有标签页。
     *
     * <p>定位到的是注册时包装过的 {@code ConcurrentWebSocketSessionDecorator}，
     * 因此与业务推送共享同一把写锁，不会出现「PONG 与业务帧并发写同一会话」。</p>
     *
     * @return 是否投递成功（连接不存在或写失败返回 false）
     */
    public boolean sendToSession(String sessionId, String json) {
        Long userId = ownerBySession.get(sessionId);
        if (userId == null) {
            return false;
        }
        WebSocketSession session = sessionsByUser.getOrDefault(userId, Map.of()).get(sessionId);
        return session != null && safeSend(session, json);
    }

    /**
     * 向本机<b>全部</b>连接投递同一帧（心跳探测用）。
     *
     * @return 实际投递成功的连接数
     */
    public int broadcastToAllLocal(String json) {
        int delivered = 0;
        for (Long userId : new ArrayList<>(sessionsByUser.keySet())) {
            delivered += sendToLocal(userId, json);
        }
        return delivered;
    }

    /**
     * 扫描并关闭心跳超时的连接。
     *
     * <p>半开连接（对端断电 / 断网）无法靠 TCP 感知，也不会触发
     * {@code afterConnectionClosed}——只能由服务端按活跃时间主动判定并断开，
     * 否则注册表会持续累积僵尸会话，推送一直「投递成功」却永远送不到。</p>
     *
     * @param timeoutMillis 超过该时长未收到任何帧即判定掉线（需求口径：90s）
     * @return 被清理的连接数
     */
    public int evictIdle(long timeoutMillis) {
        long deadline = System.currentTimeMillis() - timeoutMillis;
        int evicted = 0;
        // ConcurrentHashMap 迭代为弱一致，允许迭代中删除；先快照 ID 更直观
        for (String sessionId : new ArrayList<>(lastActiveAt.keySet())) {
            Long activeAt = lastActiveAt.get(sessionId);
            if (activeAt == null || activeAt > deadline) {
                continue;
            }
            Long userId = ownerBySession.get(sessionId);
            WebSocketSession session = userId == null
                    ? null
                    : sessionsByUser.getOrDefault(userId, Map.of()).get(sessionId);
            if (session != null) {
                closeQuietly(session, new CloseStatus(WsProtocol.CLOSE_HEARTBEAT_TIMEOUT,
                        "heartbeat timeout"));
            }
            unregister(sessionId);
            evicted++;
            log.info("WS 心跳超时清理：userId={}, sessionId={}, 静默时长={}ms",
                    userId, sessionId, System.currentTimeMillis() - activeAt);
        }
        return evicted;
    }

    /**
     * 本机在线的用户 ID 快照（运维观测 / 诊断用，非业务路径）。
     */
    public Set<Long> localOnlineUsers() {
        return Set.copyOf(sessionsByUser.keySet());
    }

    /** 本机连接总数。 */
    public int localSessionCount() {
        return ownerBySession.size();
    }

    /**
     * 取某会话的最近活跃时刻（epoch millis）；不存在返回 null。
     */
    public Long lastActiveAt(String sessionId) {
        return lastActiveAt.get(sessionId);
    }

    private boolean safeSend(WebSocketSession session, String json) {
        if (!session.isOpen()) {
            unregister(session);
            return false;
        }
        try {
            session.sendMessage(new TextMessage(json));
            return true;
        } catch (Exception e) {
            // 推送失败不是错误路径：消息已在库中，用户下次连接会经补拉拿到
            log.warn("WS 推送失败，注销该连接：sessionId={}, cause={}", session.getId(), e.getMessage());
            closeQuietly(session, CloseStatus.SERVER_ERROR);
            unregister(session);
            return false;
        }
    }

    private void closeQuietly(WebSocketSession session, CloseStatus status) {
        try {
            if (session.isOpen()) {
                session.close(status);
            }
        } catch (Exception e) {
            log.debug("WS 关闭连接异常（忽略）：sessionId={}, cause={}", session.getId(), e.getMessage());
        }
    }

    /** 仅供测试：清空全部注册状态。 */
    void clearForTest() {
        sessionsByUser.clear();
        ownerBySession.clear();
        lastActiveAt.clear();
    }

    /** 仅供测试：直接插入一条已注册连接（跳过 WebSocketSession 构造）。 */
    void registerForTest(Long userId, WebSocketSession session, long activeAtMillis) {
        register(userId, session);
        lastActiveAt.put(session.getId(), activeAtMillis);
    }
}
