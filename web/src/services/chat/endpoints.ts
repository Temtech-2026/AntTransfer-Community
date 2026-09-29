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

  /**
   * 撤回消息（`POST`，仅发送人本人、仅 2 分钟内）。
   *
   * <p><b>用 clientMsgId 而不是消息 id 撤回</b>：写扩散下同一条消息在每个参与人那里
   * 是不同的行（id 各不相同），只有幂等键跨行、跨端一致，本地也只有它能在乐观行上匹配
   * （乐观行还没有服务端 id）。服务端据此把该逻辑消息的全部落库行一起翻转，
   * 任何一端重新拉历史都会看到「已撤回」。</p>
   *
   * <p>时间窗由服务端按自己的时钟判定（超窗 `1034`），前端不做权威判定——
   * 本地时间可被随意修改，前端算出的窗口只影响右键菜单里那一项的显隐。</p>
   */
  recall: '/api/v1/chat/messages/recall',

  /**
   * 解析单聊目标（把登录账号 / 用户 ID 翻译成可发起会话的对端）。
   *
   * <p>非管理员没有用户检索权限（`/api/v1/system/users` 挂在系统管理面），
   * 拿不到别人的 19 位雪花 ID，因此「按账号发起会话」必须先走这一步。</p>
   */
  resolveTarget: '/api/v1/chat/targets/resolve',

  /**
   * 对端备注（`PUT` 设置 / 修改，`DELETE` 取消）：同一路径两种方法。
   *
   * <p><b>为什么备注挂在 `/contacts/{peerId}` 之下而不是账号路径上：</b>备注是
   * {@code (我, 他)} 这一行的私有属性，不是账号昵称——它只改变「我看到的他叫什么」，
   * 对方与其他任何人的界面都不受影响，也不写 {@code sys_user}。
   * 挂在账号路径（如 `/users/{id}/alias`）会让人误以为改的是那个账号。</p>
   *
   * <p><b>为什么是函数而不是常量字符串：</b>同 {@link CHAT_ENDPOINTS.group}——
   * 路径里带 19 位雪花用户 ID，一旦经 `Number()` 归一就会备注到另一个人头上。</p>
   */
  peerAlias: (peerId: string): string => `/api/v1/chat/contacts/${peerId}/alias`,

  /**
   * 订阅对端在线状态，并同时取回其当前值（单聊）。
   *
   * <p>「订阅」与「读取」合并成一次往返：打开会话时必须先拿到当前状态才能画点，
   * 而「要不要显示状态点」与「要不要订阅」永远是同一个决定。打开会话即订阅，
   * 打开期间每 30s 续订一次（服务端续订窗口 2min），关闭会话即停止续订。</p>
   */
  presenceWatch: '/api/v1/chat/presence/watch',

  /**
   * 转发「我正在输入」瞬时信号（单聊，对端经 `TYPING` 帧收到）。
   *
   * <p>上行走 HTTP（限流 / 明确参数错误 / 与消息投递同一把目标校验尺子），下行仍是 WS 帧。</p>
   */
  typing: '/api/v1/chat/typing',

  /**
   * 群聊：`GET` 取「我加入的群」，`POST` 创建群聊（同路径不同方法）。
   *
   * <p><b>POST 才需要权限点</b>（`chat:group:create`）：建群会写 `sys_group` /
   * `sys_group_member` 并决定后续消息的可见范围。GET 是登录即用——
   * 它只返回登录人自己加入的群，维度写死在服务端，没有「传别人的 ID 列别人的群」的入参面。</p>
   *
   * <p>群聊会话以 `targetId = 群组 ID` 定位，因此这里返回的 `id` 可直接拿去做会话目标，
   * 建群成功后无需再查一次会话列表。</p>
   */
  groups: '/api/v1/chat/groups',

  /**
   * 群详情（`GET`）/ 改群名（`PATCH`）/ 解散群（`DELETE`）：同一路径三种方法。
   *
   * <p><b>为什么这里是函数而不是常量字符串：</b>路径里必须带上群 ID，
   * 而 ID 是 19 位雪花值——一旦有人写成 `Number(id)` 就会丢精度、指向另一个群。
   * 用模板字符串收口，调用方没有任何机会在中间做数值归一。
   * 既有的常量端点都不同方法共用一个字符串，故沿用同一风格的注释粒度。</p>
   */
  group: (groupId: string): string => `/api/v1/chat/groups/${groupId}`,

  /** 邀请成员（`POST`，一次可邀多人；服务端对已在群者幂等跳过）。 */
  groupMembers: (groupId: string): string =>
    `/api/v1/chat/groups/${groupId}/members`,

  /**
   * 移除单个成员（`DELETE`）。
   *
   * <p><b>被移除者进路径、批量邀请进 body</b>：移除永远是一次一个人的决定，
   * 路径与被删资源一一对应；邀请则是「一批人」这个集合，天然是请求体。</p>
   */
  groupMember: (groupId: string, userId: string): string =>
    `/api/v1/chat/groups/${groupId}/members/${userId}`,

  /** 退出群聊（`POST`，作用于登录人自己，故路径里只有群 ID、没有他人 ID）。 */
  groupQuit: (groupId: string): string =>
    `/api/v1/chat/groups/${groupId}/quit`,

  /**
   * 我的群提醒偏好（`GET` 读 / `PUT` 整体覆盖写）：同一路径两种方法。
   *
   * <p><b>为什么路径里只有群 ID、没有用户 ID：</b>偏好是 {@code (我, 这个群)} 这条成员关系的
   * 私有属性（同 {@link CHAT_ENDPOINTS.peerAlias} 的取舍），作用对象写死为登录人。
   * 挂成 {@code /groups/{groupId}/members/{userId}/notify} 会立刻引出
   * 「能不能替别人设免打扰」这个本不该存在的话题。</p>
   *
   * <p><b>为什么不复用 {@link CHAT_ENDPOINTS.group}</b>：群详情也会带上这份偏好，
   * 但它同时要组装全量成员名单（最坏 500 条批量反查展示名 / 头像）。
   * 用户每拨一个开关就读一次全量名单是明显的浪费，故单开一个只读三个开关的窄接口。</p>
   */
  groupNotifyPreference: (groupId: string): string =>
    `/api/v1/chat/groups/${groupId}/notify-preference`,
} as const;
