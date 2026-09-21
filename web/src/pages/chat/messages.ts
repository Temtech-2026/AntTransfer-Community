/**
 * 聊天页的纯逻辑（无 React、无副作用），单独成文件是为了可单测。
 *
 * <p>这里放的都是「最容易写错、错了还很难复现」的合并规则：
 * <ol>
 *   <li><b>消息去重必须同时认 id 与 clientMsgId。</b>发送一条消息会有两条到达路径——
 *       HTTP 响应（带真实 id）与 WS 回推帧（同一个 id，因为推送覆盖该用户全部连接）。
 *       两者 id 相同，靠 id 即可收敛；但一旦客户端做了乐观插入（只有 clientMsgId），
 *       就必须靠 clientMsgId 认亲，否则同一条消息会显示两遍。</li>
 *   <li><b>未读数只由「别人发的 + 不是当前打开的会话」产生。</b>自己发的（多标签页会收到自己的帧）
 *       不能给自己加未读，否则每发一条自己的角标就 +1。</li>
 *   <li><b>会话列表按最后一条消息 ID 排序，不按时间字符串。</b>理由同后端聚合 SQL：
 *       id 与插入顺序同序且无并列，时间字符串受时钟影响还可能因格式差异比错大小。</li>
 * </ol>
 */

import {
  type ChatSession,
  type Conversation,
  isMine,
  sessionKey,
  sessionOfMessage,
} from '@/services/chat';
import type { NotifyMessage } from '@/services/notify';
import { compareSnowflakeId } from '@/utils/id';

/** 合并一条消息进消息流时，判定「同一条消息」的键。 */
export function messageKey(message: NotifyMessage): string {
  if (message.id) {
    return `id:${message.id}`;
  }
  if (message.clientMsgId) {
    return `client:${message.clientMsgId}`;
  }
  // 既无 id 也无幂等键：退化为「时间 + 正文」，仅用于兜底展示，不承担真正的去重语义
  return `raw:${message.createTime ?? ''}:${message.content ?? ''}`;
}

/**
 * 判断两条消息是否同一条。
 *
 * <p>先比 {@link messageKey}，再交叉比 id / clientMsgId——覆盖「乐观插入时只有 clientMsgId、
 * 服务端帧同时带 id 与 clientMsgId」这一步跨跃。</p>
 */
function isSameMessage(a: NotifyMessage, b: NotifyMessage): boolean {
  if (messageKey(a) === messageKey(b)) {
    return true;
  }
  if (a.id && b.id) {
    return a.id === b.id;
  }
  if (a.clientMsgId && b.clientMsgId) {
    return a.clientMsgId === b.clientMsgId;
  }
  return false;
}

/**
 * 消息排序：按 id 升序（id 与插入顺序同序）；还没拿到服务端 id 的（乐观行）排在末尾。
 *
 * <p>乐观行用空串 `id: ''` 而不是缺字段（{@link NotifyMessage.id} 是必填的），
 * 由 {@link compareSnowflakeId} 统一按「空串最大」处理，否则乐观行会排到整个消息流最前面。</p>
 */
export function sortMessages(messages: NotifyMessage[]): NotifyMessage[] {
  return [...messages].sort((a, b) => {
    const byId = compareSnowflakeId(a.id, b.id);
    return byId !== 0 ? byId : (a.createTime ?? '').localeCompare(b.createTime ?? '');
  });
}

/**
 * 合并一条消息：已存在则就地覆盖（补上真实 id / 已读状态），否则追加。
 *
 * @returns 新数组（按 id 升序），调用方可直接 setState
 */
export function mergeMessage(
  list: NotifyMessage[],
  incoming: NotifyMessage,
): NotifyMessage[] {
  const index = list.findIndex((item) => isSameMessage(item, incoming));
  if (index < 0) {
    return sortMessages([...list, incoming]);
  }
  const next = [...list];
  next[index] = incoming;
  return next;
}

/**
 * 把「更早的一页历史」并到消息流头部。
 *
 * @param list  当前消息流（正序）
 * @param older 更早的一页（**后端倒序返回**，调用方需先 `reverse()`）
 */
export function prependHistory(
  list: NotifyMessage[],
  older: NotifyMessage[],
): NotifyMessage[] {
  const merged: NotifyMessage[] = [];
  const seen = new Set<string>();
  for (const message of [...older, ...list]) {
    const key = messageKey(message);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(message);
  }
  return sortMessages(merged);
}

/** 会话列表排序：最后活跃的在前（字符串 ID 走数值序比较，禁止 `Number()`）。 */
export function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) =>
    compareSnowflakeId(b.lastMessageId, a.lastMessageId),
  );
}

/** 把某个会话的未读清零（进入会话 / 标记已读后调用）。 */
export function clearSessionUnread(
  list: Conversation[],
  session: ChatSession,
): Conversation[] {
  const key = sessionKey(session);
  return list.map((item) =>
    sessionKey(item) === key && item.unreadCount !== 0
      ? { ...item, unreadCount: 0 }
      : item,
  );
}

/** 实时消息对会话列表的影响。 */
export interface ApplyIncomingOptions {
  /** 当前打开的会话（命中则不加未读）。 */
  activeSession: ChatSession | null;
}

/** {@link applyIncomingToConversations} 的结果。 */
export interface ApplyIncomingResult {
  /** 更新后的会话列表。 */
  conversations: Conversation[];
  /**
   * 该消息所属的会话是否已在列表中。
   *
   * <p>`false` 表示「收到了一个列表里还没有的会话」——调用方据此决定要不要拉一次会话列表。
   * 不适合就地插一条：缺 `targetName`，插进去会先显示成「用户 #id」再跳成真名，很难看。</p>
   */
  knownSession: boolean;
}

/**
 * 把一条实时消息折算到会话列表上（更新摘要 / 未读 / 排序）。
 *
 * @returns 非会话消息（系统通知）时原样返回，`knownSession` 为 `true`（无需刷新列表）
 */
export function applyIncomingToConversations(
  list: Conversation[],
  message: NotifyMessage,
  options: ApplyIncomingOptions,
): ApplyIncomingResult {
  const session = sessionOfMessage(message);
  if (!session) {
    return { conversations: list, knownSession: true };
  }

  const key = sessionKey(session);
  const index = list.findIndex((item) => sessionKey(item) === key);
  if (index < 0) {
    return { conversations: list, knownSession: false };
  }

  const selfSent = isMine(message);
  const isActive =
    options.activeSession != null && sessionKey(options.activeSession) === key;
  const current = list[index];
  const next = [...list];
  /**
   * 乱序到达（旧消息晚于新消息抵达）时不能拿旧内容覆盖摘要，否则会出现
   * 「lastMessageId 已是新的、正文却倒退」的不一致展示。未读不受此限——
   * 迟到的消息仍然是未读，照常 +1。
   */
  // 乐观行没有服务端 id（空串）：无从比较先后，按「最新」处理
  const incomingId = message.id || current.lastMessageId;
  const isLatest = compareSnowflakeId(incomingId, current.lastMessageId) >= 0;
  next[index] = {
    ...current,
    ...(isLatest
      ? {
          lastMessageId: message.id || current.lastMessageId,
          lastContent: message.content ?? current.lastContent,
          lastMessageType: message.messageType ?? current.lastMessageType,
          lastSenderUserId: message.senderUserId ?? current.lastSenderUserId,
          lastMessageMine: selfSent,
          lastTime: message.createTime ?? current.lastTime,
        }
      : {}),
    unreadCount:
      selfSent || isActive ? current.unreadCount : current.unreadCount + 1,
  };
  return { conversations: sortConversations(next), knownSession: true };
}
