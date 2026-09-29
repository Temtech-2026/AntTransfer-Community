/**
 * 消息中心（第 2 步页面 8）：系统通知 + 待办。
 *
 * <p><b>三条口径，决定了这个页面的写法：</b>
 * <ol>
 *   <li><b>实时 + 历史两条来源合流。</b>历史走 REST 分页，实时走 {@link useWebSocket} 的
 *       `onMessage`；重连时 `wsStore` 会补拉离线消息并**从同一个 `onMessage` 推过来**，
 *       所以这里只写一套插入逻辑（补收计数另走 `subscribeBackfill`，仅用于提示）。</li>
 *   <li><b>未读数不在本页自算。</b>红点数字的唯一事实源是 `wsStore`，本页只读不写；
 *       做完已读写操作后调 `wsStore.refresh()` 对齐，避免「列表已读、红点不动」。</li>
 *   <li><b>新消息只在第 1 页插入。</b>翻到第 2 页时插行会让整屏内容下移（容易点错目标），
 *       因此第 2 页及以后只靠顶栏角标与「刷新」按钮提示。</li>
 * </ol>
 *
 * <p>待办 Tab 的数据源 `TodoController` 是 `sys_notify_message` 按类型（1/2/8）+ 未读状态的
 * **投影视图**，所以「标记已办」复用通知域的「标记已读」接口，落点是审批中心 / 文件工作台。
 */

import {
  BellOutlined,
  CheckOutlined,
  DownloadOutlined,
  LinkOutlined,
  ReloadOutlined,
  SafetyOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history, useAccess, useIntl } from '@umijs/max';
