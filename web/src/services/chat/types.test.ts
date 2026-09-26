import { describe, expect, it } from 'vitest';

import { ChatScope, MessageType } from '@/services/notify/types';

import { buildFileCardContent } from './fileCard';
import {
  type Conversation,
  conversationInitial,
  conversationSummary,
  messageSenderInitial,
  messageSenderLabel,
  messageSummary,
  resolveSessionDisplay,
} from './types';

describe('messageSummary 对文件消息的摘要口径', () => {
  it('剥掉条目引用尾注，只留「名字（大小）」', () => {
    const content = buildFileCardContent(
      '季度报告.pdf',
      '2.4 MB',
      '1949000000000000001',
    );
    expect(messageSummary({ content, messageType: MessageType.FILE })).toBe(
      '[文件] 季度报告.pdf（2.4 MB）',
    );
  });

  it('历史文件消息（无尾注）照旧展示', () => {
    expect(
      messageSummary({
        content: '季度报告.pdf（2.4 MB）',
        messageType: MessageType.FILE,
      }),
    ).toBe('[文件] 季度报告.pdf（2.4 MB）');
  });

  it('不是卡片形态的文件消息原样展示，不吞内容', () => {
    expect(
      messageSummary({ content: '对方发来一个文件', messageType: MessageType.FILE }),
    ).toBe('[文件] 对方发来一个文件');
  });

  it('文本消息不做任何加工', () => {
    expect(
      messageSummary({
        content: '季度报告.pdf（2.4 MB）\n#file:1',
        messageType: MessageType.TEXT,
      }),
    ).toBe('季度报告.pdf（2.4 MB）\n#file:1');
  });

  it('自己发的文件仍然带「我：」前缀', () => {
    const content = buildFileCardContent('a.pdf', '1 KB', '9');
    expect(
      messageSummary({ content, messageType: MessageType.FILE, mine: true }),
    ).toBe('我：[文件] a.pdf（1 KB）');
  });
});

describe('conversationSummary 与会话项字段口径一致', () => {
  it('会话列表那一行也剥掉尾注', () => {
    const content = buildFileCardContent('a.pdf', '1 KB', '9');
    const conversation = {
      lastContent: content,
      lastMessageType: MessageType.FILE,
    } as unknown as Parameters<typeof conversationSummary>[0];
    expect(conversationSummary(conversation)).toBe('[文件] a.pdf（1 KB）');
  });
});

/** 对端头像地址带缓存版本号，与服务端拼出来的形状一致。 */
const PEER_AVATAR = 'http://localhost:8080/v1/users/900000000000000009/avatar?v=2';

describe('resolveSessionDisplay 把会话名带进详情态', () => {
  const conversations: Conversation[] = [
    {
      chatScope: 1,
      targetId: '900000000000000009',
      targetName: '系统管理员',
      targetAvatarUrl: PEER_AVATAR,
      lastMessageId: '900000000000000100',
      unreadCount: 0,
    },
    {
      chatScope: 2,
      targetId: '900000000000000009',
      targetName: '运维支持群',
      // 群没有头像：服务端恒下发 null，前端也不该替它编一个
      targetAvatarUrl: null,
      lastMessageId: '900000000000000101',
      unreadCount: 0,
    },
  ];

  it('会话自带名字时原样返回，不等会话列表加载', () => {
    const session = {
      chatScope: 1,
      targetId: '900000000000000009',
      targetName: '系统管理员',
    };
    expect(resolveSessionDisplay(session)).toBe(session);
  });

  it('只有定位键时从列表回查补名', () => {
    const session = { chatScope: 1, targetId: '900000000000000009' };
    expect(resolveSessionDisplay(session, conversations).targetName).toBe(
      '系统管理员',
    );
  });

  it('scope 不同不误配：同一个 targetId 在单聊与群聊里不是同一个会话', () => {
    const session = { chatScope: 2, targetId: '900000000000000009' };
    expect(resolveSessionDisplay(session, conversations).targetName).toBe(
      '运维支持群',
    );
  });

  it('列表为空或查不到时保持原样，回落的拼装只归 conversationTitle 一处', () => {
    const session = { chatScope: 1, targetId: '900000000000000009' };
    expect(resolveSessionDisplay(session, null)).toEqual(session);
    expect(resolveSessionDisplay(session, []).targetName).toBeUndefined();
  });

  it('纯空白名字视同没名字（否则头像会取到一个空格）', () => {
    const session = {
      chatScope: 1,
      targetId: '900000000000000009',
      targetName: '   ',
    };
    expect(resolveSessionDisplay(session, conversations).targetName).toBe(
      '系统管理员',
    );
  });

  it('回查后的首字与列表头像一致——这正是抽屉里「系」变「用」的那一步', () => {
    const session = { chatScope: 1, targetId: '900000000000000009' };
    // 不回查：回落「用户 #<雪花ID>」→「用」（修复前详情头像的样子）
    expect(conversationInitial(resolveSessionDisplay(session, null))).toBe('用');
    // 回查：与列表项同源 →「系」
    expect(
      conversationInitial(resolveSessionDisplay(session, conversations)),
    ).toBe('系');
    expect(conversationInitial(conversations[0])).toBe('系');
  });

  it('头像跟着名字一起回填：详情气泡与列表用同一张图', () => {
    const session = { chatScope: 1, targetId: '900000000000000009' };
    expect(resolveSessionDisplay(session, null).targetAvatarUrl).toBeUndefined();
    expect(
      resolveSessionDisplay(session, conversations).targetAvatarUrl,
    ).toBe(PEER_AVATAR);
  });

  it('群聊回查拿到的仍是 null（群没有头像），不该被编出一张默认图', () => {
    const session = { chatScope: 2, targetId: '900000000000000009' };
    expect(
      resolveSessionDisplay(session, conversations).targetAvatarUrl,
    ).toBeNull();
  });

  it('自带头像时原样返回，不再回查列表', () => {
    const session = {
      chatScope: 1,
      targetId: '900000000000000009',
      targetName: '系统管理员',
      targetAvatarUrl: PEER_AVATAR,
    };
    expect(resolveSessionDisplay(session, conversations)).toBe(session);
  });
});

