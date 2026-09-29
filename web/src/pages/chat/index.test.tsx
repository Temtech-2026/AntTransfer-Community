/**
 * 聊天页 · 发送侧与即时通讯抽屉同源。
 *
 * <p>两个入口（`/chat` 页与即时通讯抽屉）在「发一份文件」这件事上必须逐项一致，
 * 否则同一个人在抽屉里和页面上会看到两种产品。规则本身由
 * `hooks/useChatAttachmentDraft.test.tsx` 逐条钉住，这里只钉**接线**：</p>
 * <ol>
 *   <li><b>拖入文件即出现共用附件条</b>：文件名、大小、用途限制选择器都在，
 *       且单聊才有选择器（群聊本期不建授权，给出一组无效选项只会误导）；</li>
 *   <li><b>带附件时正文可留空</b>：附言是可选的，发送按钮不该被空正文卡住；</li>
 *   <li><b>发出去的是共用实现组装的消息</b>：消息与授权共用同一个幂等键、
 *       正文带 `#att:` 尾注；</li>
 *   <li><b>失败保留附件</b>：发送失败后待发文件还在，用户可以直接重发。</li>
 * </ol>
 *
 * <p>深链 `?scope=&targetId=` 是消息中心跳进来的落点，也用它免去「先点会话再发消息」
 * 的铺垫——测的是发送链路，不是列表交互。</p>
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { App } from 'antd';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import access, { type AccessModel } from '@/access';
import { testFormatMessage } from '@/locales/testTranslate';
import { DataScope } from '@/services/access';
import {
  createChatAttachment,
  type ChatAttachment,
} from '@/services/file/chatAttachment';
import {
  ChatScope,
  MessageType,
  NotifyType,
  type NotifyMessage,
  RecallStatus,
} from '@/services/notify';
import {
  type ChatTarget,
  fetchChatHistory,
  fetchConversations,
  markChatRead,
  recallChatMessage,
  resolveChatTarget,
  sendChatMessage,
  sendTyping,
  watchPeerPresence,
} from '@/services/chat';
import { SYSTEM_PERM } from '@/services/system';
import { ChatPresenceStatus, type WsStatus } from '@/services/ws';
import { FILE_DRAG_MIME, type FileDragPayload } from '@/utils/dragFile';

import ChatPage from './index';

/** 断言用：从 zh-CN 语言包取文案，键写错即失败（不在测试里另抄一份中文）。 */
const t = (id: string, values?: Record<string, unknown>) =>
  testFormatMessage({ id, values });

/** 可变的深链与权限模型：两者都在渲染时读取，便于逐用例切换。 */
const holder = vi.hoisted(() => ({ search: '', model: {} as unknown }));

vi.mock('@umijs/max', async () => {
  const { testFormatMessage: translate } = await import(
    '@/locales/testTranslate'
  );
  return {
    useAccess: () => holder.model,
    // 「我发的」气泡头像走登录态（`useCurrentUserAvatar`）：默认没有登录态 →
    // 自己的头像取不到，仍走 UserOutlined 兜底；需要时用例可往 holder 里塞一个。
    useModel: () => ({ initialState: modelHolder.initialState }),
    // 兼容两种调用形态：`formatMessage({ id, values })` 与 `formatMessage({ id }, values)`
    useIntl: () => ({
      formatMessage: (
        descriptor: { id: string; values?: Record<string, unknown> },
        values?: Record<string, unknown>,
      ) => translate({ id: descriptor.id, values: values ?? descriptor.values }),
    }),
    request: vi.fn(),
    history: {
      get location() {
        return { pathname: '/chat', search: holder.search };
      },
      push: vi.fn(),
      replace: vi.fn(),
    },
  };
});

vi.mock('@/services/chat', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/chat')>();
  return {
    ...actual,
    fetchConversations: vi.fn(),
    fetchChatHistory: vi.fn(),
    markChatRead: vi.fn(),
    recallChatMessage: vi.fn(),
    sendChatMessage: vi.fn(),
    resolveChatTarget: vi.fn(),
    // 在线状态与「正在输入」走真实现会发 HTTP；替身后才能按需注入状态与断言上报
    watchPeerPresence: vi.fn(),
    sendTyping: vi.fn(),
  };
});

vi.mock('@/services/file/chatAttachment', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/file/chatAttachment')>();
  return { ...actual, createChatAttachment: vi.fn() };
});

// 实时帧不走真 WebSocket（只会引入不稳定），但要把页面注册的回调捞出来，
// 以便按需注入 CHAT_READ / PRESENCE / TYPING 帧——否则这些接线就只能靠肉眼
//
// 合并而<b>不是</b>覆盖：页面上有两处订阅（页面的消息 + 回执，与 useChatPresence 的
// 在线状态 + 输入态），后注册的那次会把前一次的回调挤掉
const wsHolder = vi.hoisted(() => ({
  options: null as null | Record<string, unknown>,
  /** 连接状态：默认已连上；要验证异常文案的用例可临时改写（beforeEach 会复位）。 */
  status: 'open' as WsStatus,
}));

/** 登录态替身：`useCurrentUserAvatar` 从它取「我自己的头像」。 */
const modelHolder = vi.hoisted(() => ({
  initialState: undefined as unknown,
}));

vi.mock('@/hooks/useWebSocket', () => ({
  default: (options: Record<string, unknown>) => {
    wsHolder.options = { ...wsHolder.options, ...options };
    return { status: wsHolder.status, reconnectNow: vi.fn() };
  },
}));

