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
import { wsStore, type WsStatus } from '@/services/ws';

/** Hook 入参。 */
export interface UseWebSocketOptions {
  /** 是否在挂载时确保连接已启动（默认 true，幂等）。 */
  autoConnect?: boolean;
  /** 实时消息回调（会自动解绑；回调内可用最新闭包，无需 useCallback）。 */
  onMessage?: (message: NotifyMessage) => void;
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
  const { autoConnect = true, onMessage } = options;

  const snapshot = useSyncExternalStore(wsStore.subscribe, wsStore.getSnapshot, wsStore.getSnapshot);

  // 用 ref 转发回调：订阅只建立一次，避免调用方每次渲染都重新订阅
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    const listener = (message: NotifyMessage) => onMessageRef.current?.(message);
    return wsStore.subscribeMessage(listener);
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
