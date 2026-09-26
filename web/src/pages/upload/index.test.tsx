/**
 * 分片上传演示页：上传方式卡片。
 *
 * <p>要钉住的是「卡片上的选择与参数真的落到了上传组件上」。这页最容易出的错不是样式，
 * 而是选了 A 方式却按 B 方式的参数发分片——那会把两种请求体静默地混着发出去。
 * 所以断言直接落在传给 `ChunkUpload` 的 props 上。</p>
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { testFormatMessage } from '@/locales/testTranslate';

import UploadDemoPage from './index';

vi.mock('@umijs/max', () => ({
  // 兼容 `formatMessage({ id, values })` 与 `formatMessage({ id }, values)` 两种调用形态
  useIntl: () => ({
    formatMessage: (
      descriptor: { id: string; values?: Record<string, unknown> },
      values?: Record<string, unknown>,
    ) =>
      testFormatMessage({ id: descriptor.id, values: values ?? descriptor.values }),
  }),
  useLocation: () => ({ pathname: '/upload' }),
  request: vi.fn(),
  history: { push: vi.fn(), replace: vi.fn() },
}));

/**
 * 上传组件替身：把收到的关键配置挂到 DOM 上。
 *
 * <p>不拉真实组件是因为本用例要断言的正是「页面传了什么」，真实组件会自己接上
 * 队列与网络，边界反而看不清。</p>
 */
vi.mock('@/components/ChunkUpload', () => ({
  formatBytes: (size: number) => `${size} B`,
  ChunkUpload: (props: {
    partPayloadMode?: string;
    chunkSize?: number;
    concurrency?: number;
    showTuning?: boolean;
  }) => (
    <div
      data-testid="chunk-upload"
      data-mode={props.partPayloadMode}
      data-chunk-size={String(props.chunkSize)}
      data-concurrency={String(props.concurrency)}
      data-show-tuning={String(props.showTuning)}
    />
  ),
}));

/** 断言用：从 zh-CN 语言包取文案，键写错即失败（不在测试里另抄一份中文） */
const t = (id: string) => testFormatMessage({ id });

function uploader() {
  return screen.getByTestId('chunk-upload');
}

/**
 * 页面上四个下拉框的显示值，顺序 = 卡片顺序 ×（分片大小，并发数）。
 *
 * <p>读 `.ant-select` 的文本即可：下拉面板挂在 body 的独立浮层里，不在选择器内部，
 * 所以这里的文本就是用户看到的那一个已选值。</p>
 */
function selectedTexts() {
  return Array.from(document.querySelectorAll('.ant-select')).map(
    (node) => node.textContent,
  );
}

/**
 * 按卡片标题定位某张方式卡片。
 *
 * <p>刻意不用 `Content-Type` 标记定位：那个串也会出现在告警里的行内代码中，
 * 标题才是卡片范围内唯一的锚点。</p>
 */
function modeCard(titleId: string) {
  const card = screen.getByText(t(titleId)).closest('.ant-card');
  if (!card) {
    throw new Error(`未找到「${t(titleId)}」所在的方式卡片`);
  }
  return within(card as HTMLElement);
}

describe('上传方式卡片', () => {
  it('默认按表单分片上传，并把该方式自己的参数传给上传组件', () => {
    render(<UploadDemoPage />);

    expect(uploader().dataset.mode).toBe('multipart');
    expect(uploader().dataset.chunkSize).toBe(String(4 * 1024 * 1024));
    expect(uploader().dataset.concurrency).toBe('3');
    // 参数已经由卡片统一配置，组件内部那行调节项不再重复出现
    expect(uploader().dataset.showTuning).toBe('false');

    // 两张卡片各显示自己那一份参数，初始值互不覆盖
    expect(selectedTexts()).toEqual(['4 MB', '3', '8 MB', '5']);

    const multipart = modeCard('upload.mode.multipart.title');
    expect(multipart.getByText(t('upload.mode.multipart.tag'))).toBeTruthy();
    expect(multipart.getByText(t('upload.mode.active'))).toBeTruthy();
    // 只有未选中的那张才需要「使用此方式」
    expect(
      screen.getAllByRole('button', { name: t('upload.mode.use') }),
    ).toHaveLength(1);
  });

  it('切到二进制流：换的是整套参数，不是只换 Content-Type', () => {
    render(<UploadDemoPage />);

    fireEvent.click(screen.getByRole('button', { name: t('upload.mode.use') }));

    expect(uploader().dataset.mode).toBe('octet-stream');
    expect(uploader().dataset.chunkSize).toBe(String(8 * 1024 * 1024));
    expect(uploader().dataset.concurrency).toBe('5');

    // 参数跟着「方式」走而不是被覆盖：切过去读的是二进制流自己那一份
    expect(selectedTexts()).toEqual(['4 MB', '3', '8 MB', '5']);

    const octetStream = modeCard('upload.mode.octetStream.title');
    expect(octetStream.getByText(t('upload.mode.octetStream.tag'))).toBeTruthy();
    expect(octetStream.getByText(t('upload.mode.active'))).toBeTruthy();
    expect(
      screen.getAllByRole('button', { name: t('upload.mode.use') }),
    ).toHaveLength(1);
  });

  it('后端尚未支持的方式必须明确警示，不能让人以为选了就能用', () => {
    render(<UploadDemoPage />);

    const octetStream = modeCard('upload.mode.octetStream.title');
    expect(octetStream.getByText(t('upload.mode.unsupportedTag'))).toBeTruthy();
    // 告警里点名了实际后果（HTTP 415），而不是一句含糊的「暂不支持」
    expect(octetStream.getByText(/415/)).toBeTruthy();

    const multipart = modeCard('upload.mode.multipart.title');
    expect(multipart.queryByText(t('upload.mode.unsupportedTag'))).toBeNull();
  });
});

/** 按标题定位「接入方式」卡片：页面上别处也有代码片段，断言必须限定在卡片范围内 */
function usageCard() {
  const card = screen
    .getByText(t('upload.demo.usage.title'))
    .closest('.ant-card');
  if (!card) {
    throw new Error('未找到「接入方式」所在卡片');
  }
  return within(card as HTMLElement);
}

describe('接入方式', () => {
  it('默认给出组件用法，示例代码与配套要点落在同一张卡片里', () => {
    render(<UploadDemoPage />);

    const usage = usageCard();
    expect(
      screen
        .getByRole('tab', { name: t('upload.demo.usage.tab.component') })
        .getAttribute('aria-selected'),
    ).toBe('true');

    // 示例按真实 props 写：读的人抄走就能跑，不会抄到一个不存在的配置项
    expect(usage.getByText(/partPayloadMode="multipart"/)).toBeTruthy();
    // 要点讲的就是这段代码里的约束，两者同源
    expect(usage.getByText(/决定队列身份/)).toBeTruthy();
  });

  it('切到 Hook 用法后真的换出 Hook 示例', () => {
    render(<UploadDemoPage />);

    const usage = usageCard();
    const hookTab = screen.getByRole('tab', {
      name: t('upload.demo.usage.tab.hook'),
    });
    fireEvent.click(hookTab);

    expect(hookTab.getAttribute('aria-selected')).toBe('true');
    // 这段代码只有 Hook 用法才有：证明换的是内容，不只是换个高亮
    expect(usage.getByText(/clearFinished/)).toBeTruthy();
    expect(usage.getByText(/只给状态与动作、不画界面/)).toBeTruthy();
  });
});