// 页面外壳（面包屑、页头）与发送链路无关，换成一个容器，避免把 pro-components 的
// 布局逻辑拉进 jsdom。但 extra 必须渲染——页头常驻的连接质量指示住在那里，
// 丢掉 extra 等于把「常驻可见 + 异常时改文案」这条口径移出测试视野
vi.mock('@ant-design/pro-components', () => ({
  PageContainer: ({
    children,
    extra,
  }: {
    children: ReactNode;
    extra?: ReactNode;
  }) => (
    <div>
      {extra}
      {children}
    </div>
  ),
}));

const mockedCreate = vi.mocked(createChatAttachment);
const mockedSend = vi.mocked(sendChatMessage);
const mockedResolve = vi.mocked(resolveChatTarget);
const mockedRecall = vi.mocked(recallChatMessage);

const NODE_ID = '900000000000000011';
const PEER_ID = '900000000000000009';
const GROUP_ID = '900000000000000012';
const GRANT_ID = '88';

const file: FileDragPayload = {
  nodeId: NODE_ID,
  fileName: '季度报告.pdf',
  sizeBytes: 2517000,
};

/** 一次真实的投放：走 {@link FILE_DRAG_MIME} 协议，与页面上的解析口径同一条路径。 */
const dropFile = (target: Element, payload: FileDragPayload = file) => {
  fireEvent.drop(target, {
    dataTransfer: {
      types: [FILE_DRAG_MIME],
      getData: (type: string) =>
        type === FILE_DRAG_MIME ? JSON.stringify(payload) : '',
    },
  });
};

/** 回执按请求体生成：正文与幂等键都由共用实现决定，替身不该自己编一份。 */
const echoSent = async (payload: {
  content: string;
  clientMsgId: string;
  scope: number;
  targetId: string;
}): Promise<NotifyMessage> =>
  ({
    id: '900000000000000771',
    senderUserId: '1',
    recipientUserId: payload.targetId,
    notifyType:
      payload.scope === ChatScope.PRIVATE
        ? NotifyType.IM_PRIVATE
        : NotifyType.IM_GROUP,
    messageType: MessageType.FILE,
    chatScope: payload.scope,
    chatTargetId: payload.targetId,
    clientMsgId: payload.clientMsgId,
    content: payload.content,
    createTime: '2026-09-22 10:00:00',
  }) as NotifyMessage;

const renderPage = () =>
  render(
    <App>
      <ChatPage />
    </App>,
  );

/** 深链打开会话后，输入框出现即代表首页历史已就位。 */
const openComposer = () => screen.findByRole('textbox');

const sendButton = () => screen.getByLabelText(t('chat.action.send'));

/**
 * 已读回执（气泡下的读者头像）。
 *
 * <p>两条到达路径必须都成立，缺一条产品就是错的：</p>
 * <ol>
 *   <li><b>历史</b>：进会话时列表自带 `readers`——离线期间发生的阅读只能靠它补齐；</li>
 *   <li><b>实时</b>：对端正在读时由 `CHAT_READ` 帧补上，不必刷新。</li>
 * </ol>
 *
 * <p>另外钉住两个容易画错的边界：回执只属于<b>发出去</b>的消息（别人发的消息上不该出现
 * 读者），且只属于<b>当前会话</b>（服务端推给发送人，而发送人可能同时开着多个会话）。</p>
 */
