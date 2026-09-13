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

/**
 * WebSocket 通道协议常量（原生 WebSocket + JSON 信封，不引入 STOMP）。
 *
 * <p><b>为什么不用 STOMP：</b>STOMP 的价值在于「多目的地订阅 + 服务端消息代理」，
 * 而本场景所有下行都是「按用户点对点推送」——没有广播主题、没有订阅关系需要维护。
 * 引入 STOMP 只会多一层目的地解析与帧编解码，却仍要自己实现会话注册表、心跳与
 * 跨实例广播（{@code SimpleBroker} 不支持集群）。因此选择原生 {@code TextWebSocketHandler} +
 * 自定义 JSON 信封：协议面更小、可测、跨语言客户端（Web / 桌面）直接可用。</p>
 *
 * <p><b>信封格式</b>（上下行一致，便于统一日志与抓包）：</p>
 * <pre>{@code
 * { "type": "NOTIFY", "data": { ... }, "ts": 1789000000000 }
 * }</pre>
 *
 * @author AntTransfer CE
 */
public final class WsProtocol {

    /** 服务端注册的握手路径（随 context-path 前缀，默认完整路径为 {@code /api/ws/notify}） */
    public static final String PATH = "/ws/notify";

    /** 握手令牌参数名：浏览器 WebSocket 构造器无法设置自定义头，令牌只能走查询串 */
    public static final String TOKEN_PARAM = "token";

    /** 标准 Authorization 头（非浏览器客户端用，形如 {@code Bearer <token>}） */
    public static final String AUTH_HEADER = "Authorization";

    /** 令牌前缀 */
    public static final String BEARER_PREFIX = "Bearer ";

    /* ---------------- 下行帧类型（服务端 → 客户端） ---------------- */

    /** 连接就绪：携带当前用户 ID 与未读快照，客户端据此初始化红点 */
    public static final String TYPE_CONNECTED = "CONNECTED";

    /** 系统通知实时推送（单条） */
    public static final String TYPE_NOTIFY = "NOTIFY";

    /** 会话消息实时推送（单条） */
    public static final String TYPE_CHAT = "CHAT";

    /** 未读快照（红点 / 待办 / 会话角标三口径） */
    public static final String TYPE_UNREAD = "UNREAD";

    /** 心跳应答 */
    public static final String TYPE_PONG = "PONG";

    /** 服务端心跳探测（客户端应回 PONG；也可不回，任何帧都算存活） */
    public static final String TYPE_PING = "PING";

    /** 错误（仅用于协议层错误，不承载业务错误码） */
    public static final String TYPE_ERROR = "ERROR";

    /* ---------------- 上行帧类型（客户端 → 服务端） ---------------- */

    /** 客户端心跳：服务端回 {@link #TYPE_PONG} 并刷新会话活跃时间 */
    public static final String TYPE_CLIENT_PING = "PING";

    /* ---------------- 会话属性键（握手拦截器写入，Handler 读取） ---------------- */

    /** 握手后写入的会话属性：用户 ID（Long） */
    public static final String ATTR_USER_ID = "ATTR_USER_ID";

    /** 握手后写入的会话属性：登录账号（String） */
    public static final String ATTR_USERNAME = "ATTR_USERNAME";

    /** 自定义关闭码：鉴权失败（握手层拒绝为 401，此处用于「连接建立后校验属性缺失」） */
    public static final int CLOSE_UNAUTHORIZED = 4001;

    /** 自定义关闭码：心跳超时（90s 无任何帧） */
    public static final int CLOSE_HEARTBEAT_TIMEOUT = 4002;

    /** 自定义关闭码：服务端主动断开（如账号在本端被吊销） */
    public static final int CLOSE_SERVER_SHUTDOWN = 4003;

    private WsProtocol() {
    }
}
