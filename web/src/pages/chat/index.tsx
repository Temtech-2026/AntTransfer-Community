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
 * </ol>
 *
 * <p>历史翻页用 {@code beforeId} 游标而非 offset：会话是持续写入的流，offset 会因新消息
 * 插入而整体错位，表现为「翻页翻出重复内容」。
 */

import {
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
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

import EmptyState from '@/components/EmptyState';
import SectionCard from '@/components/SectionCard';
import useWebSocket from '@/hooks/useWebSocket';
import {
  type ChatSession,
  type Conversation,
  type ConversationTitleLabels,
  conversationInitial,
  conversationSummary,
  conversationTitle,
  fetchChatHistory,
  fetchConversations,
  isMine,
  isSameSession,
  markChatRead,
  newClientMsgId,
  sendChatMessage,
  sessionKey,
  sessionOfMessage,
} from '@/services/chat';
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
import { wsStore } from '@/services/ws';

import useStyles from './index.style';
import {
  applyIncomingToConversations,
  clearSessionUnread,
  mergeMessage,
  messageKey,
  prependHistory,
  sortConversations,
} from './messages';

const { Text } = Typography;

/** 单次拉取的历史条数（与后端 `notify.chat-history-limit` 同量级）。 */
const HISTORY_PAGE_SIZE = 50;

/** 距底部多少像素内算「贴着底」：此时新消息才自动滚屏。 */
const STICK_THRESHOLD = 24;

/** 新建会话时的人数上限（后端为全量用户检索，这里只要够用）。 */
const USER_SEARCH_PAGE_SIZE = 20;

/** 正文长度上限（后端 `ChatSendDTO` 的物理上界）。 */
const MAX_CONTENT = 1000;

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
  const [messages, setMessages] = useState<NotifyMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgError, setMsgError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  // —— 新建会话 ——
  const [newOpen, setNewOpen] = useState(false);
  const [newScope, setNewScope] = useState<number>(ChatScope.PRIVATE);
  const [newTargetId, setNewTargetId] = useState<number | null>(null);
  const [newUsers, setNewUsers] = useState<UserVO[]>([]);
  const [newUsersLoading, setNewUsersLoading] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newSubmitting, setNewSubmitting] = useState(false);

  /** 用户检索是管理员能力（`system:user:list`）；普通账号降级为直接填 ID。 */
  const canPickUser = access.can(SYSTEM_PERM.USER_LIST);

  const streamRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const loadingMoreRef = useRef(false);
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

  const handleSend = async () => {
    const session = activeSessionRef.current;
    const content = inputRef.current.trim();
    if (!session || sending) {
      return;
    }
    if (!content) {
      toast.warning(intl.formatMessage({ id: 'chat.composer.empty' }));
      return;
    }
    setSending(true);
    try {
      const saved = await sendChatMessage({
        scope: session.chatScope,
        targetId: session.targetId,
        messageType: MessageType.TEXT,
        content,
        clientMsgId: newClientMsgId(),
      });
      setInput('');
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

  const { status, reconnectNow } = useWebSocket({ onMessage: handleIncoming });

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
    const targetId = Number(rawTargetId);
    if (
      !Number.isInteger(scope) ||
      !Number.isInteger(targetId) ||
      targetId <= 0
    ) {
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

  const openNewModal = () => {
    setNewOpen(true);
    setNewScope(ChatScope.PRIVATE);
    setNewTargetId(null);
    setNewContent('');
    setNewUsers([]);
    void searchUsers('');
  };

  const handleCreate = async () => {
    if (!newTargetId) {
      toast.warning(intl.formatMessage({ id: 'chat.new.target.required' }));
      return;
    }
    const session: ChatSession = { chatScope: newScope, targetId: newTargetId };
    const content = newContent.trim();
    setNewSubmitting(true);
    try {
      if (content) {
        await sendChatMessage({
          scope: newScope,
          targetId: newTargetId,
          messageType: MessageType.TEXT,
          content,
          clientMsgId: newClientMsgId(),
        });
      }
      setNewOpen(false);
      await loadConversations();
      await openSession(session);
    } catch {
      // 目标无效 / 非群成员等错误由请求层提示；保持弹窗打开便于改目标重试
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

  const activeConversation = useMemo(
    () =>
      conversations.find((item) => isSameSession(item, activeSession)) ?? null,
    [conversations, activeSession],
  );

  const activeTitle = activeSession
    ? conversationTitle(
        { ...activeSession, targetName: activeConversation?.targetName },
        labels,
      )
    : '';
  const activeInitial = activeSession
    ? conversationInitial(
        { ...activeSession, targetName: activeConversation?.targetName },
        labels,
      )
    : '?';
  const activeScope = activeSession?.chatScope ?? null;

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

  const renderMessage = (message: NotifyMessage) => {
    const mine = isMine(message);
    const typed =
      (message.messageType ?? MessageType.TEXT) !== MessageType.TEXT;
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
        >
          {mine ? <UserOutlined /> : activeInitial}
        </Avatar>
        <div
          className={`${styles.bubbleWrap}${mine ? ` ${styles.bubbleWrapSelf}` : ''}`}
        >
          <div
            className={`${styles.bubble}${mine ? ` ${styles.bubbleSelf}` : ''}${
              !mine && typed ? ` ${styles.bubbleTyped}` : ''
            }`}
          >
            {message.content}
          </div>
          <span className={styles.bubbleMeta}>
            {mine
              ? intl.formatMessage({ id: 'chat.sender.mine' })
              : activeTitle}{' '}
            · {formatMessageTime(message.createTime)}
          </span>
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
          <div className={styles.shell}>
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
                  </div>
                  <div
                    className={styles.stream}
                    ref={streamRef}
                    onScroll={handleStreamScroll}
                  >
                    {renderStream()}
                  </div>
                  <div className={styles.composer}>
                    <Input.TextArea
                      rows={3}
                      value={input}
                      maxLength={MAX_CONTENT}
                      showCount
                      disabled={sending}
                      placeholder={intl.formatMessage({
                        id: 'chat.composer.placeholder',
                      })}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        // Ctrl / Cmd + Enter 发送：普通回车用于换行，避免误发
                        if (
                          event.key === 'Enter' &&
                          (event.ctrlKey || event.metaKey)
                        ) {
                          event.preventDefault();
                          void handleSend();
                        }
                      }}
                    />
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      loading={sending}
                      onClick={() => void handleSend()}
                    >
                      {intl.formatMessage({ id: 'chat.action.send' })}
                    </Button>
                  </div>
                </>
              ) : (
                renderStream()
              )}
            </section>
          </div>
        </SectionCard>
      </Space>

      <Modal
        open={newOpen}
        title={intl.formatMessage({ id: 'chat.new.title' })}
        okText={intl.formatMessage({ id: 'chat.new.submit' })}
        cancelText={intl.formatMessage({ id: 'chat.new.cancel' })}
        confirmLoading={newSubmitting}
        onOk={() => void handleCreate()}
        onCancel={() => setNewOpen(false)}
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
                setNewTargetId(null);
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
                {
                  label: (
                    <Space size={6}>
                      <TeamOutlined />
                      {intl.formatMessage({ id: 'chat.new.scope.group' })}
                    </Space>
                  ),
                  value: ChatScope.GROUP,
                },
              ]}
            />
          </div>

          <div>
            <div style={{ marginBottom: 8 }}>
              {intl.formatMessage({
                id:
                  newScope === ChatScope.GROUP
                    ? 'chat.new.target.labelGroup'
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
                onChange={(value: number | undefined) =>
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
            ) : (
              <>
                <Input
                  type="number"
                  min={1}
                  value={newTargetId ?? ''}
                  placeholder={intl.formatMessage({
                    id:
                      newScope === ChatScope.GROUP
                        ? 'chat.new.target.placeholderGroup'
                        : 'chat.new.target.placeholder',
                  })}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setNewTargetId(
                      Number.isInteger(next) && next > 0 ? next : null,
                    );
                  }}
                />
                {newScope === ChatScope.PRIVATE && !canPickUser ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {intl.formatMessage({ id: 'chat.new.user.noPermission' })}
                  </Text>
                ) : null}
              </>
            )}
          </div>

          <div>
            <div style={{ marginBottom: 8 }}>
              {intl.formatMessage({ id: 'chat.new.content.label' })}
            </div>
            <Input.TextArea
              rows={3}
              value={newContent}
              maxLength={MAX_CONTENT}
              showCount
              placeholder={intl.formatMessage({
                id: 'chat.new.content.placeholder',
              })}
              onChange={(event) => setNewContent(event.target.value)}
            />
          </div>
        </Space>
      </Modal>
    </PageContainer>
  );
};

export default ChatPage;
