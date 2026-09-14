/**
 * 通知 / 会话域类型与**未读口径**（纯函数，前端镜像后端契约）。
 *
 * <p>未读三口径的权威定义在 {@code NotifyMessageMapper}（SQL 为准），前端逐条对齐：
 * <ul>
 *   <li>{@code inbox} —— {@code read_status=0 and notify_type not in (6,7)}：系统通知红点，
 *       注意**含 type=8 传输完成**（`NotifyType.isInbox()` 注释写的是 1~5，与 SQL 不一致，
 *       以 SQL 为准——它才是红点上显示的数字）；</li>
 *   <li>{@code todo} —— {@code notify_type in (1,2,8)}：待办中心角标；</li>
 *   <li>{@code chat} —— {@code notify_type in (6,7)}：会话角标，与红点<b>互不重叠</b>。</li>
 * </ul>
 *
 * <p>因此实时增量的正确算法是：会话消息 → {@code chat+1}；其余系统通知 → {@code inbox+1}，
 * 且当类型属于待办三段时再 {@code todo+1}（见 {@link applyIncomingMessage}）。
 */

/** 未读三口径快照（`GET /v1/notifications/unread`、WS `CONNECTED`/`UNREAD` 帧共用）。 */
export interface UnreadCount {
  /** 系统通知未读数（导航栏红点）。 */
  inbox: number;
  /** 待办未办数（待我审批 / 审批结果 / 传输完成）。 */
  todo: number;
  /** 会话未读数（单聊 + 群聊）。 */
  chat: number;
}

/** 零值快照。 */
export const EMPTY_UNREAD: UnreadCount = { inbox: 0, todo: 0, chat: 0 };

/** 通知类型（与 {@code NotifyType} 逐值对齐）。 */
export const NotifyType = {
  /** 审批待办（→ 审批人）。 */
  APPROVAL_TODO: 1,
  /** 审批结果（→ 申请人）。 */
  APPROVAL_RESULT: 2,
  /** 外发链接锁定。 */
  SHARE_LOCKED: 3,
  /** 外发链接到期提醒。 */
  SHARE_EXPIRE_SOON: 4,
  /** 异常登录告警。 */
  ABNORMAL_LOGIN: 5,
  /** 单聊消息。 */
  IM_PRIVATE: 6,
  /** 群聊消息。 */
  IM_GROUP: 7,
  /** 传输完成提醒。 */
  TRANSFER_COMPLETED: 8,
} as const;

/** 会话范围（与后端 {@code ChatScope} 对齐）。 */
export const ChatScope = {
  /** 单聊（chatTargetId = 对端用户 ID）。 */
  PRIVATE: 1,
  /** 群聊（chatTargetId = 群组 ID）。 */
  GROUP: 2,
} as const;

/** 消息体类型（与后端 {@code MessageType} 对齐，CE 目前透传不做差异化渲染）。 */
export const MessageType = {
  TEXT: 1,
  FILE: 2,
  IMAGE: 3,
  SYSTEM: 4,
} as const;

/**
 * 站内 / 会话消息（`NotifyMessageVO`）。
 *
 * <p>REST 列表元素与 WebSocket `NOTIFY`/`CHAT` 帧的 {@code data} 同构，前端只写一套解析逻辑。
 */
export interface NotifyMessage {
  id: number;
  recipientUserId?: number | null;
  senderUserId?: number | null;
  notifyType: number;
  messageType?: number | null;
  chatScope?: number | null;
  chatTargetId?: number | null;
  clientMsgId?: string | null;
  title?: string | null;
  content?: string | null;
  bizType?: string | null;
  bizId?: number | null;
  readStatus?: number | null;
  readTime?: string | null;
  createTime?: string | null;
}

/** 是否会话消息（6/7）。 */
export function isChatNotify(notifyType: number): boolean {
  return notifyType === NotifyType.IM_PRIVATE || notifyType === NotifyType.IM_GROUP;
}

/** 是否计入待办（1/2/8）。 */
export function isTodoNotify(notifyType: number): boolean {
  return (
    notifyType === NotifyType.APPROVAL_TODO ||
    notifyType === NotifyType.APPROVAL_RESULT ||
    notifyType === NotifyType.TRANSFER_COMPLETED
  );
}

/** 是否计入系统通知红点（≠6/7，即含 1~5 与 8）。 */
export function isInboxNotify(notifyType: number): boolean {
  return !isChatNotify(notifyType);
}

/** 规范化快照：负数 / NaN / 缺失一律归零，避免出现 "-1" 角标。 */
export function normalizeUnread(raw?: Partial<UnreadCount> | null): UnreadCount {
  const pick = (value: unknown): number => {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? Math.floor(num) : 0;
  };
  return { inbox: pick(raw?.inbox), todo: pick(raw?.todo), chat: pick(raw?.chat) };
}

/**
 * 实时增量：把一条新消息折算到三口径上。
 *
 * <p>口径说明见文件头——这里刻意做成纯函数，是整套红点逻辑里最容易算错的 5 行。
 */
export function applyIncomingMessage(current: UnreadCount, notifyType: number): UnreadCount {
  const base = normalizeUnread(current);
  if (isChatNotify(notifyType)) {
    return { ...base, chat: base.chat + 1 };
  }
  return {
    ...base,
    inbox: base.inbox + 1,
    todo: isTodoNotify(notifyType) ? base.todo + 1 : base.todo,
  };
}

/**
 * 「一键已读」后的本地快照。
 *
 * <p>后端 `markAllInboxRead` 翻转的是 <b>notify_type not in (6,7)</b>，
 * 因此 inbox 与 todo 同时清零、chat 不动（聊天记录不能被「全部已读」顺带清掉）。
 */
export function applyInboxCleared(current: UnreadCount): UnreadCount {
  const base = normalizeUnread(current);
  return { inbox: 0, todo: 0, chat: base.chat };
}

/** 角标展示：超过上限显示 99+。 */
export function formatBadgeCount(count: number, max = 99): string {
  const normalized = normalizeUnread({ inbox: count }).inbox;
  return normalized > max ? `${max}+` : String(normalized);
}
