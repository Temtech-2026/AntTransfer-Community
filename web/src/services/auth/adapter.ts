/**
 * 认证域出参 → 前端会话模型的适配（纯函数，便于单测）。
 */

import type { AuthUserSummary, CurrentUser } from './types';

/** 超级管理员角色编码（与 `sys_role.code` / `sql/V9__...` 授权语句一致）。 */
const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

/**
 * 用户摘要 → ProLayout 的 `CurrentUser`。
 *
 * <p>只做「有的字段如实映射、没有的留空」，不做任何补默认值——头像缺失就交给头像组件
 * 走首字母兜底，昵称缺失才退回账号，避免展示出「用户名叫 用户」这类臆造文案。</p>
 *
 * <p>{@code access} 字段是 Ant Design Pro 模板遗留（access.ts 的 canAdmin 仍在读），
 * 它<b>不代表权限模型</b>；真正的判定一律走 `access.ts` 的 {@code can(perm_code)}。</p>
 */
export function toCurrentUser(user?: AuthUserSummary | null): CurrentUser | undefined {
  if (!user?.username) {
    return undefined;
  }
  const nickname = user.nickname?.trim();
  const avatar = user.avatarUrl?.trim();
  const isSuperAdmin = (user.roles ?? []).includes(SUPER_ADMIN_ROLE);
  return {
    name: nickname || user.username,
    avatar: avatar || undefined,
    userid: user.id == null ? undefined : String(user.id),
    access: isSuperAdmin ? 'admin' : undefined,
  };
}
