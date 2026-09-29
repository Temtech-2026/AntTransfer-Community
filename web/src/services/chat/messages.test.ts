import { describe, expect, it } from 'vitest';

import type { Conversation } from './types';
import {
  ChatScope,
  MessageType,
  type NotifyMessage,
  NotifyType,
  RecallStatus,
} from '@/services/notify';

import {
  applyIncomingToConversations,
  applyRecall,
  clearSessionUnread,
  isRecallable,
  markConversationRecalled,
  mergeMessage,
  messageKey,
  prependHistory,
  RECALL_CLOCK_TOLERANCE_MS,
  RECALL_WINDOW_MS,
  sortConversations,
  sortMessages,
} from './messages';

/**
 * 造一条会话消息；`mine` 用「sender === recipient」表达，与后端写扩散口径一致。
 *
 * <p>ID 一律是字符串：19 位雪花 ID 超出 JS 安全整数范围，服务端以字符串下发、
 * 前端以字符串承接（乐观行未拿到服务端 ID 时用空串）。</p>
 */
function chatMessage(overrides: Partial<NotifyMessage> = {}): NotifyMessage {
  return {
    id: '1',
    recipientUserId: '7',
    senderUserId: '9',
    notifyType: NotifyType.IM_PRIVATE,
    messageType: MessageType.TEXT,
    chatScope: ChatScope.PRIVATE,
    chatTargetId: '9',
    content: 'hi',
    createTime: '2026-09-16T10:00:00',
    ...overrides,
  };
}

/** 造一条「别人发给我的」单聊消息（入参用短数字便于阅读，落库形态仍是字符串）。 */
function incoming(id: number, content = `m${id}`): NotifyMessage {
  return chatMessage({
    id: String(id),
    content,
    createTime: `2026-09-16T10:00:${String(id).padStart(2, '0')}`,
  });
}

/** 造一条「我发出的」单聊消息。 */
function outgoing(id: number, content = `s${id}`): NotifyMessage {
  return chatMessage({
    id: String(id),
    content,
    senderUserId: '7',
    recipientUserId: '7',
    createTime: `2026-09-16T10:00:${String(id).padStart(2, '0')}`,
  });
}

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    chatScope: ChatScope.PRIVATE,
    targetId: '9',
    targetName: '张三',
    lastMessageId: '10',
    lastContent: '旧消息',
    lastMessageType: MessageType.TEXT,
    lastSenderUserId: '9',
    lastMessageMine: false,
    lastTime: '2026-09-16T09:00:00',
    unreadCount: 0,
    // 未读 @ 是未读的子集：默认没有点名，用例要考它时在 overrides 里给
    mentionUnreadCount: 0,
    ...overrides,
  };
}

describe('messageKey', () => {
  it('优先用 id，其次 clientMsgId，都没有才退化到「时间 + 正文」', () => {
    expect(messageKey(chatMessage({ id: '5' }))).toBe('id:5');
    expect(messageKey(chatMessage({ id: '', clientMsgId: 'c1' }))).toBe(
      'client:c1',
    );
    expect(
      messageKey(chatMessage({ id: '', createTime: 't', content: 'x' })),
    ).toBe('raw:t:x');
  });
});

describe('sortMessages', () => {
  it('按 id 升序；缺 id 的（乐观行）排到末尾', () => {
    const list = [
      chatMessage({ id: '3' }),
      chatMessage({ id: '', clientMsgId: 'pending' }),
      chatMessage({ id: '1' }),
    ];

    expect(sortMessages(list).map((item) => item.id)).toEqual(['1', '3', '']);
  });
});

