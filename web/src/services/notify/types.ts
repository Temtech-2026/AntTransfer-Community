/**
 * 通知 / 会话域类型与**未读口径**（纯函数，前端镜像后端契约）。
 *
 * <p>未读三口径的权威定义在 {@code NotifyMessageMapper}（SQL 为准），前端逐条对齐：
 * <ul>
 *   <li>{@code inbox} —— {@code read_status=0 and notify_type not in (6,7)}：系统通知红点，
 *       注意**含 type=8 传输完成与 type=9 取件回执**（后端的 `NotifyType.isInbox()` 已在
 *       2026-09-29 随 9 扩段修正为与 SQL 同口径，此前的 1~5 区间判断已不再存在）；</li>
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
  /** 外发链接被取件回执（→ 链接创建者）。 */
  SHARE_ACCESSED: 9,
} as const;

/** 会话范围（与后端 {@code ChatScope} 对齐）。 */
export const ChatScope = {
  /** 单聊（chatTargetId = 对端用户 ID）。 */
  PRIVATE: 1,
  /** 群聊（chatTargetId = 群组 ID）。 */
  GROUP: 2,
} as const;

/**
 * 消息体类型（与后端 {@code MessageType} 逐值对齐）。
 *
 * <p><b>修正说明：</b>此前此处写的是 {@code IMAGE:3 / SYSTEM:4}，与后端不符——
 * 后端口径为 {@code SYSTEM:0 / CHAT_TEXT:1 / FILE_TRANSFER:2 / APPROVAL_RESULT:3}
 * （见 at-common {@code MessageType}；会话消息禁止取 0，由 ChatService 校验）。
 * 因当时前端只做透传、不按类型差异化渲染，偏差一直没被暴露；
 * 聊天页要按类型渲染「[文件]」这类摘要，必须以后端为准。</p>
 */
export const MessageType = {
  /** 非会话消息（系统通知 / 待办）——不会出现在会话流里。 */
  SYSTEM: 0,
  /** 文本（单聊 / 群聊）。 */
  TEXT: 1,
  /** 文件传输通知（文件卡片）。 */
  FILE: 2,
  /** 审批结果通知（结论卡片）。 */
  APPROVAL: 3,
} as const;

/** 撤回状态（与后端 {@code NotifyMessage.RECALL_*} 逐值对齐）。 */
export const RecallStatus = {
  /** 正常（未撤回）。 */
  NONE: 0,
  /** 已撤回：正文已被服务端清空，渲染成「已撤回」占位。 */
  DONE: 1,
} as const;

/**
 * 已读某条会话消息的读者（对齐后端 {@code ChatReaderVO}）。
 *
 * <p><b>为什么必须有独立的类型而不是复用会话对端</b>：读者是「这条消息被谁读了」，
 * 与「这条消息属于哪个会话」无关——群聊里一条消息可以挂一串读者。展示只需要
 * 「画得出头像」的几项（ID + 展示名 + 头像地址），故服务端也只回这几项。</p>
 */
export interface ChatReader {
  /** 读者用户 ID（19 位雪花 ID，服务端以字符串下发）。 */
  userId: string;
  /** 读者展示名（与消息头像同一口径；服务端保证非空，为空的行不会下发）。 */
  displayName: string;
  /**
   * 读者头像对外地址（含 `?v=` 缓存版本号）；null 表示该读者没有头像。
   *
   * <p>缺失时渲染回落展示名首字符——头像缺失不该让「谁读了」这块信息消失。</p>
   */
  avatarUrl?: string | null;
}

/**
 * 站内 / 会话消息（`NotifyMessageVO`）。
 *
 * <p>REST 列表元素与 WebSocket `NOTIFY`/`CHAT` 帧的 {@code data} 同构，前端只写一套解析逻辑。
 *
 * <p><b>ID 均为字符串</b>（19 位雪花 ID 超出 JS 安全整数范围，服务端统一以字符串下发）。
 * {@link #id} 在乐观行（尚未收到服务端回执）时为 {@code ''}，排序时按「空串排在末尾」处理。</p>
 */
