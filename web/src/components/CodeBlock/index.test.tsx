/**
 * CodeBlock：语言标记、原文展示与复制反馈。
 *
 * <p>要钉住的是「按钮说复制成功时，剪贴板里真的有内容」。这条链路上最容易糊弄的是
 * 非安全上下文：`navigator.clipboard` 不存在时必须走降级，两条路都断了必须明说失败，
 * 而不是点完毫无反应还显示成功。</p>
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { testFormatMessage } from '@/locales/testTranslate';

import CodeBlock from './index';

vi.mock('@umijs/max', () => ({
  useIntl: () => ({
    formatMessage: (descriptor: { id: string }) =>
      testFormatMessage({ id: descriptor.id }),
  }),
}));

/** 断言用：从 zh-CN 语言包取文案，键写错即失败 */
const t = (id: string) => testFormatMessage({ id });

const CODE = "import { ChunkUpload } from '@/components/ChunkUpload';";
const TITLE = 'src/pages/upload/index.tsx';

/** 剪贴板替身；传 `undefined` 表示该环境没有 Clipboard API */
function stubClipboard(writeText?: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
}

/** `execCommand` 替身：happy-dom 未实现，降级路径必须自己造 */
function stubExecCommand(result: boolean) {
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    writable: true,
    value: vi.fn(() => result),
  });
}

function copyButton() {
  return screen.getByRole('button');
}

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'clipboard');
  Reflect.deleteProperty(document, 'execCommand');
});

describe('代码块', () => {
  it('展示语言标记、位置说明与源码原文', () => {
    render(<CodeBlock code={CODE} language="tsx" title={TITLE} />);

    expect(screen.getByText('tsx')).toBeTruthy();
    expect(screen.getByText(TITLE)).toBeTruthy();
    // 原文按字符比对：缩进与引号被「顺手美化」过就会失真
    expect(screen.getByText(CODE)).toBeTruthy();
  });

  it('不需要复制时不渲染复制按钮', () => {
    render(<CodeBlock code={CODE} copyable={false} />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('点复制后写入剪贴板，给出成功反馈并在稍后自动还原', async () => {
    const writeText = vi.fn(async () => undefined);
    stubClipboard(writeText);
    vi.useFakeTimers();

    render(<CodeBlock code={CODE} />);
    fireEvent.click(copyButton());

    // 复制是异步的：先放行微任务，反馈才会落到界面上
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(writeText).toHaveBeenCalledWith(CODE);
    expect(
      screen.getByRole('button', { name: t('component.codeBlock.copied') }),
    ).toBeTruthy();

    // 反馈不能永久停在「已复制」，否则用户会以为按钮坏了
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(
      screen.getByRole('button', { name: t('component.codeBlock.copy') }),
    ).toBeTruthy();
  });

  it('没有 Clipboard API 时降级，两条路都断了则明说失败', async () => {
    stubClipboard(undefined);
    stubExecCommand(true);

    render(<CodeBlock code={CODE} />);
    fireEvent.click(copyButton());

    expect(
      await screen.findByRole('button', { name: t('component.codeBlock.copied') }),
    ).toBeTruthy();
    expect(document.execCommand).toHaveBeenCalled();

    // 降级也失败：必须如实报错，不能沿用上一次的成功反馈
    stubExecCommand(false);
    fireEvent.click(
      screen.getByRole('button', { name: t('component.codeBlock.copied') }),
    );

    expect(
      await screen.findByRole('button', {
        name: t('component.codeBlock.copyFailed'),
      }),
    ).toBeTruthy();
  });
});
