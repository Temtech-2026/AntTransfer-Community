import { describe, expect, it } from 'vitest';

import type { NotifyMessage } from '@/services/notify/types';
import type { WsChatReadPayload } from '@/services/ws/protocol';

import { ChatScope } from '@/services/notify/types';
import {
  MAX_READER_AVATARS,
  applyReadReceipt,
  isReceiptOfSession,
  mergeReaders,
  summarizeReaders,
} from './readReceipt';

const ME = '1000000000000000001';
const PEER = '1000000000000000002';
const THIRD = '1000000000000000003';

function message(over: Partial<NotifyMessage> = {}): NotifyMessage {
  return {
    id: '9000000000000000001',
    // 写扩散下「我发的」那一行 recipient 就是我自己（见 isSelfSentMessage 的判定口径）
    senderUserId: ME,
    recipientUserId: ME,
    notifyType: 6,
    chatScope: ChatScope.PRIVATE,
    chatTargetId: PEER,
    clientMsgId: 'c-1',
    content: 'hi',
    ...over,
  };
}

function receipt(over: Partial<WsChatReadPayload> = {}): WsChatReadPayload {
  return {
    chatScope: ChatScope.PRIVATE,
    chatTargetId: PEER,
    reader: { userId: PEER, displayName: '张三' },
    clientMsgIds: ['c-1'],
    ...over,
  };
}

describe('isReceiptOfSession', () => {
  it('scope 与 targetId 都对上才算同一会话', () => {
    expect(
      isReceiptOfSession(receipt(), { chatScope: ChatScope.PRIVATE, targetId: PEER }),
    ).toBe(true);
  });

  it('群聊回执不得套到单聊窗口上', () => {
    expect(
      isReceiptOfSession(receipt({ chatScope: ChatScope.GROUP, chatTargetId: '77' }), {
        chatScope: ChatScope.PRIVATE,
        targetId: PEER,
      }),
    ).toBe(false);
  });

  it('没有打开会话时一律不接受', () => {
    expect(isReceiptOfSession(receipt(), null)).toBe(false);
  });
});

describe('mergeReaders', () => {
  it('首次加入追加到末尾', () => {
    expect(mergeReaders([], { userId: PEER, displayName: '张三' })).toEqual([
      { userId: PEER, displayName: '张三' },
    ]);
  });

  it('同一人重复到达不重复（历史 + 实时两条路径都会带到他）', () => {
    const current = [{ userId: PEER, displayName: '张三' }];

    const merged = mergeReaders(current, { userId: PEER, displayName: '张三' });

    expect(merged).toHaveLength(1);
    // 引用不变：调用方据此判断「没变化」，避免整屏重渲染
    expect(merged).toBe(current);
  });

  it('null 视为空列表', () => {
    expect(mergeReaders(null, { userId: PEER, displayName: '张三' })).toHaveLength(1);
  });
});

describe('applyReadReceipt', () => {
  it('只给 clientMsgIds 命中的消息挂读者', () => {
    const list = [message({ clientMsgId: 'c-1' }), message({ id: '2', clientMsgId: 'c-2' })];

    const next = applyReadReceipt(list, receipt({ clientMsgIds: ['c-1'] }));

    expect(next[0]?.readers).toEqual([{ userId: PEER, displayName: '张三' }]);
    expect(next[1]?.readers).toBeUndefined();
  });

  it('一条消息被多人读时按到达顺序累加', () => {
    const once = applyReadReceipt([message()], receipt());
    const twice = applyReadReceipt(once, receipt({ reader: { userId: THIRD, displayName: '李四' } }));

    expect(twice[0]?.readers?.map((reader) => reader.displayName)).toEqual(['张三', '李四']);
  });

  it('重复帧幂等且返回原数组引用（回执可被重放，不能每次都重渲染）', () => {
    const once = applyReadReceipt([message()], receipt());

    const twice = applyReadReceipt(once, receipt());

    expect(twice).toBe(once);
  });

  it('别人发的消息不挂读者（回执只说明「谁读了我发的」）', () => {
    const list = [message({ senderUserId: PEER })];

    const next = applyReadReceipt(list, receipt());

    expect(next).toBe(list);
    expect(next[0]?.readers).toBeUndefined();
  });

  it('命中幂等键但没有 clientMsgId 的脏行被跳过', () => {
    const list = [message({ clientMsgId: null })];

    expect(applyReadReceipt(list, receipt())).toBe(list);
  });

  it('空 clientMsgIds 直接原样返回', () => {
    const list = [message()];

    expect(applyReadReceipt(list, receipt({ clientMsgIds: [] }))).toBe(list);
  });

  it('保留消息原有字段，只补 readers', () => {
    const next = applyReadReceipt([message({ content: '重要' })], receipt());

    expect(next[0]).toMatchObject({ content: '重要', clientMsgId: 'c-1' });
  });
});

describe('summarizeReaders', () => {
  const many = Array.from({ length: 5 }, (_item, index) => ({
    userId: `u-${index}`,
    displayName: `用户${index}`,
  }));

  it('不超过上限时全部展示且无折叠', () => {
    expect(summarizeReaders(many.slice(0, 2), 3)).toEqual({ shown: many.slice(0, 2), overflow: 0 });
  });

  it('超过上限时截断并给出折叠数', () => {
    const summary = summarizeReaders(many, 3);

    expect(summary.shown).toHaveLength(3);
    expect(summary.overflow).toBe(2);
  });

  it('默认上限为 MAX_READER_AVATARS', () => {
    expect(summarizeReaders(many).shown).toHaveLength(MAX_READER_AVATARS);
  });

  it('空列表与 null 都返回空结果', () => {
    expect(summarizeReaders(null)).toEqual({ shown: [], overflow: 0 });
    expect(summarizeReaders([])).toEqual({ shown: [], overflow: 0 });
  });

  it('上限为 0（窄容器）时全部折叠，不丢人数', () => {
    expect(summarizeReaders(many, 0)).toEqual({ shown: [], overflow: 5 });
  });
});
