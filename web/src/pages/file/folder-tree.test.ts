import { describe, expect, it } from 'vitest';

import type { FolderNode } from '@/services/file';

import {
  findFolder,
  folderChildren,
  folderPath,
  folderPathText,
} from './folder-tree';

/** 目录 ID 是雪花 ID，一律用字符串承载（见 `services/file/types` 的 ID 语境说明）。 */
const TREE: FolderNode[] = [
  {
    id: '1',
    name: '研发',
    children: [
      { id: '11', name: '后端', children: [{ id: '111', name: '归档' }] },
      { id: '12', name: '前端' },
    ],
  },
  { id: '2', name: '市场' },
];

describe('findFolder（DFS 查找）', () => {
  it('可命中任意层级节点', () => {
    expect(findFolder(TREE, '1')?.name).toBe('研发');
    expect(findFolder(TREE, '12')?.name).toBe('前端');
    expect(findFolder(TREE, '111')?.name).toBe('归档');
  });

  it('未命中 / 空输入返回 undefined', () => {
    expect(findFolder(TREE, '999')).toBeUndefined();
    expect(findFolder(TREE, undefined)).toBeUndefined();
    // 根目录哨兵值：'0' 是真值字符串，不能被当成普通目录去查找
    expect(findFolder(TREE, '0')).toBeUndefined();
    expect(findFolder(null, '1')).toBeUndefined();
  });
});

describe('folderChildren（直接子目录）', () => {
  it('根目录返回顶层节点', () => {
    expect(folderChildren(TREE, undefined).map((n) => n.id)).toEqual(['1', '2']);
    expect(folderChildren(TREE, '0').map((n) => n.id)).toEqual(['1', '2']);
  });

  it('指定目录返回其 children，叶子节点返回空数组', () => {
    expect(folderChildren(TREE, '1').map((n) => n.id)).toEqual(['11', '12']);
    expect(folderChildren(TREE, '12')).toEqual([]);
  });

  it('目录不存在时返回空数组', () => {
    expect(folderChildren(TREE, '999')).toEqual([]);
    expect(folderChildren(null, '1')).toEqual([]);
  });
});

describe('folderPath（面包屑）', () => {
  it('返回从根到当前目录的完整路径（含自身）', () => {
    expect(folderPath(TREE, '111').map((n) => n.id)).toEqual(['1', '11', '111']);
  });

  it('根目录 / 未命中返回空数组', () => {
    expect(folderPath(TREE, undefined)).toEqual([]);
    expect(folderPath(TREE, '0')).toEqual([]);
    expect(folderPath(TREE, '999')).toEqual([]);
  });

  it('根目录文案由调用方传入（不内嵌语言文案）', () => {
    const root = '全部文件';
    expect(folderPathText(TREE, '111', root)).toBe('全部文件 / 研发 / 后端 / 归档');
    expect(folderPathText(TREE, undefined, root)).toBe('全部文件');
  });

  it('不传根目录文案时只拼接各级目录名', () => {
    expect(folderPathText(TREE, '111')).toBe('研发 / 后端 / 归档');
  });
});

describe('脏数据防护（深度上限）', () => {
  /** 构造 L1 → L2 → ... → L40 的深链，超出 MAX_DEPTH(32)。 */
  const deepChain = (): FolderNode => {
    let node: FolderNode = { id: '40', name: 'L40' };
    for (let level = 39; level >= 1; level -= 1) {
      node = { id: String(level), name: `L${level}`, children: [node] };
    }
    return node;
  };

  it('深度上限内的节点可正常命中', () => {
    const tree = [deepChain()];
    expect(findFolder(tree, '20')?.name).toBe('L20');
    expect(folderPath(tree, '20')).toHaveLength(20);
  });

  it('超出深度上限时安全返回 undefined / 空数组，不递归挂死', () => {
    const tree = [deepChain()];
    expect(findFolder(tree, '40')).toBeUndefined();
    expect(folderPath(tree, '40')).toEqual([]);
  });
});

describe('雪花 ID 口径（回归：目录 ID 不得被 Number() 归一）', () => {
  /** 真实形态的 19 位雪花 ID——超出 JS 安全整数范围（2^53-1）。 */
  const SNOWFLAKE = '1943123456789012345';
  const SNOWFLAKE_TREE: FolderNode[] = [{ id: SNOWFLAKE, name: '大 ID 目录' }];

  it('字符串 ID 可被精确定位', () => {
    expect(findFolder(SNOWFLAKE_TREE, SNOWFLAKE)?.name).toBe('大 ID 目录');
  });

  it('一旦被转成 number，末位失真后就再也查不到该目录', () => {
    const distorted = String(Number(SNOWFLAKE));
    expect(distorted).not.toBe(SNOWFLAKE);
    expect(findFolder(SNOWFLAKE_TREE, distorted)).toBeUndefined();
  });
});
