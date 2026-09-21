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
 */

import { ClockCircleOutlined, SendOutlined, SmileOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { createStyles } from 'antd-style';
import { Button, Input, Tooltip } from 'antd';
import {
  type ReactNode,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  type EmojiStorage,
  insertAtCaret,
  pushRecentEmoji,
  readRecentEmoji,
  resolveComposerKey,
  writeRecentEmoji,
} from './composer';
import { EMOJI_GROUPS, type EmojiGroup } from './emoji';

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

  /** 表情面板：从输入框下方展开，高度固定以免撑高整页。 */
  panel: {
    marginTop: 8,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    background: token.colorBgElevated,
    boxShadow: token.boxShadowTertiary,
  },

  grid: {
    display: 'grid',
    height: 196,
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
  /** 输入框上方的附加内容：抽屉的待发文件条 / 拖拽提示。 */
  header?: ReactNode;
  /** 窄容器（即时通讯抽屉）用紧凑内边距。 */
  compact?: boolean;
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
  compact = false,
}: ChatComposerProps) => {
  const intl = useIntl();
  const { styles } = useStyles();
  const storage = useEmojiStorage();

  const [panelOpen, setPanelOpen] = useState(false);
  const [recent, setRecent] = useState<readonly string[]>([]);
  const [activeGroup, setActiveGroup] = useState<string>(EMOJI_GROUPS[0].key);

  const domRef = useRef<HTMLTextAreaElement | null>(null);
  const caretRef = useRef<{ start: number; end: number } | null>(null);

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

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape' && panelOpen) {
      setPanelOpen(false);
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
    onSend();
  };

  return (
    <div
      className={compact ? `${styles.root} ${styles.rootCompact}` : styles.root}
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
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={(event) => rememberCaret(event.target)}
          onSelect={(event) => rememberCaret(event.target)}
          // 纯键盘移动光标（方向键、Home/End）不走 select，得靠 keyUp 补上
          onKeyUp={(event) => rememberCaret(event.target)}
        />
        <div className={styles.toolbar}>
          <Tooltip
            title={intl.formatMessage({ id: 'chat.composer.emoji' })}
          >
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
          <Tooltip title={intl.formatMessage({ id: 'chat.composer.sendHint' })}>
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={sending}
              disabled={!canSend}
              // 显式给出可访问名：图标自带 aria-label，否则读出来是「send 发送」
              aria-label={sendLabel}
              onClick={onSend}
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
    </div>
  );
};

export default ChatComposer;
