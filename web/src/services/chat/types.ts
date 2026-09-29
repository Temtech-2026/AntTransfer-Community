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
 *   <li><b>{@code targetName} 可能为空</b>：群聊取名自 {@code sys_group}，群解散 / 已逻辑删除时查不到；
 *       单聊则可能因对端已注销而查不到。展示名一律经 {@link conversationTitle} 回落，
 *       页面不要自己拼字符串。</li>
 * </ul>
 */

import {
  ChatScope,
  isChatNotify,
  isSelfSentMessage,
  MessageType,
  RecallStatus,
  type NotifyMessage,
} from '@/services/notify';

import type { ChatPresenceStatus } from '@/services/ws/protocol';

import { fileCardDisplayText } from './fileCard';

/** 会话列表项（对齐后端 `ConversationVO`）。 */
export interface Conversation {
  /** 会话范围：1-单聊 2-群聊。 */
  chatScope: number;
  /** 会话目标：单聊=对端用户 ID；群聊=群组 ID。19 位雪花 ID，服务端以字符串下发。 */
  targetId: string;
  /** 会话名：单聊=对端展示名；群聊=群名。两者都可能查不到（对端注销 / 群解散），null 时由前端回落。 */
  targetName?: string | null;
  /**
   * 会话头像对外地址（含 `?v=` 缓存版本号）。
   *
   * <p><b>群聊恒为 null</b>：群组没有头像，列表与详情一律回落群名首字——
   * 这与 {@link conversationTitle} 的群名回落是同一口径，不额外造一套「默认群头像」。
   * 单聊为对端头像；对端没有头像（或已注销）时也是 null，渲染回落首字符。</p>
   */
  targetAvatarUrl?: string | null;
  /**
   * <b>我给这个对端起的备注</b>（`sys_chat_peer_alias` 里 `(我, 他)` 那一行的值）。
   *
   * <p><b>它不是昵称，是「我这边的称呼」</b>：只影响我看到的展示名，
   * 不写 `sys_user`、对方与其他人的界面上都不变（对齐微信 / QQ 的语义）。
   * 因此它<b>不覆盖</b> {@link Conversation.targetName}——那仍是对方的真实昵称，
   * 资料卡上要如实显示，两者是两个字段而不是一个字段的两种取值。</p>
   *
   * <p><b>展示优先级由 {@link conversationTitle} 统一裁决</b>：备注 → 真实名 → 回落名。
   * 页面不要自己拼字符串，否则「列表显示备注、详情显示昵称」这类分裂迟早出现。</p>
   *
   * <p><b>群聊恒为 null</b>：群聊没有「对端用户」，备注无处可挂。</p>
   */
  peerAlias?: string | null;
  /** 最后一条消息 ID（去重实时帧 / 作翻页游标）。 */
  lastMessageId: string;
  /** 最后一条消息正文（列表摘要）。 */
  lastContent?: string | null;
  /** 最后一条消息体类型（见 `MessageType`）。 */
  lastMessageType?: number | null;
  /** 最后一条消息的发送人 ID。 */
  lastSenderUserId?: string | null;
  /**
   * 最后一条消息是否已撤回（见 `RecallStatus`）。
   *
   * <p><b>为什么摘要需要这个字段：</b>撤回会把正文清空，若列表只看 `lastContent`，
   * 「撤回了最后一条消息」会让那一行灰字变成空白——用户看到的是「消息丢了」，
   * 而不是「被撤回了」。刷新后本地状态会丢，故该字段必须由服务端给出。</p>
   */
  lastRecallStatus?: number | null;
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
  /**
   * 该会话未读里「点名了我」的条数（后端 {@code ConversationVO.mentionUnreadCount}）。
   *
   * <p><b>与 {@link unreadCount} 是包含关系，不是并列关系</b>：被 @ 的消息本身也是一条未读，
   * 它同时计入两者。因此界面上应是「角标数字仍取 {@code unreadCount}，
   * 若 {@code mentionUnreadCount > 0} 则把角标换成『有人 @ 我』的强调样式」，
   * 两个数<b>不相加</b>——相加会让用户看到比实际未读更多的数字。</p>
   *
   * <p>取值为 0 是常态（绝大多数会话没有人 @ 我），渲染层据此决定是否上强调样式。</p>
   */
  mentionUnreadCount: number;
}

