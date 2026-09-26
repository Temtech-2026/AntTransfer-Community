import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { testFormatMessage } from '@/locales/testTranslate';

import { RECENT_EMOJI_KEY } from './composer';

import ChatComposer from './index';

vi.mock('@umijs/max', async () => {
  const { testFormatMessage: translate } = await import('@/locales/testTranslate');
  return {
    useIntl: () => ({
      formatMessage: (
        descriptor: { id: string; values?: Record<string, unknown> },
        values?: Record<string, unknown>,
      ) => translate({ id: descriptor.id, values: values ?? descriptor.values }),
    }),
  };
});

/** 走真实语言包取值：键写错或漏加，这里立刻失败 */
const t = (id: string) => testFormatMessage({ id });

const PLACEHOLDER = t('chat.composer.placeholder');
const EMOJI_LABEL = t('chat.composer.emoji');
const SEND_LABEL = t('chat.action.send');
const RECENT_TAB = t('chat.composer.group.recent');

/** 受控组件的测试夹具：正文由外部持有，才观察得到 onChange 的结果 */
function Harness({
  onSend,
  allowEmpty = false,
}: {
  onSend: () => void;
  allowEmpty?: boolean;
}) {
  const [value, setValue] = useState('');
  return (
    <ChatComposer
      value={value}
      onChange={setValue}
      onSend={onSend}
      allowEmpty={allowEmpty}
      placeholder={PLACEHOLDER}
      sendLabel={SEND_LABEL}
    />
  );
}

const textarea = () => screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement;
const sendButton = () => screen.getByRole('button', { name: SEND_LABEL });
const emojiToggle = () => screen.getByRole('button', { name: EMOJI_LABEL });

/** 打开表情面板（发送按钮与表情入口都在输入框的工具栏里） */
function openEmojiPanel() {
  fireEvent.click(emojiToggle());
}

describe('ChatComposer 发送按钮', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('发送按钮在输入框内，正文为空时不可点', () => {
    render(<Harness onSend={vi.fn()} />);
    expect(sendButton()).toBeDisabled();
  });

  it('有正文后可点，点击即触发发送', () => {
    const onSend = vi.fn();
    render(<Harness onSend={onSend} />);
    fireEvent.change(textarea(), { target: { value: '在吗' } });
    expect(sendButton()).toBeEnabled();
    fireEvent.click(sendButton());
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('允许纯附件发送时，空正文也能点（抽屉的文件消息）', () => {
    render(<Harness onSend={vi.fn()} allowEmpty />);
    expect(sendButton()).toBeEnabled();
  });
});

describe('ChatComposer 按键口径', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('回车发送', () => {
    const onSend = vi.fn();
    render(<Harness onSend={onSend} />);
    fireEvent.change(textarea(), { target: { value: '收到' } });
    fireEvent.keyDown(textarea(), { key: 'Enter' });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('Shift + Enter 换行，不发送', () => {
    const onSend = vi.fn();
    render(<Harness onSend={onSend} />);
    fireEvent.change(textarea(), { target: { value: '第一行' } });
    fireEvent.keyDown(textarea(), { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('输入法组合中的回车不发送（避免半截拼音被发出去）', () => {
    const onSend = vi.fn();
    render(<Harness onSend={onSend} />);
    fireEvent.change(textarea(), { target: { value: 'ni' } });
    fireEvent.keyDown(textarea(), { key: 'Enter', keyCode: 229 });
    expect(onSend).not.toHaveBeenCalled();
  });
});

describe('ChatComposer 表情', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('默认收起，点表情入口展开面板', () => {
    render(<Harness onSend={vi.fn()} />);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    openEmojiPanel();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('点表情插入到光标处，而不是追加到末尾', () => {
    render(<Harness onSend={vi.fn()} />);
    fireEvent.change(textarea(), { target: { value: '你好' } });
    textarea().setSelectionRange(1, 1);
    // 用 keyUp 而不是 select：React 的 onSelect 是异步合成的，会在 act 之外补一次更新
    fireEvent.keyUp(textarea(), { key: 'ArrowLeft' });

    // 组件等下一帧才把光标落回插入点；这里让 rAF 同步收口，
    // 更新仍发生在点击这一帧内，既等得到结果也不产生 act 告警
    const raf = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        callback(0);
        return 0;
      });

    openEmojiPanel();
    fireEvent.click(screen.getByRole('button', { name: '😀' }));

    expect(textarea().value).toBe('你😀好');
    raf.mockRestore();
  });

  it('换分类可看到该组表情', () => {
    render(<Harness onSend={vi.fn()} />);
    openEmojiPanel();
    // 刻意跳过「表情」组首页的表情（😷 属于该组），改点「手势」组的 👍
    fireEvent.click(screen.getByRole('tab', { name: t('chat.composer.group.gestures') }));
    fireEvent.click(screen.getByRole('button', { name: '👍' }));
    expect(textarea().value).toBe('👍');
  });

  it('用过的表情进入「最近使用」并落到本地存储', () => {
    render(<Harness onSend={vi.fn()} />);
    // 此前没有记录：面板里不该有「最近使用」页签
    openEmojiPanel();
    expect(screen.queryByRole('tab', { name: RECENT_TAB })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '😀' }));
    expect(screen.getByRole('tab', { name: RECENT_TAB })).toBeInTheDocument();
    expect(window.localStorage.getItem(RECENT_EMOJI_KEY)).toContain('😀');
  });

  it('已有「最近使用」记录时，打开面板即出现该页签', () => {
    window.localStorage.setItem(RECENT_EMOJI_KEY, JSON.stringify(['🎉']));
    render(<Harness onSend={vi.fn()} />);
    openEmojiPanel();
    expect(screen.getByRole('tab', { name: RECENT_TAB })).toBeInTheDocument();
  });

  it('点面板外面收起，不挡着看消息', () => {
    render(<Harness onSend={vi.fn()} />);
    openEmojiPanel();
    expect(screen.getByRole('tablist')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('按 Esc 收起（焦点不在输入框上也生效）', () => {
    render(<Harness onSend={vi.fn()} />);
    openEmojiPanel();
    expect(screen.getByRole('tablist')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('发送后面板收起，消息流不再被占着', () => {
    const onSend = vi.fn();
    render(<Harness onSend={onSend} />);
    fireEvent.change(textarea(), { target: { value: '在吗' } });
    openEmojiPanel();

    fireEvent.click(sendButton());
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('点表情按钮本身不算「点外面」，可反复开合', () => {
    render(<Harness onSend={vi.fn()} />);
    openEmojiPanel();
    fireEvent.mouseDown(emojiToggle());
    fireEvent.click(emojiToggle());
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});
