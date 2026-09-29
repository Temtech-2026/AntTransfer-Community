# 🗺️ 前端路由 / 按钮 ↔ perm_code 映射（Phase 5 使用）

> 本文档是 Phase 5 前端接入 RBAC 的**单一事实源**：前端每个受保护的路由与按钮
> 必须且只能对应一个后端 perm_code，判定口径以 `GET /api/v1/permission/my`
> 返回的 `permCodes` 并集为准（登录后拉取一次 + 变更后重新拉取）。
> 后端实现：`@RequiresPerm` 注解（`server/at-permission`），前端**不得**在前端
> 硬编码角色判断，只映射 perm_code——角色只是聚合单位，可随时换绑。

## 约定

| 项 | 约定 |
| --- | --- |
| 请求 | 登录成功即调 `GET /api/v1/permission/my`，得到 `{ roles: string[], permCodes: string[], dataScope: 1\|2\|3 }` |
| 路由守卫 | 路由 meta 声明 `perm: 'file:download'`；无权限跳 403 页（不回登录页，策略 D） |
| 登录落点 | 登录成功后的 `?redirect=` **只保证「站内」，不保证「当前用户可达」**；须经 `resolveLoginLandingPath`（`services/access/landing.ts`）按 `ROUTE_PERM_RULES` + 本人 `permCodes` 收敛，不可达则回落 `DEFAULT_REDIRECT_PATH`（`/welcome`） |
| 按钮显隐 | 统一 `usePerm('file:download')` hook；**只藏不决定安全**，后端仍强制校验 |
| 命名 | 与后端 `perm_code` **逐字符一致**，禁止前端另起一套 |
| Deny | 后端 `permCodes` 已剔除显式 Deny 项，前端无需感知 Deny 逻辑 |
| 数据范围 | 列表页请求携带查询范围；后端按 `dataScope` 收敛结果（前端不用自己拼部门条件） |

## 映射表

