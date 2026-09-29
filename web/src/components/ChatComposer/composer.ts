/**
 * 聊天输入框的纯逻辑（无 React、无副作用），单独成文件是为了可单测。
 *
 * <p>三件事看着简单，但都是「错了才在中文输入法下偶发」的类型：</p>
 * <ol>
 *   <li><b>回车发送必须让开输入法。</b>用中文拼音打字时，回车是「确认候选词」。
 *       浏览器的行为并不统一：Chrome 在组合期间派发的 keydown 带
 *       {@code isComposing === true}；而 Safari 会先派发 {@code compositionend}
 *       再派发 keydown，此时 {@code isComposing} 已经是 false，只剩
 *       {@code keyCode === 229} 这个历史遗留信号可以判定。两个信号都得认，
 *       否则用户在选词时按下回车，半截拼音就被当消息发出去了。</li>
 *   <li><b>表情必须插在光标处，而不是追加到末尾。</b>用户习惯是「写到一半挑个表情」，
 *       追加会打乱语序。选区被反向框选时 {@code selectionStart > selectionEnd}，
 *       越界值也要收敛，否则 {@code slice} 会静默切出脏字符。</li>
 *   <li><b>最近使用要按「用过即置顶」去重。</b>同一个表情连续用两次不该在列表里出现两项。</li>
 *   <li><b>{@code @} 提及要能判断「用户是不是真的在选人」。</b>正文里出现 {@code @} 的理由很多
 *       ——邮箱、路径、随手打的 {@code @}——把它们都当成提及触发，会让候选面板在用户
 *       写邮箱时反复弹出来。判定规则见 {@link resolveMentionTrigger}。</li>
 * </ol>
 */

/** 触发发送 / 换行 / 不处理的键盘动作判定结果。 */
export type ComposerKeyAction = 'send' | 'newline' | 'none';

/**
 * 判定输入框上的按键该做什么。
 *
 * <p>口径（对齐微信桌面版）：<b>Enter 发送，Shift + Enter 换行</b>；
 * 额外保留 Ctrl / Cmd + Enter 发送，照顾旧习惯与多行编辑器用户。</p>
 */
export function resolveComposerKey(event: {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  /** {@code KeyboardEvent.isComposing}：输入法组合中。 */
  isComposing: boolean;
  /**
   * {@code KeyboardEvent.keyCode}：Safari 在组合结束时 {@code isComposing} 已为 false，
   * 只有 229 这个哨兵值能表明「这次回车属于输入法」。
   */
  keyCode?: number;
}): ComposerKeyAction {
  if (event.key !== 'Enter') {
    return 'none';
  }
  if (event.isComposing || event.keyCode === 229) {
    // 输入法正在选词：这一下回车归输入法，不归发送
    return 'none';
  }
  if (event.shiftKey) {
    return 'newline';
  }
  return 'send';
}

/** {@link insertAtCaret} 的结果。 */
export interface InsertAtCaretResult {
  /** 插入后的完整文本。 */
  value: string;
  /** 插入后光标应落在的位置（插入片段之后）。 */
  caret: number;
}

/**
 * 把 {@link insert} 插入到 {@link value} 的指定选区处，返回新文本与光标位置。
 *
 * @param value  原文本
 * @param insert 待插入片段（表情 / 符号）
 * @param start  选区起点；缺省或越界时退化为末尾
 * @param end    选区终点；缺省取 `start`，反选（`end < start`）时两者自动对调
 */
export function insertAtCaret(
  value: string,
  insert: string,
  start?: number,
  end?: number,
): InsertAtCaretResult {
  const length = value.length;
  const clamp = (position: number) =>
    Math.min(Math.max(Number.isFinite(position) ? position : length, 0), length);

  const rawStart = start == null ? length : clamp(start);
  const rawEnd = end == null ? rawStart : clamp(end);
  const from = Math.min(rawStart, rawEnd);
  const to = Math.max(rawStart, rawEnd);

  return {
    value: `${value.slice(0, from)}${insert}${value.slice(to)}`,
    caret: from + insert.length,
  };
}

/** 「最近使用」保留的条数上限（够用即可，不占用太多首屏）。 */
export const RECENT_EMOJI_LIMIT = 16;

/** 「最近使用」的存储键。登录态里没有可信用户主键，故不做按人隔离。 */
export const RECENT_EMOJI_KEY = 'anttransfer:chat:recent-emoji';

