/**
 * 登录回跳路径安全化。
 *
 * <p>登录页的 `redirect` 参数来自 URL 查询串，属于不可信输入：必须限制为「本站绝对路径」，
 * 否则 `?redirect=https://evil.example` 会把刚登录成功的用户直接送去钓鱼站（open redirect）。</p>
 */

/** 登录成功后的默认落点（与 routes.ts 里 `/` 的 redirect 保持一致）。 */
export const DEFAULT_REDIRECT_PATH = '/welcome';

/**
 * 是否为可安全回跳的站内路径。
 *
 * <p>`//evil.com` 与 `/\evil.com` 都会被浏览器当作「协议相对 URL」跳去外站，必须一并拒绝。</p>
 */
export function isSafeRedirectPath(target?: string | null): boolean {
  const path = target?.trim();
  if (!path?.startsWith('/')) {
    return false;
  }
  return !path.startsWith('//') && !path.startsWith('/\\');
}

/** 归一为可安全跳转的路径；不安全（外链 / 空值 / 相对路径）时回落到默认落点。 */
export function safeRedirectPath(
  target?: string | null,
  fallback: string = DEFAULT_REDIRECT_PATH,
): string {
  const path = target?.trim();
  return isSafeRedirectPath(path) ? (path as string) : fallback;
}