export interface NotifyMessage {
  id: string;
  recipientUserId?: string | null;
  senderUserId?: string | null;
  /**
   * 发送人展示名（服务端反查，仅会话消息下发）。
   *
   * <p><b>为什么消息要自带发送人是谁</b>：群聊里一个会话流有多个发送人，
   * 只靠「当前会话对端」画不出每行头像与首字符兜底；单聊里它与对端展示名同源，
   * 前端因此不必分场景取名字。</p>
   */
  senderDisplayName?: string | null;
  /**
   * 发送人头像对外地址（含 `?v=` 缓存版本号）；null = 没有头像，渲染回落首字符。
   *
   * <p>「我发的」那一行恒为 null：自己的头像不在消息载荷里，前端从登录态取
   * （见 `hooks/useCurrentUserAvatar`），少一次冗余查库。</p>
   */
  senderAvatarUrl?: string | null;
  notifyType: number;
  messageType?: number | null;
  chatScope?: number | null;
  chatTargetId?: string | null;
  clientMsgId?: string | null;
  title?: string | null;
  content?: string | null;
  bizType?: string | null;
  bizId?: string | null;
  /**
   * <b>本行接收人</b>是否已读。
   *
   * <p><b>不能当已读回执用</b>：写扩散下「我发的」那一行接收人就是我自己，
   * 落库即已读，于是我自己发的消息在这里恒为已读（1）。「谁读了我发的消息」
   * 是另一个方向的信息：历史里由 {@link NotifyMessage.readers} 给出，
   * 实时由 `CHAT_READ` 帧增量补上（见 {@code services/chat/readReceipt}）。</p>
   */
  readStatus?: number | null;
  readTime?: string | null;
  /**
   * 本条消息是否<b>点名了本行接收人</b>（{@code @} 提及）。
   *
   * <p><b>与 {@link readStatus} 同一维度：都是「相对本行接收人」的属性</b>。
   * 写扩散下同一条群消息落 N 行，只有被 @ 的那个人收到的那份为 {@code true}——
   * 因此绝不能把它理解成「这条消息提到了谁」，它回答的只是「<b>提到我了吗</b>」。
   * 想渲染正文里的 `@昵称` 高亮，用消息正文自身即可，不必依赖本字段。</p>
   *
   * <p>服务端只会对「别人 @ 我」置位（发送人自己那一行恒为 false），
   * 所以渲染层不必再判一次方向。缺失（老接口 / 系统通知）按 {@code false} 处理。</p>
   */
  mentioned?: boolean | null;
  /**
   * 撤回状态：0-正常 1-已撤回（见 {@link RecallStatus}）。
   *
   * <p><b>不要用「content 为空」判定撤回</b>：空正文是合法状态（文件 / 审批类消息的
   * 展示文案可以为空），以空串判定会把正常消息渲染成「已撤回」。
   * 服务端撤回时会两件事一起做（本字段置 1，且 content 清空），
   * 前者是给渲染用的语义标记。</p>
   */
  recallStatus?: number | null;
  /** 撤回时间（未撤回为 null）。 */
  recallTime?: string | null;
  /**
   * 被引用消息的幂等键（非空即为「引用回复」）。
   *
   * <p><b>用它而不是消息 id 定位原消息</b>：写扩散下同一条消息在发送人与接收人那里
   * 是不同的行（id 不同），只有幂等键跨行、跨端一致。</p>
   */
  quoteClientMsgId?: string | null;
  /** 被引用消息的发送人用户 ID（引用块里显示「谁说的」）。 */
  quoteSenderUserId?: string | null;
  /**
   * 被引用消息的正文快照（服务端已按码点截断）。
   *
   * <p><b>是快照不是实时值</b>：原消息随后被撤回也不会让它变空，
   * 因此渲染时不要再回查原消息。</p>
   */
  quoteContent?: string | null;
  createTime?: string | null;
  /**
   * 读过这条消息的人（**仅会话历史**填充；实时到达的读者见 `CHAT_READ` 帧）。
   *
   * <p>只对「我发的」消息有意义——别人发的消息上这个字段恒为空数组：
   * 「谁读了我的话」与「我读没读别人的话」是两条互不相干的信息。</p>
   */
  readers?: ChatReader[] | null;
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

/** 是否计入系统通知红点（≠6/7，即含 1~5、8、9）。 */
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
 * 这条消息是否由收件人自己发出。
 *
 * <p>写扩散（见后端 {@code NotifyMessage} 类注）下，「我发的」那一行的
 * {@code recipientUserId} 就是我，因此比较 sender 与 recipient 即可判定方向。
 * 这个判据<b>不依赖调用方知道自己的 userId</b>——前端登录态里恰恰没有可信的用户主键
 * （见 {@code pages/system/users} 的文件头说明），所以不能改用「当前用户 ID 比对」。</p>
 *
 * <p>为什么必须能判定方向：WS 推送覆盖该用户的<b>全部连接</b>（多端同步所需），
 * 自己发的消息也会原样推回给自己。若不拦住，每发一条消息导航栏的会话角标就 +1。</p>
 */
export function isSelfSentMessage(
  message: Pick<NotifyMessage, 'senderUserId' | 'recipientUserId'>,
): boolean {
  return message.senderUserId != null && message.senderUserId === message.recipientUserId;
}

/**
 * 实时增量：把一条新消息折算到三口径上。
 *
 * <p>口径说明见文件头——这里刻意做成纯函数，是整套红点逻辑里最容易算错的几行。</p>
 *
 * @param selfSent 是否为「自己发出」的消息（由 {@link isSelfSentMessage} 判定）。
 *                 为 `true` 时三口径一律不动：它不是未读，只是自己的一次写入回声。
 */
export function applyIncomingMessage(
  current: UnreadCount,
  notifyType: number,
  selfSent = false,
): UnreadCount {
  const base = normalizeUnread(current);
  if (selfSent) {
    return base;
  }
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
