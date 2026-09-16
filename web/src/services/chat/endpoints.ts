/**
 * 会话（IM）域端点常量（唯一改动点）。
 *
 * <p>与后端 {@code at-collaboration} 的 {@code ChatController}（{@code @RequestMapping("/v1/chat")}）
 * 逐条对齐。所有接口的 userId 一律取自登录态，前端不传也不该传——
 * 会话列表的查询维度写死在服务端的 {@code CurrentUserContext} 上，
 * 因此不存在「传别人的 ID 读别人的会话」这个入参面。</p>
 */

export const CHAT_ENDPOINTS = {
  /** 会话列表（左栏；按最后活跃倒序，含每会话未读数）。 */
  conversations: '/api/v1/chat/conversations',

  /** 发送消息（幂等：同一消息重发须沿用同一个 clientMsgId）。 */
  send: '/api/v1/chat/messages',

  /** 会话历史（倒序返回；用 beforeId 游标向上翻页，不用 offset）。 */
  history: '/api/v1/chat/messages',

  /** 会话已读（进入会话即调用，清该会话角标）。 */
  read: '/api/v1/chat/read',
} as const;
