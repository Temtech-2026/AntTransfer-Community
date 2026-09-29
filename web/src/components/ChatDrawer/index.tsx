/**
 * 即时通讯抽屉（方案「C. 即时通讯面板」）。
 *
 * <p>三条设计约束：
 * <ol>
 *   <li><b>不喧宾夺主</b>：默认隐藏，从屏幕右侧滑出 380px，主内容区不被永久占用；</li>
 *   <li><b>聊天是文件的附属品</b>：可以从文件列表拖文件进来发送，消息气泡渲染成
 *       文件迷你卡片（见 {@link ChatFileCard} 的正文口径说明）；待发文件、用途限制
 *       与授权建立走 {@link useChatAttachmentDraft}，与 `/chat` 页是同一套实现；</li>
 *   <li><b>与会话页同源</b>：会话、历史、发送、已读全部复用 `services/chat`，
 *       抽屉与 `/chat` 页看到的是同一份数据；实时帧走应用级 WebSocket 单例。
 *       消息流与<b>会话列表</b>的规则都不在组件里自己维护，一律取
 *       `services/chat/messages`：去重与排序走 {@link mergeMessage}，未读增量与重排走
 *       {@link applyIncomingToConversations}——自己发的消息同时经 HTTP 响应与 WS
 *       回推帧两条路到达，两处各写一份规则迟早会漂移（曾经的消息追加逻辑就这么漏出了
 *       「两个气泡」）。<b>已读同样是同口径</b>：只对别人发来的置读，且置读真的改了行
 *       才 {@code wsStore.refresh()} 回正顶栏红点（未读数的唯一事实源是 wsStore）。</li>
 * </ol>
 *
 * <p>窄抽屉放不下「列表 + 消息」两栏，因此采用主从切换：未选中会话时是会话列表，
 * 选中后进入消息流（左上角返回）。这样在 380px 内也不挤。
 */