/**
 * 解析出的单聊目标（对齐后端 `ChatTargetVO`）。
 *
 * <p><b>为什么发起会话需要这一步：</b>会话的落库形态是 19 位雪花 ID，而用户记得住的是
 * 登录账号；用户目录（`/api/v1/system/users`）只对系统管理面开放，非管理员既搜不到人、
 * 也无从知道该填什么 ID。因此「输入账号 → 拿到 targetId」必须由服务端翻译。</p>
 *
 * <p><b>只有这两个字段是刻意的</b>：服务端只回「你要发给谁」，不回邮箱 / 部门等画像，
 * 且要求精确提供对方账号（不是模糊检索），前端不要在此扩展用户信息缓存。</p>
 */
export interface ChatTarget {
  /** 对端用户 ID（19 位雪花 ID，服务端以字符串下发）。 */
  targetId: string;
  /** 对端展示名（昵称为空时服务端回落登录账号，恒非空）。 */
  displayName: string;
  /** 对端头像对外地址（含 `?v=` 缓存版本号）；null = 对端没有头像，渲染回落首字符。 */
  avatarUrl?: string | null;
}

/**
 * 备注操作结果（对齐后端 `ChatPeerVO`）。
 *
 * <p>设置 / 取消都回吐「这次操作后的状态」，因此调用方拿到它就知道了最终值，
 * 无需再查一次会话列表：设置成功即 {@code alias} 为写入值，取消成功即 {@code alias} 为 null。</p>
 */
export interface ChatPeer {
  /** 被备注的用户 ID（原样回吐，便于确认这次改的是谁）。19 位雪花 ID，字符串。 */
  peerId: string;
  /** 当前备注名；null = 现在没有备注（取消成功，或本来就没设过）。 */
  alias: string | null;
}

/**
 * 群聊视图（对齐后端 `ChatGroupVO`）。
 *
 * <p><b>这是「群聊此前为何不可用」的补缺：</b>群聊会话以 `targetId = 群组 ID` 定位，
 * 而群组此前既没有创建入口、也没有查询入口——用户只能手填一个 19 位雪花 ID，
 * 而这样的群既建不出来、ID 也无从得知，该分支对任何人都走不通。
 * 建群（`POST /v1/chat/groups`）与「我加入的群」（`GET /v1/chat/groups`）补齐后两端闭合。</p>
 *
 * <p>`id` 可直接作为 `ChatSession.targetId`（配 `chatScope = ChatScope.GROUP`），
 * 因此<b>建群成功后不必再拉一次会话列表</b>就能进入会话——否则「建群成功」与
 * 「能开始聊」之间会多一段空窗，用户在此期间只能看到一个没有名字的会话框。</p>
 */
export interface ChatGroup {
  /** 群组 ID（19 位雪花 ID，服务端以字符串下发）；即群聊会话的 `targetId`。 */
  id: string;
  /** 群名（服务端建群时已裁掉首尾空白并拒绝空名，恒非空）。 */
  name: string;
  /** 群主用户 ID（字符串）；用于「我是群主」判断与展示。 */
  ownerUserId: string;
  /** 成员数（含群主）。 */
  memberCount: number;
}

/**
 * 群内角色（镜像后端 `GroupMember` 的常量）。
 *
 * <p>面板只用它做展示分档（管理员标一个 Tag），<b>不参与任何权限判定</b>——
 * 能不能操作由服务端下发的 {@link ChatGroupAbility} 说了算。</p>
 */
export const CHAT_GROUP_ROLE = {
  MEMBER: 1,
  ADMIN: 2,
  READONLY: 3,
} as const;

/**
 * 群成员（对齐后端 `ChatGroupMemberVO`）。
 */
