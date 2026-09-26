/**
 * WebSocket 客户端状态机（框架无关，React 只做订阅）。
 *
 * <p>为什么不直接写在 Hook 里：
 * <ul>
 *   <li>StrictMode 双挂载 / 依赖数组变更会反复建连，闭包里的定时器与 attempt 计数器极易泄漏；</li>
 *   <li>重连时**必须重新读 token**（静默刷新后旧令牌已失效），闭包捕获的 token 会永远重连失败；
 *       因此令牌通过 {@link WsClientOptions.getToken} 每次握手现取；</li>
 *   <li>纯类 + 注入式依赖（createSocket / random）可以在 vitest 里用假 socket 全链路验证，
 *       不必依赖真实 WS 或 jsdom 的不完整实现。</li>
 * </ul>
 */

// 只依赖 notify 的纯类型/纯函数模块，不引 barrel：避免把 request/antd 链路卷进单测与首屏
import {
  EMPTY_UNREAD,
  applyIncomingMessage,
  isSelfSentMessage,
  normalizeUnread,
  type NotifyMessage,
  type UnreadCount,
} from '@/services/notify/types';

import {
  WS_DEFAULTS,
  WsFrameType,
  buildWsUrl,
  createClientPingFrame,
  nextBackoffDelay,
  parseChatReadPayload,
  parseChatRecallPayload,
  parsePresencePayload,
  parseProfilePayload,
  parseTypingPayload,
  parseWsFrame,
  shouldReconnect,
  type BackoffOptions,
  type WsChatReadPayload,
  type WsChatRecallPayload,
  type WsFrame,
  type WsLocationLike,
  type WsPresencePayload,
  type WsProfilePayload,
  type WsTypingPayload,
} from './protocol';

/** 连接状态。 */
export type WsStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

/** 事件表（全部同步回调；抛出异常由 {@link WsClient.emit} 吞掉，不允许污染状态机）。 */
export interface WsClientEvents {
  /** 状态变更。 */
  status?: (status: WsStatus) => void;
  /** 未读快照变更（快照帧 + 实时增量 + 本地清零共用一条流）。 */
  unread?: (unread: UnreadCount) => void;
  /** 收到 NOTIFY / CHAT 消息帧（data 为单条 {@link NotifyMessage}）。 */
  message?: (message: NotifyMessage, frame: WsFrame) => void;
  /**
   * 收到 `CHAT_READ` 已读回执帧（对端读了我发的消息）。
   *
   * <p>与 {@link WsClientEvents.message} 分开一条事件：回执不是消息，既不进消息流、
   * 也不影响未读，混进 message 里会让每个消费方都写一遍「是不是消息」的判据。</p>
   */
  readReceipt?: (receipt: WsChatReadPayload, frame: WsFrame) => void;
  /**
   * 收到 `CHAT_RECALL` 撤回帧（某条已发出的消息被其发送人撤回）。
   *
   * <p><b>与 {@link WsClientEvents.message} 分开一条事件</b>：撤回不产生新消息，
   * 混进 message 里会被当作「来了新消息」插进列表并重算未读——而它改变的是
   * <b>已存在那条</b>的状态。订阅方按 {@code (chatScope, chatTargetId)} 比对当前会话，
   * 再按 {@code clientMsgId} 定位并标记。</p>
   */
  recall?: (recall: WsChatRecallPayload, frame: WsFrame) => void;
  /**
   * 收到 `PRESENCE` 在线状态帧（对端状态变更）。
   *
   * <p>与 {@link WsClientEvents.readReceipt} 同一纪律：这是加速通道，权威值由
   * 「打开会话时拉一次 + 打开期间每 30s 续订一次」回正。订阅方必须先按 {@code userId}
   * 判断这帧是否属于当前打开的会话——状态可能同属多个会话窗口。</p>
   */
  presence?: (presence: WsPresencePayload, frame: WsFrame) => void;
  /**
   * 收到 `TYPING` 输入状态帧。
   *
   * <p>瞬时信号，客户端不做补偿重试；订阅方按 `(chatScope, chatTargetId)` 比对当前会话，
   * 并必须处理 `typing=false`（否则提示只能靠空闲兜底收起）。</p>
   */
  typing?: (typing: WsTypingPayload, frame: WsFrame) => void;
  /**
   * 收到 `PROFILE` 用户资料帧（本人的头像已更换）。
   *
   * <p><b>它只推给变更者本人的全部在线端</b>，所以订阅方<b>无需</b>按 userId 过滤——
   * 收到即代表「我自己的资料变了」。这与 `PRESENCE` 恰好相反（那里必须按 userId 比对），
   * 因为在线状态帧会送到多个「认识该用户」的接收人手上。</p>
   *
   * <p>不是消息：不进消息流、不影响未读三口径。</p>
   */
  profile?: (profile: WsProfilePayload, frame: WsFrame) => void;
  /** 重连成功（首次连接不算）：用于触发离线补拉。 */
  reconnected?: () => void;
  /** 协议层错误 / 不可恢复的关闭（4001）。 */
  error?: (detail: unknown) => void;
}