import {
  ArrowLeftOutlined,
  CloseOutlined,
  EditOutlined,
  ReloadOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { createStyles } from 'antd-style';
import { App, Badge, Button, Drawer, Empty, Spin, theme } from 'antd';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import ChatAttachmentHeader from '@/components/ChatAttachmentHeader';
import ChatAttachmentPicker from '@/components/ChatAttachmentPicker';
import ChatFileCard from '@/components/ChatFileCard';
import ChatGroupPanel from '@/components/ChatGroupPanel';
import ChatComposer from '@/components/ChatComposer';
import ChatMessageMenu from '@/components/ChatMessageMenu';
import ChatMessageQuote from '@/components/ChatMessageQuote';
import ChatPeerPanel from '@/components/ChatPeerPanel';
import ChatPeerStatus from '@/components/ChatPeerStatus';
import ChatQuoteBar from '@/components/ChatQuoteBar';
import UserAvatar from '@/components/UserAvatar';
import useChatAttachmentDraft from '@/hooks/useChatAttachmentDraft';
import useChatMentionables from '@/hooks/useChatMentionables';
import useChatPresence from '@/hooks/useChatPresence';
import useCurrentUserAvatar from '@/hooks/useCurrentUserAvatar';
import usePeerAliasOverrides from '@/hooks/usePeerAlias';
import { useWebSocket } from '@/hooks/useWebSocket';
import {
  fetchChatHistory,
  fetchConversations,
  markChatRead,
  recallChatMessage,
  sendChatMessage,
} from '@/services/chat/api';
import {
  fileCardDisplayText,
  parseFileCardContent,
} from '@/services/chat/fileCard';
import {
  applyIncomingToConversations,
  applyRecall,
  clearSessionUnread,
  isRecallable,
  markConversationRecalled,
  mergeMessage,
  sortConversations,
} from '@/services/chat/messages';
import {
  applyPeerAliasChange,
  applyPeerAliasOverride,
} from '@/services/chat/peerAlias';
import { toQuoteDraft, type ChatQuoteDraft } from '@/services/chat/quote';
import {
  applyReadReceipt,
  isReceiptOfSession,
  summarizeReaders,
} from '@/services/chat/readReceipt';
import {
  conversationInitial,
  conversationSummary,
  conversationTitle,
  hasUnreadMention,
  isMine,
  isRecalled,
  isSameSession,
  messageSenderInitial,
  messageSenderLabel,
  resolveSessionDisplay,
  sessionKey,
  sessionOfMessage,
  truncate,
  type ChatGroupDetail,
  type ChatSession,
  type Conversation,
  type ConversationSummaryLabels,
  type MessageSenderLabels,
} from '@/services/chat/types';
import { ChatScope, MessageType, type NotifyMessage } from '@/services/notify';
import { wsStore } from '@/services/ws';
import type {
  WsChatReadPayload,
  WsChatRecallPayload,
} from '@/services/ws/protocol';
import {
  consumeAttachment,
  setChatOpen,
  shellPanelStore,
} from '@/services/ui/panelHub';
import { SHELL } from '@/theme/tokens';
import { isErrorHandledByRequestLayer } from '@/utils/result';

/** 一次拉取的历史条数（够看一屏上下文即可，抽屉不做无限翻页） */
const HISTORY_LIMIT = 30;

/** 会话列表拉取条数 */
const CONVERSATION_LIMIT = 50;

const useStyles = createStyles(({ token, css }) => ({
  body: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    background: ${token.colorBgContainer};
  `,
  bodyDragOver: css`
    outline: 2px dashed ${token.colorPrimary};
    outline-offset: -6px;
    background: ${token.colorPrimaryBg};
  `,
  head: css`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid ${token.colorSplit};
  `,
  /**
   * 标题 + 对端状态：两行堆叠，状态在会话名下方。
   *
   * <p>抽屉只有 380px 宽，把「在线 / 正在输入…」并排放在标题右侧，长会话名会被挤成两三个字。
   * 竖排后标题独占一行，状态另起一行——与 `/chat` 页的会话头同一个版式。</p>
   */
  headMain: css`
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  `,
  headTitle: css`
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-weight: 600;
  `,
  list: css`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  `,
  conversation: css`
    display: flex;
    width: 100%;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    /* 原生 <button>：键盘 Enter/Space、焦点环与「按空格滚动」的冲突
       都由浏览器处理，不必手写 onKeyDown。以下四条是清掉 button 的默认外观。 */
    border: none;
    border-bottom: 1px solid ${token.colorSplit};
    background: transparent;
    font-family: inherit;
    text-align: left;
    cursor: pointer;

    &:hover {
      background: ${token.colorFillQuaternary};
    }
  `,
  conversationActive: css`
    background: ${token.colorPrimaryBg};
  `,
  conversationMain: css`
    flex: 1;
    min-width: 0;
  `,
  conversationTitle: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    color: ${token.colorText};
  `,
  conversationName: css`
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  `,
  conversationTime: css`
    flex: none;
    color: ${token.colorTextQuaternary};
    font-size: ${token.fontSizeSM}px;
  `,
  conversationSummary: css`
    margin-top: 2px;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
    /* 按钮内只能是行内内容，标签从 div 换成 span；省略号依赖块级格式化，
       所以这里的 display: block 不是装饰，去掉即不再截断长摘要。 */
    display: block;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  `,
  stream: css`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  `,
  row: css`
    display: flex;
    gap: 8px;
    align-items: flex-start;
  `,
  rowMine: css`
    flex-direction: row-reverse;
  `,
  avatar: css`
    flex: none;
    background: ${token.colorFillSecondary};
    color: ${token.colorTextSecondary};
  `,
  bubble: css`
    max-width: 78%;
    padding: 7px 10px;
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorFillQuaternary};
    color: ${token.colorText};
    font-size: ${token.fontSize}px;
    word-break: break-word;
    white-space: pre-wrap;
  `,
  bubbleMine: css`
    background: ${token.colorPrimaryBg};
  `,
  /**
   * 已撤回气泡：虚线描边 + 次要色文字，与 `/chat` 页同一个观感。
   *
   * <p>撤回后正文已被清空，只写「撤回了一条消息」而外观不变的话，
   * 用户扫一眼消息流会以为那句话还在。不与 `bubbleMine` 叠加（口径见页面样式注释）。</p>
   */
  bubbleRecalled: css`
    border: 1px dashed ${token.colorBorderSecondary};
    background: transparent;
    color: ${token.colorTextTertiary};
    font-style: italic;
  `,
  bubbleTime: css`
    margin-top: 4px;
    color: ${token.colorTextQuaternary};
    font-size: 11px;
    text-align: end;
  `,
  /**
   * 被点名（{@code @} 了我）的气泡：加一道强调描边。
   *
   * <p>用 {@code box-shadow} 而不是 {@code border}：已撤回气泡占用了虚线边框，
   * 两个类同时出现时谁覆盖谁取决于样式插入顺序（那由「哪个类先被用过」决定），
   * 内阴影不参与边框计算，两者可以共存（与 `/chat` 页同口径）。</p>
   */
  bubbleMentioned: css`
    box-shadow: inset 0 0 0 1px ${token.colorError};
  `,
  /** 气泡内的「有人@我」标记：文字必须给出来，描边只是加速扫视。 */
  bubbleMention: css`
    display: block;
    margin-bottom: 2px;
    color: ${token.colorError};
    font-size: ${token.fontSizeSM}px;
  `,
  /** 已读回执：气泡下的读者头像（只渲染自己发的消息）。 */
  readers: css`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-top: 3px;
  `,
  /** 头像外壳：负外边距让相邻头像叠放，描边画在壳上才不会被压掉半圈。 */
  readerAvatar: css`
    display: inline-flex;
    margin-inline-start: -5px;
    border: 1px solid ${token.colorBgContainer};
    border-radius: 50%;
  `,
  readerAvatarFirst: css`
    display: inline-flex;
    border: 1px solid ${token.colorBgContainer};
    border-radius: 50%;
  `,
  /** 头像本体（`Avatar` 不收 title / aria-*，颜色只能这样给）。 */
  readerAvatarInner: css`
    background: ${token.colorPrimary};
    color: ${token.colorTextLightSolid};
    font-size: 10px;
  `,
  readerMore: css`
    margin-inline-start: 4px;
    color: ${token.colorTextQuaternary};
    font-size: 11px;
  `,
}));

/** 时间显示：当天只给 HH:mm，跨天补日期 */
function formatClock(value?: string | null): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const clock = `${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}`;
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  return sameDay
    ? clock
    : `${date.getMonth() + 1}/${date.getDate()} ${clock}`;
}