/**
 * 气泡头像的兜底字符（{@link messageSenderInitial}）。
 *
 * <p>群聊里一屏有多个发送人，只拿「当前会话首字」兜底会让所有人的头像长得一样；
 * 但缺 `senderDisplayName`（脏数据 / 老帧）时又必须回落，否则会画出空头像。</p>
 */
describe('messageSenderInitial', () => {
  it('优先发送人展示名首字，且统一大写', () => {
    expect(messageSenderInitial({ senderDisplayName: '姚' }, '群')).toBe('姚');
    expect(messageSenderInitial({ senderDisplayName: 'lisi' }, '群')).toBe('L');
  });

  it('缺发送人展示名 / 纯空白时回落会话首字，不画空头像', () => {
    expect(messageSenderInitial({}, '系')).toBe('系');
    expect(messageSenderInitial({ senderDisplayName: null }, '系')).toBe('系');
    expect(messageSenderInitial({ senderDisplayName: '   ' }, '系')).toBe('系');
  });
});

/**
 * 「谁说的 / 谁撤的」（{@link messageSenderLabel}）。
 *
 * <p>这组用例要证明的核心是：<b>不认识自己的用户 ID，也能把人对上号</b>。
 * 前端没有登录态主键（见 services/notify/types 文件头），所以任何需要「是不是我」
 * 的判断都只能从消息自身的 sender/recipient 推。单聊只有两个人，于是
 * 「不是本行发送人」就等于「另一个人」，认人不需要目录。</p>
 */
describe('messageSenderLabel', () => {
  const labels = {
    mine: '我',
    peer: '张三',
    unknown: (userId: string) => `用户 #${userId}`,
  };
  /** 群聊没有唯一对端，调用方必须传 null（口径见 MessageSenderLabels 注释）。 */
  const groupLabels = { ...labels, peer: null };

  const incoming = {
    senderUserId: '9',
    recipientUserId: '7',
    chatScope: ChatScope.PRIVATE,
  };
  const mine = {
    senderUserId: '7',
    recipientUserId: '7',
    chatScope: ChatScope.PRIVATE,
  };
  const groupIncoming = { ...incoming, chatScope: ChatScope.GROUP };
  const groupMine = { ...mine, chatScope: ChatScope.GROUP };

  it('单聊里他人消息的发送人就是对端名', () => {
    expect(messageSenderLabel('9', incoming, labels)).toBe('张三');
  });

  it('自己发的那行：发送人是我（写扩散下 recipient 也是自己）', () => {
    expect(messageSenderLabel(mine.senderUserId, mine, labels)).toBe('我');
  });

  it('对方引用了我发的消息：认得出被引用的是「我」，不必知道自己的 ID', () => {
    // 对方的行：sender 是对端，被引用人却是我的雪花 ID —— 单聊里只有两个人，
    // 既然不是本行发送人，那就只能是我
    expect(messageSenderLabel('7', incoming, labels)).toBe('我');
  });

  it('群聊里认不出具体是谁时给 ID，而不是拿群名冒充发送人', () => {
    expect(messageSenderLabel('9', groupIncoming, groupLabels)).toBe('用户 #9');
    // 群聊里别人引用第三人：同样只能给 ID
    expect(messageSenderLabel('8', groupIncoming, groupLabels)).toBe('用户 #8');
  });

  it('群聊里自己引用的那条仍然认得出是我', () => {
    expect(messageSenderLabel('7', groupMine, groupLabels)).toBe('我');
  });

  it('用户 ID 缺失时按本条发送人处理（脏数据不臆造「用户 #」）', () => {
    expect(messageSenderLabel(undefined, incoming, labels)).toBe('张三');
    expect(messageSenderLabel('', groupMine, groupLabels)).toBe('我');
    expect(
      messageSenderLabel(
        undefined,
        { senderUserId: null, recipientUserId: null, chatScope: ChatScope.GROUP },
        groupLabels,
      ),
    ).toBe('');
  });
});