describe('mergeMessage', () => {
  it('新消息按 id 插入到正确位置', () => {
    const merged = mergeMessage([incoming(1), incoming(3)], incoming(2));

    expect(merged.map((item) => item.id)).toEqual(['1', '2', '3']);
  });

  it('同一 id 到达两次（HTTP 响应 + WS 回推）只保留一条，且以后到的为准', () => {
    const first = chatMessage({ id: '8', content: '原始' });
    const second = chatMessage({ id: '8', content: '原始', readStatus: 1 });

    const merged = mergeMessage([first], second);

    expect(merged).toHaveLength(1);
    expect(merged[0].readStatus).toBe(1);
  });

  it('已读回执不被重复到达的消息帧擦掉（消息通道永远不带 readers）', () => {
    const withReaders = chatMessage({
      id: '8',
      content: '原始',
      readers: [{ userId: '9', displayName: '张三' }],
    });
    // WS `CHAT` 帧不带读者：若直接覆盖，头像会消失且再也补不回来（回执不重放）
    const frame = chatMessage({ id: '8', content: '原始', readers: [] });

    expect(mergeMessage([withReaders], frame)[0].readers).toEqual([
      { userId: '9', displayName: '张三' },
    ]);
  });

  it('历史带来新读者时以新值为准（已读只会从无到有）', () => {
    const before = chatMessage({
      id: '8',
      readers: [{ userId: '9', displayName: '张三' }],
    });
    const after = chatMessage({
      id: '8',
      readers: [
        { userId: '9', displayName: '张三' },
        { userId: '10', displayName: '李四' },
      ],
    });

    expect(mergeMessage([before], after)[0].readers).toHaveLength(2);
  });

  it('乐观插入只有 clientMsgId，服务端帧同时带 id 与 clientMsgId 时收敛为一条', () => {
    const optimistic = chatMessage({
      id: '',
      clientMsgId: 'c-1',
      content: '发送中',
    });
    const saved = chatMessage({
      id: '42',
      clientMsgId: 'c-1',
      content: '发送中',
    });

    const merged = mergeMessage([optimistic], saved);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('42');
  });
});

describe('prependHistory', () => {
  it('更早的一页并到头部、整体仍按 id 升序，且与当前流去重', () => {
    const current = [incoming(10), incoming(11)];
    const older = [incoming(9), incoming(10)];

    const merged = prependHistory(current, older);

    expect(merged.map((item) => item.id)).toEqual(['9', '10', '11']);
  });
});

describe('sortConversations', () => {
  it('最后一条消息 ID 大的在前', () => {
    const list = [
      conversation({ targetId: '9', lastMessageId: '10' }),
      conversation({ targetId: '11', lastMessageId: '30' }),
      conversation({ targetId: '12', lastMessageId: '20' }),
    ];

    expect(sortConversations(list).map((item) => item.targetId)).toEqual([
      '11', '12', '9',
    ]);
  });
});

describe('clearSessionUnread', () => {
  it('只清命中会话的未读，未命中的保持原对象引用', () => {
    const hit = conversation({ targetId: '9', unreadCount: 3 });
    const other = conversation({ targetId: '11', unreadCount: 5 });

    const cleared = clearSessionUnread([hit, other], {
      chatScope: ChatScope.PRIVATE,
      targetId: '9',
    });

    expect(cleared[0].unreadCount).toBe(0);
    expect(cleared[1]).toBe(other);
  });

  it('scope 不同但 targetId 相同的会话不受影响（会话键必须带 scope）', () => {
    const group = conversation({
      chatScope: ChatScope.GROUP,
      targetId: '9',
      unreadCount: 4,
    });

    const cleared = clearSessionUnread([group], {
      chatScope: ChatScope.PRIVATE,
      targetId: '9',
    });

    expect(cleared[0].unreadCount).toBe(4);
  });

  it('提及未读与未读一起归零（它是未读的子集，留一个会自相矛盾）', () => {
    const hit = conversation({ unreadCount: 3, mentionUnreadCount: 2 });

    const cleared = clearSessionUnread([hit], {
      chatScope: ChatScope.PRIVATE,
      targetId: '9',
    });

    expect(cleared[0].unreadCount).toBe(0);
    expect(cleared[0].mentionUnreadCount).toBe(0);
  });

  it('未读已归零但提及未读还有剩时也要清（不留用户无法消除的「有人@我」）', () => {
    const hit = conversation({ unreadCount: 0, mentionUnreadCount: 1 });

    const cleared = clearSessionUnread([hit], {
      chatScope: ChatScope.PRIVATE,
      targetId: '9',
    });

    expect(cleared[0]).not.toBe(hit);
    expect(cleared[0].mentionUnreadCount).toBe(0);
  });

  it('本来就没有未读的会话保持原对象引用（缺失字段不能算成「有东西要清」）', () => {
    const hit = conversation({ unreadCount: 0 });
    // 模拟后端某天不回这个字段：判定必须按 0 处理，否则每次进入会话都换一次引用
    const legacy = { ...hit, mentionUnreadCount: undefined } as unknown as Conversation;

    expect(
      clearSessionUnread([legacy], {
        chatScope: ChatScope.PRIVATE,
        targetId: '9',
      })[0],
    ).toBe(legacy);
  });
});

