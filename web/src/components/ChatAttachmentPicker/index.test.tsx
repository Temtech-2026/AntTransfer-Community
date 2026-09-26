/**
 * 文件传输入口：两条来源（我的文件 / 本机上传）都必须是「一次选择 → 一份待发载荷」。
 *
 * <p>钉住四类容易漂移的口径：</p>
 * <ol>
 *   <li><b>两条来源产出的载荷同形</b>：下游附件条只认一种形态，来源差异不许泄漏出去；</li>
 *   <li><b>拿不到条目就不产出草稿</b>：上传完成但没回条目 ID 时必须报错，而不是让空 ID
 *       一路走到「点发送」才失败；</li>
 *   <li><b>列表失败不冒充成功</b>：查询报错后必须清空上一页数据，否则用户会从
 *       过期列表里挑一个发出去；</li>
 *   <li><b>入口不会被挂住</b>：上传在顶栏被取消（不回调任何 onTask*）后，入口要能再点。</li>
 * </ol>
 *
 * <p>可见性断言只用「在文档里」与「已进入离场态」两种，这里不用 `toBeVisible()`：
 * happy-dom 不派发 animationend，antd 弹窗的动画停在起始帧（`opacity: 0`），
 * 弹窗内容在计算样式上永远「不可见」，关窗后也不会被卸载——真机上两者都正常。
 * 可测的是结构与状态，不是像素。</p>
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { formatBytes } from '@/components/ChunkUpload';
import { testFormatMessage } from '@/locales/testTranslate';
import { MAX_FILE_SIZE } from '@/services/upload/constants';
import type { UploadTaskView } from '@/services/upload/types';

import ChatAttachmentPicker, { type ChatAttachmentPickerProps } from './index';

/** 断言用：从 zh-CN 语言包取文案，键写错即失败（不在测试里另抄一份中文） */
const t = (id: string, values?: Record<string, unknown>) =>
  testFormatMessage({ id, values });

/** 组件依赖的 `App.useApp()`：把 toast 换成探针，好断言「说了什么」 */
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));

/**
 * 上传引擎替身。
 *
 * <p>刻意保留 `onTaskSuccess` / `onTaskError` 与任务快照两条通道：前者验「传完了怎么组载荷」，
 * 后者验「按任务状态算忙不忙」。真实的 `useChunkUpload` 会注册全局队列并发请求，
 * 在 jsdom 里既跑不起来也测不出结论。</p>
 */
const upload = vi.hoisted(() => ({
  options: null as null | Record<string, unknown>,
  setTasks: null as null | ((tasks: UploadTaskView[]) => void),
  start: vi.fn(),
}));

/** 候选文件列表的真实请求替身 */
const { pageFiles } = vi.hoisted(() => ({ pageFiles: vi.fn() }));

vi.mock('@umijs/max', async () => {
  const { testFormatMessage: translate } = await import(
    '@/locales/testTranslate'
  );
  return {
    // 兼容两种调用形态：`formatMessage({ id, values })` 与 `formatMessage({ id }, values)`
    useIntl: () => ({
      formatMessage: (
        descriptor: { id: string; values?: Record<string, unknown> },
        values?: Record<string, unknown>,
      ) =>
        translate({ id: descriptor.id, values: values ?? descriptor.values }),
    }),
  };
});

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    App: {
      ...actual.App,
      useApp: () => ({ message: { error: toastError } }),
    },
  };
});

vi.mock('@/services/file', () => ({ pageFiles }));

vi.mock('@/hooks/useChunkUpload', async () => {
  const { useState } = await import('react');
  return {
    useChunkUpload: (options: Record<string, unknown>) => {
      upload.options = options;
      const [tasks, setTasks] = useState<UploadTaskView[]>([]);
      upload.setTasks = setTasks;
      return { tasks, start: upload.start };
    },
  };
});

const mockedPage = vi.mocked(pageFiles);
const mockedStart = vi.mocked(upload.start);

const NODE_ID = '900000000000000011';
const QUEUE_ID = 'chat-send';

const node = (over: Partial<Record<string, unknown>> = {}) => ({
  id: NODE_ID,
  name: '季度报告.pdf',
  sizeBytes: 2517000,
  level: 2,
  ...over,
});

