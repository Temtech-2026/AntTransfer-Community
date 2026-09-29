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

  /**
   * 本人自助改密：原口令再确认 + 强度校验，成功后<b>全端</b>令牌立即失效（含当前会话）。
   *
   * <p>非白名单端点。调用方拿到成功响应后必须清本地令牌并回登录页——后端已把
   * {@code token_epoch + 1}，连本次请求用的 access token 也当场作废。</p>
   */
  changePassword: '/api/v1/auth/password',

  /**
   * 本人更换头像（multipart，字段名 {@code file}；**上传即生效**）。
   *
   * <p>路径是 {@code /v1/users/me/avatar} 而不是 {@code /v1/system/users/{id}/avatar}：
   * 前者按 docs/api/README.md §1 的划分属「本人资料自助」，目标用户来自令牌，
   * <b>无权限点要求</b>；后者是管理员改他人头像，需 {@code system:user:update}。
   * 前端不得把两者混用——用管理端点改自己，会把「改头像」这件事错误地绑上管理权限。</p>
   *
   * <p>注意与「头像直出」{@code GET /v1/users/{id}/avatar}（免登录、只回图片字节）区分：
   * 本端点是写路径、须持 access token、回 JSON 摘要。</p>
   */
  myAvatar: '/api/v1/users/me/avatar',

  /**
   * 本人消息提醒设置：`GET` 读（含服务端下发的音频上限）/ `PUT` 整体覆盖（开关 + 音色）。
   *
   * <p>与头像同属「本人资料自助」：目标用户来自令牌，<b>路径里没有 userId</b>，
   * 也不挂权限点——「我自己的手机响不响」不该是一件需要被授权的事。</p>
   *
   * <p>`PUT` 是<b>整体覆盖</b>而非逐字段 `PATCH`：三个字段（开关 + 音色）在界面上是同一份状态，
   * 逐字段改动会让「并发提交时后到的旧值把新值写回去」这类交错产生界面与库不一致。</p>
   */
  myNotifySetting: '/api/v1/users/me/notify-setting',

  /**
   * 本人自定义提示音：`POST` multipart 上传（字段名 `file`，上传即生效）/ `DELETE` 清空。
   *
   * <p>只有这个写路径能把音色切成 {@code custom}：音色不是一个可以「直接声明」的字符串，
   * 而是「确实有一段音频」这个事实的结果（否则会出现「音色是自定义却没有音」的悬空状态）。</p>
   */
  myNotifySound: '/api/v1/users/me/notify-setting/sound',

  /**
   * 本人自定义提示音内容直出（**需要带令牌**，故不能用 `<audio src>` 直连）。
   *
   * <p>刻意<b>不做匿名放行</b>：提示音只在本人已登录的会话里播放，少一个匿名入口就少一处越权面。
   * 因此前端必须用 {@link downloadBinary} 带 Authorization 取回 Blob 再播放
   * （见 `services/notify/soundPlayer`），直接把这个路径塞给 `<audio>` 只会拿到 401。</p>
   *
   * <p>服务端响应为 `private, no-cache` + 强 ETag：不带 `?v=` 参数时走 304 复用，
   * 换了音频（key 变化）则自然命中新内容。</p>
   */
  myNotifySoundContent: '/api/v1/users/me/notify-setting/sound/content',
} as const;
