/**
 * 即时通讯抽屉 · 详情态的标题与头像必须同源。
 *
 * <p>钉住这条回归：会话列表里「系统管理员」的头像是「系」，可一进会话，消息头像就变成了「用」。
 * 原因是「列表 → 详情」这一步只传了定位键 {@code (scope, targetId)}，名字被丢在列表里；
 * 详情态的标题做了列表回查、消息头像没做，于是头像回落成「用户 #<雪花ID>」的首字「用」——
 * 同一屏里标题写着「系统管理员」，头像却是「用」。</p>
 *
 * <p>修复后两者都取自 {@code resolveSessionDisplay}，本用例直接比对「列表头像字符」与
 * 「详情头像字符」是否一致，因此任何一处再走回裸定位都会被它抓住。</p>
 */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { App } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { testFormatMessage } from '@/locales/testTranslate';
import {
  fetchChatHistory,
  fetchConversations,
  markChatRead,
  sendChatMessage,
  sendTyping,
  watchPeerPresence,
} from '@/services/chat/api';
import type { Conversation } from '@/services/chat/types';
import {
  ChatScope,
  MessageType,
  NotifyType,
  type NotifyMessage,
} from '@/services/notify';
import { resetShellPanel, setChatOpen } from '@/services/ui/panelHub';
import { ChatPresenceStatus, wsStore } from '@/services/ws';

import ChatDrawer from './index';

/** 断言用文案从 zh-CN 语言包取，键写错即失败（不在测试里另抄一份中文）。 */
const t = (id: string, values?: Record<string, unknown>) =>
  testFormatMessage({ id, values });

vi.mock('@umijs/max', async () => {
  const { testFormatMessage: translate } = await import(
    '@/locales/testTranslate'
  );
  return {
    // 兼容两种调用形态：`formatMessage({ id, values })` 与 `formatMessage({ id }, values)`
    useIntl: () => ({
      formatMessage: (
        descriptor: { id: string; values?: Record<string, unknown> },
        values?: Record<string, unknown>,
      ) => translate({ id: descriptor.id, values: values ?? descriptor.values }),
    }),
    // 群设置面板按「权限点 ∧ 身份」决定按钮显隐；本用例集不涉及群管理，给最小权限即可。
    // 抽屉里那个群设置入口本身不判权限点（面板自己判），所以按钮仍会出现。
    useAccess: () => ({ can: () => false }),
    // 「我发的」气泡头像走登录态（`useCurrentUserAvatar`）。本用例集只钉对端头像，
    // 因此给一个没有登录态的最小模型：自己的头像取不到 → 仍走原有兜底，断言不受影响。
    useModel: () => ({ initialState: undefined }),
  };
});

vi.mock('@/services/chat/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/chat/api')>();
  return {
    ...actual,
    fetchConversations: vi.fn(),
    fetchChatHistory: vi.fn(),
    markChatRead: vi.fn(),
    sendChatMessage: vi.fn(),
    // 在线状态与「正在输入」走真实现会发 HTTP；替身后才能控制返回的三态
    watchPeerPresence: vi.fn(),
    sendTyping: vi.fn(),
  };
});

vi.mock('@/services/file/chatAttachment', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/file/chatAttachment')>();
  return { ...actual, createChatAttachment: vi.fn() };
});

// wsStore 只用来回正顶栏角标（未读数的唯一事实源）：真跑会去请求未读接口，
// 这里换成可断言的替身
vi.mock('@/services/ws', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/ws')>();
  return { ...actual, wsStore: { ...actual.wsStore, refresh: vi.fn() } };
});

// 实时帧不走真 WebSocket（只会引入不稳定），但要把抽屉注册的回调捞出来按需注入。
// 抽屉用命名导入，聊天页用默认导入，两者都给，避免替身与调用方口径不一致。
//
// 合并而<b>不是</b>覆盖：抽屉里有两处订阅（抽屉本身的消息帧，与 useChatPresence 的
// 在线状态 + 输入态），后注册的那次会把前一次的回调挤掉
const wsHolder = vi.hoisted(() => ({
  options: null as null | Record<string, unknown>,
}));

vi.mock('@/hooks/useWebSocket', () => {
  const fake = (options: Record<string, unknown>) => {
    wsHolder.options = { ...wsHolder.options, ...options };
    return { status: 'open', reconnectNow: vi.fn() };
  };
  return { default: fake, useWebSocket: fake };
});

