/**
 * 微信式消息输入框：**发送按钮在框内**，并内置表情面板。
 *
 * <p>为什么要把两个聊天入口（`/chat` 页与即时通讯抽屉）的输入框并成一个组件：
 * 同一件事在两处各写一遍，行为漂移只是时间问题——抽屉原本是「回车发送」、
 * 页面原本是「Ctrl + Enter 发送」，用户来回切换时手感是断的。这里统一成
 * **Enter 发送 / Shift + Enter 换行**（微信口径），判定规则与输入法处理见
 * {@link resolveComposerKey}。</p>
 *
 * <p>布局对齐微信：输入框是一整个带边框的盒子，正文占上半部分，
 * 下半部分是一行工具栏（左侧表情入口、右侧发送按钮）——发送按钮因此是
 * 「在输入框里」而不是并排在外面。表情面板从盒子下方展开，分类页签放在底部。</p>
 *
 * <p>表情面板不依赖任何第三方库：正文是纯文本，表情就是 Unicode 字符，
 * 长度口径与后端 {@code @Size(max = 1000)} 完全一致（详见 ./emoji.ts 的文件头说明）。</p>
 *
 * <p><b>{@code @} 提及只在群聊启用</b>（由调用方传 {@link ChatComposerProps.mentionables} 决定，
 * 单聊不传即无此入口）：输入 {@code @} 或点工具栏的 {@code @} 按钮弹出成员候选，
 * 选中后往正文里插入 {@code @昵称 }，并把该成员的 ID 通过
 * {@link ChatComposerProps.onMentionChange} 报给调用方，由调用方在发送时随消息带上。
 * 正文里写的 {@code @昵称} 是给人看的，ID 列表才是服务端用来给被点名者打标记的依据
 * （理由见 ./composer.ts 的 {@link insertMention}）。</p>
 *
 * <p><b>提及只在正文里留痕、不进入任何本地状态机</b>：哪些 {@code @} 仍然有效，
 * 完全由「{@code @昵称} 这段文本还在不在正文里」决定（
 * {@link retainActiveMentions}），组件本身不记录插入位置——用户删掉它的方式太多，
 * 记住位置的方案总有一种编辑方式会失效。</p>
 */

import {
  ClockCircleOutlined,
  SendOutlined,
  SmileOutlined,
} from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Button, Input, Tooltip } from 'antd';
import { createStyles } from 'antd-style';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  buildMentionCandidates,
  EMPTY_MENTION_SELECTION,
  type EmojiStorage,
  insertAtCaret,
  insertMention,
  type MentionCandidate,
  type MentionSelection,
  type MentionTrigger,
  mentionAllCandidate,
  pushMention,
  pushRecentEmoji,
  readRecentEmoji,
  resolveComposerKey,
  resolveMentionTrigger,
  retainActiveMentions,
  toMentionSelection,
  writeRecentEmoji,
} from './composer';
import { EMOJI_GROUPS, type EmojiGroup } from './emoji';
import MentionPanel from './MentionPanel';

/** 「最近使用」分组在页签里的键（与静态分组区分开）。 */
const RECENT_GROUP_KEY = 'recent';

