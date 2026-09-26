/**
 * 聊天页（左会话列表 + 右聊天窗）。
 *
 * <p><b>四条口径，决定了这个页面的写法：</b>
 * <ol>
 *   <li><b>会话列表来自服务端聚合，不在前端从消息流里拼。</b>
 *       收件箱分页刻意排除会话消息（6/7），离线补拉也只覆盖纯提醒，所以
 *       「我有哪些会话」这件事只能由 {@code GET /v1/chat/conversations} 回答。</li>
 *   <li><b>未读数不在本页自算。</b>导航栏角标的唯一事实源是 {@code wsStore}；
 *       本页只做两件事——进入会话时把该会话已读，读完后 {@code wsStore.refresh()} 对齐。</li>
 *   <li><b>收消息与发消息走同一套合并规则。</b>自己发的消息会被 WS 原样推回（推送覆盖该用户
 *       全部连接），因此 HTTP 响应与 WS 帧会在同一时刻到达；去重交给
 *       {@link mergeMessage}（同时认 id 与 clientMsgId），未读增量交给
 *       {@link applyIncomingToConversations}（自己发的、或当前打开的会话都不加未读）。</li>
 *   <li><b>方向判定用 {@code senderUserId === recipientUserId}</b>，不比「当前用户 ID」——
 *       登录态里没有可信的用户主键（见 services/notify/types 文件头）。</li>
 *   <li><b>与即时通讯抽屉同源。</b>消息流、输入框、待发文件与用途限制都用两侧共享的实现
 *       （{@link useChatAttachmentDraft}、{@link ChatAttachmentHeader}、`ChatComposer`），
 *       本页只保留「页面上特有的」部分：历史翻页、未读回正、新建会话。</li>
 * </ol>
 *
 * <p>历史翻页用 {@code beforeId} 游标而非 offset：会话是持续写入的流，offset 会因新消息
 * 插入而整体错位，表现为「翻页翻出重复内容」。
 */

import {
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history, useAccess, useIntl } from '@umijs/max';
import {
  Alert,
  App,
  Avatar,
  Badge,
  Button,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  theme,
} from 'antd';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import ChatAttachmentHeader from '@/components/ChatAttachmentHeader';
import ChatAttachmentPicker from '@/components/ChatAttachmentPicker';
import ChatComposer from '@/components/ChatComposer';
import ChatFileCard from '@/components/ChatFileCard';
import ChatGroupPanel from '@/components/ChatGroupPanel';
import ChatPeerStatus from '@/components/ChatPeerStatus';
import EmptyState from '@/components/EmptyState';
import SectionCard from '@/components/SectionCard';
import useChatAttachmentDraft from '@/hooks/useChatAttachmentDraft';
import useChatPresence from '@/hooks/useChatPresence';
import useCurrentUserAvatar from '@/hooks/useCurrentUserAvatar';
import useWebSocket from '@/hooks/useWebSocket';
import {
  type ChatGroup,
  type ChatSession,
  type ChatTarget,
  type Conversation,
  type ConversationTitleLabels,
  type MessageSenderLabels,
  applyReadReceipt,
  CHAT_PERM,
  conversationInitial,
  conversationSummary,
  conversationTitle,
  createChatGroup,
  fetchChatHistory,
  fetchChatGroups,
  fetchConversations,
  isMine,
  isRecalled,
  isReceiptOfSession,
  isSameSession,
  markChatRead,
  messageSenderInitial,
  messageSenderLabel,
  newClientMsgId,
  recallChatMessage,
  resolveChatTarget,
  resolveSessionDisplay,
  sendChatMessage,
  sessionKey,
  sessionOfMessage,
  summarizeReaders,
} from '@/services/chat';
import { parseFileCardContent } from '@/services/chat/fileCard';
import {
  applyIncomingToConversations,
  applyRecall,
  clearSessionUnread,
  isRecallable,
  markConversationRecalled,
  mergeMessage,
  messageKey,
  prependHistory,
  sortConversations,
} from '@/services/chat/messages';
import { toQuoteDraft, type ChatQuoteDraft } from '@/services/chat/quote';
import type { ChatGroupDetail } from '@/services/chat/types';
import {
  ChatScope,
  isChatNotify,
  MessageType,
  type NotifyMessage,
} from '@/services/notify';
import {
  pageUsers,
  SYSTEM_PERM,
  UserStatus,
  type UserVO,
} from '@/services/system';
import {
  wsStore,
  type WsChatReadPayload,
  type WsChatRecallPayload,
} from '@/services/ws';
import ChatMessageMenu from '@/components/ChatMessageMenu';
import ChatMessageQuote from '@/components/ChatMessageQuote';
import ChatQuoteBar from '@/components/ChatQuoteBar';
import { isPositiveIdString } from '@/utils/id';
import { isErrorHandledByRequestLayer } from '@/utils/result';

import useStyles from './index.style';

const { Text } = Typography;

/** 单次拉取的历史条数（与后端 `notify.chat-history-limit` 同量级）。 */
const HISTORY_PAGE_SIZE = 50;

/** 距底部多少像素内算「贴着底」：此时新消息才自动滚屏。 */
const STICK_THRESHOLD = 24;

/** 新建会话时的人数上限（后端为全量用户检索，这里只要够用）。 */
const USER_SEARCH_PAGE_SIZE = 20;

/** 正文长度上限（后端 `ChatSendDTO` 的物理上界）。 */
const MAX_CONTENT = 1000;

/** 群名长度上限（`sys_group.name` 列宽 64，与后端 `ChatGroupCreateDTO` 同源）。 */
const MAX_GROUP_NAME = 64;

/**
 * 群成员总数上限（含群主自己），字面量镜像后端 `SysGroup.MAX_MEMBERS`。
 *
 * <p>前端拦一道只是为了不把注定被拒的请求发出去；真正的上界以后端为准
 * （超限返回 1032）。两边若只改一侧，由后端的 `ChatGroupMemberLimitTest` 断言暴露。</p>
 */
const MAX_GROUP_MEMBERS = 500;

/** 时间展示：今天给时分，今年给月日，更早给完整日期；解析失败时原样回显。 */
function formatMessageTime(value?: string | null): string {
  const raw = value?.trim();
  if (!raw) {
    return '';
  }
  const parsed = dayjs(raw);
  if (!parsed.isValid()) {
    return raw;
  }
  const now = dayjs();
  if (parsed.isSame(now, 'day')) {
    return parsed.format('HH:mm');
  }
  if (parsed.isSame(now, 'year')) {
    return parsed.format('MM-DD HH:mm');
  }
  return parsed.format('YYYY-MM-DD HH:mm');
}

