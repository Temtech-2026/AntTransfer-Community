import { describe, expect, it } from 'vitest';

import {
  ROLE,
  hasAllPerms,
  hasAnyPerm,
  hasPerm,
  hasRole,
  isSuperAdmin,
  normalizePerms,
  toPermSet,
} from './perm';

describe('normalizePerms', () => {
  it('去重 / 去空 / 去首尾空格', () => {
    expect(normalizePerms([' file:download ', '', 'file:download', '  ', null as never])).toEqual([
      'file:download',
    ]);
  });

  it('空输入返回空数组', () => {
    expect(normalizePerms(null)).toEqual([]);
    expect(normalizePerms(undefined)).toEqual([]);
  });
});

describe('hasPerm / hasAnyPerm / hasAllPerms', () => {
  const set = toPermSet(['file:download', 'system:user:list']);

  it('hasPerm：无声明视为无需权限', () => {
    expect(hasPerm(set, 'file:download')).toBe(true);
    expect(hasPerm(set, 'system:role:list')).toBe(false);
    expect(hasPerm(set, undefined)).toBe(true);
    expect(hasPerm(set, null)).toBe(true);
  });

  it('hasPerm：空源全拒绝', () => {
    expect(hasPerm(null, 'file:download')).toBe(false);
  });

  it('hasAnyPerm：满足其一即可，空数组视为放行', () => {
    expect(hasAnyPerm(set, ['system:role:list', 'file:download'])).toBe(true);
    expect(hasAnyPerm(set, ['a', 'b'])).toBe(false);
    expect(hasAnyPerm(set, [])).toBe(true);
  });

  it('hasAllPerms：全部满足才放行', () => {
    expect(hasAllPerms(set, ['file:download', 'system:user:list'])).toBe(true);
    expect(hasAllPerms(set, ['file:download', 'a'])).toBe(false);
  });

  it('数组源与 Set 源判定一致', () => {
    expect(hasPerm(['file:download'], 'file:download')).toBe(true);
    expect(hasPerm(['file:download'], 'file:upload')).toBe(false);
  });
});

describe('角色判定（仅供 UI 提示）', () => {
  it('hasRole / isSuperAdmin', () => {
    expect(hasRole([ROLE.SUPER_ADMIN], ROLE.SUPER_ADMIN)).toBe(true);
    expect(hasRole(null, ROLE.SUPER_ADMIN)).toBe(false);
    expect(isSuperAdmin(['AUDITOR'])).toBe(false);
    expect(isSuperAdmin(['AUDITOR', 'SUPER_ADMIN'])).toBe(true);
  });
});
