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
