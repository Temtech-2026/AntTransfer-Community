/**
 * 即时通讯抽屉（方案「C. 即时通讯面板」）。
 *
 * <p>三条设计约束：
 * <ol>
 *   <li><b>不喧宾夺主</b>：默认隐藏，从屏幕右侧滑出 380px，主内容区不被永久占用；</li>
 *   <li><b>聊天是文件的附属品</b>：可以从文件列表拖文件进来发送，消息气泡渲染成
 *       文件迷你卡片（见 {@link ChatFileCard} 的正文口径说明）；</li>
 *   <li><b>与会话页同源</b>：会话、历史、发送、已读全部复用 `services/chat`，
 *       抽屉与 `/chat` 页看到的是同一份数据；实时帧走应用级 WebSocket 单例。</li>
 * </ol>
 *
 * <p>窄抽屉放不下「列表 + 消息」两栏，因此采用主从切换：未选中会话时是会话列表，
 * 选中后进入消息流（左上角返回）。这样在 380px 内也不挤。
 */

import {
  ArrowLeftOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  FileOutlined,
  ReloadOutlined,
  SendOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { createStyles } from 'antd-style';
import { Alert, Avatar, Badge, Button, Drawer, Empty, Input, Spin } from 'antd';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { formatBytes } from '@/components/ChunkUpload';
import { useWebSocket } from '@/hooks/useWebSocket';
import {
  fetchChatHistory,
  fetchConversations,
  markChatRead,
  sendChatMessage,
} from '@/services/chat/api';
import {
  buildFileCardContent,
  parseFileCardContent,
} from '@/services/chat/fileCard';
import {
  conversationInitial,
  conversationSummary,
  conversationTitle,
  isMine,
  isSameSession,
  newClientMsgId,
  sessionKey,
  sessionOfMessage,
  truncate,
  type ChatSendPayload,
  type ChatSession,
  type Conversation,
} from '@/services/chat/types';
import { MessageType, type NotifyMessage } from '@/services/notify';
import {
  consumeAttachment,
  setChatOpen,
  shellPanelStore,
} from '@/services/ui/panelHub';
import { SHELL } from '@/theme/tokens';
import {
  hasDragPayload,
  readDragPayload,
  type FileDragPayload,
} from '@/utils/dragFile';

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
  headTitle: css`
    flex: 1;
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
  bubbleTime: css`
    margin-top: 4px;
    color: ${token.colorTextQuaternary};
    font-size: 11px;
    text-align: end;
  `,
  fileCard: css`
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 180px;
    padding: 8px 10px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorBgElevated};
  `,
  fileIcon: css`
    flex: none;
    font-size: 20px;
    color: ${token.colorPrimary};
  `,
  fileMeta: css`
    min-width: 0;
  `,
  fileName: css`
    display: block;
    max-width: 200px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  `,
  fileSize: css`
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
  `,
  composer: css`
    border-top: 1px solid ${token.colorSplit};
    padding: 10px 12px;
  `,
  attach: css`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    padding: 6px 8px;
    border: 1px dashed ${token.colorBorder};
    border-radius: ${token.borderRadius}px;
    background: ${token.colorFillQuaternary};
    font-size: ${token.fontSizeSM}px;
  `,
  attachName: css`
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  `,
  composerRow: css`
    display: flex;
    align-items: flex-end;
    gap: 8px;
  `,
  hint: css`
    margin-bottom: 8px;
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
 * 把新到达的消息并入会话列表。
 *
 * <p>当前正打开的会话、以及我自己发的消息都不加未读——否则抽屉开着还会长角标。
 *
 * @param activeKey 当前打开会话的 {@link sessionKey}
 */