const useStyles = createStyles(({ token }) => ({
  /** 整个输入区（含上方的附件条 / 提示）：负责与消息流之间的分隔线。 */
  root: {
    padding: '12px 20px',
    borderTop: `1px solid ${token.colorSplit}`,
  },

  /** 窄容器（抽屉）用的紧凑内边距——写法与聊天页的选中项一致：同类名追加覆盖。 */
  rootCompact: {
    padding: '10px 12px',
  },

  /**
   * 无外壳（弹窗里内嵌使用）：输入区自身不带内边距与上分隔线。
   *
   * <p>「发起会话」弹窗的外层已有 Modal 的内边距，再叠一份 20px 水平内边距会把输入框挤窄，
   * 顶上那道 `borderTop` 更是凭空多出一横（它本意是分隔「消息流」与「输入区」，
   * 弹窗里并没有消息流）。与 {@link rootCompact} 同样是「同类名追加覆盖」。</p>
   */
  rootBare: {
    padding: 0,
    borderTop: 'none',
  },

  /** 微信式输入框本体：边框盒子包住正文 + 工具栏。 */
  box: {
    border: `1px solid ${token.colorBorder}`,
    borderRadius: token.borderRadiusLG,
    background: token.colorBgContainer,
    transition: 'border-color 0.2s, box-shadow 0.2s',
    '&:focus-within': {
      borderColor: token.colorPrimaryBorder,
      boxShadow: `0 0 0 2px ${token.colorPrimaryBg}`,
    },
  },

  /** 正文：无自身的边框与内边距（`variant="borderless"`），由外层盒子统一承载。 */
  textarea: {
    padding: '8px 12px 0',
    background: 'transparent',
    '& textarea': {
      fontSize: token.fontSize,
      lineHeight: 1.6,
    },
  },

  /** 工具栏（框内下沿）：左表情、右发送。 */
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '2px 8px 6px',
  },

  /** 工具栏左侧的工具簇：表情按钮与附加入口（文件等）并排，右侧仍只留发送。 */
  tools: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },

  /** 表情面板：从输入框下方展开，高度固定以免撑高整页。 */
  panel: {
    marginTop: 8,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    background: token.colorBgElevated,
    boxShadow: token.boxShadowTertiary,
  },

  /**
   * 表情网格：高度随视口收敛。
   *
   * <p>写死 196px 时，聊天页那种「固定高度外壳 + 流内展开」的容器里，
   * 面板会把消息流挤到几乎为零（外壳本身只有 calc(100vh - 260px)），
   * 观感上就是表情区占满整个聊天区域。用 min() 给一个视口相关上限：
   * 高屏仍取满 196px，矮屏（笔记本投屏、分屏）自动让步给消息流。</p>
   */
  grid: {
    display: 'grid',
    height: 'min(196px, 26vh)',
    gridTemplateColumns: 'repeat(auto-fill, minmax(32px, 1fr))',
    gap: 2,
    padding: 8,
    overflowY: 'auto',
  },

  emojiButton: {
    height: 32,
    border: 'none',
    background: 'transparent',
    fontSize: 20,
    lineHeight: 1,
    borderRadius: token.borderRadiusSM,
    cursor: 'pointer',
    '&:hover': {
      background: token.colorFillTertiary,
    },
  },

  /**
   * {@code @} 入口按钮。
   *
   * <p>{@code @ant-design/icons} 里没有 {@code At} 图标，用文字 {@code @} 而不是找个
   * 「大概像」的图标顶替：提及的语义符号就是 {@code @} 本身，用户一眼能对上，
   * 换成人形 / 团队图标反而要靠猜（图标的可访问名还得另写一遍）。</p>
   */
  mentionButton: {
    height: 32,
    minWidth: 32,
    padding: 0,
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1,
  },

  /** 分类页签（微信把分类放在面板底部）。 */
  tabs: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: '6px 8px',
    borderTop: `1px solid ${token.colorSplit}`,
  },

  tab: {
    display: 'inline-flex',
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    fontSize: 16,
    lineHeight: 1,
    borderRadius: token.borderRadiusSM,
    cursor: 'pointer',
    opacity: 0.65,
    '&:hover': {
      background: token.colorFillTertiary,
      opacity: 1,
    },
  },

  tabActive: {
    background: token.colorFillSecondary,
    opacity: 1,
  },
}));

/**
 * 提及选择的比较签名：`userIds` 顺序敏感（顺序即插入顺序），`mentionAll` 单独一维。
 *
 * <p>抽成函数而不是在两处各拼一次字符串：初值必须与「空选择」的签名完全一致，
 * 否则组件挂载时就会凭空上报一次空提及，让父组件白渲染一轮
 * （见 {@link EMPTY_MENTION_SELECTION}）。</p>
 */
function mentionSignature(selection: MentionSelection): string {
  return `${selection.userIds.join(',')}|${selection.mentionAll}`;
}

/** 取 `localStorage`；隐身模式等场景下访问会抛异常，此时退化为「没有最近使用」。 */
function useEmojiStorage(): EmojiStorage | null {
  return useMemo(() => {
    try {
      const storage = window.localStorage;
      // 探一次读写：部分浏览器仅私有模式下 getItem 才抛错
      storage.getItem('anttransfer:probe');
      return storage;
    } catch {
      return null;
    }
  }, []);
}

