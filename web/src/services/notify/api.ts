/**
 * 通知 / 会话数据访问。
 *
 * <p>静默策略：快照类接口（unread / offline）默认静默——它们是**后台维护性调用**
 * （重连补拉、角标对齐），失败时弹 toast 只会打扰用户；用户主动触发的动作
 * （单条已读 / 一键已读）保留全局提示。
 */

import { requestData, requestPage } from '@/services/request';

import { NOTIFY_ENDPOINTS } from './endpoints';
import { EMPTY_UNREAD, normalizeUnread, type NotifyMessage, type UnreadCount } from './types';

/** 未读快照（失败时返回零值，不影响页面可用性）。 */
export async function fetchUnreadCount(): Promise<UnreadCount> {
  try {
    const raw = await requestData<Partial<UnreadCount>>(NOTIFY_ENDPOINTS.unread, {
      method: 'GET',
      silent: true,
    });
    return normalizeUnread(raw);
  } catch (error) {
    console.warn('[anttransfer] 未读快照拉取失败，按零值降级', error);
    return { ...EMPTY_UNREAD };
  }
}

/**
 * 离线补拉（重连后调用）。
 *
 * <p>后端语义：返回离线期间的未读提醒**并置读**，但待办三段（1/2/8）的已读必须由处置动作驱动，
 * 不会被补拉顺带清掉。因此补拉后应再拉一次 {@link fetchUnreadCount} 以对齐角标。
 */
export async function fetchOfflineMessages(limit?: number): Promise<NotifyMessage[]> {
  try {
    const messages = await requestData<NotifyMessage[] | null>(NOTIFY_ENDPOINTS.offline, {
      method: 'GET',
      params: limit ? { limit } : undefined,
      silent: true,
    });
    return Array.isArray(messages) ? messages : [];
  } catch (error) {
    console.warn('[anttransfer] 离线消息补拉失败', error);
    return [];
  }
}

/** 收件箱分页。 */
export function pageNotifications(params: { current?: number; pageSize?: number } = {}) {
  return requestPage<NotifyMessage>(NOTIFY_ENDPOINTS.page, {
    method: 'GET',
    params: { current: params.current ?? 1, pageSize: params.pageSize ?? 20 },
  });
}

/** 单条已读（非本人消息后端返回 4040）。 */
export function markNotificationRead(id: number) {
  return requestData<boolean>(NOTIFY_ENDPOINTS.readOne(id), { method: 'POST' });
}

/** 一键已读（返回受影响行数）。 */
export function markAllNotificationsRead() {
  return requestData<number>(NOTIFY_ENDPOINTS.readAll, { method: 'POST' });
}