| 菜单 / 路由 | 页面元素（按钮） | perm_code | 角色现状（V2） |
| --- | --- | --- | --- |
| 文件列表 `/file` | 页面可见（菜单） | —（type=1 菜单，随子项） | SUPER_ADMIN / DEPT_ADMIN / USER |
| 文件列表 `/file` | 下载 | `file:download` | 全部业务角色 |
| 文件列表 `/file` | 上传 / 秒传 | `file:upload` | 全部业务角色 |
| 文件列表 `/file` | 预览 | `file:preview` | 全部业务角色 |
| 文件列表 `/file` | 编辑 / 重命名 / 移动 | `file:edit` | 全部业务角色 |
| 文件列表 `/file` | 历史版本 / 回滚 | `file:version` | 全部业务角色 |
| 文件列表 `/file` | 创建外发链接 | `file:share` | 全部业务角色 |
| 文件列表 `/file` | 删除并销毁（回收站之上） | `file:destroy` | **仅 SUPER_ADMIN**（`sql/V8__restrict_file_destroy_to_super_admin.sql` 已从 DEPT_ADMIN 回收该点；高敏感 `level>=3` 文件还须关联一张已通过的高敏感审批单，`level` 由文件详情给出） |
| 文件列表 `/file` | 标签 CRUD / 打标 | `file:preview`（读）/ `file:edit`（写） | 全部业务角色（不另立 `tag:*` 权限点） |
| 文件列表 `/file` | 批量打包下载 | `file:download` | 全部业务角色 |
| 分享管理 `/shares` | 页面可见（菜单 + 路由守卫） | `file:share` | 全部业务角色（`ROUTE_PERM_RULES`，见 `web/src/services/access/route-perm.ts`） |
| 分享管理 `/shares` | 创建分享 / 复制链接 / 取消分享 | `file:share` | 全部业务角色（后端 `ShareController` 的创建 / 单条撤销 / 详情 / 我的分享统一收口该点） |
| 分享管理 `/shares` | 行复选框 + 失效所选（带条数；未勾选则禁用） | `file:share` | 全部业务角色（`POST /v1/shares/batch/revoke`，单次上限 200；复选框只对「生效中」的行开放） |
| 分享管理 `/shares` | 失效全部（**不接受任何范围参数**） | `file:share` | 全部业务角色（`POST /v1/shares/all/revoke`，作用域由服务端按登录主体决定；回**实际失效条数**，`0` 条不等于成功） |
| 审计日志 `/audit` | 页面可见 + 查询 / 导出 | `audit:log:read` | 仅 SUPER_ADMIN / AUDITOR |
| 消息中心 `/messages` | 页面可见 + 通知列表 / 标记已读 / 离线补拉 | —（**不设权限点**：`/v1/notifications/**` 的查询维度写死为登录人本人；加权限点只会造出「有未读却打不开」） | 全部业务角色（有登录态即可见；含本轮新增 `8` 传输完成 / `9` 取件回执 / `4` 到期前提醒） |
| 会话 `/chat` | 页面可见 + 历史 / 发送 / 已读 / 在线状态 / 「我加入的群」/ **`@` 提及**（上行 `mentionUserIds`、下行 `mentioned` / `mentionUnreadCount`） | —（**不设权限点**：查询与写入维度都写死在登录主体上，见 `ChatController` 类注） | 全部业务角色（有登录态即可见） |
| 会话 `/chat` | 新建会话弹窗 → 「群聊」类型（建群：群名 + 受邀成员） | `chat:group:create` | SUPER_ADMIN / DEPT_ADMIN / USER（`sql/V14__chat_group_permission_points.sql`；**不授 AUDITOR**——建群写 `sys_group` / `sys_group_member` 并决定后续消息可见范围，与审计员「权限锁定只读」冲突） |
| 会话 `/chat` + 即时通讯抽屉 | 群设置面板：群资料 + 成员名单（打开即可看） | —（**只看自己加入的群**：非成员回 `1012`，越权面由成员资格堵住，不设权限点） | 全部业务角色（是该群成员即可见） |
| 会话 `/chat` + 即时通讯抽屉 | 群设置面板：改群名 | `chat:group:update` | SUPER_ADMIN / DEPT_ADMIN / USER（`sql/V16__chat_group_manage_permission_points.sql`；**不授 AUDITOR**，同建群理由）**且**群内身份为群主或管理员（身份不足回 `1038`） |
| 会话 `/chat` + 即时通讯抽屉 | 群设置面板：邀请成员 | `chat:group:invite` | 同上（群主或管理员；**已在群者幂等跳过**，曾被移除者复活原成员行） |
| 会话 `/chat` + 即时通讯抽屉 | 群设置面板：移除成员 | `chat:group:remove` | SUPER_ADMIN / DEPT_ADMIN / USER **且仅群主**（管理员也不满足，回 `1041`；群主本身不可被移除，回 `1039`） |
| 会话 `/chat` + 即时通讯抽屉 | 群设置面板：解散群聊 | `chat:group:dissolve` | 同上（**仅群主**；先清全体成员关系、再停群行） |
| 会话 `/chat` + 即时通讯抽屉 | 群设置面板：退出群聊 | —（**不设权限点**：作用对象恒为登录人本人，身份维度说了算） | 全部业务角色（群内非群主；**群主退群回 `1039`**，想离开只能先解散） |
| 会话 `/chat` + 即时通讯抽屉 | 群设置入口按钮（页头 / 抽屉头部） | —（入口本身不判权限点） | 仅**群**会话渲染（单聊不出现；能不能改由面板自己判定） |
| 工作台 `/workbench`（web 首页） | 页面可见（待办 / 待审批 / 传输统计） | —（后端按当前登录用户收敛，无原子权限点） | 全部业务角色 |
| （不存在）日志清除 | 任何入口都**不渲染** | 后端从不签发 `audit:log:clear` | 任何角色（含 SUPER_ADMIN）都无 |
| 权限地图 `/permission-map` | 页面可见（我的权限点 / 角色 / 审批授权） | —（后端 `GET /v1/permission/map` 只返回当前登录用户的权限，无原子权限点） | 全部业务角色 |
| 顶栏头像下拉（全局，`AvatarDropdown`） | 个人信息 / **更换头像** / 修改密码 / 退出登录 | —（`GET /v1/auth/me`、`POST /v1/users/me/avatar`、`PUT /v1/auth/password`、`POST /v1/auth/logout` 均按当前登录身份收敛，**不设原子权限点**；换头像的路径是 `/users/me`，目标 ID 恒取令牌 subject，越权在结构上不可达） | 全部业务角色（有登录态即可见；换头像成功后本端就地换图 + 写本地头像覆盖表，其他在线端由 `PROFILE` 广播帧同步；改密成功后服务端全端吊销，前端须清本地令牌并回登录页） |
| 系统管理 `/system/users` | 页面可见（菜单） | `system:user:list` | 仅 SUPER_ADMIN |
| 系统管理 `/system/users` | 新建用户 | `system:user:create` | 仅 SUPER_ADMIN |
| 系统管理 `/system/users` | 编辑资料 / 调岗 / **更换他人头像**（`POST /v1/system/users/{id}/avatar`） | `system:user:update`（且**受操作者数据范围收敛**——管理员只改得动自己可见范围内的人，与本人在 `/users/me` 自改头像不是同一条路径） | 仅 SUPER_ADMIN |
| 系统管理 `/system/users` | 启用 / 停用 | `system:user:status` | 仅 SUPER_ADMIN |
| 系统管理 `/system/users` | 重置口令 | `system:user:reset-password` | 仅 SUPER_ADMIN |
| 系统管理 `/system/users` | 分配角色 | `system:user:assign-role` | 仅 SUPER_ADMIN |
| 系统管理 `/system/users` | 删除用户 | `system:user:delete` | 仅 SUPER_ADMIN |
| 系统管理 `/system/roles` | 页面可见（菜单） | `system:role:list` | 仅 SUPER_ADMIN |
| 系统管理 `/system/roles` | 新建角色 | `system:role:create` | 仅 SUPER_ADMIN |
| 系统管理 `/system/roles` | 编辑角色 | `system:role:update` | 仅 SUPER_ADMIN |
| 系统管理 `/system/roles` | 删除角色 | `system:role:delete` | 仅 SUPER_ADMIN |
| 系统管理 `/system/roles` | 分配权限点 | `system:role:assign-perm` | 仅 SUPER_ADMIN |
| 系统管理 `/system/depts` | 页面可见（菜单，只读部门树） | `system`（type=1 根节点，CE 无部门原子权限点） | 仅 SUPER_ADMIN |
| 系统管理 `/system/groups` | 页面可见（菜单，只读占位说明） | `system`（同上；CE 无群组接口与权限点） | 仅 SUPER_ADMIN |
| 系统管理 `/system/menus` | 页面可见（菜单，只读权限点目录） | `system`（同上） | 仅 SUPER_ADMIN |
| 访客取件 `/share/:token` | 页面可见 + 输入提取码 / 下载 | —（**免登录公开路由**：凭高熵令牌 + 提取码自证身份，无 `perm_code`，不挂 `PermGuard`） | 任何访客（含未登录） |