/** 最小 socket 接口（只描述用到的成员，便于注入假实现）。 */
export interface WsSocketLike {
  readyState: number;
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  onopen: ((event: unknown) => void) | null;
  onclose: ((event: { code?: number; reason?: string }) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface WsClientOptions {
  /** 每次握手现取令牌；返回 null 表示无会话，此时不建连。 */
  getToken: () => string | null;
  /** 握手路径，默认 {@link WS_DEFAULTS.path}。 */
  path?: string;
  /** location 推导源（单测注入）。 */
  location?: WsLocationLike;
  /** socket 工厂（单测注入假实现）。 */
  createSocket?: (url: string) => WsSocketLike;
  /** 定时器实现（单测注入假定时器）。 */
  setTimer?: (handler: () => void, timeout: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (handle: ReturnType<typeof setTimeout>) => void;
  /** 抖动随机源（单测注入定值）。 */
  random?: () => number;
  heartbeatIntervalMs?: number;
  watchdogIntervalMs?: number;
  backoff?: BackoffOptions;
  /** 是否在未登录（无 token）时自动挂起而不是进入 closed。 */
  events?: WsClientEvents;
}

const SOCKET_CONNECTING = 0;
const SOCKET_OPEN = 1;

export class WsClient {
  private readonly options: WsClientOptions;
  private readonly events: WsClientEvents;

  private socket: WsSocketLike | null = null;
  private status: WsStatus = 'idle';
  private unread: UnreadCount = { ...EMPTY_UNREAD };

  /** 是否处于「用户期望保持连接」的意图位：disconnect 后不得再自动重连。 */
  private wantConnected = false;
  /** 退避尝试次数（open 后归零）。 */
  private attempt = 0;
  /** 是否成功连上过至少一次（用于区分首连与断线重连）。 */
  private hasOpened = false;
  /** 最近一次收到任何下行帧的时间（本地假死探测）。 */
  private lastFrameAt = 0;

  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: WsClientOptions) {
    this.options = options;
    this.events = options.events ?? {};
  }

  getStatus(): WsStatus {
    return this.status;
  }

  getUnread(): UnreadCount {
    return this.unread;
  }

  isOpen(): boolean {
    return this.status === 'open' && this.socket?.readyState === SOCKET_OPEN;
  }

  /** 用户意图：保持连接。重复调用幂等（已在连/已连则忽略）。 */
  connect(): void {
    this.wantConnected = true;
    if (this.socket && !this.isClosedSocket()) {
      return;
    }
    this.open();
  }

  /**
   * 用户意图：断开。{@code resetUnread} 用于注销场景（角标随会话一起清空）。
   */
  disconnect({ resetUnread = false }: { resetUnread?: boolean } = {}): void {
    this.wantConnected = false;
    this.clearTimers();
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = null;
      socket.onclose = null;
      socket.onmessage = null;
      socket.onerror = null;
      // 1000 正常关闭：服务端不会回送业务关闭码，也不会触发重连
      try {
        socket.close(1000, 'client disconnect');
      } catch {
        // 已关闭的 socket 重复 close 会抛错，忽略
      }
    }
    if (resetUnread) {
      this.setUnread({ ...EMPTY_UNREAD });
    }
    this.setStatus('closed');
  }

  /** 立即重连（跳过当前退避等待），如「网络恢复」事件。 */
  reconnectNow(): void {
    if (!this.wantConnected) {
      return;
    }
    this.clearTimer('reconnect');
    this.attempt = 0;
    if (this.socket) {
      // 主动丢弃旧连接：onclose 已被置空，不会与新建连接互相覆盖
      const stale = this.socket;
      this.socket = null;
      try {
        stale.close(1000, 'reconnect');
      } catch {
        // 忽略
      }
    }
    this.open();
  }

  // ---------------------------------------------------------------- 内部实现

  private open(): void {
    const token = this.options.getToken();
    if (!token) {
      // 无会话：不建连也不进入重连循环，等登录后由调用方再次 connect()
      this.setStatus('closed');
      this.emit('error', new Error('WS 握手终止：本地无可用令牌'));
      return;
    }

    const create =
      this.options.createSocket ??
      ((url: string) => new WebSocket(url) as unknown as WsSocketLike);
    const url = buildWsUrl(this.options.path ?? WS_DEFAULTS.path, token, this.options.location);

    this.setStatus(this.hasOpened ? 'reconnecting' : 'connecting');

    let socket: WsSocketLike;
    try {
      socket = create(url);
    } catch (error) {
      this.emit('error', error);
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      if (this.socket !== socket) {
        return; // 已被 reconnectNow / disconnect 替换的陈旧连接
      }
      const isReconnect = this.hasOpened;
      this.hasOpened = true;
      this.attempt = 0;
      this.lastFrameAt = this.now();
      this.setStatus('open');
      this.startHeartbeat();
      this.startWatchdog();
      if (isReconnect) {
        this.emit('reconnected');
      }
    };

    socket.onmessage = (event) => {
      if (this.socket !== socket) {
        return;
      }
      this.handleFrame(event?.data);
    };

    socket.onerror = () => {
      // 浏览器出于安全不暴露错误细节，真正的收场统一走 onclose
    };

    socket.onclose = (event) => {
      if (this.socket !== socket) {
        return;
      }
      this.socket = null;
      this.clearTimers();
      const code = Number(event?.code ?? 1006);
      this.emit('error', { closeCode: code, reason: event?.reason });

      if (!this.wantConnected) {
        this.setStatus('closed');
        return;
      }
      if (!shouldReconnect(code)) {
        // 4001：令牌失效，重连必然再被拒；1001：页面离开
        this.wantConnected = false;
        this.setStatus('closed');
        return;
      }
      this.scheduleReconnect();
    };
  }

  /** 处理一帧下行数据。任何帧都刷新活跃时间（存活判定不区分类型）。 */
  private handleFrame(raw: unknown): void {
    this.lastFrameAt = this.now();
    const frame = parseWsFrame(raw);
    if (!frame) {
      return;
    }

    switch (frame.type) {
      case WsFrameType.CONNECTED: {
        const payload = frame.data as { unread?: Partial<UnreadCount> | null } | null;
        if (payload?.unread) {
          // 服务端快照是权威值，直接覆盖本地（重连时用它纠正离线期间的漂移）
          this.setUnread(normalizeUnread(payload.unread));
        }
        break;
      }
      case WsFrameType.UNREAD: {
        this.setUnread(normalizeUnread(frame.data as Partial<UnreadCount> | null));
        break;
      }
      case WsFrameType.NOTIFY:
      case WsFrameType.CHAT: {
        const message = frame.data as NotifyMessage | null;
        if (!message || typeof message.notifyType !== 'number') {
          break;
        }
        this.emit('message', message, frame);
        // 自己发的消息会被推回给自己（推送覆盖该用户的全部连接，多端同步所需），
        // 但它不是未读——不传这个标记的话，每发一条消息角标就 +1 且只能等刷新才纠正
        this.setUnread(
          applyIncomingMessage(this.unread, message.notifyType, isSelfSentMessage(message)),
        );
        break;
      }
      case WsFrameType.CHAT_READ: {
        // 回执不进未读、不进消息流：它只改「我发的某几条」的读者展示（见 services/chat/readReceipt）
        const receipt = parseChatReadPayload(frame.data);
        if (receipt) {
          this.emit('readReceipt', receipt, frame);
        }
        break;
      }
      case WsFrameType.CHAT_RECALL: {
        // 撤回不进未读、不进消息流：它只把「已存在的那条」标记为已撤回
        //（帧体不完整就丢弃，刷新拉历史即回正，见 protocol 解析器注释）
        const recall = parseChatRecallPayload(frame.data);
        if (recall) {
          this.emit('recall', recall, frame);
        }
        break;
      }
      case WsFrameType.PRESENCE: {
        // 状态点属加速通道：帧体不完整就丢弃，等下一次续订回正（见 protocol 里解析器注释）
        const presence = parsePresencePayload(frame.data);
        if (presence) {
          this.emit('presence', presence, frame);
        }
        break;
      }
      case WsFrameType.TYPING: {
        const typing = parseTypingPayload(frame.data);
        if (typing) {
          this.emit('typing', typing, frame);
        }
        break;
      }
      case WsFrameType.PROFILE: {
        // 资料帧不是消息：只改「本人的头像」，不进消息流、不动未读。
        // 帧体不完整即丢弃——真值在库，下次拉取（刷新 / 重连）自然回正
        const profile = parseProfilePayload(frame.data);
        if (profile) {
          this.emit('profile', profile, frame);
        }
        break;
      }
      case WsFrameType.PING: {
        // 服务端探测：按协议回一帧 PING（任何下行帧都已刷新 lastFrameAt）
        this.sendFrame(createClientPingFrame(this.now()));
        break;
      }
      case WsFrameType.ERROR: {
        this.emit('error', frame.data);
        break;
      }
      default:
        // PONG 与未来新增的帧类型：仅用于存活判定
        break;
    }
  }

  private scheduleReconnect(): void {
    if (!this.wantConnected) {
      return;
    }
    const delay = nextBackoffDelay(this.attempt, {
      ...this.options.backoff,
      random: this.options.random,
    });
    this.attempt += 1;
    this.setStatus('reconnecting');
    this.clearTimer('reconnect');
    this.reconnectTimer = this.setTimer(() => {
      this.reconnectTimer = null;
      if (this.wantConnected) {
        this.open();
      }
    }, delay);
  }

  /** 心跳：每 30s 上行一帧 PING（服务端 90s 无帧才判超时，容 3 次丢失）。 */
  private startHeartbeat(): void {
    this.clearTimer('heartbeat');
    const interval = this.options.heartbeatIntervalMs ?? WS_DEFAULTS.heartbeatIntervalMs;
    this.heartbeatTimer = this.setTimer(() => {
      if (!this.isOpen()) {
        return;
      }
      this.sendFrame(createClientPingFrame(this.now()));
      this.startHeartbeat();
    }, interval);
  }

  /**
   * 假死探测：TCP 半开时 onclose 可能永远不来，
   * 超过 idleTimeout 无任何下行帧即本地判定心跳超时并主动断开（code 4002 → 走重连）。
   */
  private startWatchdog(): void {
    this.clearTimer('watchdog');
    const interval = this.options.watchdogIntervalMs ?? WS_DEFAULTS.watchdogIntervalMs;
    this.watchdogTimer = this.setTimer(() => {
      if (!this.wantConnected) {
        return;
      }
      if (this.now() - this.lastFrameAt > WS_DEFAULTS.idleTimeoutMs) {
        const socket = this.socket;
        this.socket = null;
        if (socket) {
          socket.onclose = null;
          try {
            socket.close(4002, 'heartbeat timeout');
          } catch {
            // 忽略
          }
        }
        this.clearTimers();
        this.scheduleReconnect();
        return;
      }
      this.startWatchdog();
    }, interval);
  }

  private sendFrame(frame: WsFrame): void {
    if (this.socket?.readyState !== SOCKET_OPEN) {
      return;
    }
    try {
      this.socket.send(JSON.stringify(frame));
    } catch (error) {
      this.emit('error', error);
    }
  }

  private setStatus(status: WsStatus): void {
    if (this.status === status) {
      return;
    }
    this.status = status;
    this.emit('status', status);
  }

  private setUnread(next: UnreadCount): void {
    this.unread = next;
    this.emit('unread', next);
  }

  private isClosedSocket(): boolean {
    const readyState = this.socket?.readyState;
    return readyState !== SOCKET_CONNECTING && readyState !== SOCKET_OPEN;
  }

  private clearTimers(): void {
    this.clearTimer('heartbeat');
    this.clearTimer('watchdog');
    this.clearTimer('reconnect');
  }

  private clearTimer(kind: 'heartbeat' | 'watchdog' | 'reconnect'): void {
    const handle =
      kind === 'heartbeat'
        ? this.heartbeatTimer
        : kind === 'watchdog'
          ? this.watchdogTimer
          : this.reconnectTimer;
    if (handle !== null) {
      this.clearTimerHandle(handle);
    }
    if (kind === 'heartbeat') {
      this.heartbeatTimer = null;
    } else if (kind === 'watchdog') {
      this.watchdogTimer = null;
    } else {
      this.reconnectTimer = null;
    }
  }

  private clearTimerHandle(handle: ReturnType<typeof setTimeout>): void {
    const clear = this.options.clearTimer ?? clearTimeout;
    clear(handle);
  }

  private setTimer(handler: () => void, timeout: number): ReturnType<typeof setTimeout> {
    const set = this.options.setTimer;
    if (set) {
      return set(handler, timeout);
    }
    // 同时装了 DOM 与 @types/node 时全局 setTimeout 的返回类型是 number | Timeout，
    // 统一收敛到 ReturnType<typeof setTimeout> 以避免注入实现与默认实现打架
    return setTimeout(handler, timeout) as unknown as ReturnType<typeof setTimeout>;
  }

  private now(): number {
    return Date.now();
  }

  private emit<K extends keyof WsClientEvents>(
    key: K,
    ...args: Parameters<NonNullable<WsClientEvents[K]>>
  ): void {
    const handler = this.events[key] as ((...params: unknown[]) => void) | undefined;
    if (!handler) {
      return;
    }
    try {
      handler(...args);
    } catch (error) {
      // 订阅方异常不得中断状态机（否则一个渲染错误会拖垮整条连接）
      console.error('[anttransfer] WS 事件回调异常', error);
    }
  }
}
