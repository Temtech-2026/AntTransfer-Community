/**
 * 路由守卫（Umi `wrappers` 形态）。
 *
 * <p>设计要点：
 * <ul>
 *   <li>**无权限就地渲染 403，不回登录页**——按策略 D，403（1003）不引导登录，
 *       否则用户会误以为「登录态失效」并反复登录。</li>
 *   <li>所需权限点来自集中登记表 {@link resolveRoutePerm}（最长前缀匹配），
 *       业务页面不需要各自写守卫；未登记的路由（公开页 / 演示页）直接放行。</li>
 *   <li>前端守卫只解决「不渲染不可能有权限的页面」，后端仍是最终裁决。</li>
 *   <li>**放行时必须产出子路由**：Umi 4 默认（非 `reactRouter5Compat`）的 wrapper 运行期
 *       **不会注入 `children`**（@umijs/renderer-react 的 `RemoteComponent` 只做
 *       `createElement(Component, null)`），wrapper 被当成父级路由元素渲染，子路由必须由
 *       wrapper 自己渲染 `<Outlet />` 挂载。少了这一步，「有权限」会被放行成一个空 Fragment
 *       → 整块内容区空白，而无权限的 403 分支反而正常可见（因为它不依赖子路由）。</li>
 * </ul>
 *
 * <p>接线方式（config/routes.ts）：
 * <pre>{@code
 * { path: '/file', name: 'file', component: './file', wrappers: ['@/components/PermGuard'] }
 * }</pre>
 *
 * <p>如需为单条路由声明权限点，请在 {@link ROUTE_PERM_RULES} 中登记——
 * 集中登记可被单测覆盖，比散落在路由文件里的自定义 meta 更不容易漏。
 */

import { Outlet, useAccess, useLocation } from '@umijs/max';
import type { FC, ReactNode } from 'react';

import Exception403 from '@/pages/exception/403';
import { resolveRoutePerm } from '@/services/access';

/** 路由守卫属性（`children` 兼容 reactRouter5Compat 与单测；缺省时回退渲染子路由 `<Outlet />`）。 */
export interface PermGuardProps {
  children?: ReactNode;
}

const PermGuard: FC<PermGuardProps> = ({ children }) => {
  const access = useAccess();
  const { pathname } = useLocation();
  const required = resolveRoutePerm(pathname);

  // 放行时渲染子路由。⚠️ Umi 4 默认（非 reactRouter5Compat）的 wrapper 运行期**不注入 `children`**
  //（@umijs/renderer-react/dist/routes.js → RemoteComponent: createElement(Component, null)），
  // wrapper 被当作父级路由元素渲染，子路由只能靠 wrapper 自己渲染 `<Outlet />` 挂载；
  // 少了这一步，受守卫页面就会「有权限却整块空白」。保留 `children` 以兼容 compat 模式与单测。
  const passThrough = <>{children ?? <Outlet />}</>;

  // 未登记的路由：放行（公开页 / 异常页 / 演示页）
  if (!required) {
    return passThrough;
  }

  const allowed = Array.isArray(required) ? access.canAny(required) : access.can(required);
  if (allowed) {
    return passThrough;
  }

  console.warn(
    `[anttransfer] 路由 ${pathname} 缺少权限点 ${Array.isArray(required) ? required.join(' / ') : required}，已就地 403（策略 D：不跳登录）`,
  );
  return <Exception403 />;
};

export default PermGuard;
