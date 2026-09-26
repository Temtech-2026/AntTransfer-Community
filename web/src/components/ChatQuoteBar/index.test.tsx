/**
 * 「正在引用」提示条 · 三条口径。
 *
 * <ol>
 *   <li><b>预览与发出去的气泡复用同一块引用</b>：发送前看到的那块与气泡里那块必须一模一样，
 *       否则「刚才引的明明是这句」会变成一个无法自证的问题；</li>
 *   <li><b>取消是草稿唯一的回头路</b>：右键「引用」后引用态一直挂着，直到发送成功或点这里，
 *       因此该按钮必须有可读的无障碍名（图标按钮不能只靠图标表意）；</li>
 *   <li><b>发送中禁用取消</b>：请求已经带着 `quoteClientMsgId` 出去了，
 *       这时再改引用目标只会让「界面上引的」与「实际发出去的」不一致。</li>
 * </ol>
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { testFormatMessage } from '@/locales/testTranslate';
import type { ChatQuoteDraft } from '@/services/chat/quote';

import ChatQuoteBar from './index';

vi.mock('@umijs/max', async () => {
  const { testFormatMessage: translate } = await import(
    '@/locales/testTranslate'
  );
  return {
    useIntl: () => ({
      formatMessage: (
        descriptor: { id: string; values?: Record<string, unknown> },
        values?: Record<string, unknown>,
      ) => translate({ id: descriptor.id, values: values ?? descriptor.values }),
    }),
  };
});

const t = (id: string) => testFormatMessage({ id });

const draft: ChatQuoteDraft = {
  clientMsgId: 'c-1',
  senderName: '张三',
  summary: '方案已发',
};

describe('ChatQuoteBar', () => {
  it('同时给出「引用了谁 / 引了什么」与取消入口', () => {
    render(<ChatQuoteBar draft={draft} onCancel={vi.fn()} />);

    expect(screen.getByTestId('chat-quote-bar')).toBeInTheDocument();
    expect(screen.getByTestId('chat-quote')).toHaveTextContent('张三');
    expect(screen.getByTestId('chat-quote')).toHaveTextContent('方案已发');
    // 图标按钮必须有可读名字：只有图标的话读屏只会念「按钮」
    expect(
      screen.getByRole('button', { name: t('chat.composer.quote.cancel') }),
    ).toBeInTheDocument();
  });

  it('点取消 → 回调被触发一次（改主意只有这一个出口）', () => {
    const onCancel = vi.fn();
    render(<ChatQuoteBar draft={draft} onCancel={onCancel} />);

    fireEvent.click(
      screen.getByRole('button', { name: t('chat.composer.quote.cancel') }),
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('发送中（disabled）取消按钮不可点：请求已带着引用键出去了，改目标只会两处不一致', () => {
    const onCancel = vi.fn();
    render(<ChatQuoteBar draft={draft} onCancel={onCancel} disabled />);

    const cancel = screen.getByRole('button', {
      name: t('chat.composer.quote.cancel'),
    });
    expect(cancel).toBeDisabled();

    fireEvent.click(cancel);

    expect(onCancel).not.toHaveBeenCalled();
  });
});
