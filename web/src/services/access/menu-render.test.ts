import { describe, expect, it } from 'vitest';

import { filterProMenuByPerm, toProMenuItems, type ProMenuLike } from './menu-render';

describe('filterProMenuByPerm（静态路由菜单兜底）', () => {
  const menuData = [
    { path: '/welcome', name: '首页' },
    {
      path: '/system',
      name: '系统管理',
      routes: [
        { path: '/system/users', name: '用户' },
        { path: '/system/roles', name: '角色' },
      ],
    },
    { path: '/audit', name: '审计' },
    { path: '/file', name: '文件' },
  ];

  it('无权限的菜单项不渲染', () => {
    const result = filterProMenuByPerm(menuData, new Set(['system:user:list']));

    expect(result.map((item) => item.path)).toEqual(['/welcome', '/system']);
    expect(result[1].routes?.map((item) => item.path)).toEqual(['/system/users']);
  });

  it('未登记的公开页始终保留', () => {
    const result = filterProMenuByPerm(menuData, new Set());

    expect(result.map((item) => item.path)).toEqual(['/welcome']);
  });

  it('子项全被过滤的分组不留下空目录', () => {
    const result = filterProMenuByPerm(menuData, new Set(['file:download']));

    expect(result.map((item) => item.path)).toEqual(['/welcome', '/file']);
  });

  it('页面型节点（自身有权限要求）子项为空也保留', () => {
    const result = filterProMenuByPerm([{ path: '/file', name: '文件' }], new Set(['file:download']));

    expect(result).toHaveLength(1);
  });

  it('保留原对象其余字段（name / icon / 本地化结果不被重建）', () => {
    const original = [{ path: '/welcome', name: '首页', icon: 'home', extra: 'x' }];

    const result = filterProMenuByPerm(original, new Set());

    expect(result[0]).toMatchObject({ name: '首页', icon: 'home', extra: 'x' });
  });

  it('children 与 routes 两种字段名都支持，且过滤后不残留空数组', () => {
    type Item = ProMenuLike & {
      name: string;
      children?: Item[] | null;
      routes?: Item[] | null;
    };
    const childrenInput: Item[] = [
      { path: '/system', name: '系统', children: [{ path: '/system/users', name: '用户' }] },
    ];

    const withChildren = filterProMenuByPerm(childrenInput, new Set());
    expect(withChildren).toEqual([]);

    const kept = filterProMenuByPerm(childrenInput, new Set(['system:user:list']));
    expect(kept[0].children?.map((item) => item.path)).toEqual(['/system/users']);
    expect(kept[0].routes).toBeUndefined();

    const routesInput: Item[] = [
      { path: '/system', name: '系统', routes: [{ path: '/system/users', name: '用户' }] },
    ];
    const keptByRoutes = filterProMenuByPerm(routesInput, new Set(['system:user:list']));
    expect(keptByRoutes[0].routes?.map((item) => item.path)).toEqual(['/system/users']);
    expect(keptByRoutes[0].children).toBeUndefined();
  });

  it('path 为候选数组时取第一个（ProLayout 的 MenuDataItem 允许 string[]）', () => {
    const result = filterProMenuByPerm(
      [{ path: ['/system/users', '/system/users/:id'], name: '用户' }],
      new Set(),
    );

    expect(result).toEqual([]);
  });

  it('空输入返回空数组', () => {
    expect(filterProMenuByPerm(null, new Set())).toEqual([]);
    expect(filterProMenuByPerm([], new Set())).toEqual([]);
  });
});

describe('toProMenuItems（动态菜单）', () => {
  it('图标键映射为图标组件，无注册键则不给图标', () => {
    const items = toProMenuItems([
      { path: '/file', name: '文件', iconKey: 'file', perm: 'file' },
      { path: '/x', name: 'X', perm: 'unknown:thing' },
    ]);

    expect(items[0].icon).toBeTruthy();
    expect(items[1].icon).toBeUndefined();
  });

  it('递归保留层级，叶子节点不带 children 字段', () => {
    const items = toProMenuItems([
      {
        path: '/system',
        name: '系统',
        children: [{ path: '/system/users', name: '用户' }],
      },
    ]);

    expect(items[0].children?.[0].path).toBe('/system/users');
    expect(items[0].children?.[0].children).toBeUndefined();
  });

  it('空输入返回空数组', () => {
    expect(toProMenuItems(null)).toEqual([]);
  });
});
