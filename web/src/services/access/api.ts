/**
 * 权限 / 菜单数据访问。
 *
 * <p>失败策略（重要）：权限拉取失败一律<b>降级为「全拒绝」</b>而不是「放行」——
 * 前端显隐不是安全边界，但也不能因为接口抖动让无权限用户看到入口而误以为可用。
 * 后端 {@code @RequiresPerm} 始终是最终裁决。
 */

import { requestData } from '@/services/request';

import { ACCESS_ENDPOINTS } from './endpoints';
import { normalizePerms } from './perm';
import { DataScope, type MenuNode, type MyPermission } from './types';

/** 全拒绝快照（未登录 / 接口失败时的兜底）。 */
export const DENY_ALL_PERMISSION: MyPermission = {
  roles: [],
  permCodes: [],
  dataScope: DataScope.SELF,
};

/** 规范化后端返回（去重、剔除空值、dataScope 兜底为最保守的「仅本人」）。 */
export function normalizeMyPermission(raw?: Partial<MyPermission> | null): MyPermission {
  if (!raw) {
    return { ...DENY_ALL_PERMISSION };
  }
  const dataScope =
    raw.dataScope === DataScope.ALL || raw.dataScope === DataScope.DEPT_AND_SUB
      ? raw.dataScope
      : DataScope.SELF;
  return {
    roles: Array.isArray(raw.roles) ? raw.roles.filter(Boolean) : [],
    permCodes: normalizePerms(raw.permCodes),
    dataScope,
  };
}

/**
 * 拉取当前用户权限快照（`GET /api/v1/permission/my`）。
 *
 * <p>静默模式：登录页 / 未登录态调用不会弹错误提示（401 由全局链路处理跳登录）。
 */
export async function fetchMyPermission(): Promise<MyPermission> {
  try {
    const raw = await requestData<Partial<MyPermission>>(ACCESS_ENDPOINTS.myPermission, {
      method: 'GET',
      silent: true,
    });
    return normalizeMyPermission(raw);
  } catch (error) {
    console.warn('[anttransfer] 权限快照拉取失败，按全拒绝降级', error);
    return { ...DENY_ALL_PERMISSION };
  }
}

/**
 * 拉取当前用户可见菜单树（`GET /api/v1/permission/menus`）。
 *
 * <p>后端 D-9 未落地（404）时返回空数组，由调用方回退为「静态路由菜单 + perm_code 过滤」，
 * 保证登录流程不被菜单接口阻塞。
 */
export async function fetchMyMenus(): Promise<MenuNode[]> {
  try {
    const menus = await requestData<MenuNode[] | null>(ACCESS_ENDPOINTS.myMenus, {
      method: 'GET',
      silent: true,
    });
    return Array.isArray(menus) ? menus : [];
  } catch (error) {
    console.warn('[anttransfer] 动态菜单拉取失败，回退静态路由菜单过滤', error);
    return [];
  }
}
