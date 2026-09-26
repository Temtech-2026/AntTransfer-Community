/**
 * WebSocket 协议常量与纯函数（镜像后端 {@code WsProtocol}）。
 *
 * <p>信封上下行一致：{@code { type, data, ts }}。浏览器 WebSocket 构造器无法设置自定义头，
 * 因此令牌只能走查询串 {@code ?token=}（后端握手拦截器读同名参数），
 * <b>不要把 accessToken 放进 URL 日志以外的任何持久化位置</b>。
 */

import type { ChatReader, UnreadCount } from '@/services/notify';

/** 帧类型（与 {@code WsProtocol} 常量逐字符一致）。 */
export const WsFrameType = {
  /** 连接就绪：携带 userId 与未读快照。 */
  CONNECTED: 'CONNECTED',
  /** 系统通知实时推送（单条 {@code NotifyMessageVO}）。 */
  NOTIFY: 'NOTIFY',
  /** 会话消息实时推送（单条 {@code NotifyMessageVO}）。 */
  CHAT: 'CHAT',
  /** 已读回执：对端读了我发的哪些消息（{@link WsChatReadPayload}）。 */
  CHAT_READ: 'CHAT_READ',
  /** 会话消息撤回：某条已发出的消息被其发送人撤回（{@link WsChatRecallPayload}）。 */
  CHAT_RECALL: 'CHAT_RECALL',
  /** 会话对端在线状态变更（三态，{@link WsPresencePayload}）。 */
  PRESENCE: 'PRESENCE',
  /** 对端「正在输入…」瞬时信号（{@link WsTypingPayload}）。 */
  TYPING: 'TYPING',
  /** 用户资料变更：本人头像已更换（{@link WsProfilePayload}）。 */
  PROFILE: 'PROFILE',
  /** 未读快照（三口径，权威值）。 */
  UNREAD: 'UNREAD',
  /** 服务端心跳探测（客户端应回 PING，任何帧都算存活）。 */
  PING: 'PING',
  /** 心跳应答。 */
  PONG: 'PONG',
  /** 协议层错误（不承载业务错误码）。 */
  ERROR: 'ERROR',
} as const;

/** 自定义关闭码（与 {@code WsProtocol} 对齐）。 */
export const WsCloseCode = {
  /** 鉴权失败：**不重连**（令牌已失效，重连只会反复被拒，交给 HTTP 层刷新或跳登录）。 */
  UNAUTHORIZED: 4001,
  /** 心跳超时（90s 无任何帧）：可重连。 */
  HEARTBEAT_TIMEOUT: 4002,
  /** 服务端主动断开（如账号被吊销 / 服务重启）：可重连。 */
  SERVER_SHUTDOWN: 4003,
} as const;

/** 协议默认参数。 */
export const WS_DEFAULTS = {
  /** 完整握手路径（含 context-path 前缀）。 */
  path: '/api/ws/notify',
  /** 客户端心跳间隔：30s（服务端 90s 无帧判超时，留 3 次容错）。 */
  heartbeatIntervalMs: 30_000,
  /** 服务端空闲判定：90s（与 {@code WsProtocol.CLOSE_HEARTBEAT_TIMEOUT} 注释一致）。 */
  idleTimeoutMs: 90_000,
  /** 本地假死探测间隔。 */
  watchdogIntervalMs: 10_000,
  /** 重连退避起点。 */
  baseDelayMs: 1_000,
  /** 重连退避上限（避免长时断网时 30s 以上的空转）。 */
  maxDelayMs: 30_000,
  /** 退避抖动比例 ±20%（防止多端同时重连形成尖峰）。 */
  jitterRatio: 0.2,
} as const;

/** 统一信封。 */
export interface WsFrame<T = unknown> {
  type: string;
  data?: T | null;
  ts?: number;
}

