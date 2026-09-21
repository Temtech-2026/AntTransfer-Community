/**
 * 分享页「新建分享」的文件下拉选项映射。
 *
 * <p>钉住的是与文件页 `ShareModal` 同源的字段误用：外发分享按**物理文件**维度，
 * 选项 `value` 必须是 `FileNode.fileId`（`sys_file.id`），而不是 `FileNode.id`
 * （`sys_file_node` 的条目 ID）。两者都由雪花生成但分属不同值空间，
 * 传错只会得到 4005「文件不存在或已被删除」。</p>
 */
import { describe, expect, it } from 'vitest';

import type { FileNode } from '@/services/file';

import { toFileSelectOptions } from './CreateShareModal';

const node = (overrides: Partial<FileNode>): FileNode =>
  ({ id: '', name: '', ...overrides }) as unknown as FileNode;

describe('toFileSelectOptions', () => {
  it('选项 value 取物理文件 ID（node.fileId）而非条目 ID（node.id）', () => {
    const options = toFileSelectOptions([
      node({
        id: '2026091300000000123',
        fileId: '2026091300000000777',
        name: '季度报告.pdf',
      }),
    ]);

    expect(options).toEqual([
      { label: '季度报告.pdf', value: '2026091300000000777' },
    ]);
  });

  it('过滤掉缺少物理文件 ID 的残缺行，不让用户选中必然失败的文件', () => {
    const options = toFileSelectOptions([
      node({ id: '1', fileId: '9001', name: '有物理文件.pdf' }),
      node({ id: '2', fileId: null, name: '残缺行.pdf' }),
      node({ id: '3', name: '未下发该字段.pdf' }),
    ]);

    expect(options).toEqual([{ label: '有物理文件.pdf', value: '9001' }]);
  });
});
