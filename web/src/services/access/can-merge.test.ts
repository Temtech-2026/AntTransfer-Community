/**
 * `access().can()` 的权限合并语义测试。
 *
 * <p><b>先把口径摆正</b>：本仓库的「并集」与「显式 Deny 优先」不在同一个执行位置——</p>
 * <ul>
 *   <li><b>并集</b>：后端把用户所有角色的权限点合并成一份 {@code permCodes} 下发，
 *       前端 {@link access} 只做规范化（去重/去空/去空格）与建 Set；</li>
 *   <li><b>显式 Deny 优先</b>：减法在<b>后端</b>的权限解析阶段完成，
 *       下发的 {@code permCodes} 已经是「减过的结果」（见 `perm.ts` / `types.ts` 文件头约定）。</li>
 * </ul>
 *
 * <p>因此本文件要钉的不是「前端怎么算 Deny」，而是三条不可退让的边界：</p>
 * <ol>
 *   <li>前端<b>不得</b>自己引入 deny 列表做二次减法——两套减法必然漂移；
 *       被 Deny 的权限点只表现为「不在集合里」，判定结果自然为 false；</li>
 *   <li>{@code can()} 恒为集合成员判断，<b>不因超管角色而放大</b>——
 *       后端对超管同样做减法（审计读权限不得因超管身份自动获得），
 *       前端若按角色放行就等于绕过 Deny；</li>
 *   <li>拿不到权限快照时<b>全拒绝</b>（fail-closed）且 {@code dataScope} 兜底为「仅本人」，
 *       接口抖动不得造成权限提升。</li>
 * </ol>
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import access, { type AccessInitialState } from '@/access';
import { requestData } from '@/services/request';

import {
  DENY_ALL_PERMISSION,
  fetchMyPermission,
  normalizeMyPermission,
} from './api';
import { DataScope } from './types';

vi.mock('@/services/request', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/request')>();
  return { ...actual, requestData: vi.fn() };
});

const mockedRequestData = vi.mocked(requestData);

/** 构造 initialState；currentUser 形状来自 Umi 模板，这里只关心 access 字段 */
const state = (
  permission?: { roles: string[]; permCodes: string[]; dataScope: number },
  user?: Record<string, unknown>,
): AccessInitialState => ({
  permissions: permission,
  currentUser: user as unknown as NonNullable<AccessInitialState['currentUser']>,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('并集：多角色权限点在 access() 边界被规范化', () => {
  it('来自不同角色的权限点均可命中（后端并集已合并）', () => {
    // 角色 A 给 file:download，角色 B 给 system:user:list —— 合并下发
    const model = access(
      state({
        roles: ['DEPT_ADMIN', 'AUDITOR'],
        permCodes: ['file:download', 'system:user:list'],
        dataScope: DataScope.ALL,
      }),
    );

    expect(model.can('file:download')).toBe(true);
    expect(model.can('system:user:list')).toBe(true);
    // 并集不等于全量：没给的仍然拒绝
    expect(model.can('file:destroy')).toBe(false);
  });

  it('并集去重 + 去空 + 去首尾空格，permCodes 与 permSet 一致', () => {
    const model = access(
      state({
        roles: ['USER'],
        permCodes: [
          ' file:download ',
          'file:download',
          '',
          '   ',
          'file:upload',
        ] as string[],
        dataScope: DataScope.SELF,
      }),
    );

    expect(model.permCodes).toEqual(['file:download', 'file:upload']);
    expect([...model.permSet]).toEqual(model.permCodes);
    // 规范化后的裸码可命中；带空格的原始形态不可能出现
    expect(model.can('file:download')).toBe(true);
    expect(model.can(' file:download ')).toBe(false);
  });

  it('判据与后端 perm_code 逐字符一致：大小写不同即视为不同权限点', () => {
    const model = access(
      state({ roles: ['USER'], permCodes: ['file:download'], dataScope: DataScope.SELF }),
    );

    expect(model.can('file:Download')).toBe(false);
    expect(model.can('FILE:DOWNLOAD')).toBe(false);
    expect(model.can('file.download')).toBe(false);
  });
});

describe('显式 Deny：前置减法在后端，前端只认结果', () => {
  it('被 Deny 的权限点不在 permCodes 中，can() 即为 false', () => {
    // 用户角色并集里有 file:destroy，但被某条显式 Deny 减掉了 → 下发时就不存在
    const model = access(
      state({
        roles: ['DEPT_ADMIN'],
        permCodes: ['file:download', 'file:upload'],
        dataScope: DataScope.ALL,
      }),
    );

    expect(model.can('file:destroy')).toBe(false);
  });

  it('access() 结果不含任何 deny 字段：前端不持有第二套减法', () => {
    const model = access(
      state({ roles: ['USER'], permCodes: ['file:download'], dataScope: DataScope.SELF }),
    );

    const keys = Object.keys(model);
    expect(keys).not.toContain('denyCodes');
    expect(keys).not.toContain('deniedCodes');
    expect(keys).not.toContain('deny');
  });

  it('超管身份不放大 can()：角色不是权限来源', () => {
    // 超管 + 当前用户 access=admin，但 permCodes 里没有审计读权限
    // （后端三权分立：审计读不得因超管身份自动获得）
    const model = access(
      state(
        { roles: ['SUPER_ADMIN'], permCodes: ['file:download'], dataScope: DataScope.ALL },
        { access: 'admin' },
      ),
    );

    expect(model.isSuperAdmin).toBe(true);
    expect(model.canAdmin).toBe(true);
    // 关键：UI 上的「像管理员」不得转化为任何权限点
    expect(model.can('audit:log:read')).toBe(false);
    expect(model.can('system:user:list')).toBe(false);
    expect(model.can('file:download')).toBe(true);
  });
});

describe('canAny / canAll 的边界', () => {
  const model = access(
    state({
      roles: ['USER'],
      permCodes: ['file:download', 'file:upload'],
      dataScope: DataScope.SELF,
    }),
  );

  it('canAny：满足其一即可；空集合视为「无需权限」放行', () => {
    expect(model.canAny(['file:destroy', 'file:upload'])).toBe(true);
    expect(model.canAny(['file:destroy', 'file:share'])).toBe(false);
    expect(model.canAny([])).toBe(true);
    expect(model.canAny(undefined)).toBe(true);
  });

  it('canAll：必须全部满足；空集合视为「无需权限」放行', () => {
    expect(model.canAll(['file:download', 'file:upload'])).toBe(true);
    expect(model.canAll(['file:download', 'file:destroy'])).toBe(false);
    expect(model.canAll([])).toBe(true);
  });

  it('can() 未传权限点视为「无需权限」', () => {
    expect(model.can()).toBe(true);
    expect(model.can(null)).toBe(true);
  });
});

describe('fail-closed：拿不到权限快照时全拒绝', () => {
  it('initialState 为空：can 全拒、dataScope 取最保守的「仅本人」', () => {
    const model = access();

    expect(model.can('file:download')).toBe(false);
    expect(model.canAny(['file:download', 'file:upload'])).toBe(false);
    expect(model.canAll(['file:download'])).toBe(false);
    // 最保守兜底：非法/缺失的 dataScope 不得被当成「全部数据」
    expect(model.dataScope).toBe(DataScope.SELF);
    expect(model.permCodes).toEqual([]);
    expect(model.roles).toEqual([]);
  });

  it('permissions 存在但 permCodes 为空：仍然全拒绝', () => {
    const model = access(state({ roles: ['USER'], permCodes: [], dataScope: DataScope.SELF }));

    expect(model.can('file:download')).toBe(false);
  });

  it('normalizeMyPermission：非法 dataScope 一律降级为「仅本人」，不得提升', () => {
    // 0 / 99 / undefined / 'ALL' 都不是合法取值
    for (const illegal of [0, 99, -1, undefined, 'ALL' as never]) {
      expect(
        normalizeMyPermission({ roles: ['USER'], permCodes: [], dataScope: illegal }).dataScope,
      ).toBe(DataScope.SELF);
    }
    // 合法值原样保留
    expect(normalizeMyPermission({ dataScope: DataScope.ALL }).dataScope).toBe(DataScope.ALL);
    expect(
      normalizeMyPermission({ dataScope: DataScope.DEPT_AND_SUB }).dataScope,
    ).toBe(DataScope.DEPT_AND_SUB);
  });

  it('权限接口失败 → 全拒绝快照，不因接口抖动放行', async () => {
    mockedRequestData.mockRejectedValue(new Error('503'));

    const permission = await fetchMyPermission();

    expect(permission).toEqual(DENY_ALL_PERMISSION);
    // 在该快照上判定：没有任何权限点被放行
    const model = access(state(permission));
    expect(model.can('file:download')).toBe(false);
    expect(model.dataScope).toBe(DataScope.SELF);
    expect(model.roles).toEqual([]);
  });

  it('权限接口成功 → 正常放行（对照组，避免上一条断言变成恒真）', async () => {
    mockedRequestData.mockResolvedValue({
      roles: ['USER'],
      permCodes: ['file:download'],
      dataScope: DataScope.SELF,
    });

    const permission = await fetchMyPermission();

    expect(access(state(permission)).can('file:download')).toBe(true);
  });
});
