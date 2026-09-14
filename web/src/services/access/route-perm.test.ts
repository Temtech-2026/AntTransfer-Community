import { describe, expect, it } from 'vitest';

import { ROUTE_PERM_RULES, resolveRoutePerm } from './route-perm';

describe('resolveRoutePerm（最长前缀匹配）', () => {
  it('精确命中与子路径命中', () => {
    expect(resolveRoutePerm('/system/users')).toBe('system:user:list');
    expect(resolveRoutePerm('/system/users/123')).toBe('system:user:list');
    expect(resolveRoutePerm('/system/users/123/edit')).toBe('system:user:list');
  });

  it('未登记的路径返回 undefined（公开页 / 演示页放行）', () => {
    expect(resolveRoutePerm('/welcome')).toBeUndefined();
    expect(resolveRoutePerm('/upload')).toBeUndefined();
    expect(resolveRoutePerm('/system')).toBeUndefined();
    expect(resolveRoutePerm('')).toBeUndefined();
  });

  it('前缀相似但不同段不误命中（/system/users-x）', () => {
    expect(resolveRoutePerm('/system/users-x')).toBeUndefined();
  });

  it('/file 覆盖其下所有子路径', () => {
    expect(resolveRoutePerm('/file')).toBe('file:download');
    expect(resolveRoutePerm('/file/share/1')).toBe('file:download');
  });

  it('CE 无原子权限点的只读页统一用系统管理根节点 system 守卫', () => {
    expect(resolveRoutePerm('/system/depts')).toBe('system');
    expect(resolveRoutePerm('/system/depts/1/edit')).toBe('system');
    expect(resolveRoutePerm('/system/groups')).toBe('system');
    expect(resolveRoutePerm('/system/menus')).toBe('system');
  });

  it('最长前缀优先：/system/users、/system/roles 命中原子权限点而非根节点', () => {
    expect(resolveRoutePerm('/system/users')).toBe('system:user:list');
    expect(resolveRoutePerm('/system/roles/9/permissions')).toBe('system:role:list');
  });

  it('登记表本身无非法项（path 无尾斜杠、perm 非空）', () => {
    for (const rule of ROUTE_PERM_RULES) {
      expect(rule.path.startsWith('/')).toBe(true);
      expect(rule.path.endsWith('/')).toBe(false);
      expect(rule.perm).toBeTruthy();
    }
  });
});
