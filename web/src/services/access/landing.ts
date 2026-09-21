/**
 * 登录落点收敛：在「站内路径」之上，再收敛为「刚登录的这个用户真正可达的路径」。
 *
 * <p>{@link safeRedirectPath} 只回答「是不是站内」——它挡的是 open redirect
 * （`?redirect=https://evil.example` 会把用户送去钓鱼站）。但同一个 `redirect`
 * 参数还有第二类坏值：**是站内，可刚登录的用户没权限进**。
 *
 * <p>典型来源是上一个会话：用高权限账号停在 `/system/users`，令牌过期后被全局链路
 * 踢到 `/user/login?redirect=%2Fsystem%2Fusers`；此时换个低权限账号登录，回跳就
 * 一头撞进 PermGuard 的 403。用户看到的是「一登录就 403」，像登录功能坏了 —— 而
 * 实际上他只是被上一段会话的残留意图带到了一个不属于他的页面。
 *
 * <p>判定口径与 {@link import('@/components/PermGuard').default} **严格一致**：同一张
 * {@link import('./route-perm').ROUTE_PERM_RULES}、同一套
 * {@link import('./perm').hasPerm} / {@link import('./perm').hasAnyPerm}。两处若分歧，
 * 就会退化成「落点判断放行、路由守卫却拦住」这类镜像 bug，比原始问题更难查。
 *
 * <p>权限快照以**懒加载**方式注入：落点不受守卫保护时（默认的 `/welcome`、
 * 自助页 `/workbench` 等占绝大多数）根本不发起请求，不给登录流程白加一次往返。
 */

import { DEFAULT_REDIRECT_PATH, safeRedirectPath } from '@/utils/redirect';

import { hasAnyPerm, hasPerm, type PermSource } from './perm';
import { resolveRoutePerm } from './route-perm';

/**
 * 取路径部分：丢弃 query 与 hash（`/file?dir=3#top` → `/file`）。
 *
 * <p>必须先剥掉 query，否则 `/system/users?page=2` 既不等于 `/system/users`、
 * 也不以 `/system/users/` 开头，会整条漏过守卫判定而被误放行。
 */
export function pathnameOf(target: string): string {
  return target.split(/[?#]/)[0] ?? '';
}

/**
 * 某路径在给定权限下是否可达（口径与 PermGuard 一致）。
 *
 * <p>登记表的一项可能是「权限点数组」，语义是**满足其一**，故用 `hasAnyPerm`；
 * 这与 PermGuard 的 `canAny` 分支对应，不能误用 `hasAllPerms`。
 */
export function canReachPath(pathname: string, source: PermSource): boolean {
  const required = resolveRoutePerm(pathname);
  return Array.isArray(required) ? hasAnyPerm(source, required) : hasPerm(source, required);
}

/**
 * 收敛登录成功后的落点。
 *
 * @param redirect     登录页 `?redirect=` 的原始值（不可信输入，可能为 null / 外链 / 越权页）
 * @param loadPermCodes 懒加载「刚登录用户」的权限点快照；**仅在落点确实受守卫时才被调用**。
 *                      约定失败时返回全拒绝，切勿因接口抖动把用户放行到越权页面
 * @param fallback     落点不可达时的回落路径，默认 {@link DEFAULT_REDIRECT_PATH}
 * @returns 可直接交给 `window.location.assign` 的站内路径
 */
export async function resolveLoginLandingPath(
  redirect: string | null | undefined,
  loadPermCodes: () => Promise<PermSource>,
  fallback: string = DEFAULT_REDIRECT_PATH,
): Promise<string> {
  const target = safeRedirectPath(redirect, fallback);
  // 归一后的落点：它可能仍带 query / hash，守卫判定只认路径段
  const pathname = pathnameOf(target);

  // 未登记守卫的路径（公开页 / 只呈现本人数据的自助页）必然可达，无需再看权限；
  // 回落路径同样短路，避免调用方传入「本身也受保护」的 fallback 时自我锁死。
  if (target === fallback || !resolveRoutePerm(pathname)) {
    return target;
  }

  let permCodes: PermSource = null;
  try {
    permCodes = await loadPermCodes();
  } catch (error) {
    // 拿不到就按全拒绝处理并回落：宁可把用户带到默认落点，也不能赌他有权而放行
    console.warn('[anttransfer] 登录落点判定：权限快照拉取失败，回落默认落点', error);
  }

  return canReachPath(pathname, permCodes) ? target : fallback;
}
