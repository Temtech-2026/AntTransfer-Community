/**
 * 外发分享弹窗：**提交入参**与**展示形态**的契约。
 *
 * <p>钉住的是线上先后出过的两次报错：</p>
 * <ol>
 *   <li><b>提交的 `fileId` 必须是「物理文件 ID」。</b>外发分享是物理文件维度——后端
 *       `ShareLinkService#requireOwnedFile` 拿 `fileId` 查 `sys_file`，`sys_share_link.file_id`
 *       关联的也是 `sys_file.id`；而 `FileNode.id` 是 `sys_file_node` 的条目 ID，
 *       两张表的 ID 都由雪花生成、分属不同值空间。传条目 ID 只会得到
 *       4005「文件不存在或已被删除」（与「无权」刻意不可区分）。</li>
 *   <li><b>到期时间必须是 ISO-8601（`T` 分隔）。</b>后端 `CreateShareRequest.expireAt` 是
 *       `LocalDateTime` 且未配 `@JsonFormat`，空格分隔的 `yyyy-MM-dd HH:mm:ss` 会被
 *       GlobalExceptionHandler 判成 2004「请求体格式错误，请检查 JSON 与字段类型」。</li>
 * </ol>
 *
 * <p>展示层反向钉住：服务端回显的是带 `T` 的 ISO，成功态不得把 `T` 直接摆给用户。</p>
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { message } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { testFormatMessage } from '@/locales/testTranslate';
import { createShare, type FileNode, type ShareLink } from '@/services/file';

import ShareModal from './ShareModal';

/** 断言用：从 zh-CN 语言包取文案，键写错即失败（不在测试里另抄一份中文） */
const t = (id: string, values?: Record<string, unknown>) => testFormatMessage({ id, values });

vi.mock('@umijs/max', async () => {
  const { testFormatMessage: translate } = await import('@/locales/testTranslate');
  return {
    useIntl: () => ({
      // 兼容两种调用形态：`formatMessage({ id, values })` 与 `formatMessage({ id }, values)`
      formatMessage: (
        descriptor: { id: string; values?: Record<string, unknown> },
        values?: Record<string, unknown>,
      ) => translate({ id: descriptor.id, values: values ?? descriptor.values }),
    }),
  };
});

vi.mock('@/services/file', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/file')>();
  // 只打桩真正发请求的那个函数；URL 拼装、提取码校验等纯函数用真实实现
  return { ...actual, createShare: vi.fn() };
});

const mockedCreateShare = vi.mocked(createShare);

/**
 * 两个 ID 刻意取不同的值：`NODE_ID` 来自 `sys_file_node`，`FILE_OBJECT_ID` 来自 `sys_file`。
 * 用例靠「断言提交的是后者、且不是前者」抓住字段错用。
 */
const NODE_ID = '2026091300000000123';
const FILE_OBJECT_ID = '2026091300000000777';

const fileNode = (overrides: Partial<FileNode> = {}) =>
  ({
    id: NODE_ID,
    fileId: FILE_OBJECT_ID,
    name: '季度报告.pdf',
    level: 1,
    ...overrides,
  }) as unknown as FileNode;

const shareLink: ShareLink = {
  token: 'tk-20260913',
  expireAt: '2026-09-28T21:30:00',
  downloadLimit: 10,
  remainingCount: 10,
};

const renderModal = (node: FileNode = fileNode()) =>
  render(<ShareModal open node={node} onClose={vi.fn()} />);

/** 点 footer 里的「生成链接」 */
const clickGenerate = () =>
  fireEvent.click(
    screen.getByRole('button', { name: new RegExp(t('file.share.generate')) }),
  );

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  // 用例内 spy 的 `message.error` 必须还原，否则会污染后续用例
  vi.restoreAllMocks();
});

describe('ShareModal 提交入参契约', () => {
  it('提交的是物理文件 ID（node.fileId），而不是条目 ID（node.id）', async () => {
    mockedCreateShare.mockResolvedValue(shareLink);
    renderModal();
    clickGenerate();

    await waitFor(() => expect(mockedCreateShare).toHaveBeenCalledTimes(1));
    const payload = mockedCreateShare.mock.calls[0][0];
    expect(payload.fileId).toBe(FILE_OBJECT_ID);
    expect(payload.fileId).not.toBe(NODE_ID);
  });

  it('行数据缺少物理文件 ID 时就地拦截，不发注定失败的请求', async () => {
    const errorSpy = vi
      .spyOn(message, 'error')
      .mockImplementation(() => undefined as never);
    renderModal(fileNode({ fileId: null }));
    clickGenerate();

    await waitFor(() => expect(errorSpy).toHaveBeenCalledTimes(1));
    expect(mockedCreateShare).not.toHaveBeenCalled();
    expect(errorSpy.mock.calls[0][0]).toBe(t('file.share.missingFileId'));
  });

  it('以 ISO-8601（T 分隔）提交到期时间', async () => {
    mockedCreateShare.mockResolvedValue(shareLink);
    renderModal();
    clickGenerate();

    await waitFor(() => expect(mockedCreateShare).toHaveBeenCalledTimes(1));
    const payload = mockedCreateShare.mock.calls[0][0];
    // 空格分隔会让后端 LocalDateTime 反序列化失败（2004 请求体格式错误）
    expect(payload.expireAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });
});

describe('ShareModal 展示契约', () => {
  it('成功态把服务端回显的 ISO 时间转成本地可读格式', async () => {
    mockedCreateShare.mockResolvedValue(shareLink);
    renderModal();
    clickGenerate();

    await screen.findByText(t('file.share.resultTitle'));
    expect(screen.getByText('2026-09-28 21:30:00')).toBeTruthy();
    // 不得把 ISO 的 `T` 直接展示给用户
    expect(screen.queryByText(shareLink.expireAt as string)).toBeNull();
  });
});
