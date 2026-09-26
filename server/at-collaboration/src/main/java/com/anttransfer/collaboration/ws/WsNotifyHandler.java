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
import com.anttransfer.collaboration.model.vo.UnreadCountVO;
import com.anttransfer.collaboration.model.vo.WsConnectedVO;
import com.anttransfer.collaboration.service.NotifyMessageService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * 通知通道 WebSocket Handler（原生协议，服务端只下行、客户端只上行心跳）。
 *
 * <p><b>职责边界：</b>本类只做「连接生命周期 + 协议帧」两件事，不含任何业务查询分支
 * （未读快照是唯一的例外，且已降级处理）。业务推送一律经
 * {@link WsBroadcaster} → Redis → {@link WsRedisSubscriber} → 注册表，单实例与集群同一条路径。</p>
 *
 * <p><b>为什么必须用 {@link ConcurrentWebSocketSessionDecorator} 包装：</b>
 * Tomcat 的 {@code sendMessage} 非线程安全。同一连接会同时被「心跳调度线程」与
 * 「业务推送线程（Redis 订阅线程）」写入，未包装时并发写会抛
 * {@code IllegalStateException: TEXT_PARTIAL_WRITING} 甚至写出半截帧破坏协议。
 * 装饰器把并发写串行化，并在超时 / 缓冲溢出时主动关闭连接。</p>
 *
 * <p><b>上行帧策略——宽进：</b>只识别 {@code PING}，其余帧一律忽略（不报错）。
 * 客户端可能先行升级、发送服务端尚不认识的帧；对未知帧报错会让前端「灰度升级即断连」，
 * 而忽略未知帧则让新客户端在旧服务端上工作正常。任何上行帧都刷新活跃时间，</p>
 *
 * @author AntTransfer CE
 */
