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

    /**
     * 会话消息已读回执：某位读者把「我发的这一批消息」读了。
     *
     * <p>推给<b>发送人</b>（读者是触发方），载荷见 {@code ChatReadReceiptVO}。
     * 与 {@link #TYPE_UNREAD} 的分工：未读快照解决「还剩几条没读」，回执解决
     * 「我发的那条对方读了没」——后者无法从快照反推（快照里我自己的行恒为已读）。</p>
     *
     * <p>本帧是<b>加速通道</b>：丢了只表现为「下次拉会话历史才看到头像」，
     * 客户端不需要（也不应）为它做补偿逻辑。</p>
     */
    public static final String TYPE_CHAT_READ = "CHAT_READ";

    /**
     * 会话消息撤回：某条已发出的消息被其发送人撤回，载荷见 {@code ChatRecallVO}。
     *
     * <p>推给<b>该消息的所有参与人</b>（含撤回者自己的其他端）——撤回必须同步到每一端，
     * 否则「我这端撤了、那端还留着原文」。推的不是「新消息」，故不复用 {@link #TYPE_CHAT}：
     * 后者会被客户端按新消息插流，把未读数与会话摘要各多加一次。</p>
     *
     * <p>与 {@link #TYPE_CHAT_READ} 同样的定位：<b>加速通道</b>。真值在库里
     * （{@code recall_status = 1}），丢了只表现为「重新拉历史后才看到已撤回」。</p>
     */
    public static final String TYPE_CHAT_RECALL = "CHAT_RECALL";

    /**
     * 用户资料变更（头像更换）：某位用户的头像已被更换，载荷见 {@code ChatProfileVO}。
     *
     * <p>推给<b>变更者本人的所有在线端</b>——在 A 端换了头像，B 端（另一个标签页 / 另一台设备）
     * 的顶栏与聊天头像要立刻跟上。<b>刻意不推给会话对端：</b>他们的头像来自会话列表与消息载荷，
     * 下次拉取自然就是新值；为此维护一张「谁在关注谁」的订阅表，收益远小于它与群成员关系变更
     * 之间的同步成本（与 {@link #TYPE_PRESENCE} 的订阅集合是两回事，不要复用后者）。</p>
     *
     * <p><b>它也不是「新消息」：</b>不复用 {@link #TYPE_CHAT}——后者会被客户端按新消息插入
     * 消息流，把未读数与会话摘要各多算一次。载荷因此另设 {@code ChatProfileVO}，
     * 而不是套用 {@code NotifyMessageVO}。</p>
     *
     * <p>与 {@link #TYPE_CHAT_READ} 同样的定位：<b>加速通道</b>。真值在库里
     * （{@code sys_user.avatar_url}），丢了只表现为「本端要等下次拉会话列表才看到新头像」，
     * 客户端不需要（也不应）为它写补偿逻辑。</p>
     */
    public static final String TYPE_PROFILE = "PROFILE";

    /**
     * 对端在线状态变更：某位用户的在线三态发生了变化，载荷见 {@code ChatPresenceVO}。
     *
     * <p>推给<b>正在看这位用户会话</b>的人（订阅集合见 {@code at:ws:presence:watch:*}），
     * 不推给状态变化者本人（他自己的多端各自持有本端连接事实）。只在状态<b>发生迁移</b>时推：
     * 上线、弱网恢复、正常断开——心跳续期不推，否则每 30s 给每个观察者发一帧纯噪声。</p>
     *
     * <p>与 {@link #TYPE_CHAT_READ} 同样的定位：<b>加速通道</b>。丢了不影响正确性，
     * 客户端另有「打开会话时拉一次 + 打开期间每 30s 续订一次」的权威回正，
     * 因此不需要（也不应）为它写补偿逻辑。</p>
     */
    public static final String TYPE_PRESENCE = "PRESENCE";

    /**
     * 对端输入状态（正在输入…）：载荷见 {@code ChatTypingVO}。
     *
     * <p>推给<b>对端</b>（单聊即会话目标本人），不推给输入者自己的其他连接——否则同一账号的
     * 其他标签页会把「我自己在输入」渲染成「对方正在输入」。</p>
     *
     * <p><b>纯瞬时信号</b>：不落库、不进未读、不补推、不参与已读口径。丢了只表现为
     * 「少显示一次输入提示」，客户端的下一次续订帧（每 3s 一次）会补上，
     * 接收端另有空闲兜底（约 6s）自动收起。</p>
     */
    public static final String TYPE_TYPING = "TYPING";

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