describe('聊天页 · 已读回执', () => {
  /** 我发的一条消息：写扩散下「我发的」那一行 recipient 就是我自己。 */
  const mineMessage = (over: Partial<NotifyMessage> = {}): NotifyMessage => ({
    id: '900000000000000900',
    senderUserId: '900000000000000001',
    recipientUserId: '900000000000000001',
    notifyType: NotifyType.IM_PRIVATE,
    messageType: MessageType.TEXT,
    chatScope: ChatScope.PRIVATE,
    chatTargetId: PEER_ID,
    clientMsgId: 'c-1',
    content: '方案已发',
    createTime: '2026-09-22 10:00:00',
    ...over,
  });

  /** 对端发来的一条消息（不是我发的）。 */
  const peerMessage = (over: Partial<NotifyMessage> = {}): NotifyMessage => ({
    ...mineMessage(),
    id: '900000000000000901',
    senderUserId: '900000000000000002',
    recipientUserId: '900000000000000001',
    clientMsgId: 'c-2',
    content: '收到',
    ...over,
  });

  const reader = (name: string, index = 0) => ({
    userId: `90000000000000000${index}`,
    displayName: name,
  });

  /** 注入一帧回执（走页面注册的真实回调，而不是直接改 state）。 */
  const pushReceipt = async (receipt: unknown) => {
    await act(async () => {
      (wsHolder.options?.onReadReceipt as ((frame: unknown) => void) | undefined)?.(
        receipt,
      );
    });
  };

  const openPrivate = (history: NotifyMessage[]) => {
    holder.search = `?scope=${ChatScope.PRIVATE}&targetId=${PEER_ID}`;
    vi.mocked(fetchChatHistory).mockResolvedValue(history);
    renderPage();
  };

  it('历史里我发的消息带读者：气泡下画出读者头像', async () => {
    openPrivate([mineMessage({ readers: [reader('姚')] })]);

    expect(await screen.findByText('方案已发')).toBeInTheDocument();
    expect(screen.getByTitle('姚')).toBeInTheDocument();
    // 纯头像信息必须有文字等价物（读屏用户听到的是「已读：姚」）
    expect(
      screen.getByRole('img', { name: t('chat.read.by', { names: '姚' }) }),
    ).toBeInTheDocument();
  });

  it('实时回执：当前会话的帧补上读者，别的会话的帧不串进来', async () => {
    openPrivate([mineMessage()]);
    await screen.findByText('方案已发');
    expect(screen.queryByTitle('姚')).toBeNull();

    // 群聊的回执不得画到单聊窗口里（两者 scope/targetId 都不同）
    await pushReceipt({
      chatScope: ChatScope.GROUP,
      chatTargetId: GROUP_ID,
      reader: reader('姚'),
      clientMsgIds: ['c-1'],
    });
    expect(screen.queryByTitle('姚')).toBeNull();

    await pushReceipt({
      chatScope: ChatScope.PRIVATE,
      chatTargetId: PEER_ID,
      reader: reader('姚'),
      clientMsgIds: ['c-1'],
    });
    expect(screen.getByTitle('姚')).toBeInTheDocument();
  });

  it('回执只落在发出去的消息上：别人发的消息不会长出读者', async () => {
    openPrivate([peerMessage()]);
    await screen.findByText('收到');

    await pushReceipt({
      chatScope: ChatScope.PRIVATE,
      chatTargetId: PEER_ID,
      reader: reader('姚'),
      clientMsgIds: ['c-2'],
    });

    expect(screen.queryByTitle('姚')).toBeNull();
  });

  it('同一读者重复到达不重复画（历史 + 实时两条路径都会带到他）', async () => {
    openPrivate([mineMessage({ readers: [reader('姚')] })]);
    await screen.findByText('方案已发');

    await pushReceipt({
      chatScope: ChatScope.PRIVATE,
      chatTargetId: PEER_ID,
      reader: reader('姚'),
      clientMsgIds: ['c-1'],
    });

    expect(screen.getAllByTitle('姚')).toHaveLength(1);
  });

  it('群聊阅读人数多时折成「+N」：最多画三个头像，不挤破气泡', async () => {
    const names = ['甲', '乙', '丙', '丁', '戊'];
    openPrivate([
      mineMessage({
        readers: names.map((name, index) => reader(name, index)),
      }),
    ]);
    await screen.findByText('方案已发');

    expect(screen.getAllByTitle(/^[甲乙丙丁戊]$/)).toHaveLength(3);
    expect(screen.getByText('+2')).toBeInTheDocument();
    // 被折叠的人仍要能知道是谁（悬停提示给出剩余人数）
    expect(
      screen.getByTitle(t('chat.read.more', { count: 2 })),
    ).toBeInTheDocument();
  });
});

/**
 * 消息条右键：撤回与引用。
 *
 * <p>三条边界必须同时成立，缺一条产品就是错的：</p>
 * <ol>
 *   <li><b>撤回由服务端裁决</b>：前端只决定菜单项显不显示，点了必须落到
 *       `recallChatMessage(幂等键)`，且本地结果要与撤回帧到达后一致
 *       （正文消失、换占位）——否则「我以为撤回了」和「别人看到的」是两幅画面；</li>
 *   <li><b>超窗不给入口</b>：时间窗只是显隐线索，服务端才是权威（超窗回 `1034`）。
 *       摆一个必然被拒的菜单项，用户只会以为功能坏了；</li>
 *   <li><b>引用要能带出去</b>：点「引用」后输入框上方出现引用条，发送时带成
 *       `quoteClientMsgId`——用幂等键而不是消息 id，因为写扩散下同一条逻辑消息
 *       在每个人那里是不同的行，只有幂等键跨行、跨端一致。</li>
 * </ol>
 */
