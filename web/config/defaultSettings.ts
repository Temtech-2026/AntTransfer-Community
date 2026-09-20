import type { ProLayoutProps } from '@ant-design/pro-components';

import {
  BRAND_PRIMARY,
  BRAND_PRIMARY_ACTIVE,
  BRAND_PRIMARY_BG,
  SHELL,
} from '../src/theme/tokens';

/**
 * @name 布局默认配置
 * @description 视觉体系对齐 `0719-AntTransfer/at-admin` 的「Qoder 黑绿」风格。
 * 品牌色请从 `src/theme/tokens.ts` 取，不要在此处散写十六进制值。
 */
const Settings: ProLayoutProps & {
  logo?: string;
} = {
  navTheme: 'light',
  // 主色：Qoder 黑绿。暗色模式的算法切换见 src/app.tsx 的 rootContainer
  colorPrimary: BRAND_PRIMARY,
  /**
   * 顶栏 + 侧栏：顶栏承载 Logo + 组织切换器 / 全局搜索 / 通知·头像·设置，侧栏承载菜单。
   *
   * <p>此前一度改为 `layout: 'side'`，已回退。原因：`side` 下 ProLayout 的
   * `DefaultHeader` 会直接 `return null`（见 pro-components
   * `es/layout/components/Header/index.js`），顶栏上的组织切换器、全局搜索、
   * 通知与头像全部失去落点。`mix` 才会渲染顶栏。
   *
   * <p>一级菜单的落点由 `splitMenus` 单独控制，这里不再显式设置（保持默认，即一级菜单
   * 留在侧栏）。若要一级菜单进顶栏，需置 `splitMenus: true`，并注意此时
   * `headerContentRender` 是「替换」语义、会接管顶栏中部，需与传入的菜单并列渲染。
   */
  layout: 'mix',
  siderWidth: SHELL.siderWidth,
  contentWidth: 'Fluid',
  // 与源项目一致：固定顶栏，长列表滚动时操作区（搜索、新建）始终可见
  fixedHeader: true,
  fixSiderbar: true,
  colorWeak: false,
  title: 'AntTransfer CE',
  // 使用本地 Logo，去掉对 antd 官方演示图床的依赖
  logo: '/logo.svg',
  iconfontUrl: '',
  token: {
    // 侧栏选中态：浅绿底 + 深绿字，对齐源模板 `.nav-item.active`
    sider: {
      colorBgMenuItemSelected: BRAND_PRIMARY_BG,
      colorBgMenuItemHover: '#f2fdf8',
      colorTextMenuSelected: BRAND_PRIMARY_ACTIVE,
      colorTextMenuItemHover: BRAND_PRIMARY_ACTIVE,
    },
  },
};

export default Settings;
