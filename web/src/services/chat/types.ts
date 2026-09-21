/**
 * 会话域类型与展示口径（纯函数，前端镜像后端契约）。
 *
 * <p>几处与后端对齐的关键口径，集中写在这里以免散落进组件：
 * <ul>
 *   <li><b>会话的唯一标识是 {@code (chatScope, targetId)} 二元组</b>，不是单个 ID——
 *       写扩散（见后端 {@code NotifyMessage} 类注）下同一个「会话」在双方各自的记录里
 *       指向互为对端的目标 ID，因此 {@code targetId} 单独拿出来没有全局含义，
 *       任何「会话 → 字符串」的映射都必须带上 scope（见 {@link sessionKey}）。</li>
 *   <li><b>消息方向由 {@code isSelfSentMessage} 判定</b>，不要试图比对「当前用户 ID」——
 *       登录态里没有可信的用户主键（详见 {@code services/notify/types}）。</li>
 *   <li><b>{@code targetName} 可能为空</b>：群聊后端恒不返回群名（群名属 {@code sys_group}，
 *       表族收口仍挂在 architecture.md D-11），单聊也可能因用户已注销而查不到。
 *       展示名一律经 {@link conversationTitle} 回落，页面不要自己拼字符串。</li>
 * </ul>
 */

import {
  ChatScope,
  isChatNotify,
  isSelfSentMessage,
  MessageType,
  type NotifyMessage,
} from '@/services/notify';

/** 会话列表项（对齐后端 `ConversationVO`）。 */
export interface Conversation {
  /** 会话范围：1-单聊 2-群聊。 */
  chatScope: number;
  /** 会话目标：单聊=对端用户 ID；群聊=群组 ID。19 位雪花 ID，服务端以字符串下发。 */
  targetId: string;
  /** 会话名：单聊=对端展示名（可能为 null）；群聊后端恒为 null。 */
  targetName?: string | null;
  /** 最后一条消息 ID（去重实时帧 / 作翻页游标）。 */
  lastMessageId: string;
  /** 最后一条消息正文（列表摘要）。 */
  lastContent?: string | null;
  /** 最后一条消息体类型（见 `MessageType`）。 */
  lastMessageType?: number | null;
  /** 最后一条消息的发送人 ID。 */
  lastSenderUserId?: string | null;
  /**
   * 最后一条消息是否我发的（由服务端判定）。
   *
   * <p>会话列表项里没有 `recipientUserId`（它恒等于调用者，服务端不吐出来），
   * 所以这里不能像消息流那样就地推算，必须由服务端给出。</p>
   */
  lastMessageMine?: boolean;
  /** 最后一条消息时间（ISO 字符串）。 */
  lastTime?: string | null;
  /** 该会话未读数（0 = 不渲染角标）。 */
  unreadCount: number;
}

/** 会话定位（唯一标识）。 */
export interface ChatSession {
  chatScope: number;
  targetId: string;
}

/** 发送消息入参（对齐后端 `ChatSendDTO`）。 */
export interface ChatSendPayload {
  scope: number;
  /** 会话目标 ID：字符串下发/回传，后端 Jackson 反序列化为 Long，前端不得 `Number()` 归一。 */
  targetId: string;
  /** 1-文本 2-文件传输 3-审批结果（会话消息禁止传 0）。 */
  messageType: number;
  content: string;
  /** 幂等键：同一条消息重发必须沿用同一个值。 */
  clientMsgId: string;
}

/** 会话键：`scope:targetId`。用作 React key 与 Map 键。 */
export function sessionKey(session: ChatSession): string {
  return `${session.chatScope}:${session.targetId}`;
}

/** 两个会话是否同一个（比较键而非对象引用）。 */
export function isSameSession(
  a: ChatSession | null | undefined,
  b: ChatSession | null | undefined,
): boolean {
  if (!a || !b) {
    return false;
  }
  return a.chatScope === b.chatScope && a.targetId === b.targetId;
}

