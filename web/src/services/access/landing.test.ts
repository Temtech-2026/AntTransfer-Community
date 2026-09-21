import { afterEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_REDIRECT_PATH } from '@/utils/redirect';

import { canReachPath, pathnameOf, resolveLoginLandingPath } from './landing';

/** 内置 USER（普通用户）：有文件域基础能力，无审计 / 系统管理面 */
const USER_PERMS = ['file:preview', 'file:download', 'file:upload', 'file:share'];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pathnameOf', () => {
  it('剥离 query 与 hash，只留路径段', () => {
    expect(pathnameOf('/file')).toBe('/file');
    expect(pathnameOf('/file?dir=3')).toBe('/file');
    expect(pathnameOf('/system/users?page=2#top')).toBe('/system/users');
  });
});

describe('canReachPath（与 PermGuard 同口径）', () => {
  it('未登记守卫的路径恒可达（公开页 / 自助页）', () => {
    expect(canReachPath('/welcome', [])).toBe(true);
    expect(canReachPath('/workbench', [])).toBe(true);
    expect(canReachPath('/permission-map', [])).toBe(true);
  });

  it('已登记守卫的路径按权限点判定', () => {
    expect(canReachPath('/file', USER_PERMS)).toBe(true);
    expect(canReachPath('/audit', USER_PERMS)).toBe(false);
    expect(canReachPath('/system/users', USER_PERMS)).toBe(false);
  });
});

describe('resolveLoginLandingPath', () => {
  it('普通用户带着越权 redirect 登录：回落默认落点，而不是落进 403', async () => {
    await expect(
      resolveLoginLandingPath('/system/users', async () => USER_PERMS),
    ).resolves.toBe(DEFAULT_REDIRECT_PATH);
    await expect(
      resolveLoginLandingPath('/audit', async () => USER_PERMS),
    ).resolves.toBe(DEFAULT_REDIRECT_PATH);
  });

  it('有权限时保留原回跳目标（含子路径）', async () => {
    await expect(resolveLoginLandingPath('/file', async () => USER_PERMS)).resolves.toBe('/file');
    await expect(
      resolveLoginLandingPath('/system/users/9', async () => ['system:user:list']),
    ).resolves.toBe('/system/users/9');
  });

  it('query / hash 只参与判定，不改写落点', async () => {
    await expect(
      resolveLoginLandingPath('/file?dir=3#top', async () => USER_PERMS),
    ).resolves.toBe('/file?dir=3#top');
    // 同样的 query 也要能被守卫识别，否则会被误放行
    await expect(
      resolveLoginLandingPath('/system/users?page=2', async () => USER_PERMS),
    ).resolves.toBe(DEFAULT_REDIRECT_PATH);
  });

  it('落点不受守卫保护时，不发起权限请求', async () => {
    const loadPermCodes = vi.fn(async () => USER_PERMS);

    await expect(resolveLoginLandingPath('/workbench', loadPermCodes)).resolves.toBe('/workbench');
    await expect(resolveLoginLandingPath(null, loadPermCodes)).resolves.toBe(DEFAULT_REDIRECT_PATH);
    await expect(resolveLoginLandingPath('/welcome', loadPermCodes)).resolves.toBe(
      DEFAULT_REDIRECT_PATH,
    );

    expect(loadPermCodes).not.toHaveBeenCalled();
  });

  it('仍挡住 open redirect（外链 / 协议相对）', async () => {
    const loadPermCodes = vi.fn(async () => USER_PERMS);

    await expect(resolveLoginLandingPath('https://evil.example', loadPermCodes)).resolves.toBe(
      DEFAULT_REDIRECT_PATH,
    );
    await expect(resolveLoginLandingPath('//evil.example', loadPermCodes)).resolves.toBe(
      DEFAULT_REDIRECT_PATH,
    );

    expect(loadPermCodes).not.toHaveBeenCalled();
  });

  it('权限快照拉取失败：按全拒绝回落，绝不放行到受保护页', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      resolveLoginLandingPath('/system/users', async () => {
        throw new Error('权限接口抖动');
      }),
    ).resolves.toBe(DEFAULT_REDIRECT_PATH);
  });

  it('权限快照为空（无角色用户）同样回落', async () => {
    await expect(resolveLoginLandingPath('/file', async () => [])).resolves.toBe(
      DEFAULT_REDIRECT_PATH,
    );
  });

  it('数组型权限点按「满足其一」判定', async () => {
    // /system/depts 由系统管理菜单根节点 system 守卫
    await expect(resolveLoginLandingPath('/system/depts', async () => ['system'])).resolves.toBe(
      '/system/depts',
    );
  });
});