describe('聊天页 · 右键撤回与引用', () => {
  /** 时间窗按本地时间算显隐，所以「刚发出」必须由用例自己造，不能写死日期。 */
  const justNow = () => new Date(Date.now() - 30_000).toISOString();

  /** 我发的一条消息：写扩散下「我发的」那一行 recipient 就是我自己。 */
  const mineMessage = (over: Partial<NotifyMessage> = {}): NotifyMessage => ({
    id: '900000000000000900',
    senderUserId: '900000000000000001',
    recipientUserId: '900000000000000001',
    notifyType: NotifyType.IM_PRIVATE,
    messageType: MessageType.TEXT,
    chatScope: ChatScope.PRIVATE,
    chatTargetId: PEER_ID,
    clientMsgId: 'c-1',
    content: '方案已发',
    createTime: justNow(),
    ...over,
  });

  /** 对端发来的一条消息（不是我发的）。 */
  const peerMessage = (over: Partial<NotifyMessage> = {}): NotifyMessage => ({
    ...mineMessage(),
    id: '900000000000000901',
    senderUserId: '900000000000000002',
    clientMsgId: 'c-2',
    content: '收到',
    ...over,
  });

  const openPrivate = (history: NotifyMessage[]) => {
    holder.search = `?scope=${ChatScope.PRIVATE}&targetId=${PEER_ID}`;
    vi.mocked(fetchChatHistory).mockResolvedValue(history);
    renderPage();
  };

  /** 右键气泡：菜单挂在气泡自己身上（见 ChatMessageMenu 的 props 注释）。 */
  const rightClick = async (text: string) => {
    fireEvent.contextMenu(await screen.findByText(text));
  };

  /** 注入一帧撤回（走页面注册的真实回调，而不是直接改 state）。 */
  const pushRecall = async (frame: unknown) => {
    await act(async () => {
      (
        wsHolder.options?.onRecall as ((payload: unknown) => void) | undefined
      )?.(frame);
    });
  };

  const recalledOfPeer = () =>
    t('chat.message.recalled.other', {
      name: t('chat.session.userFallback', { id: PEER_ID }),
    });

  it('右键自己的消息：撤回与引用两个入口都在', async () => {
    openPrivate([mineMessage()]);
    await rightClick('方案已发');

    expect(
      await screen.findByText(t('chat.message.action.recall')),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t('chat.message.action.quote')),
    ).toBeInTheDocument();
  });

  it('点撤回：以幂等键请求服务端，气泡当场换成「你撤回了一条消息」', async () => {
    openPrivate([mineMessage()]);
    await rightClick('方案已发');

    fireEvent.click(await screen.findByText(t('chat.message.action.recall')));

    await waitFor(() => expect(mockedRecall).toHaveBeenCalledWith('c-1'));
    // 撤回是终态：正文必须立刻从本地消失，而不是等下一次刷新
    expect(
      await screen.findByText(t('chat.message.recalled.mine')),
    ).toBeInTheDocument();
    expect(screen.queryByText('方案已发')).toBeNull();
  });

  it('超窗的消息只留引用：不给一个必然被 1034 拒绝的入口', async () => {
    openPrivate([
      mineMessage({
        createTime: new Date(Date.now() - 10 * 60_000).toISOString(),
      }),
    ]);
    await rightClick('方案已发');

    expect(
      await screen.findByText(t('chat.message.action.quote')),
    ).toBeInTheDocument();
    expect(screen.queryByText(t('chat.message.action.recall'))).toBeNull();
  });

  it('别人发的消息没有撤回：撤回只对自己的消息开放', async () => {
    openPrivate([peerMessage()]);
    await rightClick('收到');

    expect(
      await screen.findByText(t('chat.message.action.quote')),
    ).toBeInTheDocument();
    expect(screen.queryByText(t('chat.message.action.recall'))).toBeNull();
  });

  it('撤回帧：当前会话当场收敛成占位（写的是对方），别的会话的帧不串进来', async () => {
    openPrivate([peerMessage()]);
    await screen.findByText('收到');

    // 群聊的撤回帧不得动单聊窗口里的消息（两者 scope/targetId 都不同）
    await pushRecall({
      chatScope: ChatScope.GROUP,
      chatTargetId: GROUP_ID,
      clientMsgId: 'c-2',
      senderUserId: '900000000000000002',
    });
    expect(screen.getByText('收到')).toBeInTheDocument();

    await pushRecall({
      chatScope: ChatScope.PRIVATE,
      chatTargetId: PEER_ID,
      clientMsgId: 'c-2',
      senderUserId: '900000000000000002',
      recallTime: '2026-09-22 10:00:05',
    });

    expect(await screen.findByText(recalledOfPeer())).toBeInTheDocument();
    expect(screen.queryByText('收到')).toBeNull();
  });

  it('引用：输入框上方出现引用条，发送时带的是那条消息的幂等键', async () => {
    openPrivate([peerMessage()]);
    await rightClick('收到');
    fireEvent.click(await screen.findByText(t('chat.message.action.quote')));

    // 引用条里那块就是「谁说的 + 说了什么」，与发出去之后气泡里那块同源
    const bar = await screen.findByTestId('chat-quote-bar');
    expect(within(bar).getByText('收到')).toBeInTheDocument();
    expect(
      within(bar).getByText(t('chat.session.userFallback', { id: PEER_ID })),
    ).toBeInTheDocument();

    fireEvent.change(await openComposer(), { target: { value: '同意' } });
    fireEvent.click(sendButton());

    await waitFor(() => expect(mockedSend).toHaveBeenCalledTimes(1));
    expect(mockedSend.mock.calls[0][0]).toMatchObject({
      content: '同意',
      quoteClientMsgId: 'c-2',
    });
    // 发送成功后引用态收尾，否则下一条消息会莫名其妙又引用一遍
    await waitFor(() =>
      expect(screen.queryByTestId('chat-quote-bar')).toBeNull(),
    );
  });

  it('取消引用：引用条消失，之后发出的是一条普通消息', async () => {
    openPrivate([peerMessage()]);
    await rightClick('收到');
    fireEvent.click(await screen.findByText(t('chat.message.action.quote')));

    fireEvent.click(
      await screen.findByTitle(t('chat.composer.quote.cancel')),
    );
    expect(screen.queryByTestId('chat-quote-bar')).toBeNull();

    fireEvent.change(await openComposer(), { target: { value: '同意' } });
    fireEvent.click(sendButton());

    await waitFor(() => expect(mockedSend).toHaveBeenCalledTimes(1));
    expect(mockedSend.mock.calls[0][0].quoteClientMsgId).toBeUndefined();
  });

  it('已撤回的消息：弹不出菜单（两项都不可用时不挂空菜单）', async () => {
    openPrivate([mineMessage({ recallStatus: RecallStatus.DONE, content: '' })]);
    const placeholder = await screen.findByText(
      t('chat.message.recalled.mine'),
    );

    fireEvent.contextMenu(placeholder);

    expect(screen.queryByText(t('chat.message.action.quote'))).toBeNull();
    expect(screen.queryByText(t('chat.message.action.recall'))).toBeNull();
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  holder.search = '';
  modelHolder.initialState = undefined;
  wsHolder.status = 'open';
  holder.model = access({
    permissions: { roles: ['USER'], permCodes: [], dataScope: DataScope.ALL },
  }) as AccessModel;
  mockedCreate.mockResolvedValue({ id: GRANT_ID } as unknown as ChatAttachment);
  mockedSend.mockImplementation(echoSent as never);
  vi.mocked(fetchConversations).mockResolvedValue([]);
  vi.mocked(fetchChatHistory).mockResolvedValue([]);
  vi.mocked(markChatRead).mockResolvedValue(0);
  mockedRecall.mockResolvedValue(undefined);
  // 打开会话即拉一次对端状态：默认给「在线」，否则每个用例都要先喂一遍才算就绪
  vi.mocked(watchPeerPresence).mockResolvedValue({
    userId: PEER_ID,
    status: ChatPresenceStatus.ONLINE,
    lastActiveAt: null,
  });
  vi.mocked(sendTyping).mockResolvedValue(undefined);
});

describe('聊天页 · 发文件', () => {
  it('单聊拖入文件：共用附件条与用途限制就位，正文可留空直接发送', async () => {
    holder.search = `?scope=${ChatScope.PRIVATE}&targetId=${PEER_ID}`;
    renderPage();

    const composer = await openComposer();
    expect(screen.queryByText(file.fileName)).toBeNull();

    // 投放挂在整块聊天区上：从输入框冒泡上去，与真实链路同一条路径
    dropFile(composer);

    expect(screen.getByText(file.fileName)).toBeInTheDocument();
    expect(screen.getByText('2.4 MB')).toBeInTheDocument();
    expect(
      screen.getByLabelText(t('chat.attach.policy.trigger')),
    ).toBeInTheDocument();
    // 附言是可选的：空正文不该把发送按钮卡住（与抽屉的 allowEmpty 同口径）
    expect(sendButton()).toBeEnabled();

    fireEvent.click(sendButton());

    await waitFor(() => expect(mockedSend).toHaveBeenCalledTimes(1));
    const grant = mockedCreate.mock.calls[0][0];
    const payload = mockedSend.mock.calls[0][0];
    expect(grant).toMatchObject({ nodeId: NODE_ID, receiverUserId: PEER_ID });
    // 幂等键同源：消息与它携带的授权必须共用同一个键
    expect(payload.clientMsgId).toBe(grant.clientMsgKey);
    expect(payload.messageType).toBe(MessageType.FILE);
    expect(payload.content).toContain(`#file:${NODE_ID}`);
    expect(payload.content).toContain(`#att:${GRANT_ID}`);
  });

  it('群聊拖入文件：不给用途限制（本期不建授权），正文只带条目引用', async () => {
    holder.search = `?scope=${ChatScope.GROUP}&targetId=${GROUP_ID}`;
    renderPage();

    dropFile(await openComposer());

    expect(screen.getByText(file.fileName)).toBeInTheDocument();
    expect(screen.queryByLabelText(t('chat.attach.policy.trigger'))).toBeNull();

    fireEvent.click(sendButton());

    await waitFor(() => expect(mockedSend).toHaveBeenCalledTimes(1));
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(mockedSend.mock.calls[0][0].content).not.toContain('#att:');
  });

  it('发送失败：待发文件留在原地，用户可以直接重发', async () => {
    holder.search = `?scope=${ChatScope.PRIVATE}&targetId=${PEER_ID}`;
    mockedSend.mockRejectedValueOnce(new Error('网络异常'));
    renderPage();

    dropFile(await openComposer());
    fireEvent.click(sendButton());

    await waitFor(() => expect(mockedSend).toHaveBeenCalledTimes(1));
    // 最贵的失败是「文件没了、还得重拖一遍」：附件必须留着
    await waitFor(() =>
      expect(screen.getByText(file.fileName)).toBeInTheDocument(),
    );
    await waitFor(() => expect(sendButton()).toBeEnabled());

    fireEvent.click(sendButton());
    await waitFor(() => expect(mockedSend).toHaveBeenCalledTimes(2));
  });
});

/**
 * 发起会话 · 非管理员的「按登录账号发起」。
 *
 * <p>缺陷原状：没有 {@code system:user:list} 的账号只能手填 19 位雪花 ID，
 * 而他们既搜不到人也拿不到 ID——「发起会话」实际不可用。
 * 现在改为填登录账号、由服务端解析成 {@code targetId}，本组用例钉住这条链路：
 * 解析结果才是发出去的 {@code targetId}、解析失败不发消息、首条消息必填。</p>
 *
 * <p>另一个口径：首条消息的输入框就是聊天界面那个 {@code ChatComposer}
 * （发送按钮长在框里，Enter 发送 / Shift + Enter 换行），所以「怎么发出去」这件事
 * 在弹窗与聊天页完全同一条路径——本组用例按可访问名点它，而不是点弹窗页脚的按钮
 * （页脚已没有「发起」，避免同一动作有两个入口）。</p>
 */
describe('聊天页 · 发起会话', () => {
  /** 从会话列表头部按钮打开新建弹窗，返回「对方登录账号」输入框。 */
  const openNewModal = async () => {
    const newButtons = await screen.findAllByRole('button', {
      name: t('chat.action.new'),
    });
    fireEvent.click(newButtons[0]);
    return screen.getByPlaceholderText(t('chat.new.target.placeholder'));
  };

  const contentBox = () =>
    screen.getByPlaceholderText(t('chat.new.content.placeholder'));

  /**
   * antd 会给「两个汉字」的按钮插一个空格（文案是「发起」，可访问名是「发 起」），
   * 所以按字符间允许空白的正则匹配——既避开这个排版细节，又不必在测试里另抄一份中文。
   */
  const byText = (text: string) =>
    new RegExp(`^\\s*${[...text].join('\\s*')}\\s*$`);

  /** 输入框内的发送按钮（`ChatComposer`，以 `aria-label` 命名）。 */
  const submit = () =>
    screen.getByRole('button', { name: byText(t('chat.new.submit')) });

  it('填登录账号：核对出对端后，发出的是解析出的 targetId 而不是账号本身', async () => {
    mockedResolve.mockResolvedValue({
      targetId: PEER_ID,
      displayName: '姚',
    } as ChatTarget);
    renderPage();

    const account = await openNewModal();
    fireEvent.change(account, { target: { value: 'yao' } });
    fireEvent.blur(account);

    expect(
      await screen.findByText(t('chat.new.user.resolved', { name: '姚' })),
    ).toBeInTheDocument();
    expect(mockedResolve).toHaveBeenCalledWith('yao');
    // 账号不是会话目标：把 'yao' 当 targetId 发出去，服务端只会回「目标不存在」
    expect(mockedSend).not.toHaveBeenCalled();

    fireEvent.change(contentBox(), { target: { value: '在吗' } });
    fireEvent.click(submit());

    await waitFor(() => expect(mockedSend).toHaveBeenCalledTimes(1));
    expect(mockedSend.mock.calls[0][0]).toMatchObject({
      scope: ChatScope.PRIVATE,
      targetId: PEER_ID,
      content: '在吗',
    });
  });

  it('账号核对失败：就地标红，且不发消息（弹窗保留便于改账号）', async () => {
    mockedResolve.mockRejectedValue(new Error('1013'));
    renderPage();

    const account = await openNewModal();
    fireEvent.change(account, { target: { value: 'nobody' } });
    fireEvent.change(contentBox(), { target: { value: '在吗' } });
    fireEvent.click(submit());

    expect(
      await screen.findByText(t('chat.new.user.notFound')),
    ).toBeInTheDocument();
    await waitFor(() => expect(mockedResolve).toHaveBeenCalledWith('nobody'));
    expect(mockedSend).not.toHaveBeenCalled();
  });

  it('首条消息必填：正文为空时「发起」是禁用的，空按 Enter 也不发送', async () => {
    renderPage();

    const account = await openNewModal();
    fireEvent.change(account, { target: { value: 'yao' } });

    // 发送按钮长在输入框里（与聊天界面同一个组件）：正文为空即禁用，
    // 「点了才弹提示」在这里已被按钮态提前挡住——这是比 toast 更直白的必填表达
    expect(submit()).toBeDisabled();

    // 键盘路径仍要走校验：空正文按 Enter 必须给出原因，且不得解析目标 / 发消息
    fireEvent.keyDown(contentBox(), { key: 'Enter' });
    expect(
      await screen.findByText(t('chat.new.content.required')),
    ).toBeInTheDocument();
    expect(mockedSend).not.toHaveBeenCalled();
    expect(mockedResolve).not.toHaveBeenCalled();
  });

  it('管理员：仍走「搜索选人」，不受手填账号通道影响', async () => {
    holder.model = access({
      permissions: {
        roles: ['ADMIN'],
        permCodes: [SYSTEM_PERM.USER_LIST],
        dataScope: DataScope.ALL,
      },
    }) as AccessModel;
    renderPage();

    const newButtons = await screen.findAllByRole('button', {
      name: t('chat.action.new'),
    });
    fireEvent.click(newButtons[0]);

    // antd Select 的 placeholder 是独立元素而非 input 属性，只能按文本查
    expect(
      await screen.findByText(t('chat.new.user.placeholder')),
    ).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(t('chat.new.target.placeholder')),
    ).toBeNull();
  });
});

