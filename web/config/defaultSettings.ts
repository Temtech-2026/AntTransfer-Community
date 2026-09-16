import type { ProLayoutProps } from '@ant-design/pro-components';

import {
  BRAND_PRIMARY,
  BRAND_PRIMARY_ACTIVE,
  BRAND_PRIMARY_BG,
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
  layout: 'mix',
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
