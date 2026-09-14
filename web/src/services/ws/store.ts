/**
 * 全局唯一 WS 连接的订阅仓库（`useSyncExternalStore` 数据源）。
 *
 * <p>连接是**应用级单例**：导航栏红点、待办角标、会话列表读的是同一份未读数，
 * 多组件各自建连既浪费又是 bug 温床。React 侧只订阅快照，不参与状态机。
 *
 * <p>生命周期取舍：{@link wsStore.start} 幂等且**不在组件卸载时停止**。
 * 原因是 StrictMode 的 mount→unmount→mount 与路由切换会频繁挂卸，按卸载关连接
 * 会造成「切个页面就闪断」；登出时请显式调用 {@link wsStore.stop}。
 */

import {
  fetchOfflineMessages,
  fetchUnreadCount,
  markAllNotificationsRead,
} from '@/services/notify/api';
import {
  EMPTY_UNREAD,
  applyInboxCleared,
  type NotifyMessage,
  type UnreadCount,
} from '@/services/notify/types';
import { tokenStore } from '@/utils/token';

import { WsClient, type WsStatus } from './ws-client';

/** 快照形状。 */
export interface WsSnapshot {
  status: WsStatus;
  unread: UnreadCount;
}

type Listener = () => void;
type MessageListener = (message: NotifyMessage) => void;
/**
 * 离线补收回调。
 *
 * <p>补收的消息本身走 {@link MessageListener} 与在线推送**同一条流**，页面无法区分
 * 「这条是刚推来的」还是「这条是补拉的」；而 UX 上这两者要给的反馈不同（补拉要说明
 * 「错过了 N 条」）。所以这里单独开一个计数事件，而不是让页面去猜时序。
 */
export type BackfillListener = (count: number) => void;

let state: WsSnapshot = { status: 'idle', unread: { ...EMPTY_UNREAD } };
const listeners = new Set<Listener>();
const messageListeners = new Set<MessageListener>();
const backfillListeners = new Set<BackfillListener>();
let started = false;

function sameUnread(a: UnreadCount, b: UnreadCount): boolean {
  return a.inbox === b.inbox && a.todo === b.todo && a.chat === b.chat;
}

function patch(next: Partial<WsSnapshot>): void {
  const nextState: WsSnapshot = { ...state, ...next };
  if (nextState.status === state.status && sameUnread(nextState.unread, state.unread)) {
    return;
  }
  state = nextState;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error('[anttransfer] WS 订阅回调异常', error);
    }
  });
}

function emitMessage(message: NotifyMessage): void {
  messageListeners.forEach((listener) => {
    try {
      listener(message);
    } catch (error) {
      console.error('[anttransfer] WS 消息回调异常', error);
    }
  });
}

function emitBackfill(count: number): void {
  backfillListeners.forEach((listener) => {
    try {
      listener(count);
    } catch (error) {
      console.error('[anttransfer] WS 补收回调异常', error);
    }
  });
}

/** 重连成功后补拉离线消息，并以服务端快照纠正本地角标（离线期间可能有漂移）。 */
async function syncAfterReconnect(): Promise<void> {
  const messages = await fetchOfflineMessages();
  messages.forEach(emitMessage);
  patch({ unread: await fetchUnreadCount() });
  // 补收事件放在角标纠正之后：监听方据此提示「已补收 N 条」时，数字已是最终值
  if (messages.length > 0) {
    emitBackfill(messages.length);
  }
}

const client = new WsClient({
  // 每次都现取：静默刷新令牌后重连必须用新令牌，闭包缓存必然失败
  getToken: () => tokenStore.getAccessToken(),
  events: {
    status: (status) => patch({ status }),
    unread: (unread) => patch({ unread }),
    message: (message) => emitMessage(message),
    reconnected: () => {
      void syncAfterReconnect();
    },
    error: (detail) => {
      const closeCode = (detail as { closeCode?: number } | undefined)?.closeCode;
      console.warn('[anttransfer] WS 连接异常', closeCode ?? detail);
    },
  },
});

/** 对外仓库 API。 */
export const wsStore = {
  isStarted(): boolean {
    return started;
  },

  getSnapshot(): WsSnapshot {
    return state;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** 订阅实时消息（在线推送 + 重连补拉，两条来源共用一条流）。 */
  subscribeMessage(listener: MessageListener): () => void {
    messageListeners.add(listener);
    return () => {
      messageListeners.delete(listener);
    };
  },

  /** 订阅「离线补收」计数事件（重连后确实补到消息时才触发）。 */
  subscribeBackfill(listener: BackfillListener): () => void {
    backfillListeners.add(listener);
    return () => {
      backfillListeners.delete(listener);
    };
  },

  /** 幂等启动：拉一次快照对齐角标，然后握手建连。 */
  start(): void {
    if (started) {
      // 已启动但连接已被服务端 4001 关闭（如令牌过期后刷新）：允许再次拉起
      if (client.getStatus() === 'closed') {
        client.connect();
      }
      return;
    }
    started = true;
    void fetchUnreadCount().then((unread) => patch({ unread }));
    client.connect();
  },

  /** 断开并清空未读（仅注销 / 会话失效时调用）。 */
  stop(): void {
    started = false;
    client.disconnect({ resetUnread: true });
  },

  /** 网络恢复 / 用户点击「重试」时跳过退避。 */
  reconnectNow(): void {
    client.reconnectNow();
  },

  /**
   * 拉一次未读快照对齐角标。
   *
   * <p>用于「本地改动了已读态」之后：消息中心把某条待办标记已办、或把整页标记已读，
   * 本地列表已经变了，但红点数字仍停留在旧值——等下一次重连才自我纠正会显得迟钝。
   * 这里让页面在写操作成功后主动拉一次，保证「列表里的已读」与「顶栏的数字」同帧一致。
   */
  async refresh(): Promise<void> {
    patch({ unread: await fetchUnreadCount() });
  },

  /** 一键已读：先落库再本地清零，失败则保留角标（下次快照会纠正）。 */
  async markAllRead(): Promise<number> {
    const affected = await markAllNotificationsRead();
    patch({ unread: applyInboxCleared(state.unread) });
    return affected;
  },
};