const PEER_ID = '900000000000000009';
const PEER_NAME = '系统管理员';
/** 我的用户 ID：写扩散下「我发的」那一行 sender 与 recipient 都是它（见 {@link isMine}）。 */
const MY_USER_ID = '900000000000000001';
/** 详情态头像一旦回落，会变成「用户 #<id>」的首字——正是本用例要排除的形态。 */
const FALLBACK_INITIAL = PEER_NAME === '系统管理员' ? '用' : '';
const AVATAR_INITIAL = '系';

const conversation: Conversation = {
  chatScope: ChatScope.PRIVATE,
  targetId: PEER_ID,
  targetName: PEER_NAME,
  lastMessageId: '900000000000000100',
  lastContent: '在吗',
  lastMessageType: MessageType.TEXT,
  unreadCount: 1,
  mentionUnreadCount: 0,
};

/** 对端发来的一条消息：`senderUserId !== recipientUserId` 即「不是我发的」。 */
const incoming: NotifyMessage = {
  id: '900000000000000101',
  senderUserId: PEER_ID,
  recipientUserId: MY_USER_ID,
  notifyType: NotifyType.IM_PRIVATE,
  messageType: MessageType.TEXT,
  chatScope: ChatScope.PRIVATE,
  chatTargetId: PEER_ID,
  content: '在吗',
  createTime: '2026-09-22 10:00:00',
};

const OTHER_ID = '900000000000000088';
const OTHER_NAME = '张三';
const STRANGER_ID = '900000000000000066';
const STRANGER_NAME = '新来的人';

/** 第二个会话：`lastMessageId` 比 {@link conversation} 大，即「更近的一条」。 */
const otherConversation: Conversation = {
  chatScope: ChatScope.PRIVATE,
  targetId: OTHER_ID,
  targetName: OTHER_NAME,
  lastMessageId: '900000000000000500',
  lastContent: '晚点说',
  lastMessageType: MessageType.TEXT,
  unreadCount: 0,
  mentionUnreadCount: 0,
};

/** 注入一条服务端推回的帧（抽屉已把 onMessage 注册进 useWebSocket 替身）。 */
async function pushFrame(frame: NotifyMessage) {
  await act(async () => {
    (
      wsHolder.options?.onMessage as ((f: NotifyMessage) => void) | undefined
    )?.(frame);
  });
}

