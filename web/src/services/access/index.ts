/**
 * 权限域出口（services/access）。
 *
 * <p>对外只需从这里取：数据访问（fetchMyPermission / fetchMyMenus / fetchPermissionMap）、
 * 纯判定（hasPerm / hasAnyPerm / hasAllPerms）、菜单构建（buildMenuTree / toMenuData / filterMenuByPerm）、
 * 路由守卫表（resolveRoutePerm）、登录落点收敛（resolveLoginLandingPath）、
 * 免登录公开路径判定（isPublicPath）。
 *
 * <p>注意导出顺序：`./map` 里也有 `Permissions` 无关的 `normalizePermissionMap`，
 * 与 `./menu` 的 `buildMenuTree` 等无重名，`export *` 可安全并列。
 */

export * from './api';
export * from './endpoints';
export * from './landing';
export * from './map';
export * from './menu';
export * from './menu-icon';
export * from './menu-render';
export * from './perm';
export * from './public-paths';
export * from './route-perm';
export * from './types';
