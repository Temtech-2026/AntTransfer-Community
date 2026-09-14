/**
 * 认证域端点常量（唯一改动点：新增 / 调整接口只改这里）。
 *
 * <p>与后端 {@code at-auth} 的 {@code @RequestMapping("/v1/auth")} 逐字符对齐；
 * 路径里的 `/api` 前缀与 `services/access`、`services/file` 同口径，由 `config/proxy.ts`
 * 转发到 at-bootstrap。</p>
 *
 * <p>关于「/auth/login」：外部计划文档的写法是 {@code /auth/login} / {@code /auth/refresh}，
 * 仓库契约（docs/api/README.md §5）是「令牌资源的动作」命名 {@code /v1/auth/token}，
 * 后端 AuthController 已在 AT-DIFF-05 登记按仓库契约实现；前端因此<b>不另造 login 别名</b>，
 * 避免同一动作出现两套路径。</p>
 */
export const AUTH_ENDPOINTS = {
  /** 登录：账号密码 → 双令牌（access 30min + refresh 7d）。免登录白名单端点。 */
  login: '/api/v1/auth/token',

  /** 刷新：refresh token 换发新令牌对（单次有效，轮换 + 复用检测）。 */
  refresh: '/api/v1/auth/token/refresh',

  /** 注销：全端吊销（DB token_epoch + 1 并清 Redis 白名单），旧令牌即刻失效。 */
  logout: '/api/v1/auth/logout',

  /** 当前登录用户摘要（含角色编码），页面刷新后恢复会话用。 */
  me: '/api/v1/auth/me',
} as const;
