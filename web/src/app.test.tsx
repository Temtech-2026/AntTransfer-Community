import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all heavy dependencies before importing app
const mockReplace = vi.fn();
const mockHistory = {
  location: {
    pathname: '/welcome',
    search: '',
    hash: '',
  },
  replace: mockReplace,
};

const mockFetchProfile = vi.fn();
const mockFetchMyPermission = vi.fn();
const mockFetchMyMenus = vi.fn();

vi.mock('@umijs/max', () => ({
  history: mockHistory,
  Link: ({ children }: any) => children,
  request: vi.fn(),
}));

// 只替换 /auth/me 这种 IO；toCurrentUser 等纯转换走真实实现，接线才被真正验证
vi.mock('@/services/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/auth')>()),
  fetchProfile: (...args: unknown[]) => mockFetchProfile(...args),
}));

// 只替换权限 / 菜单的 IO；过滤、转换等纯逻辑走真实实现，接线才被真正验证
vi.mock('@/services/access', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/access')>()),
  fetchMyPermission: (...args: unknown[]) => mockFetchMyPermission(...args),
  fetchMyMenus: (...args: unknown[]) => mockFetchMyMenus(...args),
}));

vi.mock('@/components', () => ({
  AvatarDropdown: () => null,
  DocLink: () => null,
  ErrorBoundary: ({ children }: any) => children,
  Footer: () => null,
  LangDropdown: () => null,
  NotificationBell: () => null,
  OfflineBanner: () => null,
  VersionDropdown: () => null,
}));

vi.mock('@ant-design/pro-components', () => ({
  SettingDrawer: () => null,
}));

// 图标保留真实实现：menu-icon 的注册表在模块加载期就会 createElement
vi.mock('@ant-design/icons', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ant-design/icons')>()),
  LinkOutlined: () => null,
}));

vi.mock('./requestErrorConfig', () => ({
  errorConfig: {},
}));

vi.mock('../config/defaultSettings', () => ({
  default: { navTheme: 'light' },
}));

describe('app getInitialState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHistory.location = {
      pathname: '/welcome',
      search: '',
      hash: '',
    };
    mockFetchMyPermission.mockResolvedValue({
      permCodes: ['file:download'],
      roles: [],
      dataScope: 3,
    });
    mockFetchMyMenus.mockResolvedValue([]);
  });

  it('should fetch currentUser when not on login page', async () => {
    const { getInitialState } = await import('./app');
    mockFetchProfile.mockResolvedValue({
      username: 'zhangsan',
      nickname: 'Test User',
      roles: ['SUPER_ADMIN'],
    });

    const state = await getInitialState();

    expect(mockFetchProfile).toHaveBeenCalled();
    expect(state.currentUser).toEqual({
      name: 'Test User',
      access: 'admin',
    });
    expect(state.settingDrawerOpen).toBe(false);
    expect(state.fetchUserInfo).toBeDefined();
    // 权限与菜单一并写入 initialState，供 access.ts / menuDataRender 消费
    expect(state.permissions?.permCodes).toEqual(['file:download']);
    expect(state.menus).toEqual([]);
  });

  it('should redirect to login when currentUser fetch fails (401)', async () => {
    const { getInitialState } = await import('./app');
    mockFetchProfile.mockRejectedValue(new Error('401 Unauthorized'));

    const state = await getInitialState();

    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('/user/login?redirect='),
    );
    expect(state.currentUser).toBeUndefined();
  });

  it('should not fetch currentUser on login page', async () => {
    const { getInitialState } = await import('./app');
    mockHistory.location = {
      pathname: '/user/login',
      search: '',
      hash: '',
    };

    const state = await getInitialState();

    expect(mockFetchProfile).not.toHaveBeenCalled();
    expect(state.currentUser).toBeUndefined();
    expect(state.fetchUserInfo).toBeDefined();
    // 未登录不做权限拉取，按全拒绝降级（前端不越权显示）
    expect(mockFetchMyPermission).not.toHaveBeenCalled();
    expect(state.permissions?.permCodes).toEqual([]);
    expect(state.menus).toEqual([]);
  });

  it('should encode redirect path correctly on 401', async () => {
    const { getInitialState } = await import('./app');
    mockHistory.location = {
      pathname: '/admin/users',
      search: '?page=2',
      hash: '#section',
    };
    mockFetchProfile.mockRejectedValue(new Error('401'));

    await getInitialState();

    expect(mockReplace).toHaveBeenCalledWith(
      `/user/login?redirect=${encodeURIComponent('/admin/users?page=2#section')}`,
    );
  });

  it('should include default settings in initial state', async () => {
    const { getInitialState } = await import('./app');
    mockFetchProfile.mockResolvedValue({ username: 'lisi' });

    const state = await getInitialState();

    expect(state.settings).toEqual({ navTheme: 'light' });
  });

  it('fetchUserInfo should return user data on success', async () => {
    const { getInitialState } = await import('./app');
    mockFetchProfile.mockResolvedValue({
      username: 'fuser',
      nickname: 'Fetched User',
      roles: ['SUPER_ADMIN'],
    });

    const state = await getInitialState();

    const user = await state.fetchUserInfo?.();
    expect(user).toEqual({ name: 'Fetched User', access: 'admin' });
  });
});

describe('app layout 动态菜单', () => {
  /** 取到 menuDataRender（ProLayout 的菜单数据钩子）。 */
  async function menuDataRenderOf(initialState: Record<string, unknown>) {
    const { layout } = await import('./app');

    const props = layout({
      initialState,
      setInitialState: vi.fn(),
    } as any) as any;

    return props.menuDataRender as (menuData: any[]) => any[];
  }

  it('无权限的菜单项不渲染，后端菜单为空时回退静态路由菜单', async () => {
    const menuDataRender = await menuDataRenderOf({
      settings: {},
      permissions: { permCodes: ['system:user:list'], roles: [], dataScope: 3 },
      menus: [],
    });

    const result = menuDataRender([
      { path: '/welcome', name: '首页' },
      {
        path: '/system',
        name: '系统管理',
        routes: [
          { path: '/system/users', name: '用户' },
          { path: '/system/roles', name: '角色' },
        ],
      },
    ]) as Array<{ path: string; name?: string; routes?: Array<{ path: string }> }>;

    expect(result.map((item) => item.path)).toEqual(['/welcome', '/system']);
    expect(result[1].routes?.map((item) => item.path)).toEqual(['/system/users']);
  });

  it('后端菜单非空时优先使用动态菜单并按权限过滤', async () => {
    const menuDataRender = await menuDataRenderOf({
      settings: {},
      permissions: { permCodes: ['file'], roles: [], dataScope: 3 },
      menus: [
        { id: 1, parentId: 0, permCode: 'file', permName: '文件', type: 1, routePath: '/file', icon: 'file' },
        { id: 2, parentId: 0, permCode: 'audit', permName: '审计', type: 1, routePath: '/audit' },
      ],
    });

    const result = menuDataRender([{ path: '/welcome', name: '首页' }]);

    expect(result.map((item) => item.path)).toEqual(['/file']);
    expect(result[0].name).toBe('文件');
    expect(result[0].icon).toBeTruthy();
  });
});