describe('applyIncomingToConversations', () => {
  it('非会话消息（系统通知）原样返回，且不要求刷新列表', () => {
    const list = [conversation()];
    const result = applyIncomingToConversations(
      list,
      chatMessage({
        notifyType: NotifyType.APPROVAL_TODO,
        chatScope: null,
        chatTargetId: null,
      }),
      { activeSession: null },
    );

    expect(result.conversations).toBe(list);
    expect(result.knownSession).toBe(true);
  });

  it('列表里没有这个会话时不做就地插入，交由调用方重新拉列表', () => {
    const list = [conversation({ targetId: '11' })];
    const result = applyIncomingToConversations(list, incoming(20), {
      activeSession: null,
    });

    expect(result.conversations).toBe(list);
    expect(result.knownSession).toBe(false);
  });

  it('对方发来的消息：未读 +1、摘要与时间刷新、会话排到最前', () => {
    const list = [
      conversation({ targetId: '9', lastMessageId: '10', unreadCount: 1 }),
      conversation({ targetId: '11', lastMessageId: '30', unreadCount: 0 }),
    ];

    const result = applyIncomingToConversations(list, incoming(31, '在吗'), {
      activeSession: null,
    });

    expect(result.knownSession).toBe(true);
    expect(result.conversations.map((item) => item.targetId)).toEqual(['9', '11']);
    const hit = result.conversations[0];
    expect(hit.unreadCount).toBe(2);
    expect(hit.lastMessageId).toBe('31');
    expect(hit.lastContent).toBe('在吗');
    expect(hit.lastMessageMine).toBe(false);
    expect(hit.lastTime).toBe('2026-09-16T10:00:31');
  });

  it('自己发的消息（WS 回声）不加未读，但会更新摘要与方向', () => {
    const list = [conversation({ unreadCount: 2 })];

    const result = applyIncomingToConversations(list, outgoing(33, '收到'), {
      activeSession: null,
    });

    expect(result.conversations[0].unreadCount).toBe(2);
    expect(result.conversations[0].lastContent).toBe('收到');
    expect(result.conversations[0].lastMessageMine).toBe(true);
  });

  it('当前打开的会话即使收到对方消息也不加未读', () => {
    const list = [conversation({ targetId: '9', unreadCount: 0 })];

    const result = applyIncomingToConversations(list, incoming(34), {
      activeSession: { chatScope: ChatScope.PRIVATE, targetId: '9' },
    });

    expect(result.conversations[0].unreadCount).toBe(0);
    expect(result.conversations[0].lastMessageId).toBe('34');
  });

  it('旧消息乱序到达时不把 lastMessageId / 摘要回退，但未读照常 +1', () => {
    const list = [
      conversation({ lastMessageId: '50', lastContent: '最新', unreadCount: 1 }),
    ];

    const result = applyIncomingToConversations(
      list,
      incoming(12, '迟到的旧消息'),
      {
        activeSession: null,
      },
    );

    const hit = result.conversations[0];
    expect(hit.lastMessageId).toBe('50');
    expect(hit.lastContent).toBe('最新');
    expect(hit.unreadCount).toBe(2);
  });

  it('被 @ 的消息：未读与提及未读各 +1（未读是总数，提及是其中的子集）', () => {
    const list = [
      conversation({ unreadCount: 1, mentionUnreadCount: 0 }),
    ];

    const result = applyIncomingToConversations(
      list,
      chatMessage({ id: '40', content: '@张三 看一下', mentioned: true }),
      { activeSession: null },
    );

    const hit = result.conversations[0];
    expect(hit.unreadCount).toBe(2);
    expect(hit.mentionUnreadCount).toBe(1);
  });

  it('没被 @ 的消息只加未读，不碰已有的提及未读', () => {
    const list = [conversation({ unreadCount: 1, mentionUnreadCount: 2 })];

    const result = applyIncomingToConversations(list, incoming(41), {
      activeSession: null,
    });

    const hit = result.conversations[0];
    expect(hit.unreadCount).toBe(2);
    // 路过一条无关消息不该把「有人@我」擦掉（它只能由进入会话 / 标记已读清零）
    expect(hit.mentionUnreadCount).toBe(2);
  });

  it('自己发的消息即便带了提及标记（多标签页收到自己的帧）也不给自己造「有人@我」', () => {
    const list = [conversation({ unreadCount: 0, mentionUnreadCount: 0 })];

    const result = applyIncomingToConversations(
      list,
      chatMessage({
        id: '42',
        content: '@张三 看一下',
        mentioned: true,
        senderUserId: '7',
        recipientUserId: '7',
      }),
      { activeSession: null },
    );

    const hit = result.conversations[0];
    expect(hit.unreadCount).toBe(0);
    expect(hit.mentionUnreadCount).toBe(0);
  });

  it('当前打开的会话里被 @ 也不加未读（我正看着这条消息）', () => {
    const list = [conversation({ targetId: '9', unreadCount: 0, mentionUnreadCount: 0 })];

    const result = applyIncomingToConversations(
      list,
      chatMessage({ id: '43', content: '@张三 看一下', mentioned: true }),
      { activeSession: { chatScope: ChatScope.PRIVATE, targetId: '9' } },
    );

    expect(result.conversations[0].unreadCount).toBe(0);
    expect(result.conversations[0].mentionUnreadCount).toBe(0);
  });
});