/** 会话列表的展示顺序就是 DOM 顺序，据此断言「谁排在谁前面」。 */
function expectBefore(first: HTMLElement, second: HTMLElement) {
  expect(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
}

/** 按键名取会话列表项（aria-label 由会话展示名拼出）。 */
function conversationItem(name: string) {
  return screen.getByRole('button', {
    name: t('chat.drawer.openConversation', { name }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  resetShellPanel();
  setChatOpen(true);
  vi.mocked(fetchConversations).mockResolvedValue([conversation]);
  vi.mocked(fetchChatHistory).mockResolvedValue([incoming]);
  vi.mocked(markChatRead).mockResolvedValue(undefined as never);
  // 进会话即拉一次对端状态：默认「在线」，否则每个用例都要先喂一遍才算就绪
  vi.mocked(watchPeerPresence).mockResolvedValue({
    userId: PEER_ID,
    status: ChatPresenceStatus.ONLINE,
    lastActiveAt: null,
  });
  vi.mocked(sendTyping).mockResolvedValue(undefined);
});

afterEach(() => {
  // 先卸载再重置：resetShellPanel 会清掉监听者，顺序颠倒会让组件订阅到一个已废弃的 store
  cleanup();
  resetShellPanel();
});

/**
 * 已读回执：气泡下的读者头像。
 *
 * <p>抽屉与 `/chat` 页共用 {@code services/chat/readReceipt} 的合并口径，这里只钉住
 * 「历史里的 readers 真的画出来了、且只画在自己发的消息上」——方向画反了，用户会以为
 * 自己没被读，或者把对方读别人消息的痕迹当成了自己的。</p>
 */
describe('ChatDrawer 已读回执', () => {
  it('我发的消息在气泡下画出读者头像，对端发的消息不长读者', async () => {
    const readers = [
      { userId: '900000000000000021', displayName: '姚' },
      { userId: '900000000000000022', displayName: '李四' },
    ];
    // 写扩散下「我发的」那一行 recipient 就是我自己
    const mine: NotifyMessage = {
      ...incoming,
      id: '900000000000000102',
      senderUserId: MY_USER_ID,
      recipientUserId: MY_USER_ID,
      clientMsgId: 'c-9',
      content: '文件已投递',
      readers,
    };
    vi.mocked(fetchChatHistory).mockResolvedValue([mine, incoming]);

    render(
      <App>
        <ChatDrawer />
      </App>,
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: t('chat.drawer.openConversation', { name: PEER_NAME }),
      }),
    );

    expect(await screen.findByText('文件已投递')).toBeInTheDocument();
    expect(screen.getByTitle('姚')).toBeInTheDocument();
    expect(screen.getByTitle('李四')).toBeInTheDocument();
    // 文字等价物：读屏用户听到的是「已读：姚, 李四」，而不是两个孤立的汉字
    expect(
      screen.getByRole('img', { name: t('chat.read.by', { names: '姚, 李四' }) }),
    ).toBeInTheDocument();
    // 对端那条消息没有 readers，不得凭空长出读者
    expect(screen.queryByTitle(PEER_NAME)).toBeNull();
  });
});

describe('ChatDrawer 详情态头像与列表同源', () => {
  it('点进会话后，消息头像仍是列表里的「系」，不会回落成「用」', async () => {
    render(
      <App>
        <ChatDrawer />
      </App>,
    );

    const listItem = await screen.findByRole('button', {
      name: t('chat.drawer.openConversation', { name: PEER_NAME }),
    });
    // 列表态：头像取自会话项自己的名字
    expect(screen.getByText(AVATAR_INITIAL)).toBeInTheDocument();

    fireEvent.click(listItem);

    // 详情态就绪（历史已到）
    expect(await screen.findByText('在吗')).toBeInTheDocument();
    // 标题与头像必须来自同一个展示对象
    expect(screen.getByText(PEER_NAME)).toBeInTheDocument();
    expect(screen.getByText(AVATAR_INITIAL)).toBeInTheDocument();
    expect(screen.queryByText(FALLBACK_INITIAL)).toBeNull();
  });

  it('详情态的标题首字与头像字符一致（同一屏不允许出现两种模样）', async () => {
    render(
      <App>
        <ChatDrawer />
      </App>,
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: t('chat.drawer.openConversation', { name: PEER_NAME }),
      }),
    );
    await screen.findByText('在吗');

    // 不写死「系」：直接比两处首字。标题回落成「用户 #<id>」而头像没落，或反之，
    // 都会在这里露馅
    expect(screen.getByText(PEER_NAME).textContent?.slice(0, 1)).toBe(
      screen.getByText(AVATAR_INITIAL).textContent,
    );
  });
});

/**
 * 抽屉 · 对端状态与输入提示。
 *
 * <p>抽屉与 `/chat` 页共用 `useChatPresence` + `ChatPeerStatus`（规则本身由
 * `services/chat/presence.test.ts` 与 `ChatPeerStatus/index.test.tsx` 钉住），
 * 本组只钉<b>接线</b>：详情态头部要出对端状态、`TYPING` 帧要能把它换成「正在输入…」、
 * 本端在抽屉里打字同样要上报。</p>
 *
 * <p>另一条边界：会话列表视图（标题是面板名「消息」）不出状态点——那会被读成
 * 「消息这个人」在线，而列表视图根本没有「对端」这个对象，因此也不该订阅。</p>
 */
describe('ChatDrawer 对端状态与输入提示', () => {
  const pushTyping = async (payload: unknown) => {
    await act(async () => {
      (
        wsHolder.options?.onTyping as ((f: unknown) => void) | undefined
      )?.(payload);
    });
  };

  /** 打开抽屉并点进单聊会话，等到历史就位（详情态才算渲染完成）。 */
  const openConversation = async () => {
    render(
      <App>
        <ChatDrawer />
      </App>,
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: t('chat.drawer.openConversation', { name: PEER_NAME }),
      }),
    );
    await screen.findByText('在吗');
  };

  it('列表视图不出状态点，也不订阅（那里没有「对端」这个对象）', async () => {
    render(
      <App>
        <ChatDrawer />
      </App>,
    );
    await screen.findByRole('button', {
      name: t('chat.drawer.openConversation', { name: PEER_NAME }),
    });

    expect(screen.queryByText(t('chat.presence.online'))).toBeNull();
    expect(vi.mocked(watchPeerPresence)).not.toHaveBeenCalled();
  });

  it('详情态：进会话即拉对端状态，TYPING 帧把它换成「对方正在输入…」再收起', async () => {
    await openConversation();

    await waitFor(() =>
      expect(vi.mocked(watchPeerPresence)).toHaveBeenCalledWith(
        ChatScope.PRIVATE,
        PEER_ID,
      ),
    );
    expect(await screen.findByText(t('chat.presence.online'))).toBeInTheDocument();

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
    expect(screen.getByText(t('chat.presence.online'))).toBeInTheDocument();
  });

  it('本端在抽屉里输入：同样上报「我在输入」', async () => {
    await openConversation();

    fireEvent.change(await screen.findByRole('textbox'), {
      target: { value: '晚点说' },
    });

    expect(vi.mocked(sendTyping)).toHaveBeenCalledWith(
      ChatScope.PRIVATE,
      PEER_ID,
      true,
    );
  });
});

