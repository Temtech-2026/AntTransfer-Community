/**
 * Umi `access` 插件入口：{@code useAccess()} 返回的就是本函数的返回值。
 *
 * <p>口径（docs/development/frontend-permission-map.md）：
 * <ul>
 *   <li>只映射后端 {@code perm_code}，**不硬编码角色判断**——角色只是聚合单位，随时可能换绑；</li>
 *   <li>数据来自登录后拉取一次的 {@code GET /api/v1/permission/my}，存在 initialState.permissions；</li>
 *   <li>接口失败 / 未登录时按「全拒绝」处理（见 services/access/api.ts），前端显隐不构成安全边界。</li>
 * </ul>
 *
 * <p>用法：
 * <pre>{@code
 * const access = useAccess();
 * access.can('file:download');            // 单个权限点
 * access.canAny(['system:user:list', 'system:role:list']);
 * }</pre>
 *
 * @see https://umijs.org/docs/max/access
 */

import {
  DataScope,
  ROLE,
  hasAllPerms,
  hasAnyPerm,
  hasPerm,
  normalizePerms,
  type MyPermission,
  type PermCode,
} from '@/services/access';
import type { CurrentUser } from '@/services/auth';

/** {@code useAccess()} 的返回类型。 */
export interface AccessModel {
  /** 是否具备某权限点（未传则视为「无需权限」）。 */
  can: (perm?: PermCode | null) => boolean;
  /** 是否具备其中任意一个。 */
  canAny: (perms?: readonly PermCode[] | null) => boolean;
  /** 是否全部具备。 */
  canAll: (perms?: readonly PermCode[] | null) => boolean;
  /** 权限点并集（已剔除 Deny）。 */
  permCodes: string[];
  /** 权限点集合（判定用，避免每次 O(n) 扫描）。 */
  permSet: ReadonlySet<string>;
  /** 角色编码。 */
  roles: string[];
  /** 数据范围：1 仅本人 / 2 本部门及以下 / 3 全部。 */
  dataScope: number;
  /** 是否超管（**仅供 UI 提示**，不得作为权限判定依据）。 */
  isSuperAdmin: boolean;
  /**
   * 兼容 Umi 模板既有页面（如 AvatarDropdown）的字段。
   *
   * @deprecated 新代码请用 {@link AccessModel.can}；该字段仅表示「像管理员」，不是权限判定。
   */
  canAdmin: boolean;
}

/** 供 initialState 使用的权限域形状（app.tsx getInitialState 写入）。 */
export interface AccessInitialState {
  permissions?: MyPermission;
  currentUser?: CurrentUser;
}

/**
 * Umi access 插件约定入口。
 */
export default function access(initialState?: AccessInitialState): AccessModel {
  const permission = initialState?.permissions;
  const permCodes = normalizePerms(permission?.permCodes);
  const permSet: ReadonlySet<string> = new Set(permCodes);
  const roles = permission?.roles ?? [];

  return {
    can: (perm) => hasPerm(permSet, perm),
    canAny: (perms) => hasAnyPerm(permSet, perms),
    canAll: (perms) => hasAllPerms(permSet, perms),
    permCodes,
    permSet,
    roles,
    dataScope: permission?.dataScope ?? DataScope.SELF,
    isSuperAdmin: roles.includes(ROLE.SUPER_ADMIN),
    canAdmin: roles.includes(ROLE.SUPER_ADMIN) || initialState?.currentUser?.access === 'admin',
  };
}