export interface ChatComposerProps {
  /** 当前正文（受控）。 */
  value: string;
  onChange: (next: string) => void;
  /** 点发送或按 Enter：由调用方决定是否发得出去（空正文、无会话等由调用方兜底提示）。 */
  onSend: () => void;
  /** 发送中：按钮转圈，且不再响应 Enter。 */
  sending?: boolean;
  disabled?: boolean;
  /** 允许「正文为空但带附件」发送（抽屉的文件消息）。 */
  allowEmpty?: boolean;
  /** 正文长度上限（与后端 {@code ChatSendDTO.content} 对齐）。 */
  maxLength?: number;
  showCount?: boolean;
  /** 固定行数（与 `autoSize` 二选一）。 */
  rows?: number;
  autoSize?: { minRows: number; maxRows: number };
  placeholder: string;
  /** 发送按钮文案（页与抽屉各自的键）。 */
  sendLabel: string;
  /** 输入框上方的附加内容：待发文件条 / 拖拽提示（两个入口传同一个组件）。 */
  header?: ReactNode;
  /**
   * 工具栏左侧的附加入口（如文件传输），排在表情按钮之后。
   *
   * <p>做成插槽而不是在输入框里内联：输入框只管「怎么输入与怎么发出去」，
   * 「能发什么东西」是调用方的业务（页与抽屉同用 `ChatAttachmentPicker`）。
   * 放在框内工具栏而不是框外，是为了对齐微信的手感——入口与发送按钮同属输入框。</p>
   */
  tools?: ReactNode;
  /**
   * 可 {@code @} 的成员（群聊传入；单聊 / 不传 = 不启用提及入口）。
   *
   * <p>由调用方传入而不是组件自己去拉：「谁是本会话可点名的人」属会话上下文，
   * 调用方（聊天页 / 抽屉）本就持有群成员；组件再拉一次会出现
   * 「输入框的名单比页面标题晚一拍」这类不一致。空数组与不传等价。</p>
   */
  mentionables?: readonly MentionCandidate[];
  /**
   * 「{@code @}所有人」候选的展示名（已翻译，如「所有人」）。
   *
   * <p>不传 = 本会话不提供 {@code @}所有人（单聊，或服务端下发的能力里
   * {@code canMentionAll} 为 false，即当前用户不是群主）。
   * <b>是否显示只是体验层</b>：真正的门槛在服务端（越权会得 1042），
   * 前端据此显隐是为了让非群主不必点一个必然失败的选项，而不是把权限判断搬到前端。</p>
   */
  mentionAllLabel?: string;
  /**
   * 当前生效的提及变化时回调（被点名的用户 ID 列表 + 是否 {@code @}所有人），
   * 调用方在发送时随消息带上。
   *
   * <p><b>调用方请用稳定引用</b>（{@code useCallback}）：正文每次变化都会重算生效提及，
   * 内联箭头函数会让这个回调在父组件每次渲染时换引用。组件内部已用 ref 兜住
   * 「回调换了引用就重算」的循环，但入参抖动仍会让父组件自己的依赖数组失去意义。</p>
   *
   * <p>不传 = 调用方不关心提及（如只读预览）；此时正文照样可以写 {@code @昵称}，
   * 只是不会有人被真正点名。</p>
   *
   * <p>「点名了谁」与「{@code @}所有人」在同一个对象里上报，因为它们在消息上是同一条记录的两个字段：
   * 分成两个回调就可能出现「一半新一半旧」的中间状态被发出去（见 {@code MentionSelection}）。</p>
   */
  onMentionChange?: (selection: MentionSelection) => void;
  /** 窄容器（即时通讯抽屉）用紧凑内边距。 */
  compact?: boolean;
  /** 无外壳（弹窗里内嵌使用）：去掉输入区自身的内边距与上分隔线。 */
  bare?: boolean;
}

/**
 * 微信式消息输入框。
 *
 * <p>光标位置必须自己记：表情按钮一按，焦点就从 textarea 挪走了，
 * 而受控输入框在重渲染后会丢掉选区。这里在选中 / 聚焦时把 caret 存进 ref，
 * 插入表情后再把光标落回插入点之后（见 ./composer.ts 的 insertAtCaret）。</p>
 */
