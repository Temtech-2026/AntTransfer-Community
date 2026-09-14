/**
 * 权限判定的**纯函数**内核（不依赖 React / Umi，可直接单测）。
 *
 * <p>口径（docs/development/frontend-permission-map.md「约定」）：
 * <ul>
 *   <li>判定恒以 {@code perm_code} 为准，与后端 **逐字符一致**；</li>
 *   <li>后端下发的 {@code permCodes} 已剔除显式 Deny，前端不做 Deny 运算，只做集合成员判断；</li>
 *   <li>前端显隐<b>只影响体验，不构成安全边界</b>——后端 {@code @RequiresPerm} 才是强制校验。</li>
 * </ul>
 */

/** 权限点编码。 */
export type PermCode = string;

/** 内置角色编码（仅用于「如实呈现」类 UI 提示，禁止用于权限判定）。 */
export const ROLE = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  AUDITOR: 'AUDITOR',
  DEPT_ADMIN: 'DEPT_ADMIN',
  USER: 'USER',
} as const;

/** 规范化权限点列表（去重 + 去空 + 去首尾空格）。 */
export function normalizePerms(permCodes?: readonly string[] | null): string[] {
  if (!permCodes?.length) {
    return [];
  }
  const set = new Set<string>();
  for (const code of permCodes) {
    const normalized = typeof code === 'string' ? code.trim() : '';
    if (normalized) {
      set.add(normalized);
    }
  }
  return [...set];
}

/** 构造判定用的权限集合。 */
export function toPermSet(permCodes?: readonly string[] | null): Set<string> {
  return new Set(normalizePerms(permCodes));
}

/** 判定载体：Set 或数组都可（调用方已持有数组时不必先转换）。 */
export type PermSource = ReadonlySet<string> | readonly string[] | null | undefined;

function asSet(source: PermSource): ReadonlySet<string> {
  if (!source) {
    return new Set<string>();
  }
  return Array.isArray(source) ? new Set(source) : (source as ReadonlySet<string>);
}

/**
 * 是否具备某个权限点。
 *
 * <p>未传权限点时返回 {@code true}（「无声明 = 不需要权限」），便于守卫直接用于可选 meta。
 */
export function hasPerm(source: PermSource, perm?: PermCode | null): boolean {
  if (!perm) {
    return true;
  }
  return asSet(source).has(perm);
}

/** 是否具备其中任意一个（满足其一即可）。 */
export function hasAnyPerm(source: PermSource, perms?: readonly PermCode[] | null): boolean {
  if (!perms?.length) {
    return true;
  }
  const set = asSet(source);
  return perms.some((perm) => set.has(perm));
}

/** 是否全部具备。 */
export function hasAllPerms(source: PermSource, perms?: readonly PermCode[] | null): boolean {
  if (!perms?.length) {
    return true;
  }
  const set = asSet(source);
  return perms.every((perm) => set.has(perm));
}

/** 是否拥有指定角色（**仅供 UI 提示**，不构成权限判定，见文件头说明）。 */
export function hasRole(roles: readonly string[] | null | undefined, role: string): boolean {
  return Boolean(roles?.includes(role));
}

/** 是否超管角色（仅供 UI 提示）。 */
export function isSuperAdmin(roles?: readonly string[] | null): boolean {
  return hasRole(roles, ROLE.SUPER_ADMIN);
}