export interface ChatGroupMember {
  /** 成员用户 ID（19 位雪花 ID，字符串）。 */
  userId: string;
  /**
   * 展示名；账号已删除 / 被禁用时为 `null`。
   *
   * <p>与「会话读者」不同：读者恒是当前有消息往来的人（必为可用账号），
   * 而群成员可能离职——服务端刻意不编造占位文案（那是展示层职责且要跟随语言），
   * 由面板按 i18n 文案回落「未知成员」。</p>
   */
  displayName: string | null;
  /**
   * 成员头像对外地址（含 `?v=` 缓存版本号）；null = 没有头像（含账号已删除），
   * 渲染回落 {@link displayName} 首字符；`displayName` 也为空时按面板的 i18n 文案取首字。
   */
  avatarUrl?: string | null;
  /** 群内角色：1-普通成员 2-管理员 3-只读（见 {@link CHAT_GROUP_ROLE}）。 */
  memberRole: number;
  /** 是否群主（由 `sys_group.owner_user_id` 判定，<b>不</b>看 `memberRole`）。 */
  owner: boolean;
  /** 入群时间（被移除后重新入群时刷新为本次时间）。 */
  joinTime: string;
}

/**
 * 「<b>我</b>在这个群里能做什么」（对齐后端 `ChatGroupAbilityVO`）。
 *
 * <p><b>为什么用服务端下发的布尔而不是前端自己算：</b>前端登录态没有可信的用户主键
 * （项目铁律：ID 一律字符串过线，且前端不得据本地状态做鉴权决策）——
 * 既拿不到自己的 ID，就无法把 `ownerUserId` 与自己比对；即便拿到了，那也是可伪造的本地判定。</p>
 *
 * <p><b>与权限点取「与」：</b>本对象只表达<b>群内身份</b>维度；「这个账号有没有群管理功能」
 * 仍由 {@link CHAT_PERM} 里的点经 `useAccess` 判定。两者都成立才显示按钮：
 * 身份不够会被 1038 / 1041 拒，功能未授权会被 1003 拒。</p>
 */
export interface ChatGroupAbility {
  /** 能否修改群名（群主 / 管理员）。 */
  canRename: boolean;
  /** 能否邀请新成员（群主 / 管理员）。 */
  canInvite: boolean;
  /** 能否移除成员（仅群主）。 */
  canRemoveMember: boolean;
  /** 能否解散该群（仅群主）。 */
  canDissolve: boolean;
  /** 能否退出该群（群主恒为 false：群主退群会造出无主群）。 */
  canQuit: boolean;
}

/**
 * 群详情（对齐后端 `ChatGroupDetailVO`）——群配置面板的唯一数据源。
 *
 * <p>六个写端点里，改群名 / 邀请 / 移除都回本对象，面板据此直接刷新而不必再发一次 `GET`。</p>
 */
export interface ChatGroupDetail {
  /** 群 ID（19 位雪花 ID，字符串）。 */
  id: string;
  /** 群名称。 */
  name: string;
  /** 群主用户 ID（字符串）。 */
  ownerUserId: string;
  /** 当前成员数。 */
  memberCount: number;
  /** 成员数上限（服务端配置）：面板用它做「邀请后会不会超」的即时提示。 */
  memberLimit: number;
  /** 我在该群内可执行的操作（服务端算好，前端不自行推导）。 */
  ability: ChatGroupAbility;
  /** 成员名单（按成员行 ID 升序，群主恒为第一行）。 */
  members: ChatGroupMember[];
}

/**
 * 对端在线状态视图（对齐后端 `ChatPresenceVO`）。
 *
 * <p>两条路径共用同一个形状：`POST /v1/chat/presence/watch` 的响应（`userId` 恒等于请求的
 * `targetId`），以及 `PRESENCE` 帧的载荷（`userId` 是状态发生变化的那个用户）。</p>
 */
export interface ChatPresenceVO {
  /** 状态所属用户 ID（19 位雪花 ID，字符串）。 */
  userId: string;
  /** 三态：在线 / 离线 / 网络不佳。 */
  status: ChatPresenceStatus;
  /** 最近活跃时刻（epoch millis）；离线为 null。 */
  lastActiveAt?: number | null;
}

