/**
 * 会话（IM）数据访问。
 *
 * <p><b>静默策略</b>：会话列表属「页面主数据」，失败由页面自己渲染错误态并给「重试」，
 * 因此不弹全局 toast（`silent`），避免一次网络抖动叠出两个提示；
 * 发送消息是用户主动动作，失败必须给出明确反馈（含 1012 非群成员 / 1013 目标无效），
 * 保留全局提示。
 */

import type { NotifyMessage } from '@/services/notify';
import { requestData } from '@/services/request';

import { CHAT_ENDPOINTS } from './endpoints';
import type { ChatSendPayload, Conversation } from './types';

/**
 * 会话列表。
 *
 * @param limit 条数（不传取服务端 `notify.chat-conversation-limit`）
 */
export async function fetchConversations(
  limit?: number,
): Promise<Conversation[]> {
  const list = await requestData<Conversation[] | null>(
    CHAT_ENDPOINTS.conversations,
    {
      method: 'GET',
      params: limit ? { limit } : undefined,
      silent: true,
    },
  );
  return Array.isArray(list) ? list : [];
}

/**
 * 会话历史（倒序）。
 *
 * @param beforeId 游标：只取 id 小于它的消息（首页不传）
 * @param limit    条数（服务端按 `notify.chat-history-limit` 收敛）
 */
export function fetchChatHistory(params: {
  scope: number;
  /** 会话目标 ID（19 位雪花 ID，字符串）；禁止 `Number()` 归一，否则会取错人。 */
  targetId: string;
  /** 游标：只取 id 小于它的消息（同样为字符串 ID）。 */
  beforeId?: string;
  limit?: number;
}): Promise<NotifyMessage[]> {
  return requestData<NotifyMessage[]>(CHAT_ENDPOINTS.history, {
    method: 'GET',
    params: {
      scope: params.scope,
      targetId: params.targetId,
      ...(params.beforeId ? { beforeId: params.beforeId } : {}),
      ...(params.limit ? { limit: params.limit } : {}),
    },
    silent: true,
  }).then((list) => (Array.isArray(list) ? list : []));
}

/**
 * 发送消息。
 *
 * <p>返回的 `NotifyMessageVO` 是「发送人自己那一行」（已置读），
 * 因此发送成功后可以把它直接并入消息流而不必再拉一次历史；
 * 发送人的其他标签页也会收到同一帧（推送按用户广播到其全部连接）。</p>
 */
export function sendChatMessage(
  payload: ChatSendPayload,
): Promise<NotifyMessage> {
  return requestData<NotifyMessage>(CHAT_ENDPOINTS.send, {
    method: 'POST',
    data: payload,
  });
}

/** 会话已读（返回本次置读条数；0 表示本来就没有未读）。 */
export function markChatRead(scope: number, targetId: string): Promise<number> {
  return requestData<number>(CHAT_ENDPOINTS.read, {
    method: 'POST',
    params: { scope, targetId },
    silent: true,
  });
}