const ChatComposer = ({
  value,
  onChange,
  onSend,
  sending = false,
  disabled = false,
  allowEmpty = false,
  maxLength,
  showCount,
  rows,
  autoSize,
  placeholder,
  sendLabel,
  header,
  tools,
  mentionables,
  mentionAllLabel,
  onMentionChange,
  compact = false,
  bare = false,
}: ChatComposerProps) => {
  const intl = useIntl();
  const { styles } = useStyles();
  const storage = useEmojiStorage();

  const [panelOpen, setPanelOpen] = useState(false);
  const [recent, setRecent] = useState<readonly string[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>(EMOJI_GROUPS[0].key);

  /**
   * 有候选成员才启用 {@code @}：单聊没有「点名」语义，
   * 给它一个永远弹不出人的入口只会让用户以为功能坏了。
   */
  const mentionEnabled = (mentionables?.length ?? 0) > 0;
  /** 当前正在输入中的 `@` 查询词；`null` = 候选面板未打开。 */
  const [mentionTrigger, setMentionTrigger] = useState<MentionTrigger | null>(
    null,
  );
  /** 候选面板的高亮项（鼠标悬停与上下键共用同一个「当前项」）。 */
  const [mentionIndex, setMentionIndex] = useState(0);
  /** 已确认插入、且正文里仍然留着的提及。 */
  const [mentions, setMentions] = useState<readonly MentionCandidate[]>([]);

  const domRef = useRef<HTMLTextAreaElement | null>(null);
  const caretRef = useRef<{ start: number; end: number } | null>(null);
  /** 整个输入区的根节点：用来判定「点的是面板外面」。 */
  const rootRef = useRef<HTMLDivElement | null>(null);
  /**
   * {@code onMentionChange} 经 ref 调用：回调若来自内联箭头函数，每次父渲染都会换引用，
   * 直接写进 effect 依赖会让「上报提及」在父组件每次渲染时重跑，
   * 而它又要 setState 到父组件——那就是一个渲染环。ref 让 effect 只依赖提及本身。
   */
  const mentionChangeRef = useRef(onMentionChange);
  mentionChangeRef.current = onMentionChange;
  /**
   * 上一次上报过的选择签名：内容没变就不上报，免得父组件白渲染一次。
   *
   * <p>初值取「空选择」的签名而不是空串：挂载时本来就没有任何提及，
   * 拿空串当基准会把「无提及」当成一次变化，凭空上报一轮。</p>
   */
  const reportedMentionsRef = useRef(mentionSignature(EMPTY_MENTION_SELECTION));

  /** 同一页可能有多处输入框（页 + 抽屉），面板与页签的关联 id 必须唯一。 */
  const panelId = useId();

  /** 记住光标：受控输入框不会告诉我们 caret 在哪，只能从原始 DOM 事件里抓。 */
  const rememberCaret = (element: EventTarget | null) => {
    if (!(element instanceof HTMLTextAreaElement)) {
      return;
    }
    domRef.current = element;
    caretRef.current = {
      start: element.selectionStart ?? element.value.length,
      end: element.selectionEnd ?? element.value.length,
    };
  };

  const togglePanel = useCallback(() => {
    // 表情面板与提及候选共用输入框下方这块位置：开一个必须收另一个，否则会叠在一起
    setMentionTrigger(null);
    setPanelOpen((open) => {
      if (open) {
        return false;
      }
      if (storage) {
        // 只在打开时读一次：这是便利功能，晚一拍不影响体验
        setRecent(readRecentEmoji(storage));
      }
      return true;
    });
  }, [storage]);

  /* ------------------------------- @ 提及 ------------------------------- */

  /**
   * 「@所有人」伪候选。
   *
   * <p>它不属于 {@code mentionables}（那不是一个人，没有 ID 也没有头像），
   * 但必须出现在同一份候选列表里，才能共用「上下键 / 回车 / 查询词过滤」这一整套选择交互；
   * 用哨兵 ID 混进去、再在出口处剔除，比给面板单开一套键盘逻辑要可靠得多
   * （两套逻辑迟早会在「输入法组合期让行」这类细节上分叉）。</p>
   */
  const mentionAllOption = useMemo(
    () => (mentionAllLabel ? mentionAllCandidate(mentionAllLabel) : null),
    [mentionAllLabel],
  );

  /** 候选：只在面板打开时按查询词过滤（面板没开时算出来也没有消费者）。 */
  const mentionCandidates = useMemo(
    () =>
      mentionTrigger
        ? buildMentionCandidates({
            members: mentionables ?? [],
            query: mentionTrigger.query,
            mentionAll: mentionAllOption,
          })
        : [],
    [mentionables, mentionAllOption, mentionTrigger],
  );

  /**
   * 同步 `@` 触发上下文，且**只在内容真的变化时才 setState**。
   *
   * <p>它在每次按键（{@code onKeyUp}）后都会被调用：方向键、Home/End 都会移动光标，
   * 而「光标前有没有正在输入的 {@code @}」正是由光标位置决定的。若每次按键都写入一个
   * 新对象，按一下方向键就会重渲染一次整个输入框。</p>
   */
  const syncMentionTrigger = useCallback(
    (text: string, caret: number) => {
      if (!mentionEnabled) {
        return;
      }
      setMentionTrigger((prev) => {
        const next = resolveMentionTrigger(text, caret);
        if (prev === null && next === null) {
          return prev;
        }
        if (
          prev !== null &&
          next !== null &&
          prev.start === next.start &&
          prev.query === next.query
        ) {
          return prev;
        }
        return next;
      });
      // 查询词变了，高亮项回到第一个（值本已是 0 时 React 会自行跳过这次重渲染）
      setMentionIndex(0);
    },
    [mentionEnabled],
  );

  /** 把光标落回指定位置：受控输入框重渲染后会丢选区，只能等 DOM 落地再自己设。 */
  const focusCaret = useCallback((caret: number) => {
    window.requestAnimationFrame(() => {
      const dom = domRef.current;
      if (!dom) {
        return;
      }
      dom.focus();
      dom.setSelectionRange(caret, caret);
    });
  }, []);

  /**
   * 选中候选成员：把 `@查询词` 就地换成 `@昵称 `，并记下这条提及。
   *
   * <p>插入后立刻收起面板——用户选完人就该继续打字，面板再杵着只会挡住消息流。</p>
   */
  const handlePickMention = useCallback(
    (member: MentionCandidate) => {
      if (!mentionTrigger) {
        return;
      }
      const next = insertMention(value, mentionTrigger, member);
      onChange(next.value);
      setMentions((prev) => pushMention(prev, next.mention));
      setMentionTrigger(null);
      caretRef.current = { start: next.caret, end: next.caret };
      focusCaret(next.caret);
    },
    [focusCaret, mentionTrigger, onChange, value],
  );

  /**
   * 点工具栏的 {@code @}：在光标处插入一个 `@` 并把候选面板打开。
   *
   * <p>不直接弹出「全部成员」列表，而是先落下 `@` 字符——这样按钮与「用户自己敲 @」
   * 走的是完全同一条路径（同一个触发解析、同一个过滤），不必为按钮单开一套状态。</p>
   */
  const handleOpenMention = useCallback(() => {
    if (mentionTrigger) {
      setMentionTrigger(null);
      return;
    }
    setPanelOpen(false);
    const { start } = caretRef.current ?? {};
    const at = start ?? value.length;
    const next = insertAtCaret(value, '@', at, at);
    onChange(next.value);
    caretRef.current = { start: next.caret, end: next.caret };
    setMentionTrigger({ start: at, query: '' });
    setMentionIndex(0);
    focusCaret(next.caret);
  }, [focusCaret, mentionTrigger, onChange, value]);

  /**
   * 正文变化后剔除「已经被删掉」的提及。
   *
   * <p>没有变化时返回原数组引用，避免「每敲一个字就多一次重渲染」。</p>
   */
  useEffect(() => {
    if (!mentionEnabled) {
      return;
    }
    setMentions((prev) => {
      const active = retainActiveMentions(value, prev);
      return active.length === prev.length ? prev : active;
    });
  }, [mentionEnabled, value]);

  /** 把生效提及报给调用方（它会在发送时随消息带上）。内容没变就不上报。 */
  useEffect(() => {
    if (!mentionEnabled) {
      return;
    }
    // 哨兵在此剔除：发送侧拿到的是「真实用户 ID + 是否全群」两个正交字段
    const selection = toMentionSelection(mentions);
    // 签名必须带上 mentionAll：否则「只加/只去 @所有人」时 userIds 不变，
    // 会被当成「内容没变」而不上报，发送出去的就是上一次的全群标记
    const signature = mentionSignature(selection);
    if (signature === reportedMentionsRef.current) {
      return;
    }
    reportedMentionsRef.current = signature;
    mentionChangeRef.current?.(selection);
  }, [mentionEnabled, mentions]);

  /**
   * 面板收起的两条「不用找按钮」的路子：点面板外面、按 Esc。
   *
   * <p>此前只有「再点一次表情按钮」能收——面板占着消息流的位置，用户第一反应
   * 是点旁边的聊天区或按 Esc，结果面板纹丝不动，才像是「退不下去」。
   * 监听只在面板打开期间挂载，收起即卸载，不给整页留常驻监听。</p>
   *
   * <p>Esc 走 document 而不是输入框：面板打开时焦点未必在 textarea 上
   * （用户可能刚点过分类页签），挂在输入框上的那份会漏掉。</p>
   */
  useEffect(() => {
    if (!panelOpen && mentionTrigger === null) {
      return undefined;
    }
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const root = rootRef.current;
      const target = event.target;
      // 面板、表情按钮、输入框都在根节点内：命中就不算「点外面」
      if (root && target instanceof Node && root.contains(target)) {
        return;
      }
      setPanelOpen(false);
      setMentionTrigger(null);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPanelOpen(false);
        setMentionTrigger(null);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [mentionTrigger, panelOpen]);

  /** 「最近使用」置顶后写入本地，下次打开直接可用。 */
  const rememberEmoji = useCallback(
    (emoji: string) => {
      setRecent((prev) => {
        const next = pushRecentEmoji(prev, emoji);
        if (storage) {
          writeRecentEmoji(storage, next);
        }
        return next;
      });
    },
    [storage],
  );

  const handlePickEmoji = useCallback(
    (emoji: string) => {
      const { start, end } = caretRef.current ?? {};
      const next = insertAtCaret(value, emoji, start, end);
      onChange(next.value);
      caretRef.current = { start: next.caret, end: next.caret };
      rememberEmoji(emoji);
      // 等受控值落到 DOM 之后再落光标，否则会被这次渲染覆盖回去
      window.requestAnimationFrame(() => {
        const dom = domRef.current;
        if (!dom) {
          return;
        }
        dom.focus();
        dom.setSelectionRange(next.caret, next.caret);
      });
    },
    [onChange, rememberEmoji, value],
  );

  const groups = useMemo<readonly EmojiGroup[]>(
    () =>
      recent.length
        ? [{ key: RECENT_GROUP_KEY, emojis: recent }, ...EMOJI_GROUPS]
        : EMOJI_GROUPS,
    [recent],
  );
  const current =
    groups.find((group) => group.key === activeGroup) ?? groups[0];
  const currentLabel = intl.formatMessage({
    id: `chat.composer.group.${current.key}`,
  });

  const canSend = !disabled && !sending && (allowEmpty || value.trim() !== '');

  /**
   * 发送统一从这里出：正文已经交出去，面板就没有继续占着消息流的理由。
   * 留着不收的话，刚发完消息想接着看上一条，面板还杵在那儿挡着。
   */
  const handleSend = useCallback(() => {
    setPanelOpen(false);
    setMentionTrigger(null);
    onSend();
  }, [onSend]);

  /**
   * 键盘事件的第一优先级是「提及候选面板」。
   *
   * <p><b>输入法组合期必须整块让行</b>：中文昵称的拼音还没上屏时，回车是「选词」、
   * 上下键是「翻候选词页」——被我们抢去当确认键，用户就根本打不出中文。
   * 判定同时看 {@code isComposing} 与 {@code keyCode === 229}
   * （Safari 在 compositionend 之后 isComposing 已为 false，只剩 229 可判），
   * 与 {@link resolveComposerKey} 同一口径。</p>
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const composing =
      event.nativeEvent.isComposing ||
      (event.nativeEvent as KeyboardEvent).keyCode === 229;
    if (mentionTrigger && mentionCandidates.length > 0 && !composing) {
      const total = mentionCandidates.length;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setMentionIndex((index) => (index + 1) % total);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setMentionIndex((index) => (index - 1 + total) % total);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        // 下标可能因候选收窄而越界，兜底取第一项
        handlePickMention(
          mentionCandidates[mentionIndex] ?? mentionCandidates[0],
        );
        return;
      }
    }
    if (event.key === 'Escape' && !composing && (panelOpen || mentionTrigger)) {
      setPanelOpen(false);
      setMentionTrigger(null);
      return;
    }
    const action = resolveComposerKey({
      key: event.key,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      isComposing: event.nativeEvent.isComposing,
      // Safari 在 compositionend 之后 isComposing 已为 false，只剩 229 可判
      keyCode: (event.nativeEvent as KeyboardEvent).keyCode,
    });
    if (action === 'none') {
      return;
    }
    if (action === 'newline') {
      return;
    }
    event.preventDefault();
    handleSend();
  };

  return (
    <div
      ref={rootRef}
      className={[
        styles.root,
        compact ? styles.rootCompact : '',
        bare ? styles.rootBare : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {header}
      <div className={styles.box}>
        <Input.TextArea
          className={styles.textarea}
          variant="borderless"
          value={value}
          rows={rows}
          autoSize={autoSize}
          maxLength={maxLength}
          showCount={showCount}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => {
            rememberCaret(event.target);
            onChange(event.target.value);
            syncMentionTrigger(
              event.target.value,
              event.target.selectionStart ?? event.target.value.length,
            );
          }}
          onKeyDown={handleKeyDown}
          onFocus={(event) => rememberCaret(event.target)}
          onSelect={(event) => rememberCaret(event.target)}
          // 纯键盘移动光标（方向键、Home/End）不走 select，得靠 keyUp 补上；
          // 而光标一动，「光标前是不是正在输入 @」也可能跟着变，故一并重算提及上下文
          onKeyUp={(event) => {
            // currentTarget 才带 textarea 的类型：target 是 EventTarget，取不到 value / selectionStart
            const element = event.currentTarget;
            rememberCaret(element);
            syncMentionTrigger(
              element.value,
              element.selectionStart ?? element.value.length,
            );
          }}
        />
        <div className={styles.toolbar}>
          <div className={styles.tools}>
            <Tooltip title={intl.formatMessage({ id: 'chat.composer.emoji' })}>
              <Button
                type="text"
                icon={<SmileOutlined />}
                aria-label={intl.formatMessage({ id: 'chat.composer.emoji' })}
                aria-expanded={panelOpen}
                // 按下不抢焦点：光标留在正文里，取表情才插得准
                onMouseDown={(event) => event.preventDefault()}
                onClick={togglePanel}
              />
            </Tooltip>
            {mentionEnabled ? (
              <Tooltip
                title={intl.formatMessage({ id: 'chat.composer.mention' })}
              >
                <Button
                  type="text"
                  className={styles.mentionButton}
                  aria-label={intl.formatMessage({
                    id: 'chat.composer.mention',
                  })}
                  aria-expanded={mentionTrigger !== null}
                  // 同上：按下不抢焦点，光标留在正文里，提及才插得准
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={handleOpenMention}
                >
                  @
                </Button>
              </Tooltip>
            ) : null}
            {tools}
          </div>
          <Tooltip title={intl.formatMessage({ id: 'chat.composer.sendHint' })}>
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={sending}
              disabled={!canSend}
              // 显式给出可访问名：图标自带 aria-label，否则读出来是「send 发送」
              aria-label={sendLabel}
              onClick={handleSend}
            >
              {sendLabel}
            </Button>
          </Tooltip>
        </div>
      </div>

      {panelOpen ? (
        <div className={styles.panel}>
          <div
            className={styles.grid}
            id={panelId}
            role="tabpanel"
            aria-label={currentLabel}
          >
            {current.emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={styles.emojiButton}
                // 同上：不抢焦点，插入后光标仍在正文里
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handlePickEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div
            className={styles.tabs}
            role="tablist"
            aria-label={intl.formatMessage({ id: 'chat.composer.emojiPanel' })}
          >
            {groups.map((group) => {
              const active = group.key === current.key;
              const label = intl.formatMessage({
                id: `chat.composer.group.${group.key}`,
              });
              return (
                <Tooltip key={group.key} title={label}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls={panelId}
                    aria-label={label}
                    className={[styles.tab, active ? styles.tabActive : '']
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setActiveGroup(group.key)}
                  >
                    {group.key === RECENT_GROUP_KEY ? (
                      <ClockCircleOutlined />
                    ) : (
                      group.emojis[0]
                    )}
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </div>
      ) : null}

      {/*
        提及候选：与表情面板互斥（togglePanel 与 handleOpenMention 各收对方），
        因此这里不会再与表情面板叠在一起。
        空候选也照常渲染——面板突然消失会让用户以为 @ 功能坏了，留一句「没有匹配成员」更清楚。
      */}
      {mentionTrigger !== null ? (
        <MentionPanel
          candidates={mentionCandidates}
          activeIndex={mentionIndex}
          panelLabel={intl.formatMessage({ id: 'chat.composer.mentionPanel' })}
          emptyLabel={intl.formatMessage({ id: 'chat.composer.mentionEmpty' })}
          onHover={setMentionIndex}
          onPick={handlePickMention}
        />
      ) : null}
    </div>
  );
};

export default ChatComposer;