/** `CONNECTED` 帧载荷。 */
export interface WsConnectedPayload {
  /** 当前连接用户主键（19 位雪花 ID，服务端以字符串下发）。 */
  userId: string;
  /** 未读快照；后端在查询失败等场景可能给 null，此时保留本地值。 */
  unread?: UnreadCount | null;
}

/**
 * `CHAT_READ` 帧载荷（对齐后端 {@code ChatReadReceiptVO}）。
 *
 * <p><b>这是「对端读了我发的消息」的增量通道，不是未读快照。</b>它由<b>读者</b>进入会话
 * 置读时产生，推给<b>发送人</b>；因此 {@code chatTargetId} 是<b>发送人视角</b>的会话目标
 * （单聊 = 读者本人，群聊 = 群 ID）——服务端已换算，前端直接与当前会话比对即可，
 * 不要拿它去反推读者是谁。</p>
 *
 * <p>{@code clientMsgIds} 是本次被读的那几条（发送人自己的幂等键）。用幂等键而非消息 ID
 * 是因为发送人本地可能还挂着「只有 clientMsgId 的乐观行」；同时它天然把范围限定在
 * 我自己发出去的消息上，前端无需再判定方向。</p>
 */
export interface WsChatReadPayload {
  chatScope: number;
  /** 发送人视角的会话目标（19 位雪花 ID，字符串）。 */
  chatTargetId: string;
  /** 读到消息的人（展示名由服务端反查，查不到时整帧不下发）。 */
  reader: ChatReader;
  /** 本次被置读的消息幂等键。 */
  clientMsgIds: string[];
}

/**
 * `CHAT_RECALL` 帧载荷（对齐后端 {@code ChatRecallVO}）。
 *
 * <p><b>定位用 {@code clientMsgId} 而不是消息 id：</b>写扩散下同一条消息在每个参与人那里
 * 是不同的行（id 各不相同），只有幂等键全局一致；本地也只有幂等键可以拿来匹配
 * （乐观行还没有服务端 id）。{@code chatScope + chatTargetId} 是<b>本接收人视角</b>的
 * 会话定位，服务端按行逐条下发，直接与当前打开的会话比对即可。</p>
 *
 * <p><b>这是加速通道</b>：撤回是已落库的事实（{@code recallStatus = 1}），
 * 丢了只表现为「重新拉历史后才看到已撤回」，不需要补偿逻辑。</p>
 */
export interface WsChatRecallPayload {
  /** 被撤回消息的幂等键。 */
  clientMsgId: string;
  /** 撤回者（= 原消息发送人）用户 ID。 */
  senderUserId: string;
  chatScope: number;
  /** 本接收人视角的会话目标（单聊=撤回者；群聊=群 ID）。 */
  chatTargetId: string;
  /** 撤回时间。 */
  recallTime?: string | null;
}

/**
 * 解析 `CHAT_RECALL` 帧载荷；形状不完整时返回 `undefined`（调用方静默丢弃）。
 *
 * <p>校验放在协议层的原因与 {@link parseChatReadPayload} 一致：帧体来自网络，
 * 宁可不打这次「已撤回」标记（刷新即回正），也不让一帧脏数据崩掉聊天页。</p>
 */
export function parseChatRecallPayload(
  data: unknown,
): WsChatRecallPayload | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }
  const raw = data as Partial<WsChatRecallPayload>;
  if (typeof raw.clientMsgId !== 'string' || !raw.clientMsgId) {
    return undefined;
  }
  if (typeof raw.senderUserId !== 'string' || !raw.senderUserId) {
    return undefined;
  }
  if (typeof raw.chatScope !== 'number') {
    return undefined;
  }
  if (typeof raw.chatTargetId !== 'string' || !raw.chatTargetId) {
    return undefined;
  }
  return {
    clientMsgId: raw.clientMsgId,
    senderUserId: raw.senderUserId,
    chatScope: raw.chatScope,
    chatTargetId: raw.chatTargetId,
    recallTime: typeof raw.recallTime === 'string' ? raw.recallTime : null,
  };
}