/**
 * 消息合并：抽屉的消息流不能靠「追加」维护。
 *
 * <p>缺陷原状：自己发的消息会经**两条路**到达——HTTP 发送响应、以及服务端把这条帧
 * 原样推回（推送覆盖该用户全部连接）。抽屉两处都是 `[...prev, x]` 直接追加，
 * 于是刚发出去的消息在抽屉里变成两个气泡；`/chat` 页因为走 {@code mergeMessage}
 * （同时认 id 与 clientMsgId）没这个问题。</p>
 *
 * <p>本组用例走真实链路：点发送 → 注入服务端推回的同一条帧 → 数气泡。</p>
 */
describe('ChatDrawer 消息合并', () => {
  it('自己发的消息被服务端原样推回时，只画一个气泡', async () => {
    // 写扩散下「我发的」那一行收件人就是我自己，故 senderUserId === recipientUserId
    const sent: NotifyMessage = {
      ...incoming,
      id: '900000000000000103',
      recipientUserId: PEER_ID,
      clientMsgId: 'c-11',
      content: '收到',
    };
    vi.mocked(sendChatMessage).mockResolvedValue(sent);

    render(
      <App>
        <ChatDrawer />
      </App>,
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: t('chat.drawer.openConversation', { name: PEER_NAME }),
      }),
    );
    await screen.findByText('在吗');

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '收到' },
    });
    fireEvent.click(screen.getByRole('button', { name: t('chat.drawer.send') }));
    await waitFor(() => expect(screen.getByText('收到')).toBeInTheDocument());

    // 服务端把自己那条推回来：HTTP 响应与 WS 帧是同一条消息（id 相同）
    await pushFrame(sent);

    expect(screen.getAllByText('收到')).toHaveLength(1);
  });
});

/**
 * 会话列表：抽屉与 `/chat` 页必须共用同一套「摘要 / 未读 / 排序」规则。
 *
 * <p>收敛前的抽屉自己写了一份 {@code applyIncoming}：既不排序、也不判乱序，来什么帧就用它覆盖
 * 摘要。三个后果都能被下面抓住——新消息到了会话不往前挪、迟到的旧帧把摘要改回旧文案、
 * 列表里还没有的会话就地插一条缺 {@code targetName} 的壳（先显示「用户 #id」再跳真名）。</p>
 */