/**
 * 会话头 · 对端在线状态与「正在输入」。
 *
 * <p>本组钉住四条容易写错的口径（实现分别在 `hooks/useChatPresence`（接线）、
 * `services/chat/presence`（纯规则）与 `components/ChatPeerStatus`（展示））：</p>
 * <ol>
 *   <li><b>打开会话即订阅</b>：状态点先有权威值，再靠 30s 续订与 `PRESENCE` 帧回正；</li>
 *   <li><b>帧必须按会话过滤</b>：别人（或别的会话）的状态与输入，不得画到当前窗口上；</li>
 *   <li><b>`typing=false` 要把提示收起来</b>：只处理 true 会让提示永久挂住；</li>
 *   <li><b>本端输入要有节流与收尾</b>：连续按键折算成一串节流帧，发送后立刻补 `false`。</li>
 * </ol>
 *
 * <p>群聊另有一条：群没有单一对端，不订阅也不显示（服务端同样在入口拒收）。</p>
 */
describe('聊天页 · 对端状态与输入提示', () => {
  /** 另一个会话的对端：它的帧绝不能改到当前窗口上。 */
  const OTHER_PEER = '900000000000000088';

  const pushPresence = async (payload: unknown) => {
    await act(async () => {
      (
        wsHolder.options?.onPresence as ((frame: unknown) => void) | undefined
      )?.(payload);
    });
  };

  const pushTyping = async (payload: unknown) => {
    await act(async () => {
      (
        wsHolder.options?.onTyping as ((frame: unknown) => void) | undefined
      )?.(payload);
    });
  };

  const openPrivate = (history: NotifyMessage[] = []) => {
    holder.search = `?scope=${ChatScope.PRIVATE}&targetId=${PEER_ID}`;
    vi.mocked(fetchChatHistory).mockResolvedValue(history);
    renderPage();
  };

  it('打开单聊会话：拉一次对端状态并画出「在线」', async () => {
    openPrivate();
    await openComposer();

    await waitFor(() =>
      expect(vi.mocked(watchPeerPresence)).toHaveBeenCalledWith(
        ChatScope.PRIVATE,
        PEER_ID,
      ),
    );
    expect(await screen.findByText(t('chat.presence.online'))).toBeInTheDocument();
  });

  it('三态文案随服务端返回切换（灰「离线」/ 红「网络状态不佳」）', async () => {
    vi.mocked(watchPeerPresence).mockResolvedValue({
      userId: PEER_ID,
      status: ChatPresenceStatus.UNSTABLE,
      lastActiveAt: null,
    });
    openPrivate();

    // 颜色不单独表意：同一行必须有文字等价物
    expect(
      await screen.findByText(t('chat.presence.unstable')),
    ).toBeInTheDocument();
    expect(screen.queryByText(t('chat.presence.online'))).toBeNull();
  });

  it('PRESENCE 帧：命中当前对端才改点，别人的帧不串台', async () => {
    openPrivate();
    await screen.findByText(t('chat.presence.online'));

    await pushPresence({
      userId: OTHER_PEER,
      status: ChatPresenceStatus.OFFLINE,
      lastActiveAt: null,
    });
    expect(screen.queryByText(t('chat.presence.offline'))).toBeNull();

    await pushPresence({
      userId: PEER_ID,
      status: ChatPresenceStatus.UNSTABLE,
      lastActiveAt: null,
    });
    expect(
      await screen.findByText(t('chat.presence.unstable')),
    ).toBeInTheDocument();
  });

  it('TYPING 帧：对端开始输入即提示，发出停止信号即收起并回到静态状态', async () => {
    openPrivate();
    await screen.findByText(t('chat.presence.online'));

    await pushTyping({
      chatScope: ChatScope.PRIVATE,
      chatTargetId: PEER_ID,
      typing: true,
    });
    expect(await screen.findByText(t('chat.typing'))).toBeInTheDocument();

    await pushTyping({
      chatScope: ChatScope.PRIVATE,
      chatTargetId: PEER_ID,
      typing: false,
    });
    await waitFor(() => expect(screen.queryByText(t('chat.typing'))).toBeNull());
    // 收起后仍要说明对方当前状态（这一行不是「输入提示专用位」）
    expect(screen.getByText(t('chat.presence.online'))).toBeInTheDocument();
  });

  it('别的会话的输入帧不点亮本会话', async () => {
    openPrivate();
    await screen.findByText(t('chat.presence.online'));

    await pushTyping({
      chatScope: ChatScope.PRIVATE,
      chatTargetId: OTHER_PEER,
      typing: true,
    });

    expect(screen.queryByText(t('chat.typing'))).toBeNull();
  });

  it('本端输入：上报 true；清空或发送后立刻补 false', async () => {
    openPrivate();
    const composer = await openComposer();

    fireEvent.change(composer, { target: { value: '在' } });
    expect(vi.mocked(sendTyping)).toHaveBeenCalledWith(
      ChatScope.PRIVATE,
      PEER_ID,
      true,
    );

    // 只有空白不算输入：清空后对端该立刻收起提示，而不是继续看着一个发呆的人
    fireEvent.change(composer, { target: { value: '   ' } });
    expect(vi.mocked(sendTyping)).toHaveBeenLastCalledWith(
      ChatScope.PRIVATE,
      PEER_ID,
      false,
    );

    fireEvent.change(composer, { target: { value: '在吗' } });
    fireEvent.click(sendButton());

    await waitFor(() => expect(mockedSend).toHaveBeenCalledTimes(1));
    // 清空输入框走的是 setState 而非 onChange，不显式收尾对端要等空闲兜底
    await waitFor(() =>
      expect(vi.mocked(sendTyping)).toHaveBeenLastCalledWith(
        ChatScope.PRIVATE,
        PEER_ID,
        false,
      ),
    );
  });

  it('群聊：不订阅对端状态，也不显示状态点或输入提示', async () => {
    holder.search = `?scope=${ChatScope.GROUP}&targetId=${GROUP_ID}`;
    renderPage();
    await openComposer();

    expect(vi.mocked(watchPeerPresence)).not.toHaveBeenCalled();

    // 群没有单一对端：即便有帧到达也不出提示（纯规则层同样只认单聊）
    await pushTyping({
      chatScope: ChatScope.GROUP,
      chatTargetId: GROUP_ID,
      typing: true,
    });
    expect(screen.queryByText(t('chat.typing'))).toBeNull();
    expect(screen.queryByText(t('chat.presence.online'))).toBeNull();
  });
});