/**
 * 把刚用过的表情置顶。
 *
 * <p>已存在时先移除再插入，保证「最近」列表里不出现重复项，且顺序就是使用顺序。</p>
 */
export function pushRecentEmoji(
  list: readonly string[],
  emoji: string,
  limit: number = RECENT_EMOJI_LIMIT,
): string[] {
  const next = [emoji, ...list.filter((item) => item !== emoji)];
  return next.slice(0, limit);
}

/** 可读的存储接口：只用到 `getItem` / `setItem`，便于测试注入假实现。 */
export interface EmojiStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

/**
 * 读取「最近使用」。
 *
 * <p>坏数据（非 JSON、非字符串数组、含空串）一律当空处理——这只是个便利功能，
 * 解析失败不该让输入框崩掉。</p>
 */
export function readRecentEmoji(storage: EmojiStorage): string[] {
  try {
    const raw = storage.getItem(RECENT_EMOJI_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is string => typeof item === 'string' && item !== '')
      .slice(0, RECENT_EMOJI_LIMIT);
  } catch {
    return [];
  }
}

/** 写入「最近使用」；存储不可用（隐身模式 / 配额满）时静默放弃。 */
export function writeRecentEmoji(storage: EmojiStorage, list: readonly string[]): void {
  try {
    storage.setItem(RECENT_EMOJI_KEY, JSON.stringify(list.slice(0, RECENT_EMOJI_LIMIT)));
  } catch {
    // 存不下就当作没有「最近使用」，不影响发消息
  }
}

/* ============================ @ 提及 ============================ */

/**
 * 可 {@code @} 的候选成员。
 *
 * <p>与 `ChatGroupMember` 保持「字段少而稳」的差别：输入框只需要「选谁」与「显示什么」，
 * 不关心成员的角色、加入时间。把成员对象直接透传进来会让这个组件与群成员契约一起漂移。</p>
 */
export interface MentionCandidate {
  /** 用户 ID。<b>一律字符串</b>——19 位雪花 ID 超出 JS 安全整数范围，转数字即丢精度。 */
  userId: string;
  /** 展示名（与消息气泡上的昵称同源）。 */
  displayName: string;
  /** 头像地址；可空。 */
  avatarUrl?: string | null;
}

/** 正在输入中的 `@` 查询词。 */
export interface MentionTrigger {
  /** {@code @} 在正文中的下标。 */
  start: number;
  /** {@code @} 与光标之间的查询词；空串表示刚敲下 {@code @}。 */
  query: string;
}

/** `@` 查询词长度上限：超过它就不再当作「正在选人」，避免整段正文被当成查询词。 */
export const MENTION_QUERY_MAX_LENGTH = 20;

/** 候选面板一次最多展示的人数。再多也划不动，不如让用户多打一个字缩小范围。 */
export const MENTION_CANDIDATE_LIMIT = 8;

/**
 * 从光标位置解析出「正在输入中的 {@code @} 查询词」，没有则返回 `null`。
 *
 * <p><b>只认光标<b>之前</b>最后一个 {@code @}</b>：用户可能先打了半句话再回头补 {@code @}，
 * 也可能已经 @ 过一个人、现在正在 @ 第二个——只有光标前那一个才是「当前这次选人」。</p>
 *
 * <p><b>三种情况下不触发</b>（否则会在完全无关的输入里弹出候选面板）：</p>
 * <ol>
 *   <li>{@code @} 与光标之间已经出现空白——用户已经把昵称写完并继续打字了；</li>
 *   <li>查询词长到 20 字以上——正文里出现这么长的「@ 后面接一串字」几乎不可能是选人；</li>
 *   <li>{@code @} 前面紧挨着词字符（字母 / 数字 / 下划线）——那是邮箱 {@code a@b.com}
 *       或路径，不是提及。中文昵称前不会出现这种情况，所以按 ASCII 词字符判定即可。</li>
 * </ol>
 *
 * @param value 输入框当前全文
 * @param caret 光标位置（{@code selectionStart}）
 * @param maxQueryLength 查询词长度上限
 */
