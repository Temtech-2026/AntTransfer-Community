/**
 * 免登录公开路径判定（登录守卫的唯一口径）。
 *
 * <p>背景：`app.tsx` 的 `getInitialState` 与 `onPageChange` 默认认为「除登录页外一切路径都要登录」——
 * 这对管理端是对的，但外发分享的访客页（`/share/{token}`）本来就<b>没有账号</b>：
 * 访客拿到的只是一条链接和一句提取码。若不放行，浏览器打开分享链接会被整页重定向到
 * `/user/login?redirect=%2Fshare%2F...`——即「复制分享链接后在浏览器里打不开对应画面」，
 * 而且访客此时连登录凭据都没有，等于彻底进不去。</p>
 *
 * <p>之所以做成<b>单一纯函数</b>而不是在两处各写一遍判断：漏改一处的后果不是样式问题，
 * 而是「要么访客被踢去登录，要么登录态校验被绕过」——两种都是安全/可用性事故。
 * 判定同时被 `app.tsx` 复用，新增免登录页面时只改这里。</p>
 *
 * <p>注意两个刻意的收窄：</p>
 * <ul>
 *   <li>只放行 <b>单段</b> token（`/share/abc`），不放行 `/share/abc/def`——深层路径不属于任何路由，
 *       没理由让它绕过登录；</li>
 *   <li>不放行 `/share` 本身（无 token 的裸前缀），它会落到 404 而不是进入取件流程。</li>
 * </ul>
 */

/** 登录页路径：唯一「未登录也能停留」的非公开入口（它自己就是登录动作的载体）。 */
export const LOGIN_PATH = '/user/login';

/** 分享访客页前缀（`/share/{token}`，免登录取件）。 */
export const SHARE_VISIT_PREFIX = '/share/';

/**
 * 是否为免登录公开路径。
 *
 * @param pathname 路由路径（可带或不带前导 `/`；query/hash 请调用方先行剥离）
 */
export function isPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) {
    return false;
  }
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (path === LOGIN_PATH) {
    return true;
  }
  // 单段 token：/share/{token}（允许一个尾部斜杠）
  return /^\/share\/[^/]+\/?$/.test(path);
}