> 🔐 **系统管理面四条红线的前端职责**：后端已强制（`RoleAdminService` / `UserAdminService`），前端**只需如实呈现**，不要「猜」：
> ① 内置角色（`SUPER_ADMIN` / `AUDITOR` / `DEPT_ADMIN` / `USER`）禁用删除入口与数据范围选择器（`1020`）；
> ② `AUDITOR` 的授权弹窗置为只读——**不要硬编码角色码**，读接口下发的 `auditorLocked` 标记（`1021`）；
> ③ 数据范围非「全部」时，角色数据范围下拉**只列 ≤ 自身**的选项、权限点树**置灰自身没有的点**（`1027`）——
> 这只是少挨一次 403 的体验优化，**安全由后端兜底**；
> ④ 对自己隐藏停用 / 删除 / 重置口令 / 改角色四个按钮（`1023`），违背后端必拒。
>
> 🔁 **调岗 / 离职的交互提示**：改部门（调岗）或停用（离职）会**回收该用户全部审批类授权并吊销在途会话**，
> 属不可逆副作用，前端须二次确认并明示后果（不要只写「确定保存吗」）。
>
> ❗ `1020` / `1021` / `1023` / `1024` / `1027` 均为**策略 D**：就地提示，**禁止引导重新登录**。
>
> 💬 **群聊入口的显隐口径**（`web/src/services/chat/perm.ts`）：无 `chat:group:create` 时
> **整个「群聊」类型都不出现在新建会话弹窗里**（隐藏，不是置灰）。原因有两条：
> ① 该分支下每个动作都以建群为前提，留下一个必然失败的入口只会重演「群聊不可用」；
> ② 置灰需要解释「为什么我不能建群」，而这对多数用户是无关信息。
> 「我加入的群」（`GET /v1/chat/groups`）与建群权限无关——它只返回登录人自己加入的群，
> 属登录即用；无建群权限时不展示群聊类型，该入口也随之一并不可见。
> 前端显隐不构成安全边界，强制校验在后端 `ChatController#createGroup` 的 `@RequiresPerm`。
>
> ⚙️ **群设置面板的显隐是「权限点 ∧ 群内身份」的合取**（`web/src/components/ChatGroupPanel`，
> 两个入口共用同一实现）：权限点（`CHAT_PERM.GROUP_UPDATE / INVITE / REMOVE / DISSOLVE`）论
> 「这个账号有没有群管理这项功能」，服务端随详情下发的 `ChatGroupDetailVO.ability`
> （`canRename / canInvite / canRemoveMember / canDissolve / canQuit`）论「我在**这个群**里是什么身份」，
> **两者都成立才渲染按钮**。只看其一都会做出「按钮在、点了必失败」的界面——分别回 `1003` 与
> `1038` / `1041`（见 [error-codes.md](../api/error-codes.md)）。
> 两条附带红线：① **前端不自行推断「我是不是群主」**——登录态里没有可信的用户主键，
> 身份判定只在服务端（`ability` 由 `sys_group.owner_user_id` + `member_role` 实时算出，
> **不落第二份「谁是群主」的副本**），前端因此也自然做不出「移除自己」这种必然被 `1039` 拒绝的按钮；
> ② **群设置入口（页头 / 抽屉头部）本身不判权限点**，只在群会话渲染——能不能改、能改什么由面板自己判定，
> 入口再判一道就是两处口径，迟早分叉。
> 危险动作（移除 / 退群 / 解散）**一律走 `useDangerConfirm` 弹窗**而不是行内气泡（误触代价不可逆），
> 其中解散标 `critical`：它先清全体成员关系、再停群行，历史消息此后在服务端不再可读。

