import { describe, expect, it } from 'vitest';

import type { FolderNode } from '@/services/file';

import {
  findFolder,
  folderChildren,
  folderPath,
  folderPathText,
} from './folder-tree';

const TREE: FolderNode[] = [
  {
    id: 1,
    name: '研发',
    children: [
      { id: 11, name: '后端', children: [{ id: 111, name: '归档' }] },
      { id: 12, name: '前端' },
    ],
  },
  { id: 2, name: '市场' },
];

describe('findFolder（DFS 查找）', () => {
  it('可命中任意层级节点', () => {
    expect(findFolder(TREE, 1)?.name).toBe('研发');
    expect(findFolder(TREE, 12)?.name).toBe('前端');
    expect(findFolder(TREE, 111)?.name).toBe('归档');
  });

  it('未命中 / 空输入返回 undefined', () => {
    expect(findFolder(TREE, 999)).toBeUndefined();
    expect(findFolder(TREE, undefined)).toBeUndefined();
    expect(findFolder(TREE, 0)).toBeUndefined();
    expect(findFolder(null, 1)).toBeUndefined();
  });
});

describe('folderChildren（直接子目录）', () => {
  it('根目录返回顶层节点', () => {
    expect(folderChildren(TREE, undefined).map((n) => n.id)).toEqual([1, 2]);
    expect(folderChildren(TREE, 0).map((n) => n.id)).toEqual([1, 2]);
  });

  it('指定目录返回其 children，叶子节点返回空数组', () => {
    expect(folderChildren(TREE, 1).map((n) => n.id)).toEqual([11, 12]);
    expect(folderChildren(TREE, 12)).toEqual([]);
  });

  it('目录不存在时返回空数组', () => {
    expect(folderChildren(TREE, 999)).toEqual([]);
    expect(folderChildren(null, 1)).toEqual([]);
  });
});

describe('folderPath（面包屑）', () => {
  it('返回从根到当前目录的完整路径（含自身）', () => {
    expect(folderPath(TREE, 111).map((n) => n.id)).toEqual([1, 11, 111]);
  });

  it('根目录 / 未命中返回空数组', () => {
    expect(folderPath(TREE, undefined)).toEqual([]);
    expect(folderPath(TREE, 999)).toEqual([]);
  });

  it('文案始终以「全部文件」起头', () => {
    expect(folderPathText(TREE, 111)).toBe('全部文件 / 研发 / 后端 / 归档');
    expect(folderPathText(TREE, undefined)).toBe('全部文件');
  });
});

describe('脏数据防护（深度上限）', () => {
  /** 构造 L1 → L2 → ... → L40 的深链，超出 MAX_DEPTH(32)。 */
  const deepChain = (): FolderNode => {
    let node: FolderNode = { id: 40, name: 'L40' };
    for (let id = 39; id >= 1; id -= 1) {
      node = { id, name: `L${id}`, children: [node] };
    }
    return node;
  };

  it('深度上限内的节点可正常命中', () => {
    const tree = [deepChain()];
    expect(findFolder(tree, 20)?.name).toBe('L20');
    expect(folderPath(tree, 20)).toHaveLength(20);
  });

  it('超出深度上限时安全返回 undefined / 空数组，不递归挂死', () => {
    const tree = [deepChain()];
    expect(findFolder(tree, 40)).toBeUndefined();
    expect(folderPath(tree, 40)).toEqual([]);
  });
});