/**
 * 在线三态（对齐后端 {@code ChatPresenceStatus}）。
 *
 * <p>判定权在服务端：{@code UNSTABLE} 不是「网络断了」而是「连接还在、但心跳已超出健康窗口」
 * （1.5 × 心跳间隔）。前端只负责画点，不要自己在本地按时间重算——本地时钟与服务端可能不同源。</p>
 */
export const ChatPresenceStatus = {
  /** 绿点：活跃时刻在健康窗口内。 */
  ONLINE: 'ONLINE',
  /** 灰点：无活跃记录（含 Redis 读取失败的服务端降级）。 */
  OFFLINE: 'OFFLINE',
  /** 红点：连接还在但心跳迟到，即「网络状态不佳」。 */
  UNSTABLE: 'UNSTABLE',
} as const;

export type ChatPresenceStatus =
  (typeof ChatPresenceStatus)[keyof typeof ChatPresenceStatus];

/** 是否为合法三态值（用于协议层净化网络数据）。 */
export function isPresenceStatus(value: unknown): value is ChatPresenceStatus {
  return (
    value === ChatPresenceStatus.ONLINE ||
    value === ChatPresenceStatus.OFFLINE ||
    value === ChatPresenceStatus.UNSTABLE
  );
}

/**
 * `PRESENCE` 帧载荷（对齐后端 {@code ChatPresenceVO}）。
 *
 * <p>这是「某个用户的在线状态变了」的<b>加速通道</b>：权威值由 `POST /v1/chat/presence/watch`
 * 在打开会话时拉一次、并在打开期间每 30s 续订一次回正；丢了只表现为状态点晚一拍。</p>
 *
 * <p>{@code userId} 是<b>状态发生变化的那个用户</b>（不是接收人视角的目标 ID），
 * 前端拿它与当前会话的对端比对——命中才改点，否则会把 A 的状态画到 B 的会话上。</p>
 */
export interface WsPresencePayload {
  /** 状态所属用户 ID（19 位雪花 ID，字符串）。 */
  userId: string;
  status: ChatPresenceStatus;
  /** 最近活跃时刻（epoch millis）；离线为 null（离线不展示「最后在线时间」）。 */
  lastActiveAt?: number | null;
}

/**
 * `TYPING` 帧载荷（对齐后端 {@code ChatTypingVO}）。
 *
 * <p><b>{@code chatTargetId} 是「接收人视角」的会话目标</b>——单聊即输入者本人的用户 ID。
 * 因此接收方要拿它与<b>自己当前打开的会话</b>比对 `(chatScope, chatTargetId)`，
 * 不要拿它反推「我是谁」。</p>
 *
 * <p>纯瞬时信号：不落库、不进未读、不补推。收到 `typing=false` 或本端空闲兜底超时即收起提示。</p>
 */
export interface WsTypingPayload {
  /** 会话范围：1-单聊（当前仅单聊承载本帧）。 */
  chatScope: number;
  /** 接收人视角的会话目标（单聊=输入者本人 ID）。 */
  chatTargetId: string;
  /** true=开始/继续输入；false=停止输入。 */
  typing: boolean;
}

/**
 * `PROFILE` 帧载荷（对齐后端 {@code ChatProfileVO}）。
 *
 * <p><b>它只推给「资料变更者本人」的全部在线连接</b>，所以收到即意味着「我自己的头像换了」：
 * 在 A 端换了头像，B 端（另一个标签页 / 另一台设备）的顶栏与聊天里自己的头像要立刻跟上，
 * 不必等下次刷新。刻意<b>不推给会话对端</b>——对端看到的我的头像来自会话列表与消息载荷里
 * 的 `avatarUrl`，下次拉取自然就是新值，为此维护一张订阅表不划算。</p>
 *
 * <p><b>它不是新消息</b>：不进消息流、不参与未读三口径，因此单独占一个事件，
 * 不要混进 `onMessage` 里处理。</p>
 *
 * <p>与 `CHAT_READ` / `PRESENCE` 同样的定位：<b>加速通道</b>。真值在库里
 * （{@code sys_user.avatar_url}），丢了只表现为「本端晚一步看到新头像」，无需补偿。</p>
 */
