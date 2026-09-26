/**
 * 用户管理页：时间列的显示口径。
 *
 * <p>要钉住的是**列级 `render` 会覆盖 `valueType` 格式化**这个坑：ProTable 靠
 * `dateFormatter="string"` 把日期列渲染成 `YYYY-MM-DD HH:mm:ss`，而列上只要自带
 * `render`，这套格式化就整个失效——服务端下发的 ISO-8601（`2026-09-26T14:30:00`）
 * 会被原样摆到用户面前。「最近登录时间」原本就踩了这个坑，且它同时是**全仓库唯一**
 * 一处 `valueType: 'dateTime'` 与自定义 `render` 并存的列。</p>
 *
 * <p>两个用例分别锁住两端：有值时必须与「创建时间」同一种写法（去掉 `T`），
 * 无值（从未登录）时保留本页统一的 `--` 占位，而不是被兜底成 `-` 或留白。</p>
 */

import { render, screen } from '@testing-library/react';
import { App } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import access, { type AccessModel } from '@/access';
import { DataScope } from '@/services/access';
import {
  SYSTEM_PERM,
  UserStatus,
  fetchDeptOptions,
  fetchUserRoleOptions,
  pageUsers,
  type UserVO,
} from '@/services/system';

import UsersPage from './index';

/** 可变的权限模型：`useAccess()` 每次渲染都读它，从而在同一个用例里切换权限 */
const holder = vi.hoisted(() => ({ model: {} as unknown }));

vi.mock('@umijs/max', async () => {
  const { testFormatMessage: translate } = await import('@/locales/testTranslate');
  return {
    useAccess: () => holder.model,
    // 兼容两种调用形态：`formatMessage({ id, values })` 与 `formatMessage({ id }, values)`
    useIntl: () => ({
      formatMessage: (
        descriptor: { id: string; values?: Record<string, unknown> },
        values?: Record<string, unknown>,
      ) => translate({ id: descriptor.id, values: values ?? descriptor.values }),
    }),
    request: vi.fn(),
    history: {
      location: { pathname: '/system/users', search: '' },
      push: vi.fn(),
      replace: vi.fn(),
    },
  };
});

vi.mock('@/services/system', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/system')>();
  return {
    ...actual,
    pageUsers: vi.fn(),
    fetchDeptOptions: vi.fn(),
    fetchUserRoleOptions: vi.fn(),
  };
});

// 三个弹层各自独立成单元，此处只关心列表渲染
vi.mock('./components/UserFormModal', () => ({ default: () => null }));
vi.mock('./components/AssignRoleDrawer', () => ({ default: () => null }));
vi.mock('./components/ResetPasswordModal', () => ({ default: () => null }));

const mockedPageUsers = vi.mocked(pageUsers);

/** 时间一律用 ISO-8601 造数据：接口下发的就是这个形态，测试替身不该自降口径 */
const row = (overrides: Partial<UserVO> = {}): UserVO =>
  ({
    id: '101',
    username: 'zhangsan',
    nickname: '张三',
    deptId: '9',
    deptName: '研发部',
    status: UserStatus.NORMAL,
    protectedUser: false,
    lastLoginTime: '2026-09-26T14:30:00',
    createTime: '2026-09-01T09:00:00',
    roleIds: ['1'],
    roleCodes: ['USER'],
    ...overrides,
  }) as unknown as UserVO;

/** 授予一组权限点；前端只做「在不在集合里」的判定 */
const grant = (permCodes: string[]) => {
  holder.model = access({
    permissions: { roles: ['USER'], permCodes, dataScope: DataScope.ALL },
  }) as AccessModel;
};

const renderPage = () =>
  render(
    <App>
      <UsersPage />
    </App>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  grant([SYSTEM_PERM.USER_LIST]);
  vi.mocked(fetchDeptOptions).mockResolvedValue([]);
  vi.mocked(fetchUserRoleOptions).mockResolvedValue([]);
  mockedPageUsers.mockResolvedValue({ records: [row()], total: 1 } as never);
});

describe('用户管理 · 时间列显示口径', () => {
  it('最近登录时间与「创建时间」同一种写法：ISO 的 T 不摆给用户', async () => {
    renderPage();

    // 两列都由同一个 dateFormatter 口径产出，必须逐字符一致
    expect(await screen.findByText('2026-09-26 14:30:00')).toBeTruthy();
    expect(screen.getByText('2026-09-01 09:00:00')).toBeTruthy();
    // 反面：带 `T` 的原始串不得出现在界面上
    expect(screen.queryByText('2026-09-26T14:30:00')).toBeNull();
  });

  it('从未登录（null）保留 -- 占位，而不是被兜底成 - 或留白', async () => {
    mockedPageUsers.mockResolvedValue({
      records: [row({ lastLoginTime: null })],
      total: 1,
    } as never);

    renderPage();

    // `--` 是本页缺失业务值的统一写法（nickname / deptName / roleCodes 同款）
    expect(await screen.findByText('--')).toBeTruthy();
    expect(screen.queryByText('2026-09-26 14:30:00')).toBeNull();
  });
});