describe('ChatDrawer 会话列表', () => {
  it('实时消息把该会话顶到最前，摘要跟着更新', async () => {
    // 故意返回一个不按 lastMessageId 倒序的列表：排序是前端共用规则的事，不赖服务端顺序
    vi.mocked(fetchConversations).mockResolvedValue([
      conversation,
      otherConversation,
    ]);

    render(
      <App>
        <ChatDrawer />
      </App>,
    );

    const peer = await screen.findByRole('button', {
      name: t('chat.drawer.openConversation', { name: PEER_NAME }),
    });
    // otherConversation 的最后一条消息更新，故排在前面
    expectBefore(conversationItem(OTHER_NAME), peer);

    await pushFrame({
      ...incoming,
      id: '900000000000000600',
      content: '今晚有空',
    });

    expectBefore(peer, conversationItem(OTHER_NAME));
    expect(screen.getByText('今晚有空')).toBeInTheDocument();
  });

  it('迟到的旧帧不让摘要往回退', async () => {
    render(
      <App>
        <ChatDrawer />
      </App>,
    );
    await screen.findByRole('button', {
      name: t('chat.drawer.openConversation', { name: PEER_NAME }),
    });

    await pushFrame({
      ...incoming,
      id: '900000000000000600',
      content: '今晚有空',
    });
    expect(screen.getByText('今晚有空')).toBeInTheDocument();

    // 乱序送达的旧帧：id 比当前摘要小，不能拿它覆盖正文
    await pushFrame({
      ...incoming,
      id: '900000000000000200',
      content: '翻上去才看到的老消息',
    });
    expect(screen.queryByText('翻上去才看到的老消息')).toBeNull();
    expect(screen.getByText('今晚有空')).toBeInTheDocument();
  });

  it('列表里还没有的会话不就地插壳，而是拉一次会话列表', async () => {
    render(
      <App>
        <ChatDrawer />
      </App>,
    );
    await screen.findByRole('button', {
      name: t('chat.drawer.openConversation', { name: PEER_NAME }),
    });
    expect(fetchConversations).toHaveBeenCalledTimes(1);

    vi.mocked(fetchConversations).mockResolvedValue([
      conversation,
      {
        chatScope: ChatScope.PRIVATE,
        targetId: STRANGER_ID,
        targetName: STRANGER_NAME,
        lastMessageId: '900000000000000700',
        lastContent: '你好',
        lastMessageType: MessageType.TEXT,
        unreadCount: 1,
        mentionUnreadCount: 0,
      },
    ]);
    await pushFrame({
      ...incoming,
      id: '900000000000000700',
      senderUserId: STRANGER_ID,
      chatTargetId: STRANGER_ID,
      content: '你好',
    });

    await waitFor(() => expect(fetchConversations).toHaveBeenCalledTimes(2));
    // 名字来自服务端：就地插壳只会显示「用户 #<id>」
    expect(await screen.findByRole('button', {
      name: t('chat.drawer.openConversation', { name: STRANGER_NAME }),
    })).toBeInTheDocument();
    expect(screen.queryByText(`用户 #${STRANGER_ID}`)).toBeNull();
  });
});

/**
 * 已读口径：抽屉与 `/chat` 页必须是同一套。
 *
 * <p>会话页就两条规则：<b>别人发来的才置读</b>（自己发的会被推送原样收回来，标了也没意义），
 * 以及<b>置读真的改了行（`affected > 0`）才回正顶栏角标</b>——未读数的唯一事实源是 `wsStore`，
 * 少这一拉，顶栏红点就停在旧数字上。收敛前的抽屉两条都不满足：对每条帧（含自己发的）都置读，
 * 置读后又从不 refresh。</p>
 */
describe('ChatDrawer 已读口径', () => {
  /**
   * 点进会话并等历史就绪。
   *
   * @param affected 置读接口的返回（真的改了几行），由用例声明
   */
  async function openPeerSession(affected: number) {
    vi.mocked(markChatRead).mockResolvedValue(affected);
    render(
      <App>
        <ChatDrawer />
      </App>,
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: t('chat.drawer.openConversation', { name: PEER_NAME }),
      }),
    );
    await screen.findByText('在吗');
    // 先冲掉「进入会话」那次置读留下的 then 链，再清账：否则它的 refresh 会算到下一个断言头上
    await act(async () => {});
    vi.mocked(markChatRead).mockClear();
    vi.mocked(wsStore.refresh).mockClear();
  }

  it('别人发来的帧：置读该会话并回正顶栏角标', async () => {
    await openPeerSession(1);

    await pushFrame({
      ...incoming,
      id: '900000000000000800',
      content: '再看一眼',
    });
    await act(async () => {});

    expect(markChatRead).toHaveBeenCalledWith(ChatScope.PRIVATE, PEER_ID);
    expect(wsStore.refresh).toHaveBeenCalledTimes(1);
  });

  it('置读没改到行时不拉未读快照（不白拉一次顶栏）', async () => {
    await openPeerSession(0);

    await pushFrame({
      ...incoming,
      id: '900000000000000801',
      content: '再看一眼',
    });
    await act(async () => {});

    expect(markChatRead).toHaveBeenCalledWith(ChatScope.PRIVATE, PEER_ID);
    expect(wsStore.refresh).not.toHaveBeenCalled();
  });

  it('自己发的帧不置读（多标签页会把自己的消息收回来）', async () => {
    await openPeerSession(1);

    await pushFrame({
      ...incoming,
      id: '900000000000000802',
      senderUserId: MY_USER_ID,
      recipientUserId: MY_USER_ID,
      clientMsgId: 'c-12',
      content: '收到',
    });

    // 跳过的是置读，不是合并：消息照常进流
    expect(screen.getByText('收到')).toBeInTheDocument();
    expect(markChatRead).not.toHaveBeenCalled();
    expect(wsStore.refresh).not.toHaveBeenCalled();
  });
});