/**
 * 头像接真实图片：有地址就画图，没地址就回落首字符。
 *
 * <p>页面里 3 处头像（会话列表 / 消息气泡 / 读者）此前一律只画首字符。接图片要逐处接上，
 * 且「我发的」那一行与别人的路子不同：<b>自己的头像不在消息载荷里</b>（服务端刻意省掉
 * 这次查库），只能取登录态。取错了就会「顶栏换了新头像、聊天里自己还是旧图」。</p>
 */
describe('聊天页 · 头像', () => {
  const PEER_AVATAR = 'http://localhost:8080/v1/users/900000000000000009/avatar?v=2';
  const MY_AVATAR = 'http://localhost:8080/v1/users/900000000000000001/avatar?v=4';

  const peerMessage = (over: Partial<NotifyMessage> = {}): NotifyMessage =>
    ({
      id: '900000000000000910',
      senderUserId: '900000000000000002',
      recipientUserId: '900000000000000001',
      notifyType: NotifyType.IM_PRIVATE,
      messageType: MessageType.TEXT,
      chatScope: ChatScope.PRIVATE,
      chatTargetId: PEER_ID,
      content: '方案已发',
      createTime: '2026-09-22 10:00:00',
      ...over,
    }) as NotifyMessage;

  const openPrivate = (history: NotifyMessage[]) => {
    holder.search = `?scope=${ChatScope.PRIVATE}&targetId=${PEER_ID}`;
    vi.mocked(fetchChatHistory).mockResolvedValue(history);
    return renderPage();
  };

  /** 页面里所有 `src` 等于给定地址的图片数量（按地址找，避免被无关插图带偏）。 */
  const countAvatar = (container: HTMLElement, src: string) =>
    container.querySelectorAll(`img[src="${src}"]`).length;

  it('会话列表与对端气泡都用服务端下发的人像地址', async () => {
    vi.mocked(fetchConversations).mockResolvedValue([
      {
        chatScope: ChatScope.PRIVATE,
        targetId: PEER_ID,
        targetName: '系统管理员',
        targetAvatarUrl: PEER_AVATAR,
        lastMessageId: '900000000000000920',
        unreadCount: 0,
        mentionUnreadCount: 0,
      },
    ]);
    const { container } = openPrivate([
      peerMessage({ senderDisplayName: '系统管理员', senderAvatarUrl: PEER_AVATAR }),
    ]);
    await screen.findByText('方案已发');

    // 列表一处 + 气泡一处
    expect(countAvatar(container, PEER_AVATAR)).toBe(2);
  });

  it('会话列表带人像、点进详情也不丢（详情态靠回查列表拿到同一张图）', async () => {
    vi.mocked(fetchConversations).mockResolvedValue([
      {
        chatScope: ChatScope.PRIVATE,
        targetId: PEER_ID,
        targetName: '系统管理员',
        targetAvatarUrl: PEER_AVATAR,
        lastMessageId: '900000000000000920',
        unreadCount: 0,
        mentionUnreadCount: 0,
      },
    ]);
    // 历史消息里没有发送人头像（老数据）：全靠回查会话列表补
    const { container } = openPrivate([peerMessage()]);
    await screen.findByText('方案已发');

    expect(countAvatar(container, PEER_AVATAR)).toBe(2);
  });

  it('「我发的」气泡用登录态里的头像，而不是消息载荷（载荷里根本没有）', async () => {
    modelHolder.initialState = { currentUser: { avatar: MY_AVATAR } };
    const { container } = openPrivate([
      peerMessage({
        id: '900000000000000911',
        senderUserId: '900000000000000001',
        recipientUserId: '900000000000000001',
      }),
    ]);
    await screen.findByText('方案已发');

    expect(countAvatar(container, MY_AVATAR)).toBe(1);
  });

  it('没有头像时不画破图（列表与气泡都不出现 img），仍回落首字符「系」', async () => {
    vi.mocked(fetchConversations).mockResolvedValue([
      {
        chatScope: ChatScope.PRIVATE,
        targetId: PEER_ID,
        targetName: '系统管理员',
        lastMessageId: '900000000000000920',
        unreadCount: 0,
        mentionUnreadCount: 0,
      },
    ]);
    const { container } = openPrivate([peerMessage({ senderDisplayName: '系统管理员' })]);
    await screen.findByText('方案已发');

    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(screen.getAllByText('系').length).toBeGreaterThan(0);
  });
});

