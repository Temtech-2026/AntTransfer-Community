/**
 * 实时通知 Hook：把 {@link wsStore} 单例状态接进 React。
 *
 * <p>三种用法（按需取用，未用到的字段不产生额外开销）：
 * <pre>{@code
 * // 1. 导航栏红点
 * const { unread, status } = useWebSocket();
 *
 * // 2. 收件箱页面：拿到实时消息 + 历史补拉
 * useWebSocket({ onMessage: (msg) => setList((prev) => [msg, ...prev]) });
 *
 * // 3. 网络恢复后手动重连
 * const { reconnectNow } = useWebSocket({ autoConnect: false });
 * }</pre>
 *
 * <p>注意：Hook **不负责断开**——连接是应用级单例（详见 services/ws/store.ts 文件头），
 * 登出请直接调用 {@code wsStore.stop()}。
 */

import { useEffect, useRef, useSyncExternalStore } from 'react';

import type { NotifyMessage, UnreadCount } from '@/services/notify';
import {
  wsStore,
  type WsChatReadPayload,
  type WsChatRecallPayload,
  type WsPresencePayload,
  type WsProfilePayload,
  type WsStatus,
  type WsTypingPayload,
} from '@/services/ws';

/** Hook 入参。 */
export interface UseWebSocketOptions {
  /** 是否在挂载时确保连接已启动（默认 true，幂等）。 */
  autoConnect?: boolean;
  /** 实时消息回调（会自动解绑；回调内可用最新闭包，无需 useCallback）。 */
  onMessage?: (message: NotifyMessage) => void;
  /**
   * 已读回执回调（对端读了我发的哪些消息）。
   *
   * <p>与 {@link UseWebSocketOptions.onMessage} 分开：回执不是消息，进不了消息流，
   * 只用于把读者头像补到已渲染的气泡下。回调里请先判断会话是否匹配。</p>
   */
  onReadReceipt?: (receipt: WsChatReadPayload) => void;
  /**
   * 对端在线状态变更（加速通道；权威值由打开会话时拉取 + 期间续订回正）。
   *
   * <p>回调里请先按 `presence.userId` 判断是否属于当前会话的对端。</p>
   */
  onPresence?: (presence: WsPresencePayload) => void;
  /**
   * 对端输入状态（`typing=false` 也要处理，否则提示只能等空闲兜底收起）。
   *
   * <p>回调里请先按 `(chatScope, chatTargetId)` 判断是否属于当前会话。</p>
   */
  onTyping?: (typing: WsTypingPayload) => void;
  /**
   * 消息撤回回调（某条已发出的消息被其发送人撤回）。
   *
   * <p>与 {@link UseWebSocketOptions.onMessage} 分开：撤回不产生新消息，
   * 混进消息流会被当作「来了新消息」插入并重算未读，而它改变的是<b>已存在那条</b>的状态。
   * 回调里请先按 `(chatScope, chatTargetId)` 判断是否属于当前会话，
   * 再按 `clientMsgId` 定位本地那条。</p>
   */
  onRecall?: (recall: WsChatRecallPayload) => void;
  /**
   * 本人资料变更（头像已更换）。
   *
   * <p>该帧只推给<b>本人</b>的各端，因此回调里不必按 userId 过滤；收到就应立刻换图
   * （它没有「打开会话拉一次」那种回正时机，不跟进会一直显示旧图直到刷新）。</p>
   */
  onProfile?: (profile: WsProfilePayload) => void;
}

/** Hook 返回值。 */
export interface UseWebSocketResult {
  /** 连接状态：`idle` / `connecting` / `open` / `reconnecting` / `closed`。 */
  status: WsStatus;
  /** 当前是否已连上（渲染红点时用 `open` 更准）。 */
  open: boolean;
  /** 未读三口径（快照 + 实时增量，实时维护）。 */
  unread: UnreadCount;
  /** 未读总数（红点数字）。 */
  total: number;
  /** 手动重连（跳过指数退避）。 */
  reconnectNow: () => void;
  /** 一键已读：落库成功后本地清零 inbox/todo，chat 不动。 */
  markAllRead: () => Promise<number>;
  /** 启动连接（`autoConnect=false` 时的入口）。 */
  connect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketResult {
  const {
    autoConnect = true,
    onMessage,
    onReadReceipt,
    onPresence,
    onTyping,
    onRecall,
    onProfile,
  } = options;

  const snapshot = useSyncExternalStore(wsStore.subscribe, wsStore.getSnapshot, wsStore.getSnapshot);

  // 用 ref 转发回调：订阅只建立一次，避免调用方每次渲染都重新订阅
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onReadReceiptRef = useRef(onReadReceipt);
  onReadReceiptRef.current = onReadReceipt;
  const onPresenceRef = useRef(onPresence);
  onPresenceRef.current = onPresence;
  const onTypingRef = useRef(onTyping);
  onTypingRef.current = onTyping;
  const onRecallRef = useRef(onRecall);
  onRecallRef.current = onRecall;
  const onProfileRef = useRef(onProfile);
  onProfileRef.current = onProfile;

  useEffect(() => {
    const listener = (message: NotifyMessage) => onMessageRef.current?.(message);
    return wsStore.subscribeMessage(listener);
  }, []);

  useEffect(() => {
    const listener = (receipt: WsChatReadPayload) => onReadReceiptRef.current?.(receipt);
    return wsStore.subscribeReadReceipt(listener);
  }, []);

  useEffect(() => {
    const listener = (presence: WsPresencePayload) =>
      onPresenceRef.current?.(presence);
    return wsStore.subscribePresence(listener);
  }, []);

  useEffect(() => {
    const listener = (typing: WsTypingPayload) => onTypingRef.current?.(typing);
    return wsStore.subscribeTyping(listener);
  }, []);

  useEffect(() => {
    const listener = (recall: WsChatRecallPayload) => onRecallRef.current?.(recall);
    return wsStore.subscribeRecall(listener);
  }, []);

  useEffect(() => {
    const listener = (profile: WsProfilePayload) => onProfileRef.current?.(profile);
    return wsStore.subscribeProfile(listener);
  }, []);

  useEffect(() => {
    if (autoConnect) {
      wsStore.start();
    }
  }, [autoConnect]);

  return {
    status: snapshot.status,
    open: snapshot.status === 'open',
    unread: snapshot.unread,
    total: snapshot.unread.inbox + snapshot.unread.todo + snapshot.unread.chat,
    reconnectNow: () => wsStore.reconnectNow(),
    markAllRead: () => wsStore.markAllRead(),
    connect: () => wsStore.start(),
  };
}

export default useWebSocket;