const ChatPage = () => {
  const intl = useIntl();
  const access = useAccess();
  const { message: toast } = App.useApp();
  const { token } = theme.useToken();
  const { styles } = useStyles();

  // —— 会话列表 ——
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [convLoaded, setConvLoaded] = useState(false);
  const [convError, setConvError] = useState(false);
  const [keyword, setKeyword] = useState('');

  // —— 当前会话 ——
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  /**
   * 群设置面板是否展开。
   *
   * <p>只存开关、不另存群 ID：面板要配的群恒是当前打开的这个会话
   * （由 `activeSession` 推出）。多存一个群 ID 就多出一种状态——
   * 「面板开着、会话却已切走」，那时它配的是谁就说不清了。</p>
   */
  const [groupPanelOpen, setGroupPanelOpen] = useState(false);
  const [messages, setMessages] = useState<NotifyMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  /**
   * 正在引用的消息（右键气泡「引用」后进入）。
   *
   * <p>存的是<b>草稿</b>而不是消息对象：输入框只需要「显示什么 + 发送时回传哪个键」，
   * 而消息对象里带着读者列表、已读状态等与引用无关的东西（见 services/chat/quote）。
   * 切换会话时必须清掉——留着会让下一条消息被误挂到另一个会话的引用上。</p>
   */
  const [quote, setQuote] = useState<ChatQuoteDraft | null>(null);
  // 待发文件、用途限制、拖拽投放与「先建授权再发消息」与即时通讯抽屉共用同一份实现，
  // 两个入口因此不会各走各的（见 hooks/useChatAttachmentDraft 文件头）
  const {
    attachment,
    setAttachment,
    policy,
    setPolicy,
    dragOver,
    dropZoneProps,
    buildMessage,
  } = useChatAttachmentDraft();

  // —— 新建会话 ——
  const [newOpen, setNewOpen] = useState(false);
  const [newScope, setNewScope] = useState<number>(ChatScope.PRIVATE);
  // 会话目标 ID 是 19 位雪花 ID 的字符串形态：全程保持 string，禁止 Number() 归一（会丢末位）
  const [newTargetId, setNewTargetId] = useState<string | null>(null);
  const [newUsers, setNewUsers] = useState<UserVO[]>([]);
  const [newUsersLoading, setNewUsersLoading] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newSubmitting, setNewSubmitting] = useState(false);
  // 非管理员手填的「对方登录账号（或 19 位用户 ID）」：人记得住账号，记不住雪花 ID，
  // 而用户检索（system:user:list）属系统管理面，因此这一步必须由服务端解析
  const [newTargetQuery, setNewTargetQuery] = useState('');
  const [newResolvedTarget, setNewResolvedTarget] = useState<ChatTarget | null>(
    null,
  );
  const [newResolving, setNewResolving] = useState(false);
  const [newResolveFailed, setNewResolveFailed] = useState(false);
  // 群聊：群名 + 受邀成员（不含自己）。成员一律用 ChatTarget 承载——
  // 管理员走用户检索、非管理员走账号解析，两条路径的产物形状必须一致，
  // 否则「谁在群里」这件事在页面上就有两套写法，早晚对不上。
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState<ChatTarget[]>([]);
  // 非管理员按登录账号逐个加人（与单聊的 resolveChatTarget 同一条服务端解析路径）
  const [newMemberQuery, setNewMemberQuery] = useState('');
  const [newMemberResolving, setNewMemberResolving] = useState(false);
  // 我加入的群：群聊的会话标识就是群组 ID，登录即用，不依赖权限点
  const [newGroups, setNewGroups] = useState<ChatGroup[]>([]);
  const [newGroupsLoading, setNewGroupsLoading] = useState(false);

  /**
   * 用户检索是管理员能力（`system:user:list`，属系统管理面）。
   *
   * <p>普通账号不是「降级成填 ID」——他们根本无从得知别人的雪花 ID，
   * 因此改走「填登录账号 → 服务端解析成 targetId」这条等价路径（见 {@link resolveNewTarget}）。</p>
   */
  const canPickUser = access.can(SYSTEM_PERM.USER_LIST);

  /**
   * 建群是会话域唯一挂权限点的动作（`chat:group:create`，见 `sql/V14`）。
   *
   * <p>无此点时<b>整个群聊类型都不出现在新建弹窗里</b>（而不是置灰）：
   * 置灰要解释「为什么我不能建群」，这对多数用户是无关信息；
   * 且群聊此前不可用的根因正是「给了一个走不通的入口」，不该再留一个走不通的选项。</p>
   */
  const canCreateGroup = access.can(CHAT_PERM.GROUP_CREATE);

  const streamRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const loadingMoreRef = useRef(false);
  // 在途的目标解析请求：失焦核对与点「发起」会几乎同时触发，复用它可避免重复解析
  const resolvingTargetRef = useRef<Promise<ChatTarget | null> | null>(null);
  // 实时回调要在「订阅只建一次」的前提下读到最新值，故用 ref 镜像
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const activeSessionRef = useRef(activeSession);
  activeSessionRef.current = activeSession;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const inputRef = useRef(input);
  inputRef.current = input;

  const labels = useMemo<ConversationTitleLabels>(
    () => ({
      group: (id) =>
        intl.formatMessage({ id: 'chat.session.groupFallback' }, { id }),
      user: (id) =>
        intl.formatMessage({ id: 'chat.session.userFallback' }, { id }),
    }),
    [intl],
  );

  const titleOf = useCallback(
    (session: ChatSession & { targetName?: string | null }) =>
      conversationTitle(session, labels),
    [labels],
  );

  const scrollToBottom = useCallback((smooth = false) => {
    const node = streamRef.current;
    if (!node) {
      return;
    }
    node.scrollTo({
      top: node.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }, []);

  /** 滚动时记录「是否贴着底」：用户往回翻历史时不要被新消息拽下去。 */
  const handleStreamScroll = () => {
    const node = streamRef.current;
    if (!node) {
      return;
    }
    stickToBottomRef.current =
      node.scrollHeight - node.scrollTop - node.clientHeight <= STICK_THRESHOLD;
  };

  const loadConversations = useCallback(async () => {
    setConvLoading(true);
    setConvError(false);
    try {
      setConversations(sortConversations(await fetchConversations()));
      setConvLoaded(true);
    } catch {
      // 失败提示由请求层给出，这里只把左栏切成「加载失败」空态
      setConvError(true);
    } finally {
      setConvLoading(false);
    }
  }, []);

  /**
   * 打开会话并加载首页历史。
   *
   * <p>顺序是有讲究的：先清本地未读（用户已经看到了，角标必须先落），
   * 再拉历史；已读接口单独 try——它失败不该让整页变成错误态。
   */
  const openSession = useCallback(
    async (session: ChatSession) => {
      setActiveSession(session);
      setMessages([]);
      // 引用草稿跟着会话走：留着会让下一条消息被挂到另一个会话的引用上
      // （服务端也会以 1036 拒绝，但那已经是发出去之后的事了）
      setQuote(null);
      setHasMore(false);
      setMsgError(false);
      setMsgLoading(true);
      stickToBottomRef.current = true;
      try {
        const page = await fetchChatHistory({
          scope: session.chatScope,
          targetId: session.targetId,
        });
        // 后端按 id 倒序返回（便于 beforeId 向上翻页），展示需要正序
        setMessages(page.slice().reverse());
        setHasMore(page.length >= HISTORY_PAGE_SIZE);
        setConversations((prev) => clearSessionUnread(prev, session));
        window.requestAnimationFrame(() => scrollToBottom());
      } catch {
        setMsgError(true);
      } finally {
        setMsgLoading(false);
      }
      try {
        const affected = await markChatRead(
          session.chatScope,
          session.targetId,
        );
        if (affected > 0) {
          await wsStore.refresh();
        }
      } catch {
        // 已读失败不影响看消息；下次进入会重试
      }
    },
    [scrollToBottom],
  );

  /**
   * 群资料变更（改名 / 邀请 / 移除）后，把新群名同步到会话标题与左栏列表。
   *
   * <p>标题与列表项必须一起改：两者同源渲染（见 {@link resolveSessionDisplay}），
   * 只改一处就会出现「标题是旧名、左栏却是新名」的分裂。</p>
   */
  const applyGroupUpdate = useCallback((detail: ChatGroupDetail) => {
    setActiveSession((prev) =>
      prev && prev.chatScope === ChatScope.GROUP && prev.targetId === detail.id
        ? { ...prev, targetName: detail.name }
        : prev,
    );
    setConversations((prev) =>
      prev.map((item) =>
        item.chatScope === ChatScope.GROUP && item.targetId === detail.id
          ? { ...item, targetName: detail.name }
          : item,
      ),
    );
  }, []);

  /**
   * 我已退出 / 解散该群：立刻关掉会话并回到空态。
   *
   * <p>留在屏上只会让下一次操作撞上 1012——服务端已经清掉我的成员行，
   * 读写这个群都不再被允许。清场口径与 {@link openSession} 一致：
   * 消息、引用草稿、待发文件一并清掉。</p>
   */
  const handleGroupLeft = useCallback(
    (groupId: string) => {
      setActiveSession((prev) =>
        prev && prev.targetId === groupId ? null : prev,
      );
      setGroupPanelOpen(false);
      setMessages([]);
      setQuote(null);
      setAttachment(null);
      setHasMore(false);
      void loadConversations();
    },
    [loadConversations, setAttachment],
  );

  /** 向上翻页：把更早的一页插到顶部，并补偿 scrollTop 以免视口跳动。 */
  const loadMore = async () => {
    const session = activeSessionRef.current;
    const current = messagesRef.current;
    const beforeId = current[0]?.id;
    if (!session || !beforeId || loadingMoreRef.current) {
      return;
    }
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const node = streamRef.current;
    const previousHeight = node?.scrollHeight ?? 0;
    try {
      const older = await fetchChatHistory({
        scope: session.chatScope,
        targetId: session.targetId,
        beforeId,
        limit: HISTORY_PAGE_SIZE,
      });
      setMessages((prev) => prependHistory(prev, older.slice().reverse()));
      setHasMore(older.length >= HISTORY_PAGE_SIZE);
      window.requestAnimationFrame(() => {
        const target = streamRef.current;
        if (target) {
          target.scrollTop += target.scrollHeight - previousHeight;
        }
      });
    } catch {
      toast.error(intl.formatMessage({ id: 'chat.stream.loadMoreFailed' }));
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  /**
   * 输入框变化：顺手把「我在输入」告诉对端。
   *
   * <p>空白正文算没在输入——清空输入框后对端该立刻收起提示，而不是继续看到一个
   * 已经在发呆的人。节流与续订由 Hook 内部处理，这里只表达意图。</p>
   */
  const handleInputChange = (next: string) => {
    setInput(next);
    notifyTyping(next.trim() !== '');
  };

  const handleSend = async () => {
    const session = activeSessionRef.current;
    const content = inputRef.current.trim();
    if (!session || sending) {
      return;
    }
    // 带附件时正文只是附言，可以留空（与抽屉的 allowEmpty 口径一致）
    if (!content && !attachment) {
      toast.warning(intl.formatMessage({ id: 'chat.composer.empty' }));
      return;
    }
    setSending(true);
    try {
      // 幂等键与授权建立都在共用草稿机里（含仅预览传 0、群聊不建授权等规则）；
      // 引用键也只在这里回传，服务端据此校验并把「谁说的 + 快照」写进这条消息
      const saved = await sendChatMessage(
        await buildMessage(session, content, quote?.clientMsgId),
      );
      setInput('');
      // 引用随发送成功一起清掉：失败时保留，让用户改完正文能直接重试同一句引用
      setQuote(null);
      // 显式收尾：清空走的是 setState 而非 onChange，不补这一帧对端要等空闲兜底才收起
      notifyTyping(false);
      setAttachment(null);
      stickToBottomRef.current = true;
      setMessages((prev) => mergeMessage(prev, saved));
      const result = applyIncomingToConversations(
        conversationsRef.current,
        saved,
        {
          activeSession: session,
        },
      );
      if (result.knownSession) {
        setConversations(result.conversations);
      } else {
        // 新会话（首条消息）不在列表里：就地插会缺 targetName，改拉一次
        void loadConversations();
      }
      window.requestAnimationFrame(() => scrollToBottom(true));
    } catch {
      // 发送失败（1012 非群成员 / 1013 目标无效等）由请求层给出提示，输入保留不丢
    } finally {
      setSending(false);
    }
  };

  // —— 实时帧 ——
  const handleIncoming = (incoming: NotifyMessage) => {
    if (!isChatNotify(incoming.notifyType)) {
      return;
    }
    const session = sessionOfMessage(incoming);
    if (!session) {
      return;
    }
    const active = activeSessionRef.current;
    const inActive = isSameSession(session, active);

    if (inActive) {
      if (stickToBottomRef.current) {
        window.requestAnimationFrame(() => scrollToBottom());
      }
      setMessages((prev) => mergeMessage(prev, incoming));
      if (!isMine(incoming)) {
        // 窗口正开着就不该攒未读：立刻置读并回正导航栏角标
        void markChatRead(session.chatScope, session.targetId)
          .then((affected) => (affected > 0 ? wsStore.refresh() : undefined))
          .catch(() => undefined);
      }
    }

    const result = applyIncomingToConversations(
      conversationsRef.current,
      incoming,
      {
        activeSession: active,
      },
    );
    if (!result.knownSession) {
      void loadConversations();
      return;
    }
    setConversations(result.conversations);
  };

  /**
   * 已读回执帧：只认当前打开的会话，把读者补到对应气泡下。
   *
   * <p>服务端只把回执推给发送人，而这些帧可能同时属于多个会话（页面 + 抽屉 + 多标签页），
   * 因此必须先比对 {@code (scope, targetId)}；不比对就会把 A 会话的读者画到 B 会话里。</p>
   */
  const handleReadReceipt = (receipt: WsChatReadPayload) => {
    if (!isReceiptOfSession(receipt, activeSessionRef.current)) {
      return;
    }
    setMessages((prev) => applyReadReceipt(prev, receipt));
  };

  /**
   * 撤回帧：把当前会话里的那条消息标记为已撤回（对方撤回时我自己这端也要变）。
   *
   * <p>服务端把撤回推给该消息的<b>全部参与人</b>，而这些帧可能同时属于多个会话
   * （页面 + 抽屉 + 多标签页），因此先比对 {@code (scope, targetId)} 再按幂等键定位——
   * 不比对就会把 A 会话里好好的某条消息标成「已撤回」。</p>
   */
  const handleRecallFrame = (recall: WsChatRecallPayload) => {
    if (!isReceiptOfSession(recall, activeSessionRef.current)) {
      return;
    }
    setMessages((prev) =>
      applyRecall(prev, recall.clientMsgId, recall.recallTime),
    );
  };

  const { status, reconnectNow } = useWebSocket({
    onMessage: handleIncoming,
    onReadReceipt: handleReadReceipt,
    onRecall: handleRecallFrame,
  });

  /**
   * 对端在线状态与「正在输入」。
   *
   * <p>帧的会话过滤、30s 续订、输入节流都在 Hook 与 services/chat/presence 里
   * （与即时通讯抽屉共用同一份实现，见 hooks/useChatPresence 文件头）。</p>
   */
  const { peerStatus, peerTyping, notifyTyping } = useChatPresence({
    session: activeSession,
  });

  // 首屏拉会话列表
  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // 深链：/chat?scope=1&targetId=7（消息中心 / 待办跳转的落点）
  const deepLinkDoneRef = useRef(false);
  useEffect(() => {
    if (deepLinkDoneRef.current) {
      return;
    }
    deepLinkDoneRef.current = true;
    const query = new URLSearchParams(history.location.search);
    const rawScope = query.get('scope');
    const rawTargetId = query.get('targetId');
    if (rawScope === null || rawTargetId === null) {
      return;
    }
    const scope = Number(rawScope);
    // targetId 保持字符串原样：Number() 会把 19 位雪花 ID 的末位吃掉，导致打开错误的会话
    const targetId = rawTargetId.trim();
    if (!Number.isInteger(scope) || !isPositiveIdString(targetId)) {
      return;
    }
    if (scope !== ChatScope.PRIVATE && scope !== ChatScope.GROUP) {
      return;
    }
    void openSession({ chatScope: scope, targetId });
  }, [openSession]);

  // —— 新建会话 ——
  const searchUsers = async (searchKeyword: string) => {
    if (!canPickUser) {
      return;
    }
    setNewUsersLoading(true);
    try {
      const page = await pageUsers({
        keyword: searchKeyword.trim() || undefined,
        status: UserStatus.NORMAL,
        current: 1,
        pageSize: USER_SEARCH_PAGE_SIZE,
      });
      setNewUsers(page.records ?? []);
    } catch {
      setNewUsers([]);
    } finally {
      setNewUsersLoading(false);
    }
  };

  const resetNewTargetState = () => {
    setNewTargetId(null);
    setNewTargetQuery('');
    setNewResolvedTarget(null);
    setNewResolveFailed(false);
    resolvingTargetRef.current = null;
    // 群聊与单聊的目标来源不同（群名 + 成员 vs 账号），切类型时一并作废，避免带着残留去提交
    setNewGroupName('');
    setNewGroupMembers([]);
    setNewMemberQuery('');
  };

  /**
   * 我加入的群（群聊类型下的「进入已有群」选择器）。
   *
   * <p>登录即用、失败退化为空列表：它只返回登录人自己在 `sys_group_member` 里的群，
   * 空列表是正常结果（还没加入任何群），不是错误态——因此不弹 toast，
   * 也不给「重试」（用户没有可修正的动作，重试只是重复同一个空结果）。</p>
   */
  const loadMyGroups = async () => {
    setNewGroupsLoading(true);
    try {
      setNewGroups(await fetchChatGroups());
    } catch {
      setNewGroups([]);
    } finally {
      setNewGroupsLoading(false);
    }
  };

  /** 加一位受邀成员；按 `targetId` 去重，同一个人加两次只对应一个群成员行。 */
  const addGroupMember = (member: ChatTarget) => {
    setNewGroupMembers((prev) =>
      prev.some((item) => item.targetId === member.targetId)
        ? prev
        : [...prev, member],
    );
  };

  const removeGroupMember = (targetId: string) => {
    setNewGroupMembers((prev) =>
      prev.filter((item) => item.targetId !== targetId),
    );
  };

  /**
   * 成员下拉的选项（管理员路径）。
   *
   * <p>选项取「已选成员 ∪ 本次检索结果」，而不是只用检索结果：检索词一换，上一批结果就被
   * 新一批覆盖，此时先前选中的人会找不到名字，Tag 上只能显示裸 19 位雪花 ID。
   * 以「已选成员」兜底，保证任何时刻每个已选 ID 都有名字可显示。</p>
   */
  const groupMemberOptions = useMemo(() => {
    const byId = new Map<string, { name: string; username?: string }>();
    // 先放检索结果（带账号，重名时可区分），再用已选成员补上检索结果里没有的人
    newUsers.forEach((user) => {
      byId.set(user.id, {
        name: user.nickname || user.username,
        username: user.username,
      });
    });
    newGroupMembers.forEach((member) => {
      if (!byId.has(member.targetId)) {
        byId.set(member.targetId, { name: member.displayName });
      }
    });
    return [...byId].map(([value, meta]) => ({
      value,
      label: meta.username
        ? intl.formatMessage(
            { id: 'chat.new.user.optionLabel' },
            { name: meta.name, username: meta.username },
          )
        : meta.name,
      displayName: meta.name,
    }));
  }, [intl, newGroupMembers, newUsers]);

  /**
   * 解析并加入一位成员（非管理员路径：填登录账号 → 服务端翻译成会话目标）。
   *
   * <p>与「发起单聊」用同一条解析路径和同一把尺子：账号打错（1013）当场提示，
   * 而不是等点了「发起」才被拒。解析成功即清空输入框，便于连续加人。</p>
   */
  const resolveNewMember = async () => {
    const query = newMemberQuery.trim();
    if (!query || newMemberResolving) {
      return;
    }
    setNewMemberResolving(true);
    try {
      addGroupMember(await resolveChatTarget(query));
      setNewMemberQuery('');
    } catch {
      // 失败原因由请求层提示；保留输入内容便于改账号重试
    } finally {
      setNewMemberResolving(false);
    }
  };

  /**
   * 进入一个我加入的群（不发消息）。
   *
   * <p><b>为什么不要求先写一句话：</b>群聊的会话标识就是群组 ID，它由 `sys_group`
   * 独立存在、不依赖消息推导，回来读历史本身就是完整动作。建群那条路径相反——
   * 首条消息必填（见 {@link handleCreate}），因为<b>被拉进群的人只能靠这条消息</b>
   * 第一次看到这个群。</p>
   */
  const enterGroup = async (groupId: string) => {
    const group = newGroups.find((item) => item.id === groupId);
    setNewOpen(false);
    await openSession({
      chatScope: ChatScope.GROUP,
      targetId: groupId,
      // 名字跟着定位带过去：会话列表刷新前标题也正确，不必回落成「群聊 #<雪花ID>」
      targetName: group?.name,
    });
  };

  /**
   * 解析非管理员手填的会话目标（登录账号 / 19 位用户 ID）。
   *
   * <p><b>为什么不让用户直接填 ID：</b>会话目标的落库形态是 19 位雪花 ID，
   * 而用户目录挂系统管理面（`system:user:list`），普通账号既搜不到人也拿不到 ID——
   * 「必须填一个自己无从得知的标识」正是发起会话失败的成因。
   * 登录账号是人记得住、说得出的标识，把它翻译成 targetId 是服务端的事。</p>
   *
   * <p>解析在「离开输入框 / 回车」时触发并就地反馈：账号打错时用户当场就知道，
   * 不必等写完消息点「发起」才被拒。失败原因（1013）由请求层提示。</p>
   *
   * @returns 解析出的目标；空输入或解析失败返回 null（校验态已写入 state）
   */
  const resolveNewTarget = (): Promise<ChatTarget | null> => {
    if (newResolvedTarget) {
      // 输入一变就会清空解析结果，因此这里不会拿到陈旧的「上一次解析」
      return Promise.resolve(newResolvedTarget);
    }
    if (resolvingTargetRef.current) {
      return resolvingTargetRef.current;
    }
    const query = newTargetQuery.trim();
    if (!query) {
      setNewResolveFailed(false);
      return Promise.resolve(null);
    }
    setNewResolving(true);
    setNewResolveFailed(false);
    const task = resolveChatTarget(query)
      .then((target) => {
        setNewResolvedTarget(target);
        return target;
      })
      .catch(() => {
        setNewResolveFailed(true);
        return null;
      })
      .finally(() => {
        setNewResolving(false);
        resolvingTargetRef.current = null;
      });
    resolvingTargetRef.current = task;
    return task;
  };

  /**
   * 确定「发起会话」的目标：单聊且无检索权限时才需要解析。
   *
   * <p>回到的 {@code targetName} / {@code avatarUrl} 让会话标题与头像立刻正确——
   * 否则新会话在列表刷新前只能回落成「用户 #<雪花ID>」，用户会以为选错了人。</p>
   */
  const resolveCreateTarget = async (): Promise<{
    targetId: string;
    targetName?: string | null;
    avatarUrl?: string | null;
  } | null> => {
    if (newScope !== ChatScope.PRIVATE || canPickUser) {
      if (!newTargetId) {
        toast.warning(intl.formatMessage({ id: 'chat.new.target.required' }));
        return null;
      }
      return { targetId: newTargetId };
    }
    if (!newTargetQuery.trim()) {
      toast.warning(intl.formatMessage({ id: 'chat.new.target.accountRequired' }));
      return null;
    }
    const resolved = newResolvedTarget ?? (await resolveNewTarget());
    // 解析失败：请求层已给出原因、输入框下方已标红，这里不再叠一个 toast
    return resolved
      ? {
          targetId: resolved.targetId,
          targetName: resolved.displayName,
          avatarUrl: resolved.avatarUrl,
        }
      : null;
  };

  const openNewModal = () => {
    setNewOpen(true);
    setNewScope(ChatScope.PRIVATE);
    resetNewTargetState();
    setNewContent('');
    setNewUsers([]);
    void searchUsers('');
    // 「我加入的群」是登录即用的只读数据，本身不依赖建群权限；
    // 但无建群权限时群聊类型整个不出现，也就不必白拉一次
    if (canCreateGroup) {
      void loadMyGroups();
    }
  };

  const handleCreate = async () => {
    const content = newContent.trim();
    const isGroup = newScope === ChatScope.GROUP;
    if (!content) {
      // 会话由消息写扩散而来：不发首条消息，服务端不会留下任何会话记录，
      // 「发起成功」只存在于本地，刷新即消失。群聊同理——被拉进群的人正是靠这条
      // 消息才第一次看到这个群，因此两类会话在这条规则上没有差别。
      toast.warning(intl.formatMessage({ id: 'chat.new.content.required' }));
      return;
    }
    if (isGroup) {
      if (!newGroupName.trim()) {
        toast.warning(intl.formatMessage({ id: 'chat.new.group.nameRequired' }));
        return;
      }
      if (newGroupMembers.length === 0) {
        toast.warning(
          intl.formatMessage({ id: 'chat.new.group.memberRequired' }),
        );
        return;
      }
      // +1 是群主自己：上限是「群的总人数」，不是「受邀人数」（与后端同口径）
      if (newGroupMembers.length + 1 > MAX_GROUP_MEMBERS) {
        toast.warning(
          intl.formatMessage(
            { id: 'chat.new.group.memberLimit' },
            { max: MAX_GROUP_MEMBERS },
          ),
        );
        return;
      }
    }
    setNewSubmitting(true);
    try {
      let session: ChatSession;
      if (isGroup) {
        // 建群先于发消息：服务端返回的 id 就是群聊会话的 targetId，
        // 因此建完即可进入会话，不必等会话列表刷新
        const group = await createChatGroup({
          name: newGroupName.trim(),
          memberIds: newGroupMembers.map((member) => member.targetId),
        });
        session = {
          chatScope: ChatScope.GROUP,
          targetId: group.id,
          targetName: group.name,
        };
      } else {
        const target = await resolveCreateTarget();
        if (!target) {
          return;
        }
        session = {
          chatScope: ChatScope.PRIVATE,
          targetId: target.targetId,
          targetName: target.targetName,
          // 解析结果自带头像：首条消息发出后会话列表要重新拉一次，
          // 带上它就不必等这次刷新才有头像（群聊没有头像，故上面那条不带）
          targetAvatarUrl: target.avatarUrl,
        };
      }
      const firstMessage = {
        scope: session.chatScope,
        targetId: session.targetId,
        messageType: MessageType.TEXT,
        content,
        // 幂等键只在这条消息上有效：重发必须沿用同一个值，故每次提交都新生成
        clientMsgId: newClientMsgId(),
      };
      if (isGroup) {
        // 群已经在服务端落库了，首条消息失败不该把用户留在弹窗里——
        // 再点一次「发起」会建出第二个同名群；会话本身马上就会打开，
        // 用户可以在聊天框里把那句话重发一遍
        try {
          await sendChatMessage(firstMessage);
        } catch {
          toast.error(
            intl.formatMessage({ id: 'chat.new.group.firstMessageFailed' }),
          );
        }
      } else {
        // 单聊相反：会话只由这条消息隐含，「发失败 = 会话不存在」，
        // 因此失败必须留在弹窗里让用户改目标重试（不吞异常）
        await sendChatMessage(firstMessage);
      }
      setNewOpen(false);
      await loadConversations();
      await openSession(session);
    } catch {
      // 目标无效 / 非群成员 / 建群校验失败（1031~1033）等错误由请求层提示；
      // 保持弹窗打开便于修正后重试
    } finally {
      setNewSubmitting(false);
    }
  };

  // —— 派生数据 ——
  const visibleConversations = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) {
      return conversations;
    }
    return conversations.filter(
      (item) =>
        titleOf(item).toLowerCase().includes(query) ||
        conversationSummary(item).toLowerCase().includes(query),
    );
  }, [conversations, keyword, titleOf]);

  /** 我自己的头像（登录态）：气泡里「我发的」那一行不走消息载荷，见 `useCurrentUserAvatar`。 */
  const myAvatar = useCurrentUserAvatar();

  /**
   * 当前会话的展示对象（名字与头像已回填，见 {@link resolveSessionDisplay}）。
   *
   * <p>标题与头像必须同源。原先两处各自内联「回查会话列表补名字」，只是恰好都写对了；
   * 一旦有一处漏掉（抽屉的消息头像就是这样漏的），同一个会话就会在同一屏里呈现两种模样——
   * 标题是「系统管理员」，头像却是回落名「用户 #<id>」的首字「用」。</p>
   */
  const activeDisplay = useMemo(
    () =>
      activeSession
        ? resolveSessionDisplay(activeSession, conversations)
        : null,
    [activeSession, conversations],
  );

  const activeTitle = activeDisplay
    ? conversationTitle(activeDisplay, labels)
    : '';
  const activeInitial = activeDisplay
    ? conversationInitial(activeDisplay, labels)
    : '?';
  const activeScope = activeSession?.chatScope ?? null;

  /**
   * 引用块里的「谁说的」、撤回占位里的「谁撤的」。
   *
   * <p>回落口径与标题同源（{@link labels}）：单聊的对端名就是会话标题，所以直接复用它；
   * 群聊没有唯一对端，传 `null` 让 {@link messageSenderLabel} 把 ID 兜出去
   * ——消息流里本来就没有群成员的姓名，这时候写群名是错的，写 ID 只是不好看。</p>
   */
  const senderLabels = useMemo<MessageSenderLabels>(
    () => ({
      mine: intl.formatMessage({ id: 'chat.sender.mine' }),
      peer: activeScope === ChatScope.PRIVATE ? activeTitle : null,
      unknown: labels.user,
    }),
    [intl, activeScope, activeTitle, labels],
  );

  /** 撤回后的气泡占位：自己撤的说「你」，别人撤的写名字。 */
  const recalledText = (message: NotifyMessage) =>
    isMine(message)
      ? intl.formatMessage({ id: 'chat.message.recalled.mine' })
      : intl.formatMessage(
          { id: 'chat.message.recalled.other' },
          {
            name: messageSenderLabel(
              message.senderUserId,
              message,
              senderLabels,
            ),
          },
        );

  /**
   * 撤回一条自己发出的消息（右键菜单里那一项）。
   *
   * <p><b>先发请求、成功后再改本地</b>：撤回成功的表现是正文永久消失，一旦本地先改了、
   * 服务端却拒绝（`1034` 超窗 / `1035` 不是你的消息），原文已经找不回来，只能画一个
   * 「已撤回」而事实并非如此。反过来的代价只是几百毫秒的等待，而这段时间里
   * `CHAT_RECALL` 帧往往比响应还先到（它走的是同一条收敛规则，见
   * {@link applyRecall}），用户根本感觉不到。</p>
   *
   * <p>失败原因由请求层给出（撤回是显式动作，接口刻意非静默），
   * 这里只兜住不经请求通道的异常，避免同一句话弹两遍。</p>
   */
  const handleRecall = async (message: NotifyMessage) => {
    const clientMsgId = message.clientMsgId;
    if (!clientMsgId) {
      return;
    }
    try {
      await recallChatMessage(clientMsgId);
      setMessages((prev) => applyRecall(prev, clientMsgId));
      const session = activeSessionRef.current;
      if (session) {
        // 撤回的若是该会话最后一条，左栏摘要会同时变空：正文被清空后，
        // 不补这一笔就只能等下次刷新才看到正确状态（见 markConversationRecalled）
        setConversations((prev) =>
          markConversationRecalled(prev, session, message.id),
        );
      }
      toast.success(intl.formatMessage({ id: 'chat.message.recall.success' }));
    } catch (error) {
      if (!isErrorHandledByRequestLayer(error)) {
        toast.error(intl.formatMessage({ id: 'chat.message.recall.failed' }));
      }
    }
  };

  const connectionAlert = (() => {
    if (status === 'open' || status === 'idle') {
      return null;
    }
    const tone: Record<string, 'info' | 'warning' | 'error'> = {
      connecting: 'info',
      reconnecting: 'warning',
      closed: 'error',
    };
    return (
      <Alert
        type={tone[status] ?? 'warning'}
        showIcon
        title={intl.formatMessage({ id: `message.connection.${status}` })}
        action={
          status === 'connecting' ? undefined : (
            <Button size="small" onClick={reconnectNow}>
              {intl.formatMessage({ id: 'message.connection.reconnectNow' })}
            </Button>
          )
        }
      />
    );
  })();

  /** 左栏四态：失败 → 首屏骨架 → 空 → 列表。 */
  const renderListState = () => {
    if (convError) {
      return (
        <EmptyState
          variant="error"
          action={
            <Button
              icon={<ReloadOutlined />}
              onClick={() => void loadConversations()}
            >
              {intl.formatMessage({ id: 'common.empty.error.action' })}
            </Button>
          }
        />
      );
    }
    if (!convLoaded && convLoading) {
      return (
        <div className={styles.listState} style={{ textAlign: 'center' }}>
          <Spin />
        </div>
      );
    }
    if (conversations.length === 0) {
      return (
        <EmptyState
          variant="data"
          title={intl.formatMessage({ id: 'chat.list.empty.title' })}
          description={intl.formatMessage({ id: 'chat.list.empty.desc' })}
          action={
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={openNewModal}
            >
              {intl.formatMessage({ id: 'chat.action.new' })}
            </Button>
          }
        />
      );
    }
    if (visibleConversations.length === 0) {
      return (
        <EmptyState
          variant="search"
          title={intl.formatMessage({ id: 'chat.list.emptyFiltered.title' })}
          description={intl.formatMessage({
            id: 'chat.list.emptyFiltered.desc',
          })}
        />
      );
    }
    return null;
  };

  /**
   * 气泡下的已读回执：读者头像。
   *
   * <p><b>只对自己发的消息渲染</b>——「谁读过我这条」是发送人关心的信息；别人的消息上
   * 该字段恒为空（服务端只按发送侧镜像行算），前端这层判据是防止脏数据画错方向。</p>
   *
   * <p>头像封顶 {@link summarizeReaders} 的默认值后折成「+N」：群聊里几十人已读时，
   * 一排头像会把气泡挤变形，而第 4 个之后的头像本来也认不出是谁。</p>
   */
  const renderReaders = (message: NotifyMessage) => {
    const { shown, overflow } = summarizeReaders(message.readers);
    if (shown.length === 0) {
      return null;
    }
    const names = (message.readers ?? []).map((reader) => reader.displayName);
    return (
      <div
        className={styles.readers}
        // 整排头像对读屏是一个整体：`role="img"` 让它的后代不进入无障碍树，
        // 读者名单由 aria-label 一次说全，而不是让读屏逐字念出「姚」「李」
        role="img"
        aria-label={intl.formatMessage(
          { id: 'chat.read.by' },
          { names: names.join(', ') },
        )}
      >
        {shown.map((reader, index) => (
          // 外壳承载 title / 叠放与描边（Avatar 不收这些属性）
          <span
            key={reader.userId}
            title={reader.displayName}
            className={
              index === 0 ? styles.readerAvatarFirst : styles.readerAvatar
            }
          >
            <Avatar
              size={18}
              style={{ background: token.colorPrimary, fontSize: 10 }}
              src={reader.avatarUrl ?? undefined}
            >
              {reader.displayName.slice(0, 1).toUpperCase()}
            </Avatar>
          </span>
        ))}
        {overflow > 0 ? (
          <span
            className={styles.readerMore}
            title={intl.formatMessage(
              { id: 'chat.read.more' },
              { count: overflow },
            )}
          >
            {`+${overflow}`}
          </span>
        ) : null}
      </div>
    );
  };

  const renderMessage = (message: NotifyMessage) => {
    const mine = isMine(message);
    const typed =
      (message.messageType ?? MessageType.TEXT) !== MessageType.TEXT;
    // 撤回是终态、正文已被清空：判定只看标记，不看正文是否为空（见 isRecalled）
    const recalled = isRecalled(message);
    // 文件消息的正文末尾带条目引用（见 services/chat/fileCard）；解析得出就渲染成卡片，
    // 解析不出（正文被截断过的历史消息）就原样当文本，不至于把标记甩给用户看。
    // 已撤回的不再解析：正文已清空，卡片会退化成一张空壳
    const card =
      !recalled && message.messageType === MessageType.FILE
        ? parseFileCardContent(message.content)
        : null;
    /**
     * 引用草稿：非空即代表「这条消息现在可以被引用」。
     *
     * <p>已撤回、或没有幂等键的消息构造不出草稿（见 services/chat/quote），
     * 右键菜单里也就不会出现「引用」——菜单项的显隐直接由这份草稿决定，
     * 不另写一套判断，免得两处口径漂移。</p>
     */
    const quoteDraft = toQuoteDraft(
      message,
      messageSenderLabel(message.senderUserId, message, senderLabels),
    );
    // 已撤回的气泡不叠 `bubbleSelf`：撤回后两个方向长得一样是刻意的（见 index.style）
    const bubbleClass = recalled
      ? `${styles.bubble} ${styles.bubbleRecalled}`
      : `${styles.bubble}${mine ? ` ${styles.bubbleSelf}` : ''}${
          !mine && typed ? ` ${styles.bubbleTyped}` : ''
        }`;
    return (
      <div
        key={messageKey(message)}
        className={`${styles.row}${mine ? ` ${styles.rowSelf}` : ''}`}
      >
        <Avatar
          size={32}
          style={{
            flexShrink: 0,
            background: mine ? token.colorFillSecondary : token.colorPrimary,
            color: mine ? token.colorTextSecondary : token.colorTextLightSolid,
          }}
          /* 「我发的」不带发送人头像（服务端刻意省掉这次查库），自己的头像只认登录态，
             与顶栏同源；别人发的优先用消息自带的发送人头像——群聊里每行发送人不同，
             只靠会话首字会画出一屏同款头像。消息没给人像时（老数据 / 反查不到），
             再回落当前会话的头像：单聊里发送人就是对端，与标题、首字兜底同源 */
          src={mine ? myAvatar : message.senderAvatarUrl ?? activeDisplay?.targetAvatarUrl ?? undefined}
        >
          {mine ? <UserOutlined /> : messageSenderInitial(message, activeInitial)}
        </Avatar>
        <div
          className={`${styles.bubbleWrap}${mine ? ` ${styles.bubbleWrapSelf}` : ''}`}
        >
          <ChatMessageMenu
            canRecall={isRecallable(message)}
            canQuote={quoteDraft != null}
            onRecall={() => void handleRecall(message)}
            onQuote={() => setQuote(quoteDraft)}
          >
            <div className={bubbleClass}>
              {recalled ? (
                recalledText(message)
              ) : card ? (
                <ChatFileCard
                  name={card.name}
                  sizeText={card.sizeText}
                  nodeId={card.nodeId}
                  attachmentId={card.attachmentId}
                  mine={mine}
                />
              ) : (
                <>
                  {/*
                    引用块取服务端写入时的快照（谁说的 + 当时那段正文），不回查原消息：
                    原消息随后被撤回时正文已清空，回查会让引用块一起变空白
                  */}
                  {message.quoteClientMsgId ? (
                    <ChatMessageQuote
                      senderName={messageSenderLabel(
                        message.quoteSenderUserId,
                        message,
                        senderLabels,
                      )}
                      summary={message.quoteContent ?? ''}
                    />
                  ) : null}
                  {message.content}
                </>
              )}
            </div>
          </ChatMessageMenu>
          <span className={styles.bubbleMeta}>
            {mine
              ? intl.formatMessage({ id: 'chat.sender.mine' })
              : activeTitle}{' '}
            · {formatMessageTime(message.createTime)}
          </span>
          {mine ? renderReaders(message) : null}
        </div>
      </div>
    );
  };

  const renderStream = () => {
    if (!activeSession) {
      return (
        <div className={styles.streamState}>
          <EmptyState
            variant="data"
            title={intl.formatMessage({ id: 'chat.stream.placeholder.title' })}
            description={intl.formatMessage({
              id: 'chat.stream.placeholder.desc',
            })}
          />
        </div>
      );
    }
    if (msgError) {
      return (
        <div className={styles.streamState}>
          <EmptyState
            variant="error"
            action={
              <Button
                icon={<ReloadOutlined />}
                onClick={() => void openSession(activeSession)}
              >
                {intl.formatMessage({ id: 'common.empty.error.action' })}
              </Button>
            }
          />
        </div>
      );
    }
    if (msgLoading && messages.length === 0) {
      return (
        <div className={styles.streamState}>
          <Spin />
        </div>
      );
    }
    if (messages.length === 0) {
      return (
        <div className={styles.streamState}>
          <EmptyState
            variant="data"
            title={intl.formatMessage({ id: 'chat.stream.empty.title' })}
            description={intl.formatMessage({ id: 'chat.stream.empty.desc' })}
          />
        </div>
      );
    }
    return (
      <>
        <div className={styles.historyBar}>
          {hasMore ? (
            <Button
              size="small"
              loading={loadingMore}
              onClick={() => void loadMore()}
            >
              {intl.formatMessage({
                id: loadingMore
                  ? 'chat.stream.loadingMore'
                  : 'chat.stream.loadMore',
              })}
            </Button>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {intl.formatMessage({ id: 'chat.stream.noMore' })}
            </Text>
          )}
        </div>
        {messages.map(renderMessage)}
      </>
    );
  };

  /** 右栏标题旁的连接状态点：不弹横幅，但让「实时是否在线」始终可见。 */
  const statusDot = (
    <span
      className={styles.dot}
      style={{
        background:
          status === 'open'
            ? token.colorSuccess
            : status === 'connecting' || status === 'reconnecting'
              ? token.colorWarning
              : token.colorError,
      }}
    />
  );

  return (
    <PageContainer
      title={intl.formatMessage({ id: 'chat.title' })}
      subTitle={intl.formatMessage({ id: 'chat.subtitle' })}
      extra={
        <Space wrap>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void loadConversations()}
          >
            {intl.formatMessage({ id: 'chat.action.refresh' })}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openNewModal}>
            {intl.formatMessage({ id: 'chat.action.new' })}
          </Button>
        </Space>
      }
    >
      <Space orientation="vertical" size={16} style={{ display: 'flex' }}>
        {connectionAlert}

        <SectionCard bodyPadding={false}>
          <div
            className={
              dragOver ? `${styles.shell} ${styles.shellDragOver}` : styles.shell
            }
            {...dropZoneProps}
          >
            <aside className={styles.aside}>
              <div className={styles.asideHeader}>
                <span className={styles.asideTitle}>
                  {intl.formatMessage({ id: 'chat.list.title' })}
                </span>
                <Space size={4}>
                  {statusDot}
                  <Button
                    size="small"
                    type="text"
                    icon={<PlusOutlined />}
                    onClick={openNewModal}
                    aria-label={intl.formatMessage({ id: 'chat.action.new' })}
                  />
                </Space>
              </div>
              <div className={styles.search}>
                <Input.Search
                  allowClear
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder={intl.formatMessage({
                    id: 'chat.search.placeholder',
                  })}
                />
              </div>
              <div className={styles.list}>
                {renderListState() ??
                  visibleConversations.map((item) => {
                    const active = isSameSession(item, activeSession);
                    return (
                      <button
                        key={sessionKey(item)}
                        type="button"
                        className={`${styles.item}${active ? ` ${styles.itemActive}` : ''}`}
                        onClick={() => void openSession(item)}
                      >
                        <Badge
                          count={item.unreadCount}
                          size="small"
                          overflowCount={99}
                        >
                          <Avatar
                            size={40}
                            style={{
                              background: active
                                ? token.colorPrimary
                                : token.colorFillSecondary,
                              color: active
                                ? token.colorTextLightSolid
                                : token.colorTextSecondary,
                            }}
                            src={item.targetAvatarUrl ?? undefined}
                          >
                            {conversationInitial(item, labels)}
                          </Avatar>
                        </Badge>
                        <div className={styles.itemBody}>
                          <div className={styles.itemHead}>
                            <span className={styles.itemName}>
                              {titleOf(item)}
                            </span>
                            <span className={styles.itemTime}>
                              {formatMessageTime(item.lastTime)}
                            </span>
                          </div>
                          <div className={styles.itemSummary}>
                            {conversationSummary(item)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </aside>

            <section className={styles.main}>
              {activeSession ? (
                <>
                  <div className={styles.mainHeader}>
                    <div className={styles.mainHeading}>
                      <div className={styles.mainTitle}>
                        {statusDot}
                        <span>{activeTitle}</span>
                        <Tag
                          color={
                            activeScope === ChatScope.GROUP ? 'blue' : 'default'
                          }
                        >
                          {intl.formatMessage({
                            id:
                              activeScope === ChatScope.GROUP
                                ? 'chat.tag.group'
                                : 'chat.tag.private',
                          })}
                        </Tag>
                      </div>
                      {/*
                        对端状态：只在单聊出点（群聊没有单一对端，Hook 里 status 恒为 null），
                        「正在输入…」与状态文案共用这一行（见 ChatPeerStatus 文件头）
                      */}
                      <ChatPeerStatus status={peerStatus} typing={peerTyping} />
                    </div>
                    {/*
                      群设置入口只在群会话出现：单聊没有群可配，摆一个点不动的按钮
                      只会招来「为什么单聊没有」的疑问。能不能改、能改什么由面板自己判定，
                      这里不预先判一道——两处各判一次，口径迟早分叉。
                    */}
                    {activeScope === ChatScope.GROUP ? (
                      <Button
                        type="text"
                        icon={<SettingOutlined />}
                        aria-label={intl.formatMessage({ id: 'chat.group.title' })}
                        onClick={() => setGroupPanelOpen(true)}
                      >
                        {intl.formatMessage({ id: 'chat.group.title' })}
                      </Button>
                    ) : null}
                  </div>
                  <div
                    className={styles.stream}
                    ref={streamRef}
                    onScroll={handleStreamScroll}
                  >
                    {renderStream()}
                  </div>
                  <ChatComposer
                    value={input}
                    onChange={handleInputChange}
                    onSend={() => void handleSend()}
                    sending={sending}
                    disabled={sending}
                    allowEmpty={Boolean(attachment)}
                    maxLength={MAX_CONTENT}
                    autoSize={{ minRows: 3, maxRows: 6 }}
                    placeholder={intl.formatMessage({
                      id: attachment
                        ? 'chat.attach.placeholder'
                        : 'chat.composer.placeholder',
                    })}
                    sendLabel={intl.formatMessage({ id: 'chat.action.send' })}
                    tools={
                      <ChatAttachmentPicker
                        queueId="chat-send"
                        onPick={setAttachment}
                        // 已有待发文件时不再让点：草稿只装一份，允许替换等于
                        // 悄悄丢掉用户已经调好的用途限制（有效期 / 下载次数）
                        disabled={sending || Boolean(attachment)}
                      />
                    }
                    header={
                      <>
                        {/* 「正在引用」条在最上面：它是这次发送要带上的唯一一条上下文，
                            附件条只是内容本身（见 ChatQuoteBar 文件头） */}
                        {quote ? (
                          <ChatQuoteBar
                            draft={quote}
                            onCancel={() => setQuote(null)}
                            disabled={sending}
                          />
                        ) : null}
                        <ChatAttachmentHeader
                          attachment={attachment}
                          policy={policy}
                          onPolicyChange={setPolicy}
                          onRemove={() => setAttachment(null)}
                          showPolicy={activeScope === ChatScope.PRIVATE}
                          disabled={sending}
                        />
                      </>
                    }
                  />
                </>
              ) : (
                renderStream()
              )}
            </section>
          </div>
        </SectionCard>
      </Space>

      {/*
        群设置面板：与即时通讯抽屉共用同一个组件（见 components/ChatGroupPanel）。
        只有群会话才给出 groupId——单聊时置空，面板即便被打开也不会去拉一个不存在的群。
      */}
      <ChatGroupPanel
        open={groupPanelOpen}
        groupId={activeScope === ChatScope.GROUP ? activeSession?.targetId : null}
        onClose={() => setGroupPanelOpen(false)}
        onUpdated={applyGroupUpdate}
        onLeft={handleGroupLeft}
      />

      <Modal
        open={newOpen}
        title={intl.formatMessage({ id: 'chat.new.title' })}
        onCancel={() => setNewOpen(false)}
        // 「发起会话」这个动作本身就是「发出首条消息」，发送按钮因此长在输入框里
        // （与聊天界面同一个 ChatComposer）；页脚再放一个「发起」等于同一动作出现两次，
        // 两处都改文案也必然漂移，故页脚只留取消。
        footer={
          <Button onClick={() => setNewOpen(false)}>
            {intl.formatMessage({ id: 'chat.new.cancel' })}
          </Button>
        }
      >
        <Space orientation="vertical" size={16} style={{ display: 'flex' }}>
          <div>
            <div style={{ marginBottom: 8 }}>
              {intl.formatMessage({ id: 'chat.new.scope.label' })}
            </div>
            <Segmented
              block
              value={newScope}
              onChange={(value) => {
                setNewScope(value as number);
                // 单聊目标是账号、群聊目标是群名 + 成员，两者不通用，切类型即作废已填内容
                resetNewTargetState();
              }}
              options={[
                {
                  label: (
                    <Space size={6}>
                      <UserOutlined />
                      {intl.formatMessage({ id: 'chat.new.scope.private' })}
                    </Space>
                  ),
                  value: ChatScope.PRIVATE,
                },
                // 无建群权限时整个群聊类型都不出现（见 {@link canCreateGroup}）：
                // 该分支下每个动作都以建群为前提，留着它等于给了一个必然失败的入口——
                // 群聊此前不可用的根因正是「有入口、无能力」
                ...(canCreateGroup
                  ? [
                      {
                        label: (
                          <Space size={6}>
                            <TeamOutlined />
                            {intl.formatMessage({ id: 'chat.new.scope.group' })}
                          </Space>
                        ),
                        value: ChatScope.GROUP,
                      },
                    ]
                  : []),
              ]}
            />
          </div>

          {/*
            「进入我加入的群」——补回「手填群组 ID」被去掉后丢掉的能力：
            群聊的会话标识就是群组 ID，选中即代表「我要去这个群」，
            因此它是一个动作而不是填写项，选中就进入会话（见 {@link enterGroup}）。
            列表为空（还没加入任何群）时整块不出现：一个空下拉只会让人怀疑自己没权限。
          */}
          {newScope === ChatScope.GROUP && newGroups.length > 0 ? (
            <div>
              <div style={{ marginBottom: 8 }}>
                {intl.formatMessage({ id: 'chat.new.group.existingLabel' })}
              </div>
              <Select
                style={{ width: '100%' }}
                value={undefined}
                loading={newGroupsLoading}
                placeholder={intl.formatMessage({
                  id: 'chat.new.group.existingPlaceholder',
                })}
                onChange={(value: string) => void enterGroup(value)}
                options={newGroups.map((group) => ({
                  value: group.id,
                  label: intl.formatMessage(
                    { id: 'chat.new.group.optionLabel' },
                    { name: group.name, count: group.memberCount },
                  ),
                }))}
              />
            </div>
          ) : null}

          <div>
            <div style={{ marginBottom: 8 }}>
              {intl.formatMessage({
                id:
                  newScope === ChatScope.GROUP
                    ? 'chat.new.group.nameLabel'
                    : 'chat.new.target.label',
              })}
            </div>
            {newScope === ChatScope.PRIVATE && canPickUser ? (
              <Select
                showSearch
                allowClear
                style={{ width: '100%' }}
                value={newTargetId ?? undefined}
                loading={newUsersLoading}
                placeholder={intl.formatMessage({
                  id: 'chat.new.user.placeholder',
                })}
                filterOption={false}
                onSearch={(value) => void searchUsers(value)}
                onChange={(value: string | undefined) =>
                  setNewTargetId(value ?? null)
                }
                notFoundContent={
                  newUsersLoading ? (
                    <Spin size="small" />
                  ) : (
                    <EmptyState variant="search" size="small" />
                  )
                }
                options={newUsers.map((user) => ({
                  value: user.id,
                  label: intl.formatMessage(
                    { id: 'chat.new.user.optionLabel' },
                    {
                      name: user.nickname || user.username,
                      username: user.username,
                    },
                  ),
                }))}
              />
            ) : newScope === ChatScope.PRIVATE ? (
              <>
                <Input
                  value={newTargetQuery}
                  disabled={newSubmitting}
                  placeholder={intl.formatMessage({
                    id: 'chat.new.target.placeholder',
                  })}
                  onChange={(event) => {
                    // 改一个字就作废上次解析结果，避免「解析的是 A、发出去的是 B」
                    setNewTargetQuery(event.target.value);
                    setNewResolvedTarget(null);
                    setNewResolveFailed(false);
                  }}
                  onBlur={() => void resolveNewTarget()}
                  onPressEnter={() => void resolveNewTarget()}
                  suffix={newResolving ? <Spin size="small" /> : undefined}
                />
                <Text
                  type={newResolveFailed ? 'danger' : 'secondary'}
                  style={{ display: 'block', marginTop: 6, fontSize: 12 }}
                >
                  {intl.formatMessage(
                    {
                      id: newResolveFailed
                        ? 'chat.new.user.notFound'
                        : newResolvedTarget
                          ? 'chat.new.user.resolved'
                          : 'chat.new.user.resolveHint',
                    },
                    newResolvedTarget
                      ? { name: newResolvedTarget.displayName }
                      : undefined,
                  )}
                </Text>
              </>
            ) : (
              <Input
                value={newGroupName}
                disabled={newSubmitting}
                maxLength={MAX_GROUP_NAME}
                showCount
                placeholder={intl.formatMessage({
                  id: 'chat.new.group.namePlaceholder',
                })}
                onChange={(event) => setNewGroupName(event.target.value)}
              />
            )}
          </div>

          {/*
            受邀成员：管理员走用户检索（`system:user:list`），非管理员走「填登录账号 →
            服务端解析」。两条路径的产物同为 ChatTarget（名字 + ID），差别只在「怎么挑人」。
            成员 ID 不含自己——服务端会把创建者自动作为群主入群（见 ChatGroupService#create）。
          */}
          {newScope === ChatScope.GROUP ? (
            <div>
              <div style={{ marginBottom: 8 }}>
                {intl.formatMessage({ id: 'chat.new.group.memberLabel' })}
              </div>
              {canPickUser ? (
                <Select
                  mode="multiple"
                  showSearch
                  style={{ width: '100%' }}
                  // 受控于已选成员：勾选 / 点 Tag 上的 × 都直接改这一份状态，
                  // 不再另开一个「已选列表」的展示处（两处展示早晚会不一致）
                  value={newGroupMembers.map((member) => member.targetId)}
                  disabled={newSubmitting}
                  loading={newUsersLoading}
                  placeholder={intl.formatMessage({
                    id: 'chat.new.user.placeholder',
                  })}
                  filterOption={false}
                  onSearch={(value) => void searchUsers(value)}
                  onChange={(ids: string[]) => {
                    const names = new Map(
                      groupMemberOptions.map((option) => [
                        option.value,
                        option.displayName,
                      ]),
                    );
                    setNewGroupMembers(
                      ids.map((id) => ({
                        targetId: id,
                        // 名字查找依次回退：先前已选的 → 本次选项 → 裸 ID（宁可难看也别显示空）
                        displayName: names.get(id) ?? id,
                      })),
                    );
                  }}
                  notFoundContent={
                    newUsersLoading ? (
                      <Spin size="small" />
                    ) : (
                      <EmptyState variant="search" size="small" />
                    )
                  }
                  options={groupMemberOptions}
                />
              ) : (
                <Input
                  value={newMemberQuery}
                  disabled={newSubmitting || newMemberResolving}
                  placeholder={intl.formatMessage({
                    id: 'chat.new.group.memberPlaceholder',
                  })}
                  onChange={(event) => setNewMemberQuery(event.target.value)}
                  onPressEnter={() => void resolveNewMember()}
                  onBlur={() => void resolveNewMember()}
                  suffix={newMemberResolving ? <Spin size="small" /> : undefined}
                />
              )}
              {/* 管理员路径的已选成员由 Select 自己的 Tag 承载，这里只服务非管理员路径 */}
              {!canPickUser && newGroupMembers.length > 0 ? (
                <Space size={[6, 6]} wrap style={{ marginTop: 8 }}>
                  {newGroupMembers.map((member) => (
                    <Tag
                      key={member.targetId}
                      closable={!newSubmitting}
                      onClose={() => removeGroupMember(member.targetId)}
                    >
                      {member.displayName}
                    </Tag>
                  ))}
                </Space>
              ) : null}
              <Text
                type="secondary"
                style={{ display: 'block', marginTop: 6, fontSize: 12 }}
              >
                {intl.formatMessage(
                  { id: 'chat.new.group.memberHint' },
                  { max: MAX_GROUP_MEMBERS },
                )}
              </Text>
            </div>
          ) : null}

          <div>
            <div style={{ marginBottom: 8 }}>
              {intl.formatMessage({ id: 'chat.new.content.label' })}
            </div>
            {/*
              与聊天界面同一个输入框：盒内有发送按钮，Enter 发送 / Shift + Enter 换行。
              首条消息必填由它自己兜住——正文为空时发送按钮就是禁用的（比「点了才弹提示」直白），
              而 Enter 空发仍会走 handleCreate 的校验给出原因。
            */}
            <ChatComposer
              bare
              value={newContent}
              onChange={setNewContent}
              onSend={() => void handleCreate()}
              sending={newSubmitting}
              disabled={newSubmitting}
              maxLength={MAX_CONTENT}
              autoSize={{ minRows: 3, maxRows: 6 }}
              placeholder={intl.formatMessage({
                id: 'chat.new.content.placeholder',
              })}
              sendLabel={intl.formatMessage({ id: 'chat.new.submit' })}
            />
          </div>
        </Space>
      </Modal>
    </PageContainer>
  );
};

export default ChatPage;