/**
 * 页头连接质量 · 常驻与「不谎报」。
 *
 * <p>它替代了原先挂在会话列表标题旁的那个圆点，两条口径必须钉住：</p>
 * <ol>
 *   <li><b>常驻可见</b>：不用展开任何面板，页头就能读到当前通道状态；
 *       会话列表标题旁只留「发起会话」，不再挤两个含义不同的圆点；</li>
 *   <li><b>不谎报</b>：`idle`（页面刚挂载、握手还没开始）不能显示成故障文案——
 *       「只要不是 open 就算断线」正是被替换掉的那个实现的毛病。</li>
 * </ol>
 */
describe('聊天页 · 页头连接质量', () => {
  it('页头常驻显示本端连接质量（无需展开任何面板）', async () => {
    wsHolder.status = 'open';
    renderPage();

    expect(
      await screen.findByText(t('chat.connection.open')),
    ).toBeInTheDocument();
  });

  it('断线重连中：页头文案跟着变，不必去别处找状态', async () => {
    wsHolder.status = 'reconnecting';
    renderPage();

    expect(
      await screen.findByText(t('chat.connection.reconnecting')),
    ).toBeInTheDocument();
  });

  it('idle（握手尚未开始）不谎报故障：是「未连接」而不是「连接已断开」', async () => {
    wsHolder.status = 'idle';
    renderPage();

    expect(
      await screen.findByText(t('chat.connection.idle')),
    ).toBeInTheDocument();
    expect(screen.queryByText(t('chat.connection.closed'))).toBeNull();
  });

  it('会话列表标题旁不再有连接状态圆点：那里只回答「有哪些会话」', async () => {
    renderPage();
    await screen.findByText(t('chat.list.title'));

    // 页头那份是页面上唯一的连接质量指示，列表标题旁不得再多一个
    expect(screen.getAllByText(t('chat.connection.open'))).toHaveLength(1);
  });
});
