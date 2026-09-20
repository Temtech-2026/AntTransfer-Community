/**
 * 全局浮层（外壳面板）登记处。
 *
 * <p>三栏壳里有两块「不属于任何页面、但任何页面都要能唤起」的浮层：
 * <ul>
 *   <li><b>即时通讯抽屉</b>：侧栏底部的入口、文件列表的「发送到聊天」、拖拽投递
 *       三条路径都能打开它，因此开合状态不能落在某一个页面的 state 里；</li>
 *   <li><b>传输监控悬浮窗</b>：上传是跨页面长任务（控制器在模块级注册表里），
 *       悬浮窗要在任何路由下都能展开。</li>
 * </ul>
 *
 * <p>这里刻意只做「极简的可订阅状态」而不是引入状态管理库：
 * 外壳布局（{@code src/app.tsx}）与浮层组件是两棵独立的渲染子树，
 * 靠模块级 store + {@code useSyncExternalStore} 通信，是成本最低且无 Provider 依赖的做法。
 *
 * <p><b>待办投递口径</b>：{@link attachToChat} 只把「待发送文件」暂存到这里，
 * 抽屉打开后消费一次即清空（见 {@link consumeAttachment}）。这样用户从文件页点击
 * 「发送到聊天」时，抽屉里已经选好了目标会话，不必二次去文件区找文件。
 */

import type { FileDragPayload } from '@/utils/dragFile';

/** 抽屉 / 悬浮窗快照（稳定引用，供 useSyncExternalStore 使用）。 */
export interface ShellPanelSnapshot {
  /** 即时通讯抽屉是否展开 */
  chatOpen: boolean;
  /** 传输监控悬浮窗是否展开 */
  transferOpen: boolean;
  /** 待发送到聊天的文件（一次性令牌） */
  attachment: FileDragPayload | null;
}

const EMPTY: ShellPanelSnapshot = {
  chatOpen: false,
  transferOpen: false,
  attachment: null,
};

let snapshot: ShellPanelSnapshot = EMPTY;
const listeners = new Set<() => void>();

function emit(next: ShellPanelSnapshot): void {
  snapshot = next;
  for (const listener of listeners) {
    listener();
  }
}

/** 打开 / 关闭即时通讯抽屉。 */
export function setChatOpen(open: boolean): void {
  if (snapshot.chatOpen === open) {
    return;
  }
  emit({ ...snapshot, chatOpen: open });
}

/** 打开 / 关闭传输监控悬浮窗。 */
export function setTransferOpen(open: boolean): void {
  if (snapshot.transferOpen === open) {
    return;
  }
  emit({ ...snapshot, transferOpen: open });
}

/** 切换即时通讯抽屉。 */
export function toggleChat(): void {
  setChatOpen(!snapshot.chatOpen);
}

/** 切换传输监控悬浮窗。 */
export function toggleTransfer(): void {
  setTransferOpen(!snapshot.transferOpen);
}

/**
 * 把一份文件暂存为「待发送到聊天」并展开抽屉。
 *
 * <p>用于「点击」路径：文件页的操作菜单不经过 HTML5 拖拽事件，
 * 没有 DataTransfer 可用，只能走这条通道。
 */
export function attachToChat(payload: FileDragPayload): void {
  emit({ ...snapshot, attachment: payload, chatOpen: true });
}

/**
 * 取出并清空待发送文件（抽屉消费一次）。
 *
 * @returns 没有待发送文件时返回 null
 */
export function consumeAttachment(): FileDragPayload | null {
  const current = snapshot.attachment;
  if (current) {
    emit({ ...snapshot, attachment: null });
  }
  return current;
}

/** 订阅外壳面板状态变化。 */
export function subscribeShellPanel(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 读取当前快照（稳定引用）。 */
export function getShellPanelSnapshot(): ShellPanelSnapshot {
  return snapshot;
}

/** 单测重置：清空全部浮层状态与监听者。 */
export function resetShellPanel(): void {
  snapshot = EMPTY;
  listeners.clear();
}

/** 外壳面板 store（组件统一从这里取，避免各处散写订阅）。 */
export const shellPanelStore = {
  subscribe: subscribeShellPanel,
  getSnapshot: getShellPanelSnapshot,
};
