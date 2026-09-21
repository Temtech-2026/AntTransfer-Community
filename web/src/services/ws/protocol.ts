/**
 * WebSocket 协议常量与纯函数（镜像后端 {@code WsProtocol}）。
 *
 * <p>信封上下行一致：{@code { type, data, ts }}。浏览器 WebSocket 构造器无法设置自定义头，
 * 因此令牌只能走查询串 {@code ?token=}（后端握手拦截器读同名参数），
 * <b>不要把 accessToken 放进 URL 日志以外的任何持久化位置</b>。
 */

import type { UnreadCount } from '@/services/notify';

/** 帧类型（与 {@code WsProtocol} 常量逐字符一致）。 */
export const WsFrameType = {
  /** 连接就绪：携带 userId 与未读快照。 */
  CONNECTED: 'CONNECTED',
  /** 系统通知实时推送（单条 {@code NotifyMessageVO}）。 */
  NOTIFY: 'NOTIFY',
  /** 会话消息实时推送（单条 {@code NotifyMessageVO}）。 */
  CHAT: 'CHAT',
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
