/**
 * 会话（IM）权限点常量（编译期别名，逐字符对齐 SQL 脚本）。
 *
 * <p><b>唯一事实源是 SQL 脚本</b>（{@code sql/V14__chat_group_permission_points.sql}）。
 * 这里镜像一层，是为了让页面把显隐条件写成 {@code can(CHAT_PERM.GROUP_CREATE)}
 * 而不是裸字符串——权限点拼错不会报错，只会静默判定失败，
 * 表现为「按钮莫名消失 / 选项莫名不见」这种无人能定位的现象。</p>
 *
 * <p><b>本域只对「写」设点：</b>会话的读 / 发 / 已读沿用「登录即用」口径
 * （见后端 {@code ChatController} 类注），刻意不设权限点——聊天是协作底座，
 * 按权限点逐项收紧会做出一批「能收到消息却发不出去」的半残账号，
 * 且这类问题只在特定角色的真实操作中才暴露。</p>
 *
 * <p><b>群管理同理保留两个「不设点」的口子</b>：群详情（`GET /groups/{id}`，非成员一律 1012）
 * 与退出群聊（`POST /groups/{id}/quit`，作用对象恒为登录人自己）都不挂权限点，
 * 否则会做出一批「建完群打不开群设置」或「进了群退不出去」的账号。</p>
 *
 * <p><b>权限点管不到「这个群归不归他管」：</b>下面四个点只回答「该账号有没有群管理这项功能」，
 * 群内身份（群主 / 管理员 / 普通成员）由服务端逐次判定，不足时回 1038 / 1041——
 * 与权限点不足的 1003 是两个码，前端提示也不同。故面板的按钮显隐是
 * 「权限点 **与** 后端下发的 `ability` 字段」的合取，不能只看权限点。</p>
 *
 * <p>⚠️ 前端显隐只影响体验，<b>不构成安全边界</b>；强制校验在后端
 * {@code ChatController} 的 {@code @RequiresPerm} 与服务层的群内身份判定。</p>
 */

/** 会话域权限点编码。 */
export const CHAT_PERM = {
  /** 会话菜单根节点（{@code type=1}，{@code id=103}；与 file/audit/system 并列）。 */
  MENU_ROOT: 'chat',

  /**
   * 创建群聊（{@code POST /api/v1/chat/groups}，{@code type=2}，挂 {@link CHAT_PERM.MENU_ROOT} 之下）。
   *
   * <p>V14 只授给 SUPER_ADMIN / DEPT_ADMIN / USER 三个业务角色，<b>不授 AUDITOR</b>：
   * 建群会写 {@code sys_group} / {@code sys_group_member} 并决定后续消息的可见范围，
   * 属写操作，与审计员「权限锁定只读」的口径冲突（该口径由 V2 只授
   * {@code audit:log:read}、V14 不授本点、服务层 1021 拒绝变更 AUDITOR 权限集三处共同保证）。</p>
   *
   * <p>前端若判定为「无此点」，应<b>隐藏群聊入口而不是置灰</b>：置灰需要解释原因，
   * 而「为什么我不能建群」对多数用户是无关信息，只会增加界面噪音。</p>
   */
  GROUP_CREATE: 'chat:group:create',

  /**
   * 修改群名（`PATCH /api/v1/chat/groups/{groupId}`，V16 引入）。
   *
   * <p>群主与群内管理员可用（后端 `CHAT_GROUP_ADMIN_REQUIRED` 1038 兜底）。
   * 想改名的普通成员应看到按钮，而不是「点了报无权限」——因此显隐条件是
   * {@code can(GROUP_UPDATE) && detail.ability.canRename}。</p>
   */
  GROUP_UPDATE: 'chat:group:update',

  /** 邀请成员（`POST /api/v1/chat/groups/{groupId}/members`，V16 引入；群主与管理员可用）。 */
  GROUP_INVITE: 'chat:group:invite',

  /**
   * 移除成员（`DELETE /api/v1/chat/groups/{groupId}/members/{userId}`，V16 引入；<b>仅群主</b>）。
   *
   * <p>与 {@link CHAT_PERM.GROUP_DISSOLVE} 同属「破坏性」一档：CE 刻意不给管理员，
   * 因为移除会立刻切断被移除者对历史消息的读取，不可撤销。</p>
   */
  GROUP_REMOVE: 'chat:group:remove',

  /** 解散群聊（`DELETE /api/v1/chat/groups/{groupId}`，V16 引入；<b>仅群主</b>，不可逆）。 */
  GROUP_DISSOLVE: 'chat:group:dissolve',
} as const;
