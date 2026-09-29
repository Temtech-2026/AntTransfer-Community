import { describe, expect, it } from 'vitest';

import {
  type EmojiStorage,
  type MentionCandidate,
  MENTION_CANDIDATE_LIMIT,
  MENTION_QUERY_MAX_LENGTH,
  RECENT_EMOJI_KEY,
  RECENT_EMOJI_LIMIT,
  filterMentionCandidates,
  insertAtCaret,
  insertMention,
  pushMention,
  pushRecentEmoji,
  readRecentEmoji,
  resolveComposerKey,
  resolveMentionTrigger,
  retainActiveMentions,
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

/** 构造一个候选成员，只写用例关心的字段 */
function member(userId: string, displayName: string): MentionCandidate {
  return { userId, displayName };
}

describe('resolveMentionTrigger 提及触发口径', () => {
  it('光标前刚打下的 @ 就是一次选人的开始', () => {
    expect(resolveMentionTrigger('你好 @张', 5)).toEqual({ start: 3, query: '张' });
  });

  it('只认光标之前的最后一个 @（已经 @ 过一个人后又开始 @ 第二个）', () => {
    // 'hi @张三 @李' 里前一个 @ 已经带上了空格与昵称，正在输入的只有后一个
    expect(resolveMentionTrigger('hi @张三 @李', 9)).toEqual({
      start: 7,
      query: '李',
    });
  });

  it('@ 与光标之间出现空白就不再是选人（昵称已写完，用户在接着打字）', () => {
    expect(resolveMentionTrigger('@张三 你好', 6)).toBeNull();
  });

  it('查询词超过上限不再当作选人（否则整段正文都会被拿去过滤）', () => {
    const long = '张'.repeat(MENTION_QUERY_MAX_LENGTH + 1);
    expect(resolveMentionTrigger(`@${long}`, long.length + 1)).toBeNull();
    expect(
      resolveMentionTrigger(`@${long.slice(0, 3)}`, 4),
    ).toEqual({ start: 0, query: '张张张' });
  });

  it('@ 前面紧挨着词字符时是邮箱 / 路径，不触发', () => {
    expect(resolveMentionTrigger('a@b.com', 7)).toBeNull();
    expect(resolveMentionTrigger('user_1@x', 8)).toBeNull();
  });

  it('中文 / 空格 / 行首的 @ 照常触发', () => {
    expect(resolveMentionTrigger('@', 1)).toEqual({ start: 0, query: '' });
    // 全角顿号是中文标点，不是词字符，不该被误判成邮箱
    expect(resolveMentionTrigger('、@张', 3)).toEqual({ start: 1, query: '张' });
  });

  it('没有 @ 时返回 null', () => {
    expect(resolveMentionTrigger('普通正文', 4)).toBeNull();
  });

  it('光标越界要收敛：越界按末尾算，负数当行首（不会切出脏字符）', () => {
    expect(resolveMentionTrigger('@张', 99)).toEqual({ start: 0, query: '张' });
    expect(resolveMentionTrigger('@张', -5)).toBeNull();
  });
});

describe('filterMentionCandidates 候选过滤', () => {
  const candidates = [
    member('1', '张三'),
    member('2', '李四'),
    member('3', 'Alice'),
    member('4', 'zhang san'),
  ];

  it('空查询词（刚敲下 @）返回全部', () => {
    expect(filterMentionCandidates(candidates, '')).toHaveLength(4);
  });

  it('中文用包含匹配：只记得名字里某个字也能找到', () => {
    expect(filterMentionCandidates(candidates, '三').map((item) => item.userId)).toEqual([
      '1',
    ]);
  });

  it('英文大小写不敏感，且支持名字中间的一段', () => {
    expect(
      filterMentionCandidates(candidates, 'ALI').map((item) => item.userId),
    ).toEqual(['3']);
    expect(
      filterMentionCandidates(candidates, 'hang').map((item) => item.userId),
    ).toEqual(['4']);
  });

  it('查询词首尾空白不算内容（输入法可能带上空格）', () => {
    expect(
      filterMentionCandidates(candidates, '  四  ').map((item) => item.userId),
    ).toEqual(['2']);
  });

  it('结果按上限截断：面板一屏放不下的部分让用户多打一个字去缩', () => {
    const many = Array.from({ length: MENTION_CANDIDATE_LIMIT + 3 }, (_, i) =>
      member(String(i), `成员${i}`),
    );
    expect(filterMentionCandidates(many, '')).toHaveLength(MENTION_CANDIDATE_LIMIT);
  });

  it('没有匹配时返回空数组（面板据此给「没有匹配的成员」）', () => {
    expect(filterMentionCandidates(candidates, '王五')).toEqual([]);
  });
});

describe('insertMention 把 @查询词 换成 @昵称 ', () => {
  it('替换区间正好盖住 @ 与查询词，并把光标落在空格之后', () => {
    expect(insertMention('你好 @张', { start: 3, query: '张' }, member('1', '张三'))).toEqual({
      value: '你好 @张三 ',
      caret: 7,
      mention: member('1', '张三'),
    });
  });

  it('@ 后面原本还有别的文字时只替换触发区间（不吞掉后文）', () => {
    // 用户把光标移到句中补 @：'@张' 之后是被框选/被保留的原文
    const result = insertMention('看 @张谢谢', { start: 2, query: '张' }, member('1', '张三'));
    expect(result.value).toBe('看 @张三 谢谢');
  });

  it('末尾补空格：否则接着打字会得到 @张三你好，读的人无法判断昵称到哪结束', () => {
    const result = insertMention('@', { start: 0, query: '' }, member('1', '张三'));
    expect(result.value).toBe('@张三 ');
  });

  it('昵称里的空格原样保留（昵称本身可以含空格）', () => {
    const result = insertMention('@zh', { start: 0, query: 'zh' }, member('1', 'zhang san'));
    expect(result.value).toBe('@zhang san ');
  });
});

describe('pushMention 提及去重', () => {
  it('同一人重复 @ 只保留一条', () => {
    const list = pushMention([member('1', '张三')], member('1', '张三'));
    expect(list).toHaveLength(1);
  });

  it('返回新数组（调用方是 React 状态，必须换引用才重渲染）', () => {
    const list = [member('1', '张三')];
    expect(pushMention(list, member('1', '张三'))).not.toBe(list);
  });

  it('不同的人各自保留', () => {
    const list = pushMention([member('1', '张三')], member('2', '李四'));
    expect(list.map((item) => item.userId)).toEqual(['1', '2']);
  });
});

describe('retainActiveMentions 生效提及靠正文匹配', () => {
  const zhangSan = member('1', '张三');
  const liSi = member('2', '李四');

  it('正文里还留着 @昵称 的保留下来', () => {
    expect(retainActiveMentions('你好 @张三 ', [zhangSan])).toEqual([zhangSan]);
  });

  it('用户把 @昵称 删掉后这条提及随之失效（退格、框选删除都一样）', () => {
    expect(retainActiveMentions('你好 ', [zhangSan])).toEqual([]);
  });

  it('删掉一个人、留着另一个人时只失效被删的那条', () => {
    expect(retainActiveMentions('@李四 收到', [zhangSan, liSi])).toEqual([liSi]);
  });

  it('正文里只剩名字（@ 被删掉）不算生效——服务端认的是被点名，不是重名', () => {
    expect(retainActiveMentions('张三你好', [zhangSan])).toEqual([]);
  });
});
