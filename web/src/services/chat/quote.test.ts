/**
 * 引用草稿的构造口径（{@link toQuoteDraft}）。
 *
 * <p>这层逻辑存在的意义就是「发送前那块预览与最终发出去的东西一致」，
 * 所以用例只钉三件事：<b>带哪个键回传</b>（幂等键，写扩散下唯一跨端一致的定位）、
 * <b>摘要长什么样</b>（与服务端快照同口径：带类型前缀的非文本消息、
 * 剥掉文件尾注的正文）、以及<b>哪些消息根本不该给引用入口</b>。</p>
 */

import { describe, expect, it } from 'vitest';

import {
  ChatScope,
  MessageType,
  type NotifyMessage,
  NotifyType,
  RecallStatus,
} from '@/services/notify';

import { buildFileCardContent } from './fileCard';
import { QUOTE_SUMMARY_MAX, toQuoteDraft } from './quote';

function chatMessage(overrides: Partial<NotifyMessage> = {}): NotifyMessage {
  return {
    id: '20',
    recipientUserId: '9',
    senderUserId: '7',
    notifyType: NotifyType.IM_PRIVATE,
    messageType: MessageType.TEXT,
    chatScope: ChatScope.PRIVATE,
    chatTargetId: '9',
    clientMsgId: 'c-20',
    content: '方案里的时间点要再确认',
    createTime: '2026-09-16T10:00:00',
    ...overrides,
  };
}

describe('toQuoteDraft', () => {
  it('文本消息：回传幂等键，摘要就是正文，发送人展示名由调用方给', () => {
    expect(toQuoteDraft(chatMessage(), '我')).toEqual({
      clientMsgId: 'c-20',
      senderName: '我',
      summary: '方案里的时间点要再确认',
    });
  });

  it('已撤回的不给引用入口：正文已被清空，引用它等于引一条空消息', () => {
    expect(
      toQuoteDraft(
        chatMessage({ recallStatus: RecallStatus.DONE, content: '' }),
        '我',
      ),
    ).toBeNull();
  });

  it('没有幂等键的不给引用入口：服务端取不到快照，发出去也只是一条普通消息', () => {
    expect(toQuoteDraft(chatMessage({ clientMsgId: undefined }), '我')).toBeNull();
  });

  it('长正文截断到上限（引用块是「提示」，不是内容本体）', () => {
    const draft = toQuoteDraft(chatMessage({ content: '长'.repeat(200) }), '我');

    expect(draft?.summary).toHaveLength(QUOTE_SUMMARY_MAX + 1);
    expect(draft?.summary.endsWith('…')).toBe(true);
  });

  it('文件消息：摘要剥掉条目尾注，只留用户看得懂的那句话', () => {
    const draft = toQuoteDraft(
      chatMessage({
        messageType: MessageType.FILE,
        content: `季度报告.pdf${buildFileCardContent('季度报告.pdf', '2.4 MB', '900000000000000011')}`,
      }),
      '张三',
    );

    expect(draft?.senderName).toBe('张三');
    expect(draft?.summary).not.toContain('#file:');
    expect(draft?.summary).toContain('季度报告.pdf');
  });
});
