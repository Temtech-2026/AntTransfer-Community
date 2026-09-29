import { describe, expect, it } from 'vitest';

import {
  EMPTY_UNREAD,
  NotifyType,
  applyInboxCleared,
  applyIncomingMessage,
  formatBadgeCount,
  isChatNotify,
  isInboxNotify,
  isTodoNotify,
  normalizeUnread,
} from './types';

describe('未读口径判定', () => {
  it('会话段只有 6 / 7', () => {
    expect(isChatNotify(NotifyType.IM_PRIVATE)).toBe(true);
    expect(isChatNotify(NotifyType.IM_GROUP)).toBe(true);
    expect(isChatNotify(NotifyType.TRANSFER_COMPLETED)).toBe(false);
  });

  it('待办段为 1 / 2 / 8（含传输完成）', () => {
    expect(isTodoNotify(6)).toBe(false);
    expect(isTodoNotify(1)).toBe(true);
    expect(isTodoNotify(2)).toBe(true);
    expect(isTodoNotify(8)).toBe(true);
  });

  it('红点段 = 非 6/7（含 8，以 SQL 为准而非 isInbox 注释）', () => {
    expect(isInboxNotify(8)).toBe(true);
    expect(isInboxNotify(6)).toBe(false);
    expect(isInboxNotify(7)).toBe(false);
  });

  it('取件回执 9：计入红点，但不进待办、不属于会话', () => {
    // 9 是「有人取走了文件」的正向回执，与 8 同属交付类提醒：该出现在导航栏红点里
    expect(isInboxNotify(NotifyType.SHARE_ACCESSED)).toBe(true);
    // 它不是「等我去处理的事」——进了待办就会变成永远清不掉的噪音
    expect(isTodoNotify(NotifyType.SHARE_ACCESSED)).toBe(false);
    expect(isChatNotify(NotifyType.SHARE_ACCESSED)).toBe(false);
    expect(applyIncomingMessage(EMPTY_UNREAD, NotifyType.SHARE_ACCESSED)).toEqual({
      inbox: 1,
      todo: 0,
      chat: 0,
    });
  });
});

describe('normalizeUnread', () => {
  it('负数 / NaN / 缺失一律归零', () => {
    expect(normalizeUnread({ inbox: -3, todo: Number.NaN, chat: undefined })).toEqual({
      inbox: 0,
      todo: 0,
      chat: 0,
    });
  });

  it('null / undefined 返回零值快照', () => {
    expect(normalizeUnread(null)).toEqual(EMPTY_UNREAD);
    expect(normalizeUnread(undefined)).toEqual(EMPTY_UNREAD);
  });

  it('小数向下取整', () => {
    expect(normalizeUnread({ inbox: 2.9 })).toEqual({ inbox: 2, todo: 0, chat: 0 });
  });
});

describe('applyIncomingMessage（实时增量）', () => {
  it('会话消息只加 chat', () => {
    expect(applyIncomingMessage(EMPTY_UNREAD, NotifyType.IM_PRIVATE)).toEqual({
      inbox: 0,
      todo: 0,
      chat: 1,
    });
  });

  it('系统通知加 inbox，待办段同时加 todo', () => {
    expect(applyIncomingMessage(EMPTY_UNREAD, NotifyType.APPROVAL_TODO)).toEqual({
      inbox: 1,
      todo: 1,
      chat: 0,
    });
    expect(applyIncomingMessage(EMPTY_UNREAD, NotifyType.TRANSFER_COMPLETED)).toEqual({
      inbox: 1,
      todo: 1,
      chat: 0,
    });
    expect(applyIncomingMessage(EMPTY_UNREAD, NotifyType.ABNORMAL_LOGIN)).toEqual({
      inbox: 1,
      todo: 0,
      chat: 0,
    });
  });

  it('脏数据先归零再自增', () => {
    expect(applyIncomingMessage({ inbox: -1, todo: -5, chat: 3 }, NotifyType.IM_GROUP)).toEqual({
      inbox: 0,
      todo: 0,
      chat: 4,
    });
  });
});

describe('applyInboxCleared（一键已读）', () => {
  it('inbox 与 todo 清零、chat 保持不变', () => {
    expect(applyInboxCleared({ inbox: 9, todo: 4, chat: 7 })).toEqual({
      inbox: 0,
      todo: 0,
      chat: 7,
    });
  });
});

describe('formatBadgeCount', () => {
  it('超过上限显示 99+，脏数据按 0', () => {
    expect(formatBadgeCount(5)).toBe('5');
    expect(formatBadgeCount(99)).toBe('99');
    expect(formatBadgeCount(100)).toBe('99+');
    expect(formatBadgeCount(-2)).toBe('0');
  });
});