public class WsNotifyHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(WsNotifyHandler.class);

    private final WsSessionRegistry registry;
    private final NotifyMessageService notifyMessageService;
    private final WsPresenceService presenceService;
    private final WsProperties properties;
    private final ObjectMapper objectMapper;

    public WsNotifyHandler(WsSessionRegistry registry,
                           NotifyMessageService notifyMessageService,
                           WsPresenceService presenceService,
                           WsProperties properties,
                           ObjectMapper objectMapper) {
        this.registry = registry;
        this.notifyMessageService = notifyMessageService;
        this.presenceService = presenceService;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    /**
     * 连接建立：包装 → 注册 → 下发 {@code CONNECTED}（含未读快照）。
     *
     * <p>会话属性由 {@link WsHandshakeInterceptor} 在握手阶段写入；缺失说明
     * 有人绕过了拦截器（配置错误），以 4001 关闭而不是放行一条无主体的连接。</p>
     */
    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Long userId = userIdOf(session);
        if (userId == null) {
            log.warn("WS 连接缺少鉴权属性，拒绝：sessionId={}", session.getId());
            closeQuietly(session, new CloseStatus(WsProtocol.CLOSE_UNAUTHORIZED, "missing auth"));
            return;
        }
        WebSocketSession concurrent = new ConcurrentWebSocketSessionDecorator(
                session, properties.getSendTimeLimitMillis(), properties.getBufferSizeLimitBytes());
        registry.register(userId, concurrent);
        // 上线：写在线记录并在状态迁移时推给正在看他会话的人。放在下发 CONNECTED 之前——
        // 对观察者而言「他上线了」这件事早于「他自己收到未读快照」发生，顺序更自然；
        // 且本调用内部已吞掉 Redis 异常，不会阻断建连
        presenceService.markActive(userId);
        log.debug("WS 连接建立：userId={}, sessionId={}, 本机连接数={}",
                userId, session.getId(), registry.localSessionCount());
        sendConnected(concurrent, userId);
    }

    /**
     * 上行帧处理：刷新活跃时间 + 应答 PING。未知帧静默忽略（向前兼容）。
     */
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        registry.touch(session);
        // 每个上行帧都续期在线状态——包括客户端对服务端心跳探测的 PONG 应答。
        // 这一点很关键：浏览器会把后台标签页的定时器降频到 1 次/分钟，若只靠客户端自己的
        // 定时心跳续期，后台用户会被对端看成「网络不佳」甚至「离线」；而「服务端探测 → 客户端
        // 应答」这条链路不受定时器降频影响，活跃时刻因此始终新鲜
        Long userId = userIdOf(session);
        if (userId != null) {
            presenceService.markActive(userId);
        }
        String payload = message.getPayload();
        if (payload == null || payload.isBlank()) {
            return;
        }
        try {
            JsonNode node = objectMapper.readTree(payload);
            String type = node.path("type").asText("");
            if (WsProtocol.TYPE_CLIENT_PING.equalsIgnoreCase(type)) {
                registry.sendToSession(session.getId(),
                        objectMapper.writeValueAsString(WsFrame.signal(WsProtocol.TYPE_PONG)));
            }
        } catch (Exception e) {
            // 非 JSON / 结构不符：忽略即可，不值得为此断连（宽进策略）
            log.debug("忽略无法解析的上行帧：sessionId={}, cause={}", session.getId(), e.getMessage());
        }
    }

    /**
     * 传输层异常：注销并关闭。半开连接由心跳清理兜底，这里处理的是已能感知的坏连接。
     */
    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.warn("WS 传输异常：sessionId={}, cause={}", session.getId(), exception.getMessage());
        // 这里必须自己清在线状态：本方法会先注销，随后的 afterConnectionClosed 再注销一次
        // 拿到的是 null（幂等设计），那条路径无法再判断「该用户还有没有别的连接」
        clearPresenceIfLastSession(registry.unregister(session));
        closeQuietly(session, CloseStatus.SERVER_ERROR);
    }

    /**
     * 连接关闭：注销。必须幂等——传输异常路径可能已先行注销。
     */
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Long userId = registry.unregister(session);
        clearPresenceIfLastSession(userId);
        log.debug("WS 连接关闭：userId={}, sessionId={}, status={}, 本机连接数={}",
                userId, session.getId(), status, registry.localSessionCount());
    }

    /**
     * 连接注销后的在线状态清理：<b>仅当本机已无该用户的其他连接</b>时才清除。
     *
     * <p>多标签页 / 多设备场景下关掉其中一个不能判离线；跨实例的另一种情况（该用户还连在
     * 别的实例上）会由那边的心跳在 ≤30s 内写回，见 {@link WsPresenceService} 类注「已知边界」。</p>
     *
     * @param userId 刚注销的连接归属用户（会话本就不存在时为 null，无需处理）
     */
    private void clearPresenceIfLastSession(Long userId) {
        if (userId != null && !registry.isOnlineLocally(userId)) {
            presenceService.markOffline(userId);
        }
    }

    /** 下发连接帧；快照查询失败不阻断连接（客户端退化为拉取未读接口）。 */
    private void sendConnected(WebSocketSession session, Long userId) {
        UnreadCountVO unread = null;
        try {
            unread = notifyMessageService.unreadCount(userId);
        } catch (Exception e) {
            // 建连不能因为一次统计查询失败而失败：连接本身是稀缺资源
            log.warn("WS 连接未读快照查询失败，降级为 null：userId={}, cause={}", userId, e.getMessage());
        }
        try {
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(
                    WsFrame.of(WsProtocol.TYPE_CONNECTED, new WsConnectedVO(userId, unread)))));
        } catch (Exception e) {
            log.warn("WS 连接帧下发失败：userId={}, cause={}", userId, e.getMessage());
            registry.unregister(session);
            closeQuietly(session, CloseStatus.SERVER_ERROR);
        }
    }

    private Long userIdOf(WebSocketSession session) {
        Object value = session.getAttributes().get(WsProtocol.ATTR_USER_ID);
        return value instanceof Long id ? id : null;
    }

    private void closeQuietly(WebSocketSession session, CloseStatus status) {
        try {
            if (session.isOpen()) {
                session.close(status);
            }
        } catch (Exception e) {
            log.debug("WS 关闭异常（忽略）：sessionId={}, cause={}", session.getId(), e.getMessage());
        }
    }
}