function applyIncoming(
  list: Conversation[],
  session: ChatSession,
  msg: NotifyMessage,
  activeKey: string | null,
): Conversation[] {
  const key = sessionKey(session);
  const index = list.findIndex((item) => sessionKey(item) === key);
  const mine = isMine(msg);
  if (index < 0) {
    // 全新会话：插到最前。targetName 缺失时展示名由 conversationTitle 回落
    return [
      {
        chatScope: session.chatScope,
        targetId: session.targetId,
        targetName: null,
        lastMessageId: msg.id,
        lastContent: msg.content,
        lastMessageType: msg.messageType,
        lastMessageMine: mine,
        lastTime: msg.createTime,
        unreadCount: activeKey === key || mine ? 0 : 1,
      },
      ...list,
    ];
  }
  const next = [...list];
  const current = next[index];
  next[index] = {
    ...current,
    lastMessageId: msg.id,
    lastContent: msg.content,
    lastMessageType: msg.messageType,
    lastMessageMine: mine,
    lastTime: msg.createTime,
    unreadCount:
      activeKey === key || mine ? current.unreadCount : current.unreadCount + 1,
  };
  return next;
}

/** 抽屉样式对象类型（避免用 any 传递样式） */
type DrawerStyles = ReturnType<typeof useStyles>['styles'];

/** 消息正文里的文件迷你卡片（解析失败时由调用方回落为文本） */
const FileCard: React.FC<{
  name: string;
  sizeText: string;
  styles: DrawerStyles;
}> = ({ name, sizeText, styles }) => (
  <div className={styles.fileCard}>
    <FileOutlined className={styles.fileIcon} />
    <div className={styles.fileMeta}>
      <span className={styles.fileName} title={name}>
        {name}
      </span>
      <span className={styles.fileSize}>{sizeText}</span>
    </div>
  </div>
);

/**
 * 即时通讯抽屉：会话列表 / 消息流 / 文件投递。
 */
