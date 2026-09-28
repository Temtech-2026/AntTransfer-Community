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
import type {
  WsChatReadPayload,
  WsChatRecallPayload,
  WsPresencePayload,
  WsProfilePayload,
  WsTypingPayload,
} from './protocol';

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
/**
 * 已读回执回调（对端读了我发的消息）。
 *
 * <p><b>回执是「加速通道」而非事实源</b>：它只在发送人在线时才有意义，离线期间发生的
 * 阅读不会补推——真值在会话历史的 `readers` 字段里（进入会话 / 刷新即回正）。
 * 因此这里也不落任何本地缓存，收到就直接转发给当前可见的聊天界面。</p>
 */
export type ReadReceiptListener = (receipt: WsChatReadPayload) => void;
/**
 * 消息撤回回调（某条已发出的消息被撤回）。
 *
 * <p><b>与 {@link ReadReceiptListener} 同样是加速通道</b>：真值是历史里的
 * {@code recallStatus}，离线期间的撤回不会补推（补拉的历史自带状态）。
 * 因此这里不缓存、不落库，收到就转发给当前可见的聊天界面；
 * 订阅方需自行按会话过滤，再按 {@code clientMsgId} 定位本地那条。</p>
 */
export type RecallListener = (recall: WsChatRecallPayload) => void;
/**
 * 在线状态回调（对端三态变更）。
 *
 * <p>加速通道：权威值由打开会话时拉一次 + 打开期间每 30s 续订一次回正，因此这里不缓存、
 * 不落库，收到直接转发给当前可见的聊天界面；订阅方自行按 {@code userId} 过滤会话。</p>
 */
export type PresenceListener = (presence: WsPresencePayload) => void;
/**
 * 输入状态回调（对端正在 / 不再输入）。
 *
 * <p>与 {@link PresenceListener} 同样不落缓存：它是瞬时信号，`typing=false` 与空闲兜底
 * 都只是「收起提示」，没有任何需要回正的事实。</p>
 */
export type TypingListener = (typing: WsTypingPayload) => void;
/**
 * 用户资料变更回调（本人头像已更换）。
 *
 * <p><b>它不是加速通道里「等下一条就回正」的那一类</b>：头像换了就是换了，本端不跟进
 * 就会一直显示旧图（直到刷新）。所以订阅方应当<b>立刻</b>用帧里的 `avatarUrl` 换图，
 * 而不是等下一次拉取。真值仍在 `sys_user.avatar_url`，丢了只是本端晚一步。</p>
 *
 * <p><b>订阅方必须按 `userId` 区分</b>：该帧是<b>广播帧</b>（推给所有在线端），
 * 「写全局头像覆盖表」对所有人成立，但「写我自己的登录态」只在
 * `profile.userId` 命中当前用户时才可以（见 `protocol` 里载荷注释与 `components/ProfileSync`）。</p>
 */
export type ProfileListener = (profile: WsProfilePayload) => void;

let state: WsSnapshot = { status: 'idle', unread: { ...EMPTY_UNREAD } };
const listeners = new Set<Listener>();
const messageListeners = new Set<MessageListener>();
const backfillListeners = new Set<BackfillListener>();
const readReceiptListeners = new Set<ReadReceiptListener>();
const recallListeners = new Set<RecallListener>();
const presenceListeners = new Set<PresenceListener>();
const typingListeners = new Set<TypingListener>();
const profileListeners = new Set<ProfileListener>();
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

function emitReadReceipt(receipt: WsChatReadPayload): void {
  readReceiptListeners.forEach((listener) => {
    try {
      listener(receipt);
    } catch (error) {
      console.error('[anttransfer] WS 已读回执回调异常', error);
    }
  });
}

function emitRecall(recall: WsChatRecallPayload): void {
  recallListeners.forEach((listener) => {
    try {
      listener(recall);
    } catch (error) {
      console.error('[anttransfer] WS 撤回回调异常', error);
    }
  });
}

function emitPresence(presence: WsPresencePayload): void {
  presenceListeners.forEach((listener) => {
    try {
      listener(presence);
    } catch (error) {
      console.error('[anttransfer] WS 在线状态回调异常', error);
    }
  });
}

function emitTyping(typing: WsTypingPayload): void {
  typingListeners.forEach((listener) => {
    try {
      listener(typing);
    } catch (error) {
      console.error('[anttransfer] WS 输入状态回调异常', error);
    }
  });
}

function emitProfile(profile: WsProfilePayload): void {
  profileListeners.forEach((listener) => {
    try {
      listener(profile);
    } catch (error) {
      console.error('[anttransfer] WS 资料变更回调异常', error);
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
    readReceipt: (receipt) => emitReadReceipt(receipt),
    recall: (recall) => emitRecall(recall),
    presence: (presence) => emitPresence(presence),
    typing: (typing) => emitTyping(typing),
    profile: (profile) => emitProfile(profile),
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

  /**
   * 订阅实时已读回执。
   *
   * <p>订阅方必须先按 `(chatScope, chatTargetId)` 判断这帧是不是当前打开的会话
   * （服务端推给的是发送人，而其可能同时开着多个会话窗口）。</p>
   */
  subscribeReadReceipt(listener: ReadReceiptListener): () => void {
    readReceiptListeners.add(listener);
    return () => {
      readReceiptListeners.delete(listener);
    };
  },

  /**
   * 订阅消息撤回（某条已发出的消息被其发送人撤回）。
   *
   * <p>订阅方必须先按 `(chatScope, chatTargetId)` 判断这帧是不是当前打开的会话
   * （服务端推给的是该消息的全部参与人，一次会到多条），再按 `clientMsgId` 定位。</p>
   */
  subscribeRecall(listener: RecallListener): () => void {
    recallListeners.add(listener);
    return () => {
      recallListeners.delete(listener);
    };
  },

  /**
   * 订阅对端在线状态变更。
   *
   * <p>订阅方必须先按 `presence.userId` 判断这帧是不是当前会话的对端
   * （页面 + 抽屉 + 多标签页可能各看着不同的人）。</p>
   */
  subscribePresence(listener: PresenceListener): () => void {
    presenceListeners.add(listener);
    return () => {
      presenceListeners.delete(listener);
    };
  },

  /**
   * 订阅对端输入状态。
   *
   * <p>订阅方必须先按 `(chatScope, chatTargetId)` 判断会话是否匹配；`typing=false`
   * 必须照常处理，否则提示只能等本端空闲兜底收起。</p>
   */
  subscribeTyping(listener: TypingListener): () => void {
    typingListeners.add(listener);
    return () => {
      typingListeners.delete(listener);
    };
  },

  /**
   * 订阅本人资料变更（头像）。
   *
   * <p>订阅方无需过滤：帧只推给本人各端。头像换了就应立刻换图——它不像在线状态那样
   * 有「打开会话拉一次」的回正时机，本端不跟进就会一直显示旧图直到刷新。</p>
   */
  subscribeProfile(listener: ProfileListener): () => void {
    profileListeners.add(listener);
    return () => {
      profileListeners.delete(listener);
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
