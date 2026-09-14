import { describe, expect, it } from 'vitest';

import {
  buildMenuTree,
  filterMenuByPerm,
  flattenMenuPaths,
  isRenderableMenu,
  toMenuData,
} from './menu';
import { MenuNodeType, type MenuDataNode, type MenuNode } from './types';

function node(over: Partial<MenuNode> & { id: number }): MenuNode {
  return {
    parentId: 0,
    permCode: `p${over.id}`,
    permName: `名称${over.id}`,
    type: MenuNodeType.MENU,
    routePath: `/p${over.id}`,
    ...over,
  };
}

describe('isRenderableMenu', () => {
  it('仅菜单维度 / 未隐藏 / 有路由路径才算可渲染', () => {
    expect(isRenderableMenu(node({ id: 1 }))).toBe(true);
    expect(isRenderableMenu(node({ id: 1, type: MenuNodeType.ACTION }))).toBe(false);
    expect(isRenderableMenu(node({ id: 1, visible: 0 }))).toBe(false);
    expect(isRenderableMenu(node({ id: 1, routePath: null }))).toBe(false);
    // 未回填 visible 视为显示
    expect(isRenderableMenu(node({ id: 1, visible: null }))).toBe(true);
  });
});

describe('buildMenuTree', () => {
  it('扁平列表按 parentId 组装并按 sortNo 排序', () => {
    const tree = buildMenuTree([
      node({ id: 2, parentId: 1, sortNo: 2 }),
      node({ id: 1, parentId: 0, routePath: null, sortNo: 1 }),
      node({ id: 3, parentId: 1, sortNo: 1 }),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe(1);
    // 容器自身无 routePath → 取第一个后代路径，保证可点击
    expect(tree[0].routePath).toBe('/p3');
    expect(tree[0].children?.map((child) => child.id)).toEqual([3, 2]);
  });

  it('剪掉隐藏节点与操作点', () => {
    const tree = buildMenuTree([
      node({ id: 1 }),
      node({ id: 2, visible: 0 }),
      node({ id: 3, type: MenuNodeType.ACTION }),
    ]);

    expect(tree.map((item) => item.id)).toEqual([1]);
  });

  it('子项全被剪掉的空容器一并丢弃', () => {
    const tree = buildMenuTree([
      node({ id: 1, routePath: null }),
      node({ id: 2, parentId: 1, visible: 0 }),
    ]);

    expect(tree).toEqual([]);
  });

  it('已组装好的树也能吃（collect 去重）', () => {
    const tree = buildMenuTree([
      node({ id: 1, routePath: null, children: [node({ id: 2, parentId: 1 })] }),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].children?.[0].id).toBe(2);
  });

  it('空输入返回空数组', () => {
    expect(buildMenuTree(null)).toEqual([]);
    expect(buildMenuTree([])).toEqual([]);
  });
});

describe('toMenuData', () => {
  it('名称取 permName，图标只给键，perm 用于过滤', () => {
    const data = toMenuData([
      node({ id: 1, permCode: 'file', permName: '文件', icon: 'folder', routePath: '/file' }),
    ]);

    expect(data).toEqual([
      { path: '/file', name: '文件', iconKey: 'folder', perm: 'file', children: undefined },
    ]);
  });

  it('permName 缺失时回退 permCode', () => {
    const data = toMenuData([node({ id: 1, permCode: 'file', permName: '' })]);

    expect(data[0].name).toBe('file');
  });
});

describe('filterMenuByPerm', () => {
  const menulist: MenuDataNode[] = [
    { path: '/welcome', name: '首页' },
    {
      path: '/system',
      name: '系统管理',
      children: [
        { path: '/system/users', name: '用户', perm: 'system:user:list' },
        { path: '/system/roles', name: '角色', perm: 'system:role:list' },
      ],
    },
    { path: '/audit', name: '审计', perm: 'audit:log:read' },
  ];

  it('无权限的菜单项不渲染', () => {
    const result = filterMenuByPerm(menulist, new Set(['system:user:list']));

    expect(result.map((item) => item.path)).toEqual(['/welcome', '/system']);
    expect(result[1].children?.map((item) => item.path)).toEqual(['/system/users']);
  });

  it('子项全被过滤且父级无 perm → 父级一并丢弃', () => {
    const result = filterMenuByPerm(menulist, new Set(['nothing']));

    expect(result.map((item) => item.path)).toEqual(['/welcome']);
  });

  it('父级自身有 perm 是真实页面 → 即使子项空也保留', () => {
    const result = filterMenuByPerm(
      [{ path: '/file', name: '文件', perm: 'file:download', children: [] }],
      new Set(['file:download']),
    );

    expect(result).toHaveLength(1);
  });

  it('空输入与空权限源', () => {
    expect(filterMenuByPerm(null, new Set())).toEqual([]);
    expect(filterMenuByPerm(menulist, new Set())).toEqual([{ path: '/welcome', name: '首页' }]);
  });
});

describe('flattenMenuPaths', () => {
  it('递归收集并剔除空路径', () => {
    const paths = flattenMenuPaths([
      { path: '/a', name: 'a', children: [{ path: '/a/b', name: 'b' }, { path: '', name: 'c' }] },
      { path: '/d', name: 'd' },
    ]);

    expect(paths).toEqual(['/a', '/a/b', '/d']);
  });
});
