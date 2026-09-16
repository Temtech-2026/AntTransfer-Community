import { LinkOutlined } from '@ant-design/icons';
import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import { SettingDrawer } from '@ant-design/pro-components';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history, Link } from '@umijs/max';
import { ConfigProvider, theme } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import React, { useEffect, useState } from 'react';

// Initialize dayjs plugins globally
dayjs.extend(relativeTime);

import {
  AvatarDropdown,
  DocLink,
  ErrorBoundary,
  Footer,
  GlobalUploadProgress,
  LangDropdown,
  NotificationBell,
  OfflineBanner,
  VersionDropdown,
} from '@/components';
import {
  buildMenuTree,
  DENY_ALL_PERMISSION,
  fetchMyMenus,
  fetchMyPermission,
  filterMenuByPerm,
  filterProMenuByPerm,
  type MenuNode,
  type MyPermission,
  toMenuData,
  toProMenuItems,
} from '@/services/access';
import { fetchProfile, toCurrentUser } from '@/services/auth';
import {
  BRAND_ON_PRIMARY,
  BRAND_PRIMARY_ACTIVE,
  BRAND_PRIMARY_BG,
  DARK_LAYOUT_COLORS,
  DARK_TOKENS,
  persistThemePreference,
  resolveIsDark,
  THEME_CHANGE_EVENT,
} from '@/theme/tokens';
import defaultSettings from '../config/defaultSettings';
import { errorConfig } from './requestErrorConfig';

const isDev = process.env.NODE_ENV === 'development';
const loginPath = '/user/login';

/**
 * @see https://umijs.org/docs/api/runtime-config#getinitialstate
 * */
export async function getInitialState(): Promise<{
  settings?: Partial<LayoutSettings>;
  currentUser?: API.CurrentUser;
  /** 权限域快照，`src/access.ts` 只认这个字段（见 services/access/api.ts）。 */
  permissions?: MyPermission;
  /** 后端动态菜单（D-9 未落地时为空数组，前端回退静态路由菜单）。 */
  menus?: MenuNode[];
  loading?: boolean;
  fetchUserInfo?: () => Promise<API.CurrentUser | undefined>;
  settingDrawerOpen?: boolean;
}> {
  const fetchUserInfo = async () => {
    try {
      // `/api/v1/auth/me` 只返回用户摘要（无权限点），权限 / 菜单由 fetchPermission 并发拉取
      const profile = await fetchProfile();
      return toCurrentUser(profile);
    } catch (_error) {
      const { pathname, search, hash } = history.location;
      history.replace(
        `${loginPath}?redirect=${encodeURIComponent(pathname + search + hash)}`,
      );
    }
    return undefined;
  };
  /**
   * 权限与菜单一次并发拉取。
   *
   * <p>降级口径：权限接口失败必须是「全拒绝」（宁可少显示，也不越权显示）；
   * 菜单接口 404（D-9）在 fetchMyMenus 内部已归零为空数组，不会连带登录失败。
   */
  const fetchPermission = async (): Promise<{
    permissions: MyPermission;
    menus: MenuNode[];
  }> => {
    try {
      const [permissions, menus] = await Promise.all([
        fetchMyPermission(),
        fetchMyMenus(),
      ]);
      return { permissions, menus };
    } catch (error) {
      console.warn('[anttransfer] 权限 / 菜单加载失败，按最小权限降级', error);
      return { permissions: DENY_ALL_PERMISSION, menus: [] };
    }
  };
  /**
   * 恢复用户上次选择的主题偏好（与源项目 at-admin 同构）。
   *
   * <p>只覆盖 `navTheme` 一个字段：`auto` 在这里就解析成确定的明 / 暗，
   * 避免 ProLayout 自己按系统偏好渲染、而 ConfigProvider 按 localStorage 渲染导致两边不一致。
   */
  const baseSettings: Partial<LayoutSettings> = {
    ...(defaultSettings as Partial<LayoutSettings>),
    navTheme: resolveIsDark() ? 'realDark' : 'light',
  };

  // 如果不是登录页面，执行
  const { location } = history;
  if (location.pathname !== loginPath) {
    const currentUser = await fetchUserInfo();
    const { permissions, menus } = await fetchPermission();
    return {
      fetchUserInfo,
      currentUser,
      permissions,
      menus,
      settings: baseSettings,
      settingDrawerOpen: false,
    };
  }
  return {
    fetchUserInfo,
    permissions: DENY_ALL_PERMISSION,
    menus: [],
    settings: baseSettings,
    settingDrawerOpen: false,
  };
}