const ChatDrawer: React.FC = () => {
  const intl = useIntl();
  const { styles } = useStyles();
  const panel = useSyncExternalStore(
    shellPanelStore.subscribe,
    shellPanelStore.getSnapshot,
    shellPanelStore.getSnapshot,
  );

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<NotifyMessage[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [attachment, setAttachment] = useState<FileDragPayload | null>(null);
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const streamRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<ChatSession | null>(null);
  activeRef.current = active;
  // 实时帧回调不该随渲染重建，但又要知道抽屉是否还开着，因此走 ref
  const chatOpenRef = useRef(panel.chatOpen);
  chatOpenRef.current = panel.chatOpen;

  /** 关闭抽屉：顺手清掉待发送文件，避免下次打开还挂着上一轮的附件 */
  const closeDrawer = useCallback(() => {
    setChatOpen(false);
    setAttachment(null);
  }, []);

  const loadConversations = useCallback(async () => {
    setListLoading(true);
    try {
      const list = await fetchConversations(CONVERSATION_LIMIT);
      setConversations(list);
    } catch (_error) {
      // 请求层已统一提示；这里兜住异常，抽屉不至于白屏
    } finally {
      setListLoading(false);
    }
  }, []);

  const openSession = useCallback(async (session: ChatSession) => {
    setActive(session);
    setHistoryLoading(true);
    try {
      // 接口按 id 倒序返回：反转成时间正序后再渲染
      const history = await fetchChatHistory({
        scope: session.chatScope,
        targetId: session.targetId,
        limit: HISTORY_LIMIT,
      });
      setMessages([...history].reverse());
      void markChatRead(session.chatScope, session.targetId);
      setConversations((prev) =>
        prev.map((item) =>
          isSameSession(item, session) ? { ...item, unreadCount: 0 } : item,
        ),
      );
    } catch (_error) {
      setMessages([]);
    } finally {
      setHistoryLoading(false);
    }
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
      setConversations((prev) =>
        applyIncoming(prev, session, msg, current ? sessionKey(current) : null),
      );
      if (current && isSameSession(session, current)) {
        setMessages((prev) => [...prev, msg]);
        void markChatRead(session.chatScope, session.targetId);
      }
    },
  });

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
    const payload: ChatSendPayload = {
      scope: active.chatScope,
      targetId: active.targetId,
      messageType: attachment ? MessageType.FILE : MessageType.TEXT,
      content: attachment
        ? buildFileCardContent(
            attachment.fileName,
            formatBytes(attachment.sizeBytes),
          )
        : text,
      clientMsgId: newClientMsgId(),
    };
    setSending(true);
    try {
      const sent = await sendChatMessage(payload);
      setMessages((prev) => [...prev, sent]);
      setConversations((prev) =>
        applyIncoming(prev, active, sent, sessionKey(active)),
      );
      setDraft('');
      setAttachment(null);
    } catch (_error) {
      // 发送失败：保留输入与附件，让用户可以重发（请求层已提示原因）
    } finally {
      setSending(false);
    }
  }, [active, attachment, draft, sending]);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragOver(false);
      const payload = readDragPayload(event.dataTransfer);
      if (payload) {
        setAttachment(payload);
      }
    },
    [],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!hasDragPayload(event.dataTransfer)) {
        return;
      }
      // 必须阻止默认行为，否则浏览器不会派发 drop
      event.preventDefault();
      setDragOver(true);
    },
    [],
  );

  /** 当前会话展示名：targetName 只在会话列表里，因此回查一次再回落 */
  const activeTitle = useMemo(() => {
    if (!active) {
      return intl.formatMessage({ id: 'chat.drawer.title' });
    }
    const found = conversations.find((item) => isSameSession(item, active));
    return conversationTitle({ ...active, targetName: found?.targetName });
  }, [active, conversations, intl]);

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
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
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
          <span className={styles.headTitle}>{activeTitle}</span>
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
            {listLoading && conversations.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <Spin />
              </div>
            ) : conversations.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={intl.formatMessage({ id: 'chat.drawer.emptyConversations' })}
                style={{ marginTop: 48 }}
              />
            ) : (
              conversations.map((conversation) => {
                const session: ChatSession = {
                  chatScope: conversation.chatScope,
                  targetId: conversation.targetId,
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
                    <Badge count={conversation.unreadCount} size="small">
                      <Avatar size={36} className={styles.avatar}>
                        {conversationInitial(conversation)}
                      </Avatar>
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
                        {conversationSummary(conversation, 28)}
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
                  const card =
                    msg.messageType === MessageType.FILE
                      ? parseFileCardContent(msg.content)
                      : null;
                  return (
                    <div
                      key={msg.id}
                      className={mine ? `${styles.row} ${styles.rowMine}` : styles.row}
                    >
                      <Avatar size={28} className={styles.avatar}>
                        {mine
                          ? intl.formatMessage({ id: 'chat.drawer.mineAvatar' })
                          : conversationInitial(active)}
                      </Avatar>
                      <div
                        className={
                          mine
                            ? `${styles.bubble} ${styles.bubbleMine}`
                            : styles.bubble
                        }
                      >
                        {card ? (
                          <FileCard
                            name={card.name}
                            sizeText={card.sizeText}
                            styles={styles}
                          />
                        ) : (
                          <span>
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
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className={styles.composer}>
              {attachment ? (
                <div className={styles.attach}>
                  <FileOutlined />
                  <span className={styles.attachName} title={attachment.fileName}>
                    {attachment.fileName}
                  </span>
                  <span>{formatBytes(attachment.sizeBytes)}</span>
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseCircleOutlined />}
                    aria-label={intl.formatMessage({ id: 'chat.drawer.removeAttachment' })}
                    onClick={() => setAttachment(null)}
                  />
                </div>
              ) : (
                <Alert
                  className={styles.hint}
                  type="info"
                  showIcon
                  banner
                  message={intl.formatMessage({ id: 'chat.drawer.dropHint' })}
                />
              )}
              <div className={styles.composerRow}>
                <Input.TextArea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={intl.formatMessage({
                    id: attachment
                      ? 'chat.drawer.placeholderWithAttachment'
                      : 'chat.drawer.placeholder',
                  })}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  onPressEnter={(event) => {
                    if (!event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  loading={sending}
                  onClick={() => void send()}
                >
                  {intl.formatMessage({ id: 'chat.drawer.send' })}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
};

export default ChatDrawer;
