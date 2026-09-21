/**
 * 文件域 API 的取件链路单测。
 *
 * <p>只钉住「换票 → 把取件地址交给浏览器原生下载」这条契约。取件一旦交出去，前端就不再持有
 * 字节流，所以这里断言的是「交给了谁、交了什么地址」，而不是 blob 内容。</p>
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { post, startNativeDownload } = vi.hoisted(() => ({
  post: vi.fn(),
  startNativeDownload: vi.fn(() => true),
}));

// api.ts 只依赖 services/request 与 ./endpoints，整体替换传输层即可隔离被测逻辑
vi.mock('@/services/request', () => ({
  del: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post,
  requestPage: vi.fn(),
  startNativeDownload,
}));

import { downloadNode } from './api';

const NODE = { id: 1, name: '季度报表.xlsx' } as never;

beforeEach(() => {
  vi.clearAllMocks();
  startNativeDownload.mockReturnValue(true);
});

describe('downloadNode（换票 → 浏览器原生下载）', () => {
  it('换票后把取件地址交给原生下载通道，不再自己拉整份字节', async () => {
    post.mockImplementation(async () => ({ ticket: 'tk-1', expiresInSeconds: 300 }));

    await downloadNode(NODE, { silent: true });

    expect(post).toHaveBeenCalledWith('/api/v1/files/1/ticket', undefined, {
      silent: true,
    });
    expect(startNativeDownload).toHaveBeenCalledWith(
      '/api/v1/files/1/content?ticket=tk-1',
      '季度报表.xlsx',
    );
  });

  it('未要求静默时不带静默标记（换票失败要弹全局提示）', async () => {
    post.mockImplementation(async () => ({ ticket: 'tk-2', expiresInSeconds: 300 }));

    await downloadNode(NODE);

    expect(post).toHaveBeenCalledWith('/api/v1/files/1/ticket', undefined, {});
  });

  it('服务端下发相对地址时补成同源绝对路径（iframe 的相对解析与页面层级有关）', async () => {
    post.mockImplementation(async () => ({
      ticket: 'tk-3',
      downloadUrl: 'api/v1/files/1/content?ticket=tk-3',
      expiresInSeconds: 300,
    }));

    await downloadNode(NODE);

    expect(startNativeDownload).toHaveBeenCalledWith(
      '/api/v1/files/1/content?ticket=tk-3',
      '季度报表.xlsx',
    );
  });

  it('换票失败直接抛出，且不触发任何下载', async () => {
    post.mockImplementation(async () => {
      throw new Error('无操作权限');
    });

    await expect(downloadNode(NODE, { silent: true })).rejects.toThrow('无操作权限');
    expect(startNativeDownload).not.toHaveBeenCalled();
  });
});
