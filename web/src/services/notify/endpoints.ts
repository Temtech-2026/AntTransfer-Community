/**
 * 通知域端点常量（唯一改动点）。
 *
 * <p>与后端 {@code at-collaboration} 的 {@code NotifyController}（{@code @RequestMapping("/v1/notifications")}）
 * 逐条对齐。所有接口的 userId 一律取自登录态，前端不传也不该传 userId。
 */

export const NOTIFY_ENDPOINTS = {
  /** 未读三口径快照。 */
  unread: '/api/v1/notifications/unread',

  /** 收件箱分页（含已读，时间倒序）。 */
  page: '/api/v1/notifications',

  /** 离线补拉（重连后调用；返回离线期间未读提醒并置读）。 */
  offline: '/api/v1/notifications/offline',

  /** 单条已读（非本人消息 → 4040）。 */
  readOne: (id: number) => `/api/v1/notifications/${id}/read`,

  /** 一键已读（清零系统通知红点与待办，不影响会话）。 */
  readAll: '/api/v1/notifications/read-all',
} as const;