// ProLayout 支持的api https://procomponents.ant.design/components/layout
export const layout: RunTimeLayoutConfig = ({
  initialState,
  setInitialState,
}) => {
  const permSet = new Set(initialState?.permissions?.permCodes ?? []);
  // 暗色模式下顶栏 / 侧栏换深色底；明亮模式保持白底 + 浅绿选中
  const isDark = initialState?.settings?.navTheme === 'realDark';
  return {
    /**
     * 动态菜单：优先用后端菜单（`/api/v1/permission/menus`，D-9 未落地时为 []），
     * 否则回退到「静态路由菜单按权限过滤」。两条分支都保证无权限的项不渲染。
     *
     * <p>注意：菜单不渲染只是体验优化，真正的拦截在后端 `@RequiresPerm`。
     */
    menuDataRender: (menuData) => {
      const dynamic = toProMenuItems(
        filterMenuByPerm(
          toMenuData(buildMenuTree(initialState?.menus)),
          permSet,
        ),
      );
      if (dynamic.length > 0) {
        return dynamic;
      }
      return filterProMenuByPerm(menuData, permSet);
    },
    menuItemRender: (item, dom) => {
      if (item.path) {
        return (
          <Link to={item.path} prefetch>
            {dom}
          </Link>
        );
      }
      return dom;
    },
    actionsRender: () => {
      // `locale: false` opts out of the language switcher. ProLayout's own
      // `locale` prop is a locale string, so narrow to the boolean toggle here.
      const localeEnabled =
        (initialState?.settings as { locale?: boolean })?.locale !== false;
      return [
        <GlobalUploadProgress key="upload" />,
        <NotificationBell key="notify" />,
        <DocLink key="doc" />,
        <VersionDropdown key="version" />,
        localeEnabled && <LangDropdown key="lang" />,
      ].filter(Boolean);
    },
    avatarProps: {
      src: initialState?.currentUser?.avatar,
      // 真实登录用户（昵称优先、回退账号）；未登录时 AvatarDropdown 自身渲染加载态
      title: initialState?.currentUser?.name ?? '',
      render: (_, avatarChildren) => (
        <AvatarDropdown>{avatarChildren}</AvatarDropdown>
      ),
    },
    // waterMarkProps: {
    //   content: initialState?.currentUser?.name,
    // },
    footerRender: () => <Footer />,
    onPageChange: () => {
      const { location } = history;
      // 如果没有登录，重定向到 login
      if (!initialState?.currentUser && location.pathname !== loginPath) {
        history.replace(
          `${loginPath}?redirect=${encodeURIComponent(location.pathname + location.search + location.hash)}`,
        );
      }
    },
    links: isDev
      ? [
          <Link key="openapi" to="/umi/plugin/openapi" target="_blank">
            <LinkOutlined />
            <span>OpenAPI 文档</span>
          </Link>,
        ]
      : [],
    // Replace ProLayout's default ErrorBoundary with our offline-aware version,
    // so chunk load errors show friendly messages instead of "Something went wrong."
    ErrorBoundary,
    menuHeaderRender: undefined,
    // 自定义 403 页面
    // unAccessible: <div>unAccessible</div>,
    /**
     * 主题设置抽屉：只在开发态渲染，避免把「改主色 / 换布局」这类调试面板带到生产。
     *
     * <p>改动后把 navTheme 持久化并广播事件，rootContainer 据此切换 darkAlgorithm，
     * 否则 ProLayout 变暗了、antd 组件还停在亮色。
     */
    settingDrawerRender: () => {
      if (!isDev) {
        return null;
      }
      return (
        <SettingDrawer
          disableUrlParams
          enableDarkTheme
          collapse={initialState?.settingDrawerOpen}
          onCollapseChange={(open) => {
            setInitialState((s) => ({
              ...s,
              settingDrawerOpen: open,
            }));
          }}
          settings={initialState?.settings}
          onSettingChange={(settings) => {
            persistThemePreference(settings.navTheme);
            setInitialState((s) => ({
              ...s,
              settings,
            }));
          }}
        />
      );
    },
    ...initialState?.settings,
    /**
     * 按明暗态覆盖结构色。
     *
     * <p>必须放在 `...initialState?.settings` **之后**：对象展开是整体替换 `token` 键，
     * 所以这里要把明亮态的取值一并补全，不能只写暗色分支。
     */
    token: {
      header: {
        colorBgHeader: isDark ? DARK_LAYOUT_COLORS.headerBg : '#fff',
      },
      sider: {
        colorBgMenuItemSelected: isDark
          ? DARK_LAYOUT_COLORS.siderSelectedBg
          : BRAND_PRIMARY_BG,
        colorBgMenuItemHover: isDark ? undefined : '#f2fdf8',
        colorTextMenuSelected: isDark ? BRAND_ON_PRIMARY : BRAND_PRIMARY_ACTIVE,
        colorTextMenuItemHover: isDark ? undefined : BRAND_PRIMARY_ACTIVE,
        colorMenuBackground: isDark
          ? DARK_LAYOUT_COLORS.siderMenuBg
          : undefined,
        colorBgMenuItemCollapsedElevated: isDark
          ? DARK_LAYOUT_COLORS.siderElevatedBg
          : undefined,
      },
    } as Record<string, unknown>,
  };
};