## 前端使用示例（伪代码，Phase 5 实现时按实际脚手架落位）

```ts
// usePerm hook 语义
const canDownload = usePerm('file:download');

// 路由 meta
{ path: '/file', perm: 'file:download' }

// 守卫
if (!hasPerm(route.perm)) redirect('/403');
```

## 后端对照

- 权限点全量枚举：`sql/V2__init_data.sql`（sys_permission，type=2 为操作点）
  + `sql/V9__system_admin_permission_points.sql`（系统管理面 `system:user:*` / `system:role:*`，**仅授 SUPER_ADMIN**）
  + `sql/V14__chat_group_permission_points.sql`（会话菜单根节点 `chat` + `chat:group:create`，
  授 SUPER_ADMIN / DEPT_ADMIN / USER，**不授 AUDITOR**）；
- 判定注解：`server/at-permission` 的 `@RequiresPerm`（服务端强制，前端显隐仅是体验层）；
- 数据范围收敛（能管到哪些部门）由 `AccessControlService` 在服务端按 `dataScope` 落地，
  前端**不要自己拼部门查询条件**；
- 用户管理端点在 `at-permission` 的 `/api/v1/system/users`（**不是** at-auth 的 `/api/v1/users`，
  后者是个人中心自助，见 [api/README.md §1](../api/README.md)）；
- **本人自助改密**（GAP-03，2026-09-20）落在 `/api/v1/auth/password`（**认证域动作端点**，不在上表两条前缀下）：
  只要求登录态、**不设权限点**，任何业务角色都可用；成功后全端吊销，前端入口见上表「顶栏头像下拉」行。