/**
 * 撤回的入口显隐（{@link isRecallable}）。
 *
 * <p>钉的是「前端不做权威判定」这条边界：时间窗只决定菜单项显不显示，
 * 真正的裁决在服务端（超窗回 `1034`）。因此超窗必须<b>不给入口</b>——
 * 给一个必然被拒的菜单项，用户只会以为功能坏了；反过来，钟差容忍内必须给，
 * 否则一台快几分钟的设备上「刚发出去的话」立刻就撤不掉了。</p>
 */
describe('isRecallable', () => {
  /** 我发的一条消息：写扩散下自己发的那行 recipient 就是自己。 */
  const mineAt = (
    createTime: string,
    overrides: Partial<NotifyMessage> = {},
  ) =>
    chatMessage({
      id: '20',
      senderUserId: '7',
      recipientUserId: '7',
      clientMsgId: 'c-20',
      content: '刚发的话',
      createTime,
      ...overrides,
    });

  const sentAt = Date.parse('2026-09-16T10:00:00');

  it('自己发的 + 有幂等键 + 1 分钟内：可以撤回', () => {
    expect(isRecallable(mineAt('2026-09-16T10:00:00'), sentAt + 60_000)).toBe(
      true,
    );
  });

  it('超出「2 分钟 + 30s 钟差」后不再给入口', () => {
    const tooLate =
      sentAt + RECALL_WINDOW_MS + RECALL_CLOCK_TOLERANCE_MS + 1;
    expect(isRecallable(mineAt('2026-09-16T10:00:00'), tooLate)).toBe(false);
  });

  it('钟差容忍内仍然给入口（设备时钟快于服务端时最需要撤回）', () => {
    const stillInTime =
      sentAt + RECALL_WINDOW_MS + RECALL_CLOCK_TOLERANCE_MS - 1;
    expect(isRecallable(mineAt('2026-09-16T10:00:00'), stillInTime)).toBe(true);
  });

  it('别人发的不可撤回（服务端也只允许本人）', () => {
    expect(isRecallable(incoming(21, '别人的话'), sentAt + 1000)).toBe(false);
  });

  it('没有幂等键的消息连请求都发不出去：不给入口', () => {
    expect(
      isRecallable(
        mineAt('2026-09-16T10:00:00', { clientMsgId: undefined }),
        sentAt,
      ),
    ).toBe(false);
  });

  it('已撤回的不能二次撤回', () => {
    expect(
      isRecallable(
        mineAt('2026-09-16T10:00:00', { recallStatus: RecallStatus.DONE }),
        sentAt,
      ),
    ).toBe(false);
  });

  it('时间缺失（脏数据）时不拦：交给服务端裁决比永远撤不掉更好', () => {
    expect(isRecallable(mineAt(''), sentAt)).toBe(true);
  });
});