/**
 * 即时通讯抽屉：会话列表 / 消息流 / 文件投递。
 */
const ChatDrawer: React.FC = () => {
  const intl = useIntl();
  const { token } = theme.useToken();
  const { styles } = useStyles();
  // 撤回成功的反馈：抽屉比页面小，气泡变灰之外再给一句，避免用户怀疑没点上
  const { message: toast } = App.useApp();
  const panel = useSyncExternalStore(
    shellPanelStore.subscribe,
    shellPanelStore.getSnapshot,
    shellPanelStore.getSnapshot,
  );

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<ChatSession | null>(null);
  /**
   * 群设置面板开关（只在群会话下可开）。
   *
   * <p>与 `/chat` 页同口径：只存开关，要配的群由当前会话推出——抽屉里另存一个群 ID
   * 会出现「面板开着、已经返回列表」时说不清在配哪个群。</p>
   */
  const [groupPanelOpen, setGroupPanelOpen] = useState(false);
  /**
   * 对端资料面板开关（只在单聊下可开）。
   *
   * <p>与群设置开关同口径：只存开关，要看的对端由当前会话推出。返回会话列表时
   * {@code active} 变空，面板随之关掉（见渲染处的 {@code open} 条件）。</p>
   */
  const [peerPanelOpen, setPeerPanelOpen] = useState(false);
  const [messages, setMessages] = useState<NotifyMessage[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  /**
   * 正在引用的消息（右键气泡「引用」后进入，口径见 services/chat/quote）。
   *
   * <p>与 `/chat` 页各存一份而不是塞进共用状态：两个入口可以同时开着（抽屉浮在页面上），
   * 共用一个草稿会让「在抽屉里引用的那句」跑到页面的输入框上方去。</p>
   */
  const [quote, setQuote] = useState<ChatQuoteDraft | null>(null);
  // 待发送文件、用途限制、拖拽投放与「先建授权再发消息」全部来自共用草稿机——
  // `/chat` 页用的是同一份实现，两处不会各走各的（见 hooks/useChatAttachmentDraft 文件头）
  const {
    attachment,
    setAttachment,
    policy,
    setPolicy,
    dragOver,
    dropZoneProps,
    buildMessage,
  } = useChatAttachmentDraft();
  /**
   * 本次正文里仍然有效的 {@code @} 提及对象，唯一写入方是输入框的
   * {@code onMentionChange}（口径与 `/chat` 页一致，见该页状态注释）。
   */
  const [mentionUserIds, setMentionUserIds] = useState<string[]>([]);
  // 可 @ 的群成员：单聊 / 未选中会话时是空名单，输入框据此不显示 @ 入口
  const mentionables = useChatMentionables(active);

  const streamRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<ChatSession | null>(null);
  activeRef.current = active;
  // 实时帧回调不随渲染重建，直接在闭包里读 conversations 会拿到旧数组，因此走 ref
  const conversationsRef = useRef<Conversation[]>([]);
  conversationsRef.current = conversations;
  // 实时帧回调不该随渲染重建，但又要知道抽屉是否还开着，因此走 ref
  const chatOpenRef = useRef(panel.chatOpen);
  chatOpenRef.current = panel.chatOpen;

  /** 关闭抽屉：顺手清掉待发送文件与引用草稿，避免下次打开还挂着上一轮的东西 */
  const closeDrawer = useCallback(() => {
    setChatOpen(false);
    setGroupPanelOpen(false);
    setPeerPanelOpen(false);
    setAttachment(null);
    setQuote(null);
  }, []);

  const loadConversations = useCallback(async () => {
    setListLoading(true);
    try {
      const list = await fetchConversations(CONVERSATION_LIMIT);
      // 排序交给共用规则（按最后一条消息 ID 倒序），不依赖服务端返回顺序
      setConversations(sortConversations(list));
    } catch (_error) {
      // 请求层已统一提示；这里兜住异常，抽屉不至于白屏
    } finally {
      setListLoading(false);
    }
  }, []);

  /**
   * 群资料变更（改名 / 邀请 / 移除）后同步会话标题与列表项。
   *
   * <p>口径与 `/chat` 页一致：标题与列表项同源渲染，只改一处会让同一屏里出现两个群名。</p>
   */
  const applyGroupUpdate = useCallback((detail: ChatGroupDetail) => {
    setActive((prev) =>
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
   * 我已退出 / 解散该群：退回会话列表并刷新。
   *
   * <p>离开必须真的退出去：成员行已被服务端清掉，留在详情里继续发消息只会撞上 1012。</p>
   */
  const handleGroupLeft = useCallback(
    (groupId: string) => {
      setActive((prev) => (prev && prev.targetId === groupId ? null : prev));
      setGroupPanelOpen(false);
      setMessages([]);
      setQuote(null);
      setAttachment(null);
      void loadConversations();
    },
    [loadConversations, setAttachment],
  );

  const openSession = useCallback(async (session: ChatSession) => {
    setActive(session);
    // 引用草稿跟着会话走：留着会让下一条消息被挂到另一个会话的引用上
    setQuote(null);
    setHistoryLoading(true);
    try {
      // 接口按 id 倒序返回：反转成时间正序后再渲染
      const history = await fetchChatHistory({
        scope: session.chatScope,
        targetId: session.targetId,
        limit: HISTORY_LIMIT,
      });
      setMessages([...history].reverse());
      setConversations((prev) => clearSessionUnread(prev, session));
    } catch (_error) {
      setMessages([]);
    } finally {
      setHistoryLoading(false);
    }
    // 置读与顶栏角标对齐，口径同 `/chat` 页：只有真的改了行（affected > 0）才拉一次未读快照，
    // 未读数的唯一事实源是 wsStore，不拉顶栏红点就停在旧数字上
    void markChatRead(session.chatScope, session.targetId)
      .then((affected) => (affected > 0 ? wsStore.refresh() : undefined))
      .catch(() => undefined);
  }, []);

  // 打开抽屉时刷新会话列表；关闭时收起浮层状态
  useEffect(() => {
    if (panel.chatOpen) {
      void loadConversations();
    }
  }, [panel.chatOpen, loadConversations]);

  // 消费「从文件页点发送到聊天」带过来的待发送文件（一次性令牌）
  useEffect(() => {
    if (!panel.chatOpen || !panel.attachment) {
      return;
    }
    const payload = consumeAttachment();
    if (payload) {
      setAttachment(payload);
    }
  }, [panel.chatOpen, panel.attachment]);

  // 实时帧：只处理抽屉展开期间的帧；未展开时未读由通知铃铛与 /chat 页负责
  useWebSocket({
    onMessage: (msg) => {
      if (!chatOpenRef.current) {
        return;
      }
      const session = sessionOfMessage(msg);
      if (!session) {
        return;
      }
      const current = activeRef.current;
      if (current && isSameSession(session, current)) {
        // 合并而不是追加：推送覆盖该用户全部连接，自己刚发的那条会被原样推回来，
        // 直接追加就会在抽屉里画出两个气泡（`/chat` 页走的是同一条规则）
        setMessages((prev) => mergeMessage(prev, msg));
        if (!isMine(msg)) {
          // 置读口径同 `/chat` 页：自己发的帧（多标签页会把自己的消息收回来）标了也没意义，
          // 「别人发的 + 会话正开着」才置读，并回正顶栏角标
          void markChatRead(session.chatScope, session.targetId)
            .then((affected) => (affected > 0 ? wsStore.refresh() : undefined))
            .catch(() => undefined);
        }
      }
      // 会话列表（摘要 / 未读增量 / 重排）同样交给共用规则，不与 `/chat` 页各写一份
      const result = applyIncomingToConversations(
        conversationsRef.current,
        msg,
        { activeSession: current },
      );
      if (result.knownSession) {
        setConversations(result.conversations);
      } else {
        // 列表里还没有这个会话：就地插会缺 targetName（先显示「用户 #id」再跳真名），改拉一次
        void loadConversations();
      }
    },
    // 已读回执：抽屉收起时不必处理（重开时历史自带 readers，不会丢事实）
    onReadReceipt: (receipt: WsChatReadPayload) => {
      if (!chatOpenRef.current) {
        return;
      }
      const current = activeRef.current;
      if (!isReceiptOfSession(receipt, current)) {
        return;
      }
      setMessages((prev) => applyReadReceipt(prev, receipt));
    },
    /**
     * 撤回帧：对方撤回时我这端也要变（口径与 `/chat` 页完全一致）。
     *
     * <p>服务端把撤回推给该消息的全部参与人，而这些帧可能同时属于多个会话
     * （页面 + 抽屉 + 多标签页），因此先比对 {@code (scope, targetId)} 再按幂等键定位；
     * 抽屉收起时不处理——重开时历史里带的就是撤回后的状态，不会丢事实。</p>
     */
    onRecall: (recall: WsChatRecallPayload) => {
      if (!chatOpenRef.current) {
        return;
      }
      const current = activeRef.current;
      if (!isReceiptOfSession(recall, current)) {
        return;
      }
      setMessages((prev) =>
        applyRecall(prev, recall.clientMsgId, recall.recallTime),
      );
    },
  });

  /**
   * 对端在线状态与「正在输入」。
   *
   * <p>抽屉收起时把会话传成 null：订阅、续订与输入上报一并停掉——
   * 关掉的面板不该继续每 30s 发请求，也不该再把「我在输入」报给对端
   * （与上面实时帧 {@code chatOpenRef} 的取舍同源）。</p>
   */
  const { peerStatus, peerTyping, notifyTyping } = useChatPresence({
    session: panel.chatOpen ? active : null,
  });

  /** 输入框变化：把「我在输入」告诉对端（节流与续订在 Hook 内）。 */
  const handleDraftChange = (next: string) => {
    setDraft(next);
    notifyTyping(next.trim() !== '');
  };

  // 新消息滚动到底
  useEffect(() => {
    const node = streamRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages, historyLoading]);

  const send = useCallback(async () => {
    if (!active || sending) {
      return;
    }
    const text = draft.trim();
    if (!attachment && !text) {
      return;
    }
    setSending(true);
    try {
      // 幂等键与授权建立都在共用草稿机里（含仅预览传 0、群聊不建授权等规则）
      const sent = await sendChatMessage(
        await buildMessage(active, text, quote?.clientMsgId, mentionUserIds),
      );
      // 同上：响应与 WS 回推帧几乎同时到达，去重交给 mergeMessage（同时认 id 与 clientMsgId）
      setMessages((prev) => mergeMessage(prev, sent));
      const result = applyIncomingToConversations(
        conversationsRef.current,
        sent,
        { activeSession: active },
      );
      if (result.knownSession) {
        setConversations(result.conversations);
      } else {
        // 新会话（首条消息）不在列表里：拉一次列表拿回 targetName
        void loadConversations();
      }
      setDraft('');
      // 引用随发送成功一起清掉：失败时保留，让用户改完正文能直接重试同一句引用
      setQuote(null);
      // 显式收尾：清空走的是 setState 而非 onChange，不补这一帧对端要等空闲兜底才收起
      notifyTyping(false);
      setAttachment(null);
    } catch (_error) {
      // 发送失败：保留输入、附件与引用，让用户可以重发（请求层已提示原因）
    } finally {
      setSending(false);
    }
  }, [
    active,
    attachment,
    draft,
    quote,
    buildMessage,
    sending,
    loadConversations,
  ]);

  /** 我自己的头像（登录态）：气泡里的「我」那一行不走消息载荷，见 `useCurrentUserAvatar`。 */
  const myAvatar = useCurrentUserAvatar();

  /**
   * 当前会话的展示对象（名字与头像已回填，见 {@link resolveSessionDisplay}）。
   *
   * <p>标题与消息头像都必须从这里取值：曾经标题做了回查、头像直接拿裸定位去取首字，
   * 结果列表里的「系」一进详情就变成「用」。
   */
  /**
   * 我改过的对端备注（展示层叠加，口径与 `/chat` 页完全一致）。
   *
   * <p>保存备注不重拉列表（写接口已回吐结果），因此页面数据比真实备注旧一拍；
   * 叠加只发生在派生层，存储态 {@link conversations} 保持「服务端给的那份」。</p>
   */
  const aliasOverrides = usePeerAliasOverrides();

  const viewConversations = useMemo(
    () =>
      conversations.map((item) => applyPeerAliasOverride(item, aliasOverrides)),
    [conversations, aliasOverrides],
  );

  const activeDisplay = useMemo(
    () =>
      active
        ? // 再叠一次覆盖表：详情态自带的备注可能是我刚改之前的旧值
          // （resolveSessionDisplay 只在字段缺失时回填，不覆盖已有值）
          applyPeerAliasOverride(
            resolveSessionDisplay(active, viewConversations),
            aliasOverrides,
          )
        : null,
    [active, viewConversations, aliasOverrides],
  );

  /**
   * 当前会话的对端用户 ID（仅单聊有值），口径与 `/chat` 页一致。
   *
   * <p>用在两处：会话列表项与消息气泡。它们都要把「用户 ID」交给头像组件去查全局覆盖表——
   * 只有单聊的 `targetId` 是用户 ID；群聊的目标 ID 属于群，不能拿它查用户头像。</p>
   */
  const peerUserId =
    active?.chatScope === ChatScope.PRIVATE ? activeDisplay?.targetId : undefined;

  const activeTitle = activeDisplay
    ? conversationTitle(activeDisplay)
    : intl.formatMessage({ id: 'chat.drawer.title' });

  /**
   * 引用块里的「谁说的」、撤回占位里的「谁撤的」（口径与 `/chat` 页同源）。
   *
   * <p>单聊的对端名就是会话标题，直接复用；群聊没有唯一对端，传 `null` 让
   * {@link messageSenderLabel} 把 ID 兜出去——抽屉比页面还窄，写错名字的代价更大。</p>
   */
  const senderLabels = useMemo<MessageSenderLabels>(
    () => ({
      mine: intl.formatMessage({ id: 'chat.sender.mine' }),
      peer: active?.chatScope === ChatScope.PRIVATE ? activeTitle : null,
      unknown: (userId: string) =>
        intl.formatMessage({ id: 'chat.session.userFallback' }, { id: userId }),
    }),
    [intl, active?.chatScope, activeTitle],
  );

  /** 摘要里「有人@我」前缀的文案（与 `/chat` 页同源，纯函数不硬编码语言）。 */
  const summaryLabels = useMemo<ConversationSummaryLabels>(
    () => ({ mentionMe: intl.formatMessage({ id: 'chat.mention.me' }) }),
    [intl],
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
   * <p>先发请求、成功后再改本地：撤回成功的表现是正文永久消失，一旦本地先改了、
   * 服务端却拒绝（超窗 / 不是你的消息），原文已经找不回来。失败原因由请求层给出
   * （撤回是显式动作，接口刻意非静默），这里只兜住不经请求通道的异常，
   * 避免同一句话弹两遍。</p>
   */
  const handleRecall = async (message: NotifyMessage) => {
    const clientMsgId = message.clientMsgId;
    if (!clientMsgId) {
      return;
    }
    try {
      await recallChatMessage(clientMsgId);
      setMessages((prev) => applyRecall(prev, clientMsgId));
      const session = activeRef.current;
      if (session) {
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

  /**
   * 气泡下的读者头像（已读回执）。
   *
   * <p>数据来源与 `/chat` 页完全一致：历史里每条消息自带 {@code readers}，在线时由
   * `CHAT_READ` 帧增量补上；渲染规则也共用 {@link summarizeReaders}（封顶后折成「+N」），
   * 区别只是抽屉更窄、头像更小。</p>
   */
  const renderReaders = (msg: NotifyMessage) => {
    const { shown, overflow } = summarizeReaders(msg.readers);
    if (shown.length === 0) {
      return null;
    }
    const names = (msg.readers ?? []).map((reader) => reader.displayName);
    return (
      <div
        className={styles.readers}
        role="img"
        aria-label={intl.formatMessage(
          { id: 'chat.read.by' },
          { names: names.join(', ') },
        )}
      >
        {shown.map((reader, index) => (
          // 头像内容只是姓名首字：`role="img"` 的元素后代本就不进入无障碍树，读者名单
          // 由外层 aria-label 一次性给全；外壳承载 title / 叠放与描边（Avatar 不收这些属性）
          <span
            key={reader.userId}
            title={reader.displayName}
            className={
              index === 0 ? styles.readerAvatarFirst : styles.readerAvatar
            }
          >
            <UserAvatar
              userId={reader.userId}
              size={16}
              className={styles.readerAvatarInner}
              src={reader.avatarUrl}
            >
              {reader.displayName.slice(0, 1).toUpperCase()}
            </UserAvatar>
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

  return (
    <Drawer
      open={panel.chatOpen}
      onClose={closeDrawer}
      placement="right"
      width={SHELL.chatDrawerWidth}
      closable={false}
      styles={{ header: { display: 'none' }, body: { padding: 0 } }}
    >
      <div
        className={dragOver ? `${styles.body} ${styles.bodyDragOver}` : styles.body}
        {...dropZoneProps}
      >
        <div className={styles.head}>
          {active ? (
            <Button
              type="text"
              size="small"
              icon={<ArrowLeftOutlined />}
              aria-label={intl.formatMessage({ id: 'chat.drawer.backToList' })}
              onClick={() => {
                setActive(null);
                setMessages([]);
                setAttachment(null);
                void loadConversations();
              }}
            />
          ) : (
            <UserOutlined />
          )}
          <span className={styles.headMain}>
            <span className={styles.headTitle}>{activeTitle}</span>
            {/*
              对端状态：会话列表视图（active 为空）不渲染——那里的标题是面板名「消息」，
              挂一个状态点会被读成「消息这个人」的状态
            */}
            {active ? (
              <ChatPeerStatus compact status={peerStatus} typing={peerTyping} />
            ) : null}
          </span>
          {/*
            群设置入口：只在打开的会话是群聊时出现（与 /chat 页同口径）。
            抽屉只有 380px，这里只留图标 + aria-label，文案由无障碍名承担。
          */}
          {active?.chatScope === ChatScope.GROUP ? (
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined />}
              aria-label={intl.formatMessage({ id: 'chat.group.title' })}
              onClick={() => setGroupPanelOpen(true)}
            />
          ) : null}
          {/*
            对端资料入口与群设置入口互为镜像：备注挂的是「对方这个人」，
            群聊没有这个主体（targetId 是群组 ID），因此只在单聊出现。
            抽屉只有 380px，这里与群设置一样只留图标，文案由 aria-label 承担。
          */}
          {active?.chatScope === ChatScope.PRIVATE ? (
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              aria-label={intl.formatMessage({ id: 'chat.peer.title' })}
              onClick={() => setPeerPanelOpen(true)}
            />
          ) : null}
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            aria-label={intl.formatMessage({ id: 'chat.drawer.refresh' })}
            onClick={() => void loadConversations()}
          />
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            aria-label={intl.formatMessage({ id: 'chat.drawer.close' })}
            onClick={closeDrawer}
          />
        </div>

        {!active && (
          <div className={styles.list}>
            {listLoading && viewConversations.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <Spin />
              </div>
            ) : viewConversations.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={intl.formatMessage({ id: 'chat.drawer.emptyConversations' })}
                style={{ marginTop: 48 }}
              />
            ) : (
              viewConversations.map((conversation) => {
                const session: ChatSession = {
                  chatScope: conversation.chatScope,
                  targetId: conversation.targetId,
                  // 名字随定位一起带进详情：否则只能靠回查列表补，
                  // 列表尚未加载（深链 / 刚到的新会话）时标题与头像会双双回落成「用户 #<id>」
                  targetName: conversation.targetName,
                  // 头像同理：带上就不必等列表回查，深链时详情气泡与标题头像也不会打架
                  targetAvatarUrl: conversation.targetAvatarUrl,
                  // 备注一并带过去：详情态的标题/署名要用它，深链时也能立刻显示「我起的名字」，
                  // 而不是先亮真实昵称、等列表回来再改口
                  peerAlias: conversation.peerAlias,
                };
                return (
                  <button
                    type="button"
                    key={sessionKey(session)}
                    className={styles.conversation}
                    aria-label={intl.formatMessage(
                      { id: 'chat.drawer.openConversation' },
                      { name: conversationTitle(conversation) },
                    )}
                    onClick={() => void openSession(session)}
                  >
                    <Badge
                      count={conversation.unreadCount}
                      size="small"
                      /* 有人 @ 我时把角标染成错误色：数字仍是未读总数
                         （未读 @ 是它的子集，相加会报出比实际更多的未读数） */
                      color={
                        hasUnreadMention(conversation)
                          ? token.colorError
                          : undefined
                      }
                    >
                      <UserAvatar
                        /* 单聊的 targetId 才是用户 ID，群聊不传（同 /chat 页口径） */
                        userId={
                          conversation.chatScope === ChatScope.PRIVATE
                            ? conversation.targetId
                            : undefined
                        }
                        size={36}
                        className={styles.avatar}
                        src={conversation.targetAvatarUrl}
                      >
                        {conversationInitial(conversation)}
                      </UserAvatar>
                    </Badge>
                    <span className={styles.conversationMain}>
                      <span className={styles.conversationTitle}>
                        <span className={styles.conversationName}>
                          {conversationTitle(conversation)}
                        </span>
                        <span className={styles.conversationTime}>
                          {formatClock(conversation.lastTime)}
                        </span>
                      </span>
                      <span className={styles.conversationSummary}>
                        {conversationSummary(conversation, summaryLabels, 28)}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}

        {active && (
          <>
            <div className={styles.stream} ref={streamRef}>
              {historyLoading && messages.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <Spin />
                </div>
              ) : messages.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={intl.formatMessage({ id: 'chat.drawer.emptyMessages' })}
                  style={{ marginTop: 32 }}
                />
              ) : (
                messages.map((msg) => {
                  const mine = isMine(msg);
                  // 撤回是终态、正文已被清空：判定只看标记（见 isRecalled）
                  const recalled = isRecalled(msg);
                  const card =
                    !recalled && msg.messageType === MessageType.FILE
                      ? parseFileCardContent(msg.content)
                      : null;
                  /**
                   * 这条消息是否点了我。
                   *
                   * <p>{@code mentioned} 是行级标记（写扩散下同一条消息每人一行），服务端只在被点名者
                   * 那一行置 1，所以「我这一行是 1」就等于「有人 @ 了我」，不需要解析正文里的昵称。</p>
                   *
                   * <p>已撤回的排除在外：正文已清空，再挂标记会让人以为那句话还读得到。</p>
                   */
                  const mentioned = !recalled && msg.mentioned === true;
                  // 非空即代表「这条消息现在可以被引用」：菜单项的显隐直接由它决定，
                  // 不另写一套判断（口径见 services/chat/quote）
                  const quoteDraft = toQuoteDraft(
                    msg,
                    messageSenderLabel(msg.senderUserId, msg, senderLabels),
                  );
                  return (
                    <div
                      key={msg.id}
                      className={mine ? `${styles.row} ${styles.rowMine}` : styles.row}
                    >
                      <UserAvatar
                        /* 「我发的」不给 userId：自己的头像只认登录态（与顶栏同源），
                           由资料变更帧回写。别人发的用消息自带的发送人 ID，缺失时回落
                           对端 ID（单聊里发送人即对端，与标题、首字兜底同源） */
                        userId={mine ? undefined : msg.senderUserId ?? peerUserId}
                        size={28}
                        className={styles.avatar}
                        /* 「我发的」那一行不带发送人头像（服务端刻意省掉这一次查库），
                           自己的头像只认登录态，与顶栏同源；别人发的优先用消息自带的
                           发送人头像，缺失时回落当前会话头像（单聊里发送人即对端，
                           与标题、首字兜底同源）。
                           src 是回落值：`UserAvatar` 会先用上面的 userId 查全局覆盖表，
                           因此发送人刚换过头像时无需重拉历史即可换图 */
                        src={mine ? myAvatar : msg.senderAvatarUrl ?? activeDisplay?.targetAvatarUrl ?? null}
                      >
                        {mine
                          ? intl.formatMessage({ id: 'chat.drawer.mineAvatar' })
                          : messageSenderInitial(msg, conversationInitial(activeDisplay ?? active))}
                      </UserAvatar>
                      <ChatMessageMenu
                        canRecall={isRecallable(msg)}
                        canQuote={quoteDraft != null}
                        onRecall={() => void handleRecall(msg)}
                        onQuote={() => setQuote(quoteDraft)}
                      >
                        <div
                          className={
                            // 已撤回的不叠 bubbleMine：撤回后两个方向长得一样是刻意的
                            recalled
                              ? `${styles.bubble} ${styles.bubbleRecalled}`
                              : `${styles.bubble}${
                                  mine ? ` ${styles.bubbleMine}` : ''
                                }${mentioned ? ` ${styles.bubbleMentioned}` : ''}`
                          }
                        >
                          {/*
                            「有人@我」标记放在正文之前：光有一圈描边是说不清原因的
                            ——用户只会看到一条「不知为何被框起来」的消息
                          */}
                          {mentioned ? (
                            <span className={styles.bubbleMention}>
                              {intl.formatMessage({ id: 'chat.mention.me' })}
                            </span>
                          ) : null}
                          {recalled ? (
                            recalledText(msg)
                          ) : card ? (
                            <ChatFileCard
                              name={card.name}
                              sizeText={card.sizeText}
                              nodeId={card.nodeId}
                              attachmentId={card.attachmentId}
                              mine={mine}
                            />
                          ) : (
                            <span>
                              {/*
                                引用块取服务端写入时的快照，不回查原消息：
                                原消息随后被撤回时正文已清空，回查会让引用块一起变空白。
                                快照过一层展示口径：被引用的是文件消息时正文末尾挂着
                                `#file:` / `#att:` 尾注，不剥就会当成引用正文画出来
                              */}
                              {msg.quoteClientMsgId ? (
                                <ChatMessageQuote
                                  senderName={messageSenderLabel(
                                    msg.quoteSenderUserId,
                                    msg,
                                    senderLabels,
                                  )}
                                  summary={fileCardDisplayText(msg.quoteContent)}
                                />
                              ) : null}
                              {msg.messageType === MessageType.FILE
                                ? intl.formatMessage(
                                    { id: 'chat.drawer.fileFallback' },
                                    { content: truncate(msg.content ?? '', 120) },
                                  )
                                : msg.content}
                            </span>
                          )}
                          <div className={styles.bubbleTime}>
                            {formatClock(msg.createTime)}
                          </div>
                          {mine ? renderReaders(msg) : null}
                        </div>
                      </ChatMessageMenu>
                    </div>
                  );
                })
              )}
            </div>

            <ChatComposer
              compact
              value={draft}
              onChange={handleDraftChange}
              onSend={() => void send()}
              sending={sending}
              allowEmpty={Boolean(attachment)}
              autoSize={{ minRows: 1, maxRows: 4 }}
              /* 群成员名单为空（单聊 / 未选中会话）时输入框自然不显示 @ 入口 */
              mentionables={mentionables}
              onMentionChange={setMentionUserIds}
              placeholder={intl.formatMessage({
                id: attachment
                  ? 'chat.attach.placeholder'
                  : 'chat.composer.placeholder',
              })}
              sendLabel={intl.formatMessage({ id: 'chat.drawer.send' })}
              tools={
                <ChatAttachmentPicker
                  // 与 /chat 页分成两条上传队列：抽屉挂在布局外壳上，页与抽屉会同时挂载，
                  // 共用 id 会让「在抽屉里选的文件附到页面的草稿上」（见组件文件头）
                  queueId="chat-send-drawer"
                  onPick={setAttachment}
                  disabled={sending || Boolean(attachment)}
                />
              }
              header={
                <>
                  {/* 「正在引用」条在最上面：它是这次发送要带上的唯一一条上下文 */}
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
                    showPolicy={active?.chatScope === ChatScope.PRIVATE}
                    disabled={sending}
                  />
                </>
              }
            />
          </>
        )}
      </div>

      {/*
        群设置面板：与 /chat 页共用同一个组件，口径因此不会分叉。
        groupId 只在群会话下给出——返回列表后（active 为空）即使面板还开着，
        也不会再去拉一个说不清是谁的群。
      */}
      <ChatGroupPanel
        open={groupPanelOpen}
        groupId={active?.chatScope === ChatScope.GROUP ? active.targetId : null}
        onClose={() => setGroupPanelOpen(false)}
        onUpdated={applyGroupUpdate}
        onLeft={handleGroupLeft}
      />

      {/*
        对端资料面板：与 /chat 页共用同一个组件（口径因此不会分叉）。
        peerId 只在单聊下给出——返回列表后（active 为空）或群会话里即使面板还开着，
        也不会拿着群组 ID 去查用户备注（那是跨域取值）。
      */}
      <ChatPeerPanel
        open={peerPanelOpen && active?.chatScope === ChatScope.PRIVATE}
        peerId={
          active?.chatScope === ChatScope.PRIVATE
            ? activeDisplay?.targetId
            : null
        }
        // 只读的真实昵称：仍取后端名（含回落名），备注在面板内按同一展示链叠加
        nickname={
          active?.chatScope === ChatScope.PRIVATE && activeDisplay
            ? activeDisplay.targetName?.trim() ||
              intl.formatMessage(
                { id: 'chat.session.userFallback' },
                { id: activeDisplay.targetId },
              )
            : ''
        }
        avatarUrl={activeDisplay?.targetAvatarUrl}
        alias={
          active?.chatScope === ChatScope.PRIVATE
            ? activeDisplay?.peerAlias ?? null
            : null
        }
        onClose={() => setPeerPanelOpen(false)}
        // 写接口已回吐结果，交给覆盖表即可，不必为改几个字重拉会话列表（列表在抽屉里滚动位置也会丢）
        onChanged={applyPeerAliasChange}
      />
    </Drawer>
  );
};

export default ChatDrawer;
