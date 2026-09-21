import { describe, expect, it } from 'vitest';

import {
  type EmojiStorage,
  RECENT_EMOJI_KEY,
  RECENT_EMOJI_LIMIT,
  insertAtCaret,
  pushRecentEmoji,
  readRecentEmoji,
  resolveComposerKey,
  writeRecentEmoji,
} from './composer';

/** 内存版存储：把「最近使用」的读写从浏览器里摘出来，断言才有落点 */
function createMemoryStorage(
  initial?: string | null,
): EmojiStorage & { dump: () => string | null } {
  let value = initial ?? null;
  return {
    getItem: (_key: string) => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
    dump: () => value,
  };
}

/** 一次「普通回车」的默认形态，各用例只覆盖自己关心的字段 */
const enterKey = {
  key: 'Enter',
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  isComposing: false,
};

describe('resolveComposerKey 按键口径', () => {
  it('回车即发送（微信口径）', () => {
    expect(resolveComposerKey(enterKey)).toBe('send');
  });

  it('Shift + Enter 换行', () => {
    expect(resolveComposerKey({ ...enterKey, shiftKey: true })).toBe('newline');
  });

  it('保留 Ctrl / Cmd + Enter 发送', () => {
    expect(resolveComposerKey({ ...enterKey, ctrlKey: true })).toBe('send');
    expect(resolveComposerKey({ ...enterKey, metaKey: true })).toBe('send');
  });

  it('输入法组合期间的回车归输入法，不发送', () => {
    // Chrome 会给正在组合的 keydown 打上 isComposing
    expect(resolveComposerKey({ ...enterKey, isComposing: true })).toBe('none');
  });

  it('Safari 在 compositionend 之后只剩 keyCode 229 可判，同样不发送', () => {
    expect(resolveComposerKey({ ...enterKey, keyCode: 229 })).toBe('none');
  });

  it('非回车键不处理', () => {
    expect(resolveComposerKey({ ...enterKey, key: 'a' })).toBe('none');
  });
});

describe('insertAtCaret 光标处插入', () => {
  it('插在光标处，光标落到片段之后', () => {
    // 「你好」的光标停在「你」之后
    expect(insertAtCaret('你好', '😀', 1, 1)).toEqual({
      value: '你😀好',
      caret: 3,
    });
  });

  it('有选区时替换选中内容', () => {
    expect(insertAtCaret('abc', 'X', 1, 2)).toEqual({ value: 'aXc', caret: 2 });
  });

  it('反向框选（start > end）也按同一段替换', () => {
    expect(insertAtCaret('abc', 'X', 2, 1)).toEqual({ value: 'aXc', caret: 2 });
  });

  it('没有光标信息时追加到末尾', () => {
    expect(insertAtCaret('abc', 'X')).toEqual({ value: 'abcX', caret: 4 });
  });

  it('越界与非法位置收敛到边界，不产生脏字符', () => {
    expect(insertAtCaret('abc', 'X', 99, 99)).toEqual({
      value: 'abcX',
      caret: 4,
    });
    expect(insertAtCaret('abc', 'X', -5, -5)).toEqual({
      value: 'Xabc',
      caret: 1,
    });
    expect(insertAtCaret('abc', 'X', Number.NaN, Number.NaN)).toEqual({
      value: 'abcX',
      caret: 4,
    });
  });
});

describe('pushRecentEmoji 最近使用', () => {
  it('新表情置顶', () => {
    expect(pushRecentEmoji(['😀', '😁'], '😎')).toEqual(['😎', '😀', '😁']);
  });

  it('重复使用去重并置顶', () => {
    expect(pushRecentEmoji(['😀', '😁'], '😁')).toEqual(['😁', '😀']);
  });

  it('超出上限时截断', () => {
    expect(pushRecentEmoji(['a', 'b'], 'c', 2)).toEqual(['c', 'a']);
  });
});

describe('最近使用的本地存储', () => {
  it('写入后可读回（往返一致）', () => {
    const storage = createMemoryStorage();
    writeRecentEmoji(storage, ['😀', '😁']);
    expect(storage.dump()).toBe(JSON.stringify(['😀', '😁']));
    expect(readRecentEmoji(storage)).toEqual(['😀', '😁']);
    expect(storage.getItem(RECENT_EMOJI_KEY)).not.toBeNull();
  });

  it('没有记录时为空数组', () => {
    expect(readRecentEmoji(createMemoryStorage())).toEqual([]);
  });

  it('坏数据一律当空处理，不让输入框崩掉', () => {
    expect(readRecentEmoji(createMemoryStorage('{oops'))).toEqual([]);
    expect(readRecentEmoji(createMemoryStorage('"😀"'))).toEqual([]);
    expect(readRecentEmoji(createMemoryStorage('[1,"😀",""]'))).toEqual(['😀']);
  });

  it('读取时按上限截断', () => {
    const many = Array.from({ length: RECENT_EMOJI_LIMIT + 5 }, (_, i) =>
      String.fromCharCode(0x1f600 + i),
    );
    expect(readRecentEmoji(createMemoryStorage(JSON.stringify(many)))).toHaveLength(
      RECENT_EMOJI_LIMIT,
    );
  });

  it('存储不可用（隐身模式 / 配额满）时静默放弃，不抛异常', () => {
    const broken: EmojiStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(() => writeRecentEmoji(broken, ['😀'])).not.toThrow();
  });
});