export interface WsProfilePayload {
  /** 资料发生变更的用户 ID（19 位雪花 ID，服务端以字符串下发）。 */
  userId: string;
  /** 变更后的头像对外地址（含 `?v=` 缓存版本号）；null 表示该用户当前没有头像。 */
  avatarUrl?: string | null;
}

/**
 * 解析 `PROFILE` 帧载荷；形状不完整时返回 `undefined`（调用方静默丢弃）。
 *
 * <p>{@code avatarUrl} 的空串与非字符串一律归一为 `null`（=「没有头像」），
 * 下游无需再做类型防御——空串或 `"null"` 直接塞进 `img src` 会渲染成破图。</p>
 */
export function parseProfilePayload(data: unknown): WsProfilePayload | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }
  const raw = data as Partial<WsProfilePayload>;
  if (typeof raw.userId !== 'string' || !raw.userId) {
    return undefined;
  }
  return {
    userId: raw.userId,
    avatarUrl: typeof raw.avatarUrl === 'string' && raw.avatarUrl ? raw.avatarUrl : null,
  };
}

/** 用于 URL 推导的最小 location 形状（便于单测注入，不依赖 DOM 类型）。 */
export interface WsLocationLike {
  protocol?: string;
  host?: string;
}

/** 是否是一个合法信封。 */
export function isWsFrame(value: unknown): value is WsFrame {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

/**
 * 解析下行帧；非法内容返回 undefined（服务端将来新增帧类型时旧客户端不能崩）。
 */
export function parseWsFrame(raw: unknown): WsFrame | undefined {
  if (typeof raw !== 'string' || !raw) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isWsFrame(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 解析 `CHAT_READ` 帧载荷；形状不完整时返回 `undefined`（调用方据此静默丢弃该帧）。
 *
 * <p>校验放在协议层而不是消费方：帧体来自网络，一个字段类型不对（比如 `clientMsgIds`
 * 成了对象）会在渲染树深处炸开，而报错现场与真实原因隔着好几层。宁可不打这次标，
 * 也不让一帧脏数据崩掉整个聊天页——事实仍留在库里，刷新即回正。</p>
 */
export function parseChatReadPayload(data: unknown): WsChatReadPayload | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }
  const raw = data as Partial<WsChatReadPayload>;
  const reader = raw.reader;
  if (typeof raw.chatScope !== 'number') {
    return undefined;
  }
  if (typeof raw.chatTargetId !== 'string' || !raw.chatTargetId) {
    return undefined;
  }
  if (typeof reader?.userId !== 'string' || !reader.userId) {
    return undefined;
  }
  if (typeof reader.displayName !== 'string' || !reader.displayName) {
    return undefined;
  }
  if (!Array.isArray(raw.clientMsgIds)) {
    return undefined;
  }
  const clientMsgIds = raw.clientMsgIds.filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );
  if (clientMsgIds.length === 0) {
    return undefined;
  }
  return {
    chatScope: raw.chatScope,
    chatTargetId: raw.chatTargetId,
    reader: {
      userId: reader.userId,
      displayName: reader.displayName,
      // 空串 / 非字符串一律归一为 null（=「没有头像」），渲染时回落首字符
      avatarUrl:
        typeof reader.avatarUrl === 'string' && reader.avatarUrl ? reader.avatarUrl : null,
    },
    clientMsgIds,
  };
}

