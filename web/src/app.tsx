import { LinkOutlined } from '@ant-design/icons';
import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import { SettingDrawer } from '@ant-design/pro-components';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history, Link } from '@umijs/max';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import React from 'react';

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
  DENY_ALL_PERMISSION,
  buildMenuTree,
  fetchMyMenus,
  fetchMyPermission,
  filterMenuByPerm,
  filterProMenuByPerm,
  toMenuData,
  toProMenuItems,
  type MenuNode,
  type MyPermission,
} from '@/services/access';
import { fetchProfile, toCurrentUser } from '@/services/auth';
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
      settings: defaultSettings as Partial<LayoutSettings>,
      settingDrawerOpen: false,
    };
  }
  return {
    fetchUserInfo,
    permissions: DENY_ALL_PERMISSION,
    menus: [],
    settings: defaultSettings as Partial<LayoutSettings>,
    settingDrawerOpen: false,
  };
}

// ProLayout 支持的api https://procomponents.ant.design/components/layout
export const layout: RunTimeLayoutConfig = ({
  initialState,
  setInitialState,
}) => {
  const permSet = new Set(initialState?.permissions?.permCodes ?? []);
  return {
    /**
     * 动态菜单：优先用后端菜单（`/api/v1/permission/menus`，D-9 未落地时为 []），
     * 否则回退到「静态路由菜单按权限过滤」。两条分支都保证无权限的项不渲染。
     *
     * <p>注意：菜单不渲染只是体验优化，真正的拦截在后端 `@RequiresPerm`。
     */
    menuDataRender: (menuData) => {
      const dynamic = toProMenuItems(
        filterMenuByPerm(toMenuData(buildMenuTree(initialState?.menus)), permSet),
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
    bgLayoutImgList: [
      {
        src: 'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/D2LWSqNny4sAAAAAAAAAAAAAFl94AQBr',
        left: 85,
        bottom: 100,
        height: '303px',
      },
      {
        src: 'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/C2TWRpJpiC0AAAAAAAAAAAAAFl94AQBr',
        bottom: -68,
        right: -45,
        height: '303px',
      },
      {
        src: 'https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/F6vSTbj8KpYAAAAAAAAAAAAAFl94AQBr',
        bottom: 0,
        left: 0,
        width: '331px',
      },
    ],
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
    // 增加一个 loading 的状态
    childrenRender: (children) => {
      // if (initialState?.loading) return <PageLoading />;
      return (
        <>
          {children}
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
              setInitialState((s) => ({
                ...s,
                settings,
              }));
            }}
          />
        </>
      );
    },
    ...initialState?.settings,
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
  return (
    <>
      <OfflineBanner />
      <ErrorBoundary>{container}</ErrorBoundary>
    </>
  );
}