/** 会话定位（唯一标识）。 */
export interface ChatSession {
  chatScope: number;
  targetId: string;
  /**
   * 会话展示名（可选，跟着定位一起携带）。
   *
   * <p>名字的权威来源是会话列表（{@code Conversation.targetName}），可「列表 → 详情」这一步
   * 若只传定位键，名字就丢了，详情只能回落成「用户 #<雪花ID>」。故允许把它挂在定位上带过去。</p>
   *
   * <p><b>详情态的标题与头像必须都经 {@link resolveSessionDisplay} 取值</b>，否则会出现
   * 「标题写着系统管理员、头像却是『用』」这种同一屏内自相矛盾的画面。</p>
   */
  targetName?: string | null;
  /**
   * 会话头像地址（跟着定位一起携带，口径与 {@link Conversation.targetAvatarUrl} 一致）。
   *
   * <p>与名字同理：列表 → 详情只传定位键时头像也会丢。详情态的消息气泡、
   * 顶部信息区一律经 {@link resolveSessionDisplay} 取值。</p>
   */
  targetAvatarUrl?: string | null;
  /**
   * 我给该对端起的备注（口径见 {@link Conversation.peerAlias}）。
   *
   * <p>挂在定位上带过去，理由与 {@link ChatSession.targetName} 相同：深链（只剩
   * `scope + targetId`）或刚点进列表时，详情态要靠 {@link resolveSessionDisplay} 从列表回查；
   * 而用户刚改完备注是要<b>立刻</b>看到效果的，不该等下一次列表刷新。
   * 用户自己改的备注由覆盖表（`services/chat/peerAlias`）叠加，优先级高于这里。</p>
   */
  peerAlias?: string | null;
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
  /**
   * 被引用消息的幂等键（选填，非空即为「引用回复」）。
   *
   * <p>用幂等键而不是消息 id 指认原消息：写扩散下同一条消息在发送人与接收人那里
   * 是不同的行，只有幂等键跨行一致。服务端会校验它属于本会话且未被撤回，
   * 并把「谁说的 + 正文快照」抄进本次消息（`1036` 表示引用目标不可用）。</p>
   */
  quoteClientMsgId?: string | null;
  /**
   * {@code @} 提及对象的用户 ID 列表（选填，仅群聊有意义）。
   *
   * <p><b>为什么由前端给出 ID 而不让服务端解析正文里的 `@昵称`</b>：昵称可重名、可修改、
   * 可含空格与特殊字符，从文本反查「点的是谁」必然误判；而发送端本来就知道用户点选了谁。
   * 正文里仍然照常写入 `@昵称`（那是给人看的），ID 列表只用于让服务端给被点名者
   * 那一行打标记。</p>
   *
   * <p>服务端会<b>静默剔除</b>不属于本会话的 ID（不报错）：成员列表可能因「刚有人退群」
   * 而过期，此时整条消息发送失败是不可接受的。</p>
   *
   * <p>ID 一律字符串过线（19 位雪花 ID 超出 JS 安全整数范围），不得 `Number()` 归一。</p>
   */
  mentionUserIds?: string[] | null;
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

/**
 * 会话展示名回落链：<b>我给对方起的备注 → 后端真实名 → 「群聊 #id」/「用户 #id」</b>。
 *
 * <p><b>备注为什么排在最前：</b>备注的全部意义就是「我这边按我认得出的名字称呼他」——
 * 若真实昵称还能盖过它，用户改完备注会发现界面没变（对方有昵称时），这个功能等于不存在。
 * 它与真实名是两个字段（见 {@link Conversation.peerAlias}），只在<b>这一处</b>裁决优先级：
 * 列表、详情标题、消息气泡署名、头像首字全都经本函数取值，因此不会出现
 * 「列表是备注、详情是昵称」的分裂。</p>
 *
 * <p><b>群聊不吃备注</b>：群聊没有对端用户，`targetId` 是群组 ID，拿它当用户 ID 去查备注
 * 属于串域取值。即便脏数据里带了 `peerAlias`，这里也按 scope 拦掉。</p>
 */
export function conversationTitle(
  session: ChatSession & { targetName?: string | null },
  labels: ConversationTitleLabels = DEFAULT_CONVERSATION_TITLE_LABELS,
): string {
  const alias =
    session.chatScope === ChatScope.PRIVATE ? session.peerAlias?.trim() : '';
  if (alias) {
    return alias;
  }
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
 * 详情态展示对象：把会话名与头像回填到会话定位上，供标题与头像共同取值。
 *
 * <p><b>为什么必须存在这个函数：</b>详情态的会话往往只是一个定位键（点击列表时只取了
 * {@code scope + targetId}，深链更是只剩 URL 上的两个参数），而名字只存在会话列表里。
 * 各处若各自「顺手回查一下」，就会出现有人查、有人忘的局面——实测抽屉的标题做了回查、
 * 消息头像没做，于是列表里明明是「系」的系统管理员，进入会话后头像变成「用」
 * （回落「用户 #<id>」的首字），而标题依旧正确。同一屏两处自相矛盾，用户只会认为是 bug。</p>
 *
 * <p>头像与名字同源同理：只回填名字、不回填头像，就会出现「标题是系统管理员、
 * 头像却是不带图的『系』」——同一个人的头像在列表与详情两处不一致。</p>
 *
 * <p>取值优先级：会话自带的 → 会话列表回查 → 原样返回（名字交给 {@link conversationTitle}
 * 回落成「群聊 #id」/「用户 #id」，头像交给 `Avatar` 走首字符兜底）。自带优先让
 * 「点击列表进入」这条路径<b>不必等列表刷新</b>就有正确展示，也覆盖深链时列表尚未加载完的空窗期。</p>
 *
 * @param session       详情态会话（可能只是定位键）
 * @param conversations 会话列表（可空；为空或未命中时按回落处理）
 */
export function resolveSessionDisplay(
  session: ChatSession,
  conversations?: readonly Conversation[] | null,
): ChatSession {
  const named = Boolean(session.targetName?.trim());
  // 头像「已有值」只认非空字符串：null / undefined 都表示「还不知道」，需要回查列表
  // （群聊列表项本身就是 null，回查后仍是 null，渲染回落首字，不会来回震荡）
  const avatared = Boolean(session.targetAvatarUrl);
  // 备注的「已知 / 未知」用 undefined 判定而不是真值：null 是<b>有意义的值</b>
  // （「当前没有备注」），拿真值判定会让「取消备注」在详情态永远回填不上
  // ——那样列表已经回落成真实昵称、标题却还挂着旧备注，正是这个函数要消除的分裂。
  const aliased = session.peerAlias !== undefined;
  if (named && avatared && aliased) {
    return session;
  }
  const found = conversations?.find((item) => isSameSession(item, session));
  if (!found) {
    return session;
  }
  const nextName = named ? session.targetName : found.targetName;
  const nextAvatarUrl = avatared
    ? session.targetAvatarUrl
    : found.targetAvatarUrl;
  const nextAlias = aliased ? session.peerAlias : found.peerAlias;
  // 回查后三个字段都取到和原来一样的值时，返回原对象而不是新对象：
  // 调用方的 useMemo 依赖引用相等来避免白重渲染（群聊尤其明显——群里没有头像、
  // avatar 恒为空，若每次都铺一个新对象，打开群聊就会引发一串无谓重算）
  if (
    nextName === session.targetName &&
    nextAvatarUrl === session.targetAvatarUrl &&
    nextAlias === session.peerAlias
  ) {
    return session;
  }
  return {
    ...session,
    targetName: nextName,
    targetAvatarUrl: nextAvatarUrl,
    peerAlias: nextAlias,
  };
}

/**
 * 消息是否已撤回（撤回是终态，正文已被服务端清空）。
 *
 * <p><b>判定只看标记，不看正文是否为空</b>：空正文是合法状态（文件 / 审批类消息的
 * 展示文案可以为空），以空串判定会把正常消息渲染成「已撤回」。</p>
 */
export function isRecalled(
  message: Pick<NotifyMessage, 'recallStatus'>,
): boolean {
  return message.recallStatus === RecallStatus.DONE;
}

/**
 * 消息摘要（会话列表里那一行灰字）。
 *
 * @param message   消息摘要来源（消息本体，或会话项的 `lastXxx` 字段）
 * @param maxLength 截断长度（按字符计，超出补省略号）
 */
export function messageSummary(
  message: Pick<NotifyMessage, 'content' | 'messageType' | 'recallStatus'> & {
    mine?: boolean | null;
  },
  maxLength = 40,
): string {
  // 撤回是终态，正文已被清空：这里必须先行拦截，否则「撤回了最后一条消息」会让
  // 会话列表那行灰字变成纯空白，看起来像消息丢了而不是被撤回了。
  // 也不加消息类型前缀——「[文件] 已撤回」读起来像是文件被撤回了，而事实是整条消息
  if (isRecalled(message)) {
    return `${message.mine ? '我：' : ''}已撤回`;
  }
  const body = truncate(summaryBody(message), maxLength);
  const prefix = messagePrefix(message.messageType);
  return `${message.mine ? '我：' : ''}${prefix}${body}`;
}

/**
 * 摘要里真正该给人看的正文。
 *
 * <p>文件消息的正文末尾带一条「条目引用尾注」（见 `services/chat/fileCard`），
 * 那是给卡片点击用的机器可读信息。摘要不剥掉它，会话列表里就会甩出一串
 * `#file:1949…` 的雪花 ID。</p>
 *
 * <p>消息本体<b>带类型</b>，所以这里的门禁是「只在文件消息上剥」：文本消息里
 * 真写了 `#file:1` 也照原样留着（剥法见 {@link fileCardDisplayText}）。</p>
 */
function summaryBody(
  message: Pick<NotifyMessage, 'content' | 'messageType'>,
): string {
  const content = message.content ?? '';
  if (message.messageType !== MessageType.FILE) {
    return content;
  }
  return fileCardDisplayText(content);
}

/**
 * 会话是否「还有未读的 @ 我」。
 *
 * <p><b>为什么单独成一个函数而不是各处写 {@code mentionUnreadCount > 0}：</b>
 * 摘要前缀与角标强调必须同源——一处判成强调、另一处不强调，用户会看到「红了却没说为什么」。
 * 判定本身只有一行，但它承载的是「未读 @ 是未读的子集」（见 {@link Conversation.mentionUnreadCount}）
 * 这条口径，散落成字面量比较后就没人记得它了。</p>
 */
export function hasUnreadMention(
  conversation: Pick<Conversation, 'mentionUnreadCount'>,
): boolean {
  return (conversation.mentionUnreadCount ?? 0) > 0;
}

/**
 * 会话摘要里「有人 @ 我」前缀的标签（由调用方注入 intl 版本）。
 *
 * <p>与 {@link ConversationTitleLabels} 同一套路：纯函数里不硬编码语言。</p>
 */
export interface ConversationSummaryLabels {
  /** 如「有人@我」；渲染时会自动补上双方括号。 */
  mentionMe: string;
}

/** 默认标签（中文；单测 / 非 React 场景用，页面应传 intl 版本）。 */
export const DEFAULT_CONVERSATION_SUMMARY_LABELS: ConversationSummaryLabels = {
  mentionMe: '有人@我',
};

/**
 * 会话列表项摘要（字段口径与 {@link messageSummary} 一致）。
 *
 * <p><b>未读 @ 会在摘要前加一个前缀</b>（对齐微信的「[有人@我] 张三：…」）：
 * 单靠头像上的红色角标，用户只看到「有几条没读」，不知道这几条里有人点名了自己，
 * 而点名往往是这几条里唯一需要立刻回应的。</p>
 *
 * <p>前缀<b>不计入</b> {@link maxLength}：它是标记而不是摘要正文，被截断掉就失去了意义
 * （40 字的摘要本来就常在长消息上被截）。</p>
 *
 * <p>判定用 {@link hasUnreadMention}（会话里还有未读的 @ 即显示），<b>不试图判断
 * 「是不是最后那一条 @ 了我」</b>——后者需要服务端再出一个字段，而未读 @ 通常只有一两条，
 * 两种情况用户接下来的动作完全一样：打开这个会话。</p>
 */
export function conversationSummary(
  conversation: Conversation,
  labels: ConversationSummaryLabels = DEFAULT_CONVERSATION_SUMMARY_LABELS,
  maxLength = 40,
): string {
  const body = messageSummary(
    {
      content: conversation.lastContent,
      messageType: conversation.lastMessageType,
      recallStatus: conversation.lastRecallStatus,
      mine: conversation.lastMessageMine,
    },
    maxLength,
  );
  return hasUnreadMention(conversation)
    ? `[${labels.mentionMe}] ${body}`
    : body;
}

/**
 * 消息气泡的头像兜底字符：优先发送人展示名首字，缺失时回落调用方给的会话首字。
 *
 * <p>群聊里每个发送人名字不同，若一律拿「当前会话首字」兜底，一屏人的头像会全长得一样；
 * 单聊里发送人就是对端，两者同源，所以回落值在脏数据（缺 `senderDisplayName`）时
 * 仍能把「系」画出来，而不是画一张空头像。</p>
 */
export function messageSenderInitial(
  message: Pick<NotifyMessage, 'senderDisplayName'>,
  fallback: string,
): string {
  const name = message.senderDisplayName?.trim();
  return name ? name.slice(0, 1).toUpperCase() : fallback;
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

/**
 * 消息是否我自己发的（转发 notify 域口径，避免聊天页各处重复判断）。
 *
 * <p>入参与 {@code isSelfSentMessage} 对齐，只收方向判定真正用到的两个字段：
 * 「谁说的」这类展示口径（见 {@link messageSenderLabel}）只拿得到用户 ID，
 * 不该为了判个方向被要求凑出一条完整的消息。</p>
 */
export function isMine(
  message: Pick<NotifyMessage, 'senderUserId' | 'recipientUserId'>,
): boolean {
  return isSelfSentMessage(message);
}

/** 消息里某个人的展示名标签（由调用方注入 intl 版本，避免纯函数里硬编码语言）。 */
export interface MessageSenderLabels {
  /** 「我」。 */
  mine: string;
  /**
   * 单聊对端的展示名。
   *
   * <p>群聊没有唯一对端，必须传 `null`——把群名当成「对端」会让引用块写成
   * 「群名说：…」，比给 ID 更误导。</p>
   */
  peer?: string | null;
  /** 认不出具体是谁时的回落（如「用户 #<雪花ID>」）。 */
  unknown: (userId: string) => string;
}

/**
 * 把用户 ID 翻译成「相对这条消息」的展示名：引用块的「谁说的」、撤回占位的「谁撤的」共用。
 *
 * <p><b>为什么不直接比「当前用户 ID」：</b>登录态里没有可信的用户主键
 * （见 {@code services/notify/types} 的文件头），方向判定一律走 {@link isMine}。
 * 同一套思路再往下走一步，就能在<b>不认识自己 ID</b> 的前提下把「这件事是谁干的」
 * 认到只差群聊里的具体姓名：
 * <ul>
 *   <li>与本条消息的发送人同一个 ID：本条是谁发的就是谁——自己发的那个 ID 我认得，
 *       单聊对端的名字也在手上（{@code labels.peer}）；</li>
 *   <li>不是本条消息的发送人：<b>单聊只有两个人</b>，不是发送人就是另一个人（我 / 对端），
 *       于是「我引用了对方的话」与「对方引用了我的话」都能判定；</li>
 *   <li>群聊里既不是本条发送人、又无法确认是不是我时，只剩 ID 可用，回落成「用户 #id」。
 *       前端没有成员目录（消息流里连发送人姓名都没有），硬猜一个名字比给出 ID 更坏。</li>
 * </ul>
 *
 * @param userId 待翻译的用户 ID；为空时按「本条消息的发送人」处理
 */
export function messageSenderLabel(
  userId: string | null | undefined,
  message: Pick<NotifyMessage, 'senderUserId' | 'recipientUserId' | 'chatScope'>,
  labels: MessageSenderLabels,
): string {
  const senderId = message.senderUserId ?? '';
  const target = userId || senderId;
  const mine = isMine(message);
  if (!target) {
    // 两端都缺 ID 的脏数据：不臆造「用户 #」，能确定的最少信息只有方向
    return mine ? labels.mine : labels.peer ?? '';
  }
  if (target === senderId) {
    return mine ? labels.mine : labels.peer ?? labels.unknown(target);
  }
  // 不是本条消息的发送人：单聊里只可能是另一个人
  if (message.chatScope === ChatScope.PRIVATE) {
    return mine ? labels.peer ?? labels.unknown(target) : labels.mine;
  }
  return labels.unknown(target);
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