import {
  Alert,
  App,
  Badge,
  Button,
  List,
  Segmented,
  Space,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import EmptyState from '@/components/EmptyState';
import PageSkeleton from '@/components/PageSkeleton';
import SectionCard from '@/components/SectionCard';
import useWebSocket from '@/hooks/useWebSocket';
import {
  isChatNotify,
  isTodoNotify,
  markNotificationRead,
  type NotifyMessage,
  NotifyType,
  pageNotifications,
} from '@/services/notify';
import {
  fetchTodoCount,
  markTodoHandled,
  pageTodos,
  type TodoItem,
  type TodoPendingFilter,
} from '@/services/todo';
import { type WsStatus, wsStore } from '@/services/ws';

import { resolveTodoTargetWithAccess } from './todoTarget';

const { Text, Paragraph } = Typography;

/** 分页大小：通知与待办共用。 */
const PAGE_SIZE = 20;

/** 页签。 */
type TabKey = 'notifications' | 'todos';

/** 连接恢复提示的展示时长。 */
const RESTORED_HINT_MS = 3000;

const NOTIFY_TYPE_ICON: Record<number, ReactNode> = {
  [NotifyType.APPROVAL_TODO]: <SafetyOutlined />,
  [NotifyType.APPROVAL_RESULT]: <SendOutlined />,
  [NotifyType.SHARE_LOCKED]: <LinkOutlined />,
  [NotifyType.SHARE_EXPIRE_SOON]: <LinkOutlined />,
  [NotifyType.TRANSFER_COMPLETED]: <CheckOutlined />,
  [NotifyType.SHARE_ACCESSED]: <DownloadOutlined />,
};

const KNOWN_NOTIFY_TYPES: number[] = [
  NotifyType.APPROVAL_TODO,
  NotifyType.APPROVAL_RESULT,
  NotifyType.SHARE_LOCKED,
  NotifyType.SHARE_EXPIRE_SOON,
  NotifyType.ABNORMAL_LOGIN,
  NotifyType.TRANSFER_COMPLETED,
  NotifyType.SHARE_ACCESSED,
];

/** 通知类型 → 文案 id（后端已下发 title 时以 title 为准）。 */
function notifyTypeLabelId(notifyType: number): string {
  return KNOWN_NOTIFY_TYPES.includes(notifyType)
    ? `message.type.${notifyType}`
    : 'message.type.unknown';
}

/** 待办来源文案 id（按 notifyType 判定，与跳转目标同源）。 */
function todoSourceLabelId(notifyType: number): string {
  switch (notifyType) {
    case NotifyType.APPROVAL_TODO:
      return 'message.todo.source.approval';
    case NotifyType.APPROVAL_RESULT:
      return 'message.todo.source.approvalResult';
    default:
      return 'message.todo.source.transfer';
  }
}

/** 通知 → 待办条目（后端同源，字段只需重命名）。 */
function toTodoItem(message: NotifyMessage): TodoItem {
  return {
    id: message.id,
    notifyType: message.notifyType,
    title: message.title,
    content: message.content,
    bizType: message.bizType,
    bizId: message.bizId,
    pending: (message.readStatus ?? 0) === 0,
    createTime: message.createTime,
  };
}

/** 时间展示：后端已按当前语言格式化，缺失时给占位符而不是空白。 */
function timeText(value?: string | null): string {
  return value?.trim() ? value : '—';
}

const MessagesPage = () => {
  const intl = useIntl();
  const access = useAccess();
  const { message: toast } = App.useApp();

  const [activeTab, setActiveTab] = useState<TabKey>('notifications');

  // —— 系统通知列表 ——
  const [notifications, setNotifications] = useState<NotifyMessage[]>([]);
  const [notifyTotal, setNotifyTotal] = useState(0);
  const [notifyPage, setNotifyPage] = useState(1);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [notifyLoaded, setNotifyLoaded] = useState(false);
  const [notifyError, setNotifyError] = useState(false);

  // —— 待办列表 ——
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todoFilter, setTodoFilter] = useState<TodoPendingFilter>('pending');
  const [todoTotal, setTodoTotal] = useState(0);
  const [todoPage, setTodoPage] = useState(1);
  const [todoLoading, setTodoLoading] = useState(false);
  const [todoLoaded, setTodoLoaded] = useState(false);
  const [todoError, setTodoError] = useState(false);
  const [todoUnread, setTodoUnread] = useState(0);

  // 实时插入要读「当前」筛选与页码，但不想因此重建订阅：用 ref 镜像，
  // 回调里读 ref 永远是渲染时的最新值。
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const notifyPageRef = useRef(notifyPage);
  notifyPageRef.current = notifyPage;
  const todoPageRef = useRef(todoPage);
  todoPageRef.current = todoPage;
  const todoFilterRef = useRef(todoFilter);
  todoFilterRef.current = todoFilter;

  const loadNotifications = useCallback(async (targetPage: number) => {
    setNotifyLoading(true);
    setNotifyError(false);
    try {
      const data = await pageNotifications({
        current: targetPage,
        pageSize: PAGE_SIZE,
      });
      setNotifications(data.records);
      setNotifyTotal(data.total);
      setNotifyPage(targetPage);
      setNotifyLoaded(true);
    } catch {
      // 失败提示由请求层统一给出，这里只把当前页切成「加载失败」空态
      setNotifyError(true);
    } finally {
      setNotifyLoading(false);
    }
  }, []);

  const loadTodos = useCallback(
    async (targetPage: number, filter: TodoPendingFilter) => {
      setTodoLoading(true);
      setTodoError(false);
      try {
        const data = await pageTodos({
          pending: filter,
          current: targetPage,
          pageSize: PAGE_SIZE,
        });
        setTodos(data.records);
        setTodoTotal(data.total);
        setTodoPage(targetPage);
        setTodoLoaded(true);
      } catch {
        setTodoError(true);
      } finally {
        setTodoLoading(false);
      }
    },
    [],
  );

  /** 重载当前页签（切 Tab / 翻页 / 写操作后统一走这里）。 */
  const reloadActive = useCallback(() => {
    if (activeTabRef.current === 'notifications') {
      void loadNotifications(notifyPageRef.current);
      return;
    }
    void loadTodos(todoPageRef.current, todoFilterRef.current);
  }, [loadNotifications, loadTodos]);

  // —— 实时消息插入 ——
  const handleIncoming = (incoming: NotifyMessage) => {
    // 会话消息（6/7）不进消息中心：它们有自己的聊天入口与角标口径
    if (!isChatNotify(incoming.notifyType)) {
      const fresh = notifyPageRef.current === 1;
      setNotifications((prev) =>
        prev.some((item) => item.id === incoming.id) || !fresh
          ? prev
          : [incoming, ...prev],
      );
      if (fresh) {
        setNotifyTotal((prev) => prev + 1);
      }
    }

    if (!isTodoNotify(incoming.notifyType)) {
      return;
    }
    setTodoUnread((prev) => prev + 1);
    setTodos((prev) => {
      if (prev.some((item) => item.id === incoming.id)) {
        return prev;
      }
      // 与当前筛选不符的消息不插入：「已办」视角插一条未办项会自相矛盾
      if (todoPageRef.current !== 1 || todoFilterRef.current === 'done') {
        return prev;
      }
      return [toTodoItem(incoming), ...prev];
    });
  };

  const { status, unread, reconnectNow, markAllRead } = useWebSocket({
    onMessage: handleIncoming,
  });

  // —— 连接状态提示 ——
  const prevStatusRef = useRef<WsStatus>('idle');
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const previous = prevStatusRef.current;
    prevStatusRef.current = status;
    // 只在「断过之后重新连上」时庆祝一下：首次建连（idle → open）属于正常加载
    if (status !== 'open' || previous === 'idle' || previous === 'open') {
      return;
    }
    setRestored(true);
    const timer = window.setTimeout(() => setRestored(false), RESTORED_HINT_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  // 离线补收提示：补收的消息本身已由 onMessage 插入，这里只告知「刚补上了几条」
  useEffect(
    () =>
      wsStore.subscribeBackfill((count) => {
        toast.info(
          intl.formatMessage(
            { id: 'message.connection.backfilled' },
            { count },
          ),
        );
      }),
    [toast, intl],
  );

  // 首屏拉通知列表 + 待办角标；待办列表等切到该页签再拉（不为没打开的页签买单）
  useEffect(() => {
    void loadNotifications(1);
  }, [loadNotifications]);

  useEffect(() => {
    let alive = true;
    void fetchTodoCount().then((count) => {
      if (alive) {
        setTodoUnread(count);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'todos' || todoLoaded) {
      return;
    }
    void loadTodos(1, todoFilter);
  }, [activeTab, todoLoaded, loadTodos, todoFilter]);

  const handleTabChange = (key: string) => {
    setActiveTab(key as TabKey);
  };

  const handleFilterChange = (value: string | number) => {
    const next = value as TodoPendingFilter;
    setTodoFilter(next);
    // 换筛选等于换数据集，页码必须回第 1 页，否则会停在空白页
    void loadTodos(1, next);
  };

  // —— 写操作 ——
  const handleMarkRead = async (record: NotifyMessage) => {
    try {
      await markNotificationRead(record.id);
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === record.id ? { ...item, readStatus: 1 } : item,
        ),
      );
      toast.success(intl.formatMessage({ id: 'message.action.markedRead' }));
      await wsStore.refresh();
    } catch {
      // 失败提示由请求层给出，列表保持未读态（不假装已读）
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const affected = await markAllRead();
      if (affected <= 0) {
        toast.info(intl.formatMessage({ id: 'message.action.allReadNoop' }));
        return;
      }
      toast.success(
        intl.formatMessage(
          { id: 'message.action.allMarkedRead' },
          { count: affected },
        ),
      );
      // 已读态变了，当前列表整体作废：重载而不是就地改，避免漏改其它分组
      setTodoUnread(0);
      reloadActive();
    } catch {
      // 同上：失败不动本地状态
    }
  };

  const handleMarkHandled = async (record: TodoItem) => {
    try {
      await markTodoHandled(record.id);
      setTodos((prev) =>
        prev.map((item) =>
          item.id === record.id ? { ...item, pending: false } : item,
        ),
      );
      setTodoUnread((prev) => Math.max(0, prev - 1));
      toast.success(intl.formatMessage({ id: 'message.action.handled' }));
      await wsStore.refresh();
    } catch {
      // 失败保持未办态
    }
  };

  const handleJump = (record: TodoItem) => {
    const target = resolveTodoTargetWithAccess(record, access.can);
    if (!target) {
      // 不是「坏了」，而是这个账号在这个落点没权限：就地说明，不跳死链
      toast.warning(intl.formatMessage({ id: 'message.todo.jumpMissing' }));
      return;
    }
    history.push(target.path);
  };

  const handleRefresh = () => {
    reloadActive();
    void wsStore.refresh();
  };

  // —— 连接状态横幅 ——
  const connectionAlert = (() => {
    if (restored) {
      return (
        <Alert
          type="success"
          showIcon
          title={intl.formatMessage({ id: 'message.connection.restored' })}
        />
      );
    }
    if (status === 'connecting') {
      return (
        <Alert
          type="info"
          showIcon
          title={intl.formatMessage({ id: 'message.connection.connecting' })}
        />
      );
    }
    if (status === 'reconnecting' || status === 'closed') {
      const reconnecting = status === 'reconnecting';
      return (
        <Alert
          type={reconnecting ? 'warning' : 'error'}
          showIcon
          title={intl.formatMessage({
            id: reconnecting
              ? 'message.connection.reconnecting'
              : 'message.connection.closed',
          })}
          description={intl.formatMessage({
            id: 'message.connection.offlineHint',
          })}
          action={
            <Button size="small" onClick={reconnectNow}>
              {intl.formatMessage({ id: 'message.connection.reconnectNow' })}
            </Button>
          }
        />
      );
    }
    return null;
  })();

  const typeIcon = (notifyType: number, tone: 'blue' | 'amber') => (
    <span
      style={{
        display: 'inline-flex',
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        background:
          tone === 'blue' ? 'rgba(22,119,255,0.08)' : 'rgba(250,173,20,0.12)',
        color: tone === 'blue' ? '#1677ff' : '#faad14',
      }}
    >
      {NOTIFY_TYPE_ICON[notifyType] ?? <BellOutlined />}
    </span>
  );

  /** 通知条目。 */
  const renderNotification = (record: NotifyMessage) => {
    const unreadFlag = (record.readStatus ?? 0) === 0;
    return (
      <List.Item
        actions={
          unreadFlag
            ? [
                <Button
                  key="read"
                  type="link"
                  size="small"
                  onClick={() => void handleMarkRead(record)}
                >
                  {intl.formatMessage({ id: 'message.action.markRead' })}
                </Button>,
              ]
            : undefined
        }
      >
        <List.Item.Meta
          avatar={
            <Badge dot={unreadFlag} offset={[-2, 2]}>
              {typeIcon(record.notifyType, 'blue')}
            </Badge>
          }
          title={
            <Space size={8} wrap>
              <Text strong={unreadFlag}>
                {record.title ||
                  intl.formatMessage({
                    id: notifyTypeLabelId(record.notifyType),
                  })}
              </Text>
              <Tag color="blue">
                {intl.formatMessage({
                  id: notifyTypeLabelId(record.notifyType),
                })}
              </Tag>
              {unreadFlag ? (
                <Tag color="red">
                  {intl.formatMessage({ id: 'message.state.new' })}
                </Tag>
              ) : null}
            </Space>
          }
          description={
            <Space orientation="vertical" size={2} style={{ display: 'flex' }}>
              {record.content ? (
                <Paragraph style={{ marginBottom: 0 }}>
                  {record.content}
                </Paragraph>
              ) : null}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {timeText(record.createTime)}
              </Text>
            </Space>
          }
        />
      </List.Item>
    );
  };

  /** 待办条目。 */
  const renderTodo = (record: TodoItem) => {
    const target = resolveTodoTargetWithAccess(record, access.can);
    return (
      <List.Item
        actions={[
          <Tooltip
            key="jump"
            title={
              target
                ? undefined
                : intl.formatMessage({ id: 'message.todo.jumpMissing' })
            }
          >
            <Button
              type="link"
              size="small"
              disabled={!target}
              onClick={() => handleJump(record)}
            >
              {intl.formatMessage({ id: 'message.action.jump' })}
            </Button>
          </Tooltip>,
          record.pending ? (
            <Button
              key="handled"
              type="link"
              size="small"
              onClick={() => void handleMarkHandled(record)}
            >
              {intl.formatMessage({ id: 'message.action.markHandled' })}
            </Button>
          ) : null,
        ].filter(Boolean)}
      >
        <List.Item.Meta
          avatar={
            <Badge dot={record.pending} offset={[-2, 2]}>
              {typeIcon(record.notifyType, 'amber')}
            </Badge>
          }
          title={
            <Space size={8} wrap>
              <Text strong={record.pending}>
                {record.title ||
                  intl.formatMessage({
                    id: notifyTypeLabelId(record.notifyType),
                  })}
              </Text>
              <Tag>
                {intl.formatMessage({
                  id: todoSourceLabelId(record.notifyType),
                })}
              </Tag>
              <Tag color={record.pending ? 'red' : 'default'}>
                {intl.formatMessage({
                  id: record.pending
                    ? 'message.todo.filter.pending'
                    : 'message.todo.filter.done',
                })}
              </Tag>
            </Space>
          }
          description={
            <Space orientation="vertical" size={2} style={{ display: 'flex' }}>
              {record.content ? (
                <Paragraph style={{ marginBottom: 0 }}>
                  {record.content}
                </Paragraph>
              ) : null}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {timeText(record.createTime)}
              </Text>
            </Space>
          }
        />
      </List.Item>
    );
  };

  /** 加载失败 / 首屏骨架 / 真·空，三态互斥且顺序固定。 */
  const renderListState = (
    error: boolean,
    loaded: boolean,
    empty: boolean,
    emptyProps: { title: string; desc: string },
    retry: () => void,
  ) => {
    if (error) {
      return (
        <EmptyState
          variant="error"
          action={
            <Button icon={<ReloadOutlined />} onClick={retry}>
              {intl.formatMessage({ id: 'common.empty.error.action' })}
            </Button>
          }
        />
      );
    }
    if (!loaded) {
      return <PageSkeleton variant="list" rows={5} />;
    }
    if (empty) {
      return (
        <EmptyState
          variant="data"
          title={intl.formatMessage({ id: emptyProps.title })}
          description={intl.formatMessage({ id: emptyProps.desc })}
        />
      );
    }
    return null;
  };

  const notificationsEmpty = renderListState(
    notifyError,
    notifyLoaded,
    notifications.length === 0,
    { title: 'message.empty.title', desc: 'message.empty.desc' },
    () => void loadNotifications(notifyPage),
  );

  const todosEmpty = renderListState(
    todoError,
    todoLoaded,
    todos.length === 0,
    todoFilter === 'done'
      ? {
          title: 'message.todo.empty.doneTitle',
          desc: 'message.todo.empty.doneDesc',
        }
      : { title: 'message.todo.empty.title', desc: 'message.todo.empty.desc' },
    () => void loadTodos(todoPage, todoFilter),
  );

  const tabLabel = (count: number, textId: string) => (
    <Space size={6}>
      <span>{intl.formatMessage({ id: textId })}</span>
      {count > 0 ? (
        <Badge count={count} size="small" overflowCount={99} />
      ) : null}
    </Space>
  );

  return (
    <PageContainer
      title={intl.formatMessage({ id: 'message.title' })}
      subTitle={intl.formatMessage({ id: 'message.subtitle' })}
      extra={
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
            {intl.formatMessage({ id: 'message.action.refresh' })}
          </Button>
          <Button type="primary" onClick={() => void handleMarkAllRead()}>
            {intl.formatMessage({ id: 'message.action.markAllRead' })}
          </Button>
        </Space>
      }
    >
      <Space orientation="vertical" size={16} style={{ display: 'flex' }}>
        {connectionAlert}

        <SectionCard bodyPadding="8px 24px 24px">
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            items={[
              {
                key: 'notifications',
                label: tabLabel(unread.inbox, 'message.tab.notifications'),
                children: notificationsEmpty ?? (
                  <List<NotifyMessage>
                    itemLayout="horizontal"
                    dataSource={notifications}
                    renderItem={renderNotification}
                    loading={notifyLoading}
                    pagination={{
                      current: notifyPage,
                      pageSize: PAGE_SIZE,
                      total: notifyTotal,
                      showSizeChanger: false,
                      onChange: (next) => void loadNotifications(next),
                    }}
                  />
                ),
              },
              {
                key: 'todos',
                label: tabLabel(todoUnread || unread.todo, 'message.tab.todos'),
                children: (
                  <Space
                    orientation="vertical"
                    size={12}
                    style={{ display: 'flex' }}
                  >
                    <Segmented
                      value={todoFilter}
                      onChange={handleFilterChange}
                      options={[
                        {
                          label: intl.formatMessage({
                            id: 'message.todo.filter.pending',
                          }),
                          value: 'pending',
                        },
                        {
                          label: intl.formatMessage({
                            id: 'message.todo.filter.done',
                          }),
                          value: 'done',
                        },
                        {
                          label: intl.formatMessage({
                            id: 'message.todo.filter.all',
                          }),
                          value: 'all',
                        },
                      ]}
                    />
                    {todosEmpty ?? (
                      <List<TodoItem>
                        itemLayout="horizontal"
                        dataSource={todos}
                        renderItem={renderTodo}
                        loading={todoLoading}
                        pagination={{
                          current: todoPage,
                          pageSize: PAGE_SIZE,
                          total: todoTotal,
                          showSizeChanger: false,
                          onChange: (next) => void loadTodos(next, todoFilter),
                        }}
                      />
                    )}
                  </Space>
                ),
              },
            ]}
          />
        </SectionCard>
      </Space>
    </PageContainer>
  );
};

export default MessagesPage;