const task = (over: Partial<UploadTaskView> = {}): UploadTaskView =>
  ({
    id: 'task-1',
    fileName: '年会照片.png',
    size: 2048,
    status: 'uploading',
    progress: 42,
    uploadedBytes: 860,
    speed: 1024,
    instant: false,
    chunkSize: 1048576,
    chunkCount: 1,
    received: [],
    ...over,
  }) as UploadTaskView;

const renderPicker = (props: Partial<ChatAttachmentPickerProps> = {}) => {
  const onPick = vi.fn();
  const view = render(
    <ChatAttachmentPicker onPick={onPick} queueId={QUEUE_ID} {...props} />,
  );
  return { onPick, view };
};

/** 点回形针并把弹窗收敛出来 */
const openEntry = async () => {
  fireEvent.click(screen.getByLabelText(t('chat.attach.entry')));
  return within(await screen.findByRole('dialog'));
};

/**
 * 「弹窗已经关上」的判定。
 *
 * <p>不等节点消失：离场动画在 happy-dom 里跑不完，节点不会被卸载（真机上动画一结束就卸载）。
 * 因此只要求它进入离场态——这同样能证伪「选完还杵在那儿要用户自己关」，
 * 且不依赖动画完成。</p>
 */
const expectDialogClosed = async () => {
  await waitFor(() => {
    const dialog = screen.queryByRole('dialog');
    expect(dialog === null || dialog.className.includes('ant-zoom-leave')).toBe(
      true,
    );
  });
};

const fileInput = (container: HTMLElement) =>
  container.querySelector('input[type="file"]') as HTMLInputElement;

describe('ChatAttachmentPicker · 从「我的文件」选', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPage.mockResolvedValue({ records: [node()], total: 1 });
  });

  it('打开弹窗即列出我的文件（默认第一页、按创建时间倒序）', async () => {
    renderPicker();
    const dialog = await openEntry();

    expect(await dialog.findByText('季度报告.pdf')).toBeInTheDocument();
    expect(mockedPage).toHaveBeenCalledWith(
      expect.objectContaining({
        current: 1,
        pageSize: 10,
        sort: 'createTime,desc',
      }),
    );
  });

  it('选中一个已有文件：回传与拖拽同形的载荷并关窗', async () => {
    const { onPick } = renderPicker();
    const dialog = await openEntry();

    fireEvent.click(await dialog.findByTitle('季度报告.pdf'));

    expect(onPick).toHaveBeenCalledWith({
      nodeId: NODE_ID,
      fileName: '季度报告.pdf',
      sizeBytes: 2517000,
      level: 2,
    });
    await expectDialogClosed();
  });

  it('搜索：带关键词重新查询，并回到第一页', async () => {
    renderPicker();
    const dialog = await openEntry();
    const input = await dialog.findByPlaceholderText(
      t('chat.attach.pickerSearch'),
    );

    fireEvent.change(input, { target: { value: '报告' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });

    await waitFor(() =>
      expect(mockedPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: '报告', current: 1 }),
      ),
    );
  });

  it('查询失败：给出失败说明，且不让上一页的结果留在屏幕上', async () => {
    renderPicker();
    const dialog = await openEntry();
    expect(await dialog.findByText('季度报告.pdf')).toBeInTheDocument();

    mockedPage.mockRejectedValue(new Error('boom'));
    const input = dialog.getByPlaceholderText(t('chat.attach.pickerSearch'));
    fireEvent.change(input, { target: { value: '报告' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });

    expect(
      await dialog.findByText(t('chat.attach.pickerFailed')),
    ).toBeInTheDocument();
    // 过期列表比空列表危险得多：用户会从里面挑一个已经变了的东西发出去
    expect(dialog.queryByText('季度报告.pdf')).toBeNull();
  });

  it('列表不存在的文件时给空态，不报错', async () => {
    mockedPage.mockResolvedValue({ records: [], total: 0 });
    renderPicker();
    const dialog = await openEntry();

    expect(
      await dialog.findByText(t('chat.attach.pickerEmpty')),
    ).toBeInTheDocument();
  });
});