/**
 * 头像接真实图片：服务端给了地址就画图，没给就回落首字符。
 *
 * <p>抽屉里共 3 处头像渲染点（会话列表 / 消息气泡 / 读者），此前一律只画首字符。
 * 接图片时必须逐处接上——漏掉任何一处都会变成「列表里有图、点进去没图」，
 * 比整片都没有图更像 bug。</p>
 *
 * <p>同时钉住兜底：地址为空时<b>一个 `img` 都不该出现</b>，否则会渲染成破图，
 * 反而比首字符更糟。</p>
 */
describe('ChatDrawer 头像', () => {
  const PEER_AVATAR = 'http://localhost:8080/v1/users/900000000000000009/avatar?v=2';
  const READER_AVATAR = 'http://localhost:8080/v1/users/900000000000000021/avatar?v=7';

  /**
   * 抽屉里所有头像图的 `src`（DOM 顺序即：会话列表 → 消息流）。
   *
   * <p>从 `document` 取而不是 `render` 返回的 `container`：antd `Drawer` 渲染在
   * `document.body` 的传送门里，`container` 里根本看不到它——那样断言会「恰好」全绿，
   * 什么也没钉住。</p>
   */
  function avatars(): (string | null)[] {
    return Array.from(document.querySelectorAll('img')).map((img) =>
      img.getAttribute('src'),
    );
  }

  /** 会话列表是异步拉取的：必须等列表项出现再点，同步取会直接抛「找不到元素」。 */
  async function openConversation() {
    fireEvent.click(
      await screen.findByRole('button', {
        name: t('chat.drawer.openConversation', { name: PEER_NAME }),
      }),
    );
  }

  it('会话列表与对端消息气泡都用服务端给的头像地址', async () => {
    vi.mocked(fetchConversations).mockResolvedValue([
      { ...conversation, targetAvatarUrl: PEER_AVATAR },
    ]);
    vi.mocked(fetchChatHistory).mockResolvedValue([
      {
        ...incoming,
        // 正文与列表摘要刻意不同：等这句才算消息流渲染完，否则会「只等到列表就断言」
        content: '历史消息甲',
        senderDisplayName: PEER_NAME,
        senderAvatarUrl: PEER_AVATAR,
      },
    ]);

    render(
      <App>
        <ChatDrawer />
      </App>,
    );

    // 列表与详情是二选一渲染（见 `index.tsx` 的 `!active &&` / `active &&`），两处头像
    // 不可能同屏出现，只能分别在各自视图下断言；否则「列表有图、详情漏接」会被漏掉一半
    await screen.findByRole('button', {
      name: t('chat.drawer.openConversation', { name: PEER_NAME }),
    });
    expect(avatars()).toEqual([PEER_AVATAR]);

    await openConversation();
    await screen.findByText('历史消息甲');
    expect(avatars()).toEqual([PEER_AVATAR]);
  });

  it('读者头像也用真实图片（「谁读了这条消息」不该只剩一个首字）', async () => {
    const mine: NotifyMessage = {
      ...incoming,
      id: '900000000000000103',
      senderUserId: MY_USER_ID,
      recipientUserId: MY_USER_ID,
      clientMsgId: 'c-13',
      content: '文件已投递',
      readers: [
        {
          userId: '900000000000000021',
          displayName: '姚',
          avatarUrl: READER_AVATAR,
        },
      ],
    };
    vi.mocked(fetchChatHistory).mockResolvedValue([mine]);

    render(
      <App>
        <ChatDrawer />
      </App>,
    );
    await openConversation();
    await screen.findByText('文件已投递');

    // 本用例没给会话列表头像，所以只应出现读者那一张
    expect(avatars()).toEqual([READER_AVATAR]);
  });

  it('没有头像时回落首字符：不出现任何 img（空 src 会渲染成破图）', async () => {
    vi.mocked(fetchConversations).mockResolvedValue([conversation]);
    vi.mocked(fetchChatHistory).mockResolvedValue([
      { ...incoming, content: '历史消息乙', senderDisplayName: PEER_NAME },
    ]);

    render(
      <App>
        <ChatDrawer />
      </App>,
    );
    await openConversation();
    await screen.findByText('历史消息乙');

    expect(avatars()).toEqual([]);
    // 首字符仍在（列表与气泡各一处）：兜底不是「什么都不画」
    expect(screen.getAllByText('系').length).toBeGreaterThan(0);
  });
});