/**
 * 撤回的本地收敛（{@link applyRecall}）：帧与撤回响应共用同一条规则。
 *
 * <p>「按幂等键而不是消息 id 定位」是写扩散下的硬约束——同一条逻辑消息在每个人
 * 那里是不同的行（id 不同），只有幂等键跨行、跨端一致。</p>
 */
describe('applyRecall', () => {
  const sent = (id: string, overrides: Partial<NotifyMessage> = {}) =>
    chatMessage({
      id,
      clientMsgId: `c-${id}`,
      content: `原话${id}`,
      recallStatus: RecallStatus.NONE,
      ...overrides,
    });

  it('按幂等键命中：标记撤回并清空正文（本地也读不到原文）', () => {
    const hit = sent('20');
    const other = sent('21');

    const next = applyRecall([hit, other], 'c-20', '2026-09-16T10:03:00');

    expect(next[0]).toMatchObject({
      recallStatus: RecallStatus.DONE,
      recallTime: '2026-09-16T10:03:00',
      content: '',
    });
    expect(next[1]).toBe(other);
  });

  it('未命中时返回原数组引用：撤回帧推给全部参与人，别的会话不该重渲染', () => {
    const list = [sent('20')];

    expect(applyRecall(list, 'c-unknown')).toBe(list);
  });

  it('已撤回的不重复处理：后到的帧不覆盖本地已有的撤回时间', () => {
    const list = [
      sent('20', {
        recallStatus: RecallStatus.DONE,
        recallTime: 'T1',
        content: '',
      }),
    ];

    expect(applyRecall(list, 'c-20', 'T2')).toBe(list);
  });

  it('帧没带撤回时间时保留本地值（HTTP 响应路径没有这个字段）', () => {
    const next = applyRecall([sent('20', { recallTime: 'T0' })], 'c-20');

    expect(next[0].recallTime).toBe('T0');
  });
});

/** 撤回落在会话最后一条时，左栏摘要要跟着变（{@link markConversationRecalled}）。 */
describe('markConversationRecalled', () => {
  const session = { chatScope: ChatScope.PRIVATE, targetId: '9' };

  it('撤回的正是该会话最后一条：摘要清空并标成已撤回', () => {
    const list = [conversation({ lastMessageId: '10', lastContent: '旧消息' })];

    const next = markConversationRecalled(list, session, '10');

    expect(next[0]).toMatchObject({
      lastRecallStatus: RecallStatus.DONE,
      lastContent: '',
    });
  });

  it('不是最后一条 / 不是这个会话 / 乐观行没有服务端 id：原样返回同一引用', () => {
    const list = [conversation({ lastMessageId: '10' })];

    expect(markConversationRecalled(list, session, '8')).toBe(list);
    expect(
      markConversationRecalled(list, { ...session, targetId: '11' }, '10'),
    ).toBe(list);
    expect(markConversationRecalled(list, session, '')).toBe(list);
  });
});