/**
 * @name request 配置，可以配置错误处理
 * 它基于 axios 提供了一套统一的网络请求和错误处理方案。
 * @doc https://umijs.org/docs/max/request#配置
 */
export const request: RequestConfig = {
  /**
   * 不使用模板遗留的 Ant Design 演示后端：CE 版是自托管，前后端同源，
   * `/api` 由部署层（nginx / 网关）反代到 at-bootstrap。留空即同源，
   * 避免生产构建把请求发到 `pro-api.ant-design-demo.workers.dev`。
   */
  baseURL: '',
  ...errorConfig,
};

export function rootContainer(container: React.ReactNode) {
  /**
   * 主题容器。
   *
   * <p>这里刻意**不**走 `useModel` —— Model Context 在本阶段尚未初始化。
   * 改为直接读持久化偏好，并监听 SettingDrawer 广播的事件来触发重渲染。
   *
   * <p>`ConfigProvider` 与 umi antd 插件注入的那层是嵌套关系，antd 会把父级 token 与
   * 本层合并、以本层为准，因此 `darkAlgorithm` 能覆盖到全部 antd / pro 组件。
   */
  const ThemeContainer = (props: { children?: React.ReactNode }) => {
    const [, forceUpdate] = useState(0);

    useEffect(() => {
      const handleThemeChange = () => forceUpdate((n) => n + 1);
      window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
      return () =>
        window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    }, []);

    const isDark = resolveIsDark();

    return (
      <ConfigProvider
        theme={{
          algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
          ...(isDark ? { token: { ...DARK_TOKENS } } : {}),
        }}
      >
        <OfflineBanner />
        <ErrorBoundary>{props.children}</ErrorBoundary>
      </ConfigProvider>
    );
  };

  return React.createElement(ThemeContainer, null, container);
}