describe('ChatAttachmentPicker · 上传本机文件', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPage.mockResolvedValue({ records: [], total: 0 });
    mockedStart.mockReturnValue(['task-1']);
  });

  it('用的是调用方给的队列 id，且不落本地断点缓存', async () => {
    renderPicker();

    expect(upload.options).toMatchObject({ id: QUEUE_ID, persist: false });
  });

  it('选中本机文件即交给上传引擎', async () => {
    const { view } = renderPicker();
    await openEntry();

    const picked = new File(['hello'], '年会照片.png', { type: 'image/png' });
    fireEvent.change(fileInput(view.container), {
      target: { files: [picked] },
    });

    expect(mockedStart).toHaveBeenCalledWith([picked]);
  });

  it('传完：用上传回传的条目组载荷并关窗', async () => {
    const { onPick } = renderPicker();
    await openEntry();

    const success = upload.options?.onTaskSuccess as (
      t: UploadTaskView,
    ) => void;
    await act(async () => {
      success(task({ nodeId: NODE_ID, status: 'success', progress: 100 }));
    });

    expect(onPick).toHaveBeenCalledWith({
      nodeId: NODE_ID,
      fileName: '年会照片.png',
      sizeBytes: 2048,
      level: undefined,
    });
    await expectDialogClosed();
  });

  it('传完但没回条目 ID：报错且不产出草稿', async () => {
    const { onPick } = renderPicker();
    await openEntry();

    const success = upload.options?.onTaskSuccess as (
      t: UploadTaskView,
    ) => void;
    await act(async () => {
      success(task({ nodeId: undefined, status: 'success' }));
    });

    expect(onPick).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(t('chat.attach.uploadNoNode'));
    // 弹窗留着：用户可以直接重试，不用从头再来
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('传失败：弹窗里点名是哪个文件，并可以重试', async () => {
    renderPicker();
    const dialog = await openEntry();

    const failed = upload.options?.onTaskError as (t: UploadTaskView) => void;
    await act(async () => {
      failed(task({ status: 'error' }));
    });

    expect(
      dialog.getByText(t('chat.attach.uploadFailed', { name: '年会照片.png' })),
    ).toBeInTheDocument();
    // 失败后按钮要能再点：否则用户只能关掉弹窗重来
    expect(
      dialog.getByText(t('chat.attach.fromDevice')).closest('button'),
    ).toBeEnabled();
  });

  it('上传进行中：显示进度并挡住第二次上传', async () => {
    const { view } = renderPicker();
    const dialog = await openEntry();

    const picked = new File(['hello'], '年会照片.png', { type: 'image/png' });
    fireEvent.change(fileInput(view.container), {
      target: { files: [picked] },
    });
    await act(async () => {
      upload.setTasks?.([task({ status: 'uploading', progress: 42 })]);
    });

    expect(
      dialog.getByText(t('chat.attach.fromDevice')).closest('button'),
    ).toBeDisabled();
    expect(view.container.querySelector('.ant-progress')).not.toBeNull();
  });

  it('上传在顶栏被取消：入口立刻恢复可用，不永久卡死', async () => {
    const { view } = renderPicker();
    const dialog = await openEntry();

    const picked = new File(['hello'], '年会照片.png', { type: 'image/png' });
    fireEvent.change(fileInput(view.container), {
      target: { files: [picked] },
    });
    await act(async () => {
      upload.setTasks?.([task({ status: 'canceled' })]);
    });

    // 取消走的是引擎的 cancel()，不会回调 onTaskError；只记住「我发起过」就会永久禁用
    expect(
      dialog.getByText(t('chat.attach.fromDevice')).closest('button'),
    ).toBeEnabled();
  });
});

describe('ChatAttachmentPicker · 大小提示', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPage.mockResolvedValue({ records: [], total: 0 });
  });

  it('弹窗里写明单个文件的可用大小，数字与全站体积口径一致', async () => {
    renderPicker();
    const dialog = await openEntry();

    expect(
      dialog.getByText(
        t('chat.attach.sizeLimit', { size: formatBytes(MAX_FILE_SIZE) }),
      ),
    ).toBeInTheDocument();
  });
});

describe('ChatAttachmentPicker · 入口可用性', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPage.mockResolvedValue({ records: [], total: 0 });
  });

  it('发送中或已有待发文件时入口禁用', async () => {
    const { view } = renderPicker({ disabled: true });
    expect(view.container.querySelector('button[aria-label]')).toBeDisabled();
  });

  it('正常情况下入口可点，且弹窗未打开时不发请求', async () => {
    renderPicker();

    expect(screen.getByLabelText(t('chat.attach.entry'))).toBeEnabled();
    expect(mockedPage).not.toHaveBeenCalled();
  });
});