/** 会话名回落标签（由页面注入 intl 版本，避免纯函数里硬编码语言）。 */
export interface ConversationTitleLabels {
  /** 群聊回落名，如「群聊 #3」。 */
  group: (id: string) => string;
  /** 单聊回落名，如「用户 #7」。 */
  user: (id: string) => string;
}

/** 默认回落标签（中文；单测 / 非 React 场景用，页面应传 intl 版本）。 */
export const DEFAULT_CONVERSATION_TITLE_LABELS: ConversationTitleLabels = {
  group: (id) => `群聊 #${id}`,
  user: (id) => `用户 #${id}`,
};

/** 会话展示名回落链：后端名 → 「群聊 #id」/「用户 #id」。 */
export function conversationTitle(
  session: ChatSession & { targetName?: string | null },
  labels: ConversationTitleLabels = DEFAULT_CONVERSATION_TITLE_LABELS,
): string {
  const name = session.targetName?.trim();
  if (name) {
    return name;
  }
  return session.chatScope === ChatScope.GROUP
    ? labels.group(session.targetId)
    : labels.user(session.targetId);
}

/** 头像展示字符：取展示名首字符（中文取第一个字，英文取首字母大写）。 */
export function conversationInitial(
  session: ChatSession & { targetName?: string | null },
  labels?: ConversationTitleLabels,
): string {
  return conversationTitle(session, labels).slice(0, 1).toUpperCase();
}

/**
 * 消息摘要（会话列表里那一行灰字）。
 *
 * @param message   消息摘要来源（消息本体，或会话项的 `lastXxx` 字段）
 * @param maxLength 截断长度（按字符计，超出补省略号）
 */
export function messageSummary(
  message: Pick<NotifyMessage, 'content' | 'messageType'> & {
    mine?: boolean | null;
  },
  maxLength = 40,
): string {
  const body = truncate(message.content ?? '', maxLength);
  const prefix = messagePrefix(message.messageType);
  return `${message.mine ? '我：' : ''}${prefix}${body}`;
}

/** 会话列表项摘要（字段口径与 {@link messageSummary} 一致）。 */
export function conversationSummary(
  conversation: Conversation,
  maxLength = 40,
): string {
  return messageSummary(
    {
      content: conversation.lastContent,
      messageType: conversation.lastMessageType,
      mine: conversation.lastMessageMine,
    },
    maxLength,
  );
}

/** 消息体类型前缀（文本类不加前缀）。 */
export function messagePrefix(messageType?: number | null): string {
  switch (messageType) {
    case MessageType.FILE:
      return '[文件] ';
    case MessageType.APPROVAL:
      return '[审批] ';
    default:
      return '';
  }
}

/**
 * 把一条消息折算成会话定位。
 *
 * <p>无论消息方向如何，{@code (chatScope, chatTargetId)} 都能直接当会话键用：
 * 写扩散按<b>接收人视角</b>记 target，所以「我发的」那一行 target 也是会话对端。</p>
 *
 * @returns 非会话消息、或缺会话字段的脏数据返回 null（调用方据此忽略）
 */
export function sessionOfMessage(message: NotifyMessage): ChatSession | null {
  if (!isChatNotify(message.notifyType)) {
    return null;
  }
  if (message.chatScope == null || message.chatTargetId == null) {
    return null;
  }
  return { chatScope: message.chatScope, targetId: message.chatTargetId };
}

/** 消息是否我自己发的（转发 notify 域口径，避免聊天页各处重复判断）。 */
export function isMine(message: NotifyMessage): boolean {
  return isSelfSentMessage(message);
}

/** 生成幂等键：优先 `crypto.randomUUID`，降级为「时间戳 + 随机串」。 */
export function newClientMsgId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) {
    return uuid;
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 按字符截断（超长补省略号；`maxLength <= 0` 视为不截断）。 */
export function truncate(text: string, maxLength: number): string {
  if (maxLength <= 0 || text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}…`;
}