/**
 * 解析 `PRESENCE` 帧载荷；形状不完整时返回 `undefined`（调用方静默丢弃）。
 *
 * <p>校验放在协议层的原因与 {@link parseChatReadPayload} 一致：帧体来自网络，
 * 一个字段类型不对会在渲染树深处炸开，而报错现场与真实原因隔着好几层。
 * 状态点属加速事实，宁可不更新这一点，也不让一帧脏数据崩掉聊天页。</p>
 */
export function parsePresencePayload(data: unknown): WsPresencePayload | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }
  const raw = data as Partial<WsPresencePayload>;
  if (typeof raw.userId !== 'string' || !raw.userId) {
    return undefined;
  }
  if (!isPresenceStatus(raw.status)) {
    return undefined;
  }
  // 离线本就无活跃时刻；非数字（脏数据）一律归一为 null，下游无需再做类型防御
  return {
    userId: raw.userId,
    status: raw.status,
    lastActiveAt: typeof raw.lastActiveAt === 'number' ? raw.lastActiveAt : null,
  };
}

/**
 * 解析 `TYPING` 帧载荷；形状不完整时返回 `undefined`（调用方静默丢弃）。
 *
 * <p>{@code typing} 必须是布尔原始值：`"false"` 这类字符串在 `if (typing)` 下恒为真，
 * 会把「停止输入」翻译成「正在输入」，提示就此再也收不起来。</p>
 */
export function parseTypingPayload(data: unknown): WsTypingPayload | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }
  const raw = data as Partial<WsTypingPayload>;
  if (typeof raw.chatScope !== 'number') {
    return undefined;
  }
  if (typeof raw.chatTargetId !== 'string' || !raw.chatTargetId) {
    return undefined;
  }
  if (typeof raw.typing !== 'boolean') {
    return undefined;
  }
  return {
    chatScope: raw.chatScope,
    chatTargetId: raw.chatTargetId,
    typing: raw.typing,
  };
}

/**
 * 由当前页面推导 WebSocket 地址（http→ws / https→wss）。
 *
 * <p>走同源路径而不是硬编码后端域名：开发期由 dev proxy 转发，生产期由网关转发，
 * 前端不需要为环境切换维护第二份地址配置。
 */
export function buildWsUrl(
  path: string = WS_DEFAULTS.path,
  token?: string | null,
  locationLike?: WsLocationLike,
): string {
  const loc = locationLike ?? (typeof window === 'undefined' ? undefined : window.location);
  const protocol = loc?.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = loc?.host ?? 'localhost';
  const base = `${protocol}//${host}${path}`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

/**
 * 该关闭码是否应重连。
 *
 * <p>4001 鉴权失败与 1001（页面跳转 / 关闭）不重连：前者重连必然失败，
 * 后者是客户端主动离开，重连会把「关闭」变成「常驻」。
 */
export function shouldReconnect(closeCode: number): boolean {
  return closeCode !== WsCloseCode.UNAUTHORIZED && closeCode !== 1001;
}

/** 退避参数（可注入 random 以获得确定性单测）。 */
export interface BackoffOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterRatio?: number;
  random?: () => number;
}

/**
 * 指数退避 + 抖动：attempt=0 → 1s，1 → 2s，2 → 4s …… 上限 30s。
 */
export function nextBackoffDelay(attempt: number, options: BackoffOptions = {}): number {
  const {
    baseDelayMs = WS_DEFAULTS.baseDelayMs,
    maxDelayMs = WS_DEFAULTS.maxDelayMs,
    jitterRatio = WS_DEFAULTS.jitterRatio,
    random = Math.random,
  } = options;
  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt));
  if (jitterRatio <= 0) {
    return Math.round(exponential);
  }
  const jitter = exponential * jitterRatio * (random() * 2 - 1);
  return Math.max(0, Math.round(exponential + jitter));
}

/** 构造客户端心跳帧（上行帧类型与下行同名：PING）。 */
export function createClientPingFrame(now: number = Date.now()): WsFrame<null> {
  return { type: WsFrameType.PING, data: null, ts: now };
}
