/**
 * 文件列表 ProTable：渲染与「无权限按钮不渲染」。
 *
 * <p>本页的权限口径是<b>「渲染层显隐」而非安全边界</b>（真正的边界在后端 `@RequiresPerm`），
 * 所以这里断言的每一条都对应 `docs/development/frontend-permission-map.md` 里的一行——
 * 该文档是前端权限映射的单一事实源，代码与它不一致即为缺陷。</p>
 *
 * <p>要钉住的三件事：</p>
 * <ol>
 *   <li><b>数据源由视角决定</b>：「我的文件」与「回收站」是两个端点，
 *       翻页/筛选不得串源；</li>
 *   <li><b>无权限的入口必须消失</b>：按钮可见但点击必然 403，
 *       比按钮不存在更糟（用户会认为系统坏了）；</li>
 *   <li><b>「申请权限」是唯一不受权限点约束的动作</b>——没有权限的人正是要申请的人，
 *       若给它加门禁就形成了死锁。</li>
 * </ol>
 */

import { App } from 'antd';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import access, { type AccessModel } from '@/access';
import { formatBytes } from '@/components/ChunkUpload';
import { DataScope } from '@/services/access';
import {
  fetchFolderTree,
  levelText,
  pageFiles,
  pageRecycleFiles,
  type FileNode,
} from '@/services/file';

import FileWorkbenchPage from './index';

/** 可变的权限模型：`useAccess()` 每次渲染都读它，从而在同一个用例里切换权限 */
const holder = vi.hoisted(() => ({ model: {} as unknown }));

vi.mock('@umijs/max', () => ({
  useAccess: () => holder.model,
  useIntl: () => ({
    formatMessage: (descriptor?: { defaultMessage?: string }) =>
      descriptor?.defaultMessage ?? '',
  }),
  request: vi.fn(),
  history: {
    location: { pathname: '/file', search: '' },
    push: vi.fn(),
    replace: vi.fn(),
  },
}));

vi.mock('@/services/file', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/file')>();
  return {
    ...actual,
    pageFiles: vi.fn(),
    pageRecycleFiles: vi.fn(),
    fetchFolderTree: vi.fn(),
  };
});

// 四个弹窗各自独立成单元（上传弹窗还需要 uploader 注入），此处只关心列表与工具条
vi.mock('./components/UploadModal', () => ({ default: () => null }));
vi.mock('./components/PreviewModal', () => ({ default: () => null }));
vi.mock('./components/ShareModal', () => ({ default: () => null }));
vi.mock('./components/PermissionApplyModal', () => ({ default: () => null }));

const mockedPageFiles = vi.mocked(pageFiles);
const mockedPageRecycle = vi.mocked(pageRecycleFiles);
const mockedFolderTree = vi.mocked(fetchFolderTree);

const node = (overrides: Partial<FileNode> = {}): FileNode =>
  ({
    id: 101,
    name: '季度报告.pdf',
    ext: 'pdf',
    level: 1,
    sizeBytes: 2048,
    updateTime: '2026-09-13 10:00:00',
    ...overrides,
  }) as unknown as FileNode;

/** 授予一组权限点；前端只做「在不在集合里」的判定 */
const grant = (permCodes: string[]) => {
  holder.model = access({
    permissions: { roles: ['USER'], permCodes, dataScope: DataScope.ALL },
  }) as AccessModel;
};

const ALL_PERMS = [
  'file:upload',
  'file:preview',
  'file:download',
  'file:share',
  'file:edit',
  'file:destroy',
];

const renderPage = () => render(
  <App>
    <FileWorkbenchPage />
  </App>,
);

/** 等到首屏数据行渲染出来 */
const waitForRow = async (name = '季度报告.pdf') => {
  await screen.findByText(name);
};

const queryAction = (label: string) => screen.queryByText(label);

beforeEach(() => {
  vi.clearAllMocks();
  grant(ALL_PERMS);
  mockedFolderTree.mockResolvedValue([]);
  mockedPageFiles.mockResolvedValue({ records: [node()], total: 1 } as never);
  mockedPageRecycle.mockResolvedValue({ records: [node({ id: 202 })], total: 1 } as never);
});

describe('文件列表渲染', () => {
  it('渲染数据行的名称 / 大小 / 密级，并渲染全部操作入口', async () => {
    renderPage();
    await waitForRow();

    // 大小与密级用各自格式化函数的结果断言，避免把展示格式写死在测试里
    expect(screen.getByText(formatBytes(2048))).toBeTruthy();
    expect(screen.getByText(levelText(1))).toBeTruthy();

    for (const label of ['预览', '下载', '分享', '申请权限', '删除']) {
      expect(queryAction(label), `有权限时「${label}」应渲染`).not.toBeNull();
    }
    // 工具栏
    expect(screen.getByRole('button', { name: /上传文件/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /回收站/ })).toBeTruthy();
    // 数据源必须是「我的文件」而不是回收站
    expect(mockedPageFiles).toHaveBeenCalled();
    expect(mockedPageRecycle).not.toHaveBeenCalled();
  });

  it('无权限的入口不渲染，但「申请权限」始终保留', async () => {
    grant(['file:download']);
    renderPage();
    await waitForRow();

    expect(queryAction('下载')).not.toBeNull();
    // 没有 file:preview / file:share / file:edit，这三个入口必须消失
    expect(queryAction('预览')).toBeNull();
    expect(queryAction('分享')).toBeNull();
    expect(queryAction('删除')).toBeNull();
    // 关键：申请权限无门禁——没有权限的人正是要申请的人，加门禁会形成死锁
    expect(queryAction('申请权限')).not.toBeNull();
  });

  it('上传入口由 file:upload 控制（对齐 frontend-permission-map 的「上传 / 秒传」一行）', async () => {
    grant(['file:download']);
    renderPage();
    await waitForRow();

    expect(screen.queryByRole('button', { name: /上传文件/ })).toBeNull();
  });

  it('回收站入口由 file:preview 控制：无该权限时进不去', async () => {
    grant(['file:download', 'file:upload']);
    renderPage();
    await waitForRow();

    expect(screen.queryByRole('button', { name: /回收站/ })).toBeNull();
  });
});

describe('回收站视角', () => {
  const enterRecycle = async () => {
    renderPage();
    await waitForRow();
    fireEvent.click(screen.getByRole('button', { name: /回收站/ }));
    await waitFor(() => expect(mockedPageRecycle).toHaveBeenCalled());
  };

  it('切换后数据源换成 pageRecycleFiles，操作列换成「还原 / 彻底销毁」', async () => {
    await enterRecycle();

    // 撤回：预览 / 下载 / 分享 对已移入回收站的文件没有意义
    expect(queryAction('预览')).toBeNull();
    expect(queryAction('下载')).toBeNull();
    expect(queryAction('分享')).toBeNull();
    expect(queryAction('还原')).not.toBeNull();
    expect(queryAction('彻底销毁')).not.toBeNull();
    // 工具栏出现返回入口与清空入口
    expect(screen.getByRole('button', { name: /返回我的文件/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /清空回收站/ })).toBeTruthy();
    expect(mockedPageRecycle).toHaveBeenCalledWith(
      expect.objectContaining({ current: expect.any(Number) }),
    );
  });

  it('「清空回收站」由 file:destroy 控制', async () => {
    // 进入回收站需要 file:preview；能还原但无销毁权
    grant(['file:preview', 'file:edit']);
    await enterRecycle();

    expect(queryAction('还原')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /清空回收站/ })).toBeNull();
    // 行内的「彻底销毁」同样不可见
    expect(queryAction('彻底销毁')).toBeNull();
  });
});