export function resolveMentionTrigger(
  value: string,
  caret: number,
  maxQueryLength: number = MENTION_QUERY_MAX_LENGTH,
): MentionTrigger | null {
  const length = value.length;
  const safeCaret = Math.min(
    Math.max(Number.isFinite(caret) ? caret : length, 0),
    length,
  );
  const before = value.slice(0, safeCaret);
  const at = before.lastIndexOf('@');
  if (at < 0) {
    return null;
  }
  const query = before.slice(at + 1);
  if (query.length > maxQueryLength || /\s/.test(query)) {
    return null;
  }
  const prev = at > 0 ? before.charAt(at - 1) : '';
  if (prev !== '' && /[0-9A-Za-z_]/.test(prev)) {
    return null;
  }
  return { start: at, query };
}

/**
 * 按查询词过滤候选成员。
 *
 * <p>大小写不敏感的前缀 + 包含匹配：昵称多为中文，前缀匹配对中文没有意义，
 * 而包含匹配能覆盖「只记得名字里某个字」的常见情形。空查询词返回全部（截断）。</p>
 */
export function filterMentionCandidates(
  candidates: readonly MentionCandidate[],
  query: string,
  limit: number = MENTION_CANDIDATE_LIMIT,
): MentionCandidate[] {
  const keyword = query.trim().toLowerCase();
  const matched =
    keyword === ''
      ? [...candidates]
      : candidates.filter((item) => item.displayName.toLowerCase().includes(keyword));
  return matched.slice(0, limit);
}

/** {@link insertMention} 的结果。 */
export interface MentionInsertResult {
  /** 插入后的完整文本。 */
  value: string;
  /** 插入后光标应落的位置（`@昵称 ` 之后）。 */
  caret: number;
  /** 本次插入的提及对象。 */
  mention: MentionCandidate;
}

/**
 * 把 {@link trigger} 对应的 `@查询词` 原位替换为 `@昵称 `。
 *
 * <p>末尾补一个空格是刻意的：不补的话用户接着打字会得到 `@张三你好`，
 * 服务端与阅读者都无法把它和昵称本身区分开（昵称里可以含中文），
 * 而且这个空格也是「本次选人已结束」的信号——下一次输入不会再把 `@张三` 当查询词。</p>
 *
 * <p>替换区间取 `[trigger.start, trigger.start + 1 + query.length)`，即正好盖住
 * `@` 与查询词。之所以不依赖传入的光标位置，是因为该区间末端本就等于光标
 * （query 正是从 {@code @} 到光标的那一段），少传一个参数就少一处可能不一致的状态。</p>
 */
export function insertMention(
  value: string,
  trigger: MentionTrigger,
  member: MentionCandidate,
): MentionInsertResult {
  const inserted = `@${member.displayName} `;
  const result = insertAtCaret(
    value,
    inserted,
    trigger.start,
    trigger.start + 1 + trigger.query.length,
  );
  return { value: result.value, caret: result.caret, mention: member };
}

/**
 * 追加一条提及（同一人重复 @ 时只保留一条）。
 *
 * <p>返回新数组而非原地 push：调用方是 React 状态，必须换引用才触发重渲染。</p>
 */
export function pushMention(
  list: readonly MentionCandidate[],
  member: MentionCandidate,
): MentionCandidate[] {
  return list.some((item) => item.userId === member.userId)
    ? [...list]
    : [...list, member];
}

/**
 * 过滤出「正文里仍然保留着」的提及。
 *
 * <p><b>为什么靠正文匹配而不是精确跟踪插入区间：</b>用户删掉 `@昵称` 的方式太多——
 * 退格、框选删除、全选重写、粘贴覆盖——任何基于「记住插入位置」的方案都会在某一种
 * 编辑方式下失效，而失效的后果是「点了发送却没人被 @」。正文匹配对所有这些方式都不敏感。</p>
 *
 * <p><b>代价是它偏保守</b>：若用户删掉了 `@张三` 却另打了一模一样的文本，这条提及仍会被
 * 保留。方向上是可接受的——多一个提及最坏只是让某人多看到一次「@我」高亮，
 * 而少一个提及就是「@了但对方完全不知道」，后者是本功能存在的意义所在。
 * 服务端还会再做一次成员交集校验兜底。</p>
 */
export function retainActiveMentions(
  value: string,
  mentions: readonly MentionCandidate[],
): MentionCandidate[] {
  return mentions.filter((item) => value.includes(`@${item.displayName}`));
}
