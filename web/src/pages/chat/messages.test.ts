import { describe, expect, it } from 'vitest';

import type { Conversation } from '@/services/chat';
import {
  ChatScope,
  MessageType,
  type NotifyMessage,
  NotifyType,
} from '@/services/notify';

import {
  applyIncomingToConversations,
  clearSessionUnread,
  mergeMessage,
  messageKey,
  prependHistory,
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
});
