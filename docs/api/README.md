# 🔌 API 规范（API Specification）

> 📖 本文档定义 AntTransfer CE 对外 HTTP API 的**统一契约**，服务端与前端开发均以此为基准。
> 🎫 错误码明细见 [错误码全表](./error-codes.md)，代码实现见 `server/at-common`（`Result` / `ErrorCode`）
> 与 `server/at-gateway`（`GlobalExceptionHandler`）。

## 1️⃣ URL 与版本

| 项 | 约定 |
| --- | --- |
| 🌐 服务地址 | `http://<host>:8080` |
| 🧭 全局前缀 | `/api`（`server.servlet.context-path=/api`，Swagger `/api/swagger-ui/index.html`、OpenAPI `/api/v3/api-docs` 除外） |
| 🔖 版本段 | 业务接口统一挂 **`/api/v1`**：版本化在 URL 中显式表达；破坏性变更升级 `/api/v2`，非破坏性扩展不升版本 |
| 🏷️ 资源命名 | **REST 复数资源、小写 + 连字符**，如 `/api/v1/users`、`/api/v1/permission-points`、`/api/v1/transfers` |
| ⚡ 动作用例 | 认证 / 续期等非资源端点允许动作动词：`POST /api/v1/auth/token`、`POST /api/v1/auth/token/refresh` |

> 🧩 各领域 Controller 前缀（模板，具体以模块实现为准）：

| 后端模块 | 前缀 | 典型资源 |
| --- | --- | --- |
| `at-auth` | `/api/v1/auth` | `token`、`token/refresh`、`logout`、`me`、`password`（均为动作端点；**自助改密**归此域） |
| `at-auth` | `/api/v1/users` | **本人**资料 / 当前账号：`POST /api/v1/users/me/avatar`（**本人自助换头像**——multipart 字段 `file`，PNG / JPG / GIF / WebP、单张 ≤ 2 MiB；**不挂权限点**，目标 ID 恒取令牌 subject，路径里的 `me` 使越权在结构上不可达）；头像**直出** `GET /api/v1/users/{userId}/avatar?v=<存储 key>`（**免登录**，只回图片字节，见 §5）。`sys_user` 的表主在本模块。**自助改密**按「凭据动作」形态落在 `/api/v1/auth/password`，不在本前缀下。⚠️ 「个人中心改昵称」尚未实现（见 [AT-DIFF-11](../development/AT-DIFF-todos.md#at-diff-11头像双写入口与-profile-帧广播) / [GAP-10](../development/AT-DIFF-todos.md#gap-10个人资料自助仅落头像缺改昵称)） |
| `at-permission` | `/api/v1/system/users`、`/api/v1/roles`、`/api/v1/permission-points`、`/api/v1/permission` | **系统管理面**（管理员「管别人」）：用户管理 `GET /api/v1/system/users`（分页，按操作者数据范围收敛）、`GET /api/v1/system/users/{id}`、`GET /api/v1/system/users/dept-options`（部门下拉）、`GET /api/v1/system/users/role-options`（角色下拉）、`POST /api/v1/system/users`（建号，可带初始角色）、`PUT /api/v1/system/users/{id}`（编辑；**换部门即调岗**，触发权限重评估回收审批授权）、`PATCH /api/v1/system/users/{id}/status`（启停；停用=离职，回收审批授权并吊销在途会话）、`POST /api/v1/system/users/{id}/reset-password`（禁止对自己）、`PUT /api/v1/system/users/{id}/roles`（整集替换角色，禁止对自己）、`DELETE /api/v1/system/users/{id}`（逻辑删除，受保护账号与最后一个超管不可删）；角色管理 `GET /api/v1/roles`（分页）、`GET /api/v1/roles/options`（全量下拉）、`GET /api/v1/roles/{id}`、`POST /api/v1/roles`、`PUT /api/v1/roles/{id}`、`DELETE /api/v1/roles/{id}`（内置角色不可删）、`GET /api/v1/roles/{id}/permissions`、`PUT /api/v1/roles/{id}/permissions`（整集替换；`AUDITOR` 权限锁定只读）；权限点目录 `GET /api/v1/permission-points`（只读全树）；授权申请 `/api/v1/permission/...`；动态菜单 `GET /api/v1/permission/menus`（按登录用户权限点过滤 `type=1` 节点组装树，见 `architecture.md` §4 D-9） |
| `at-file` | `/api/v1/files`、`/api/v1/folders`、`/api/v1/shares` | 文件元数据 / 上传 / 下载；**目录树**：`GET /api/v1/folders/tree`（整树，不分页）、`POST /api/v1/folders`（新建）、`PATCH /api/v1/folders/{id}/rename`、`PATCH /api/v1/folders/{id}/move`、`DELETE /api/v1/folders/{id}`（目录内文件进回收站，不销毁物理文件）；**下载与预览**：`POST /api/v1/files/{id}/ticket`（换票，需 `file:download`）、`GET /api/v1/files/{id}/content`（**免登录**，票取；支持 `Range` 续传、`speedLimit` 任务级限速、`disposition=inline`）、`GET /api/v1/files/{id}/thumbnail`（**免登录**，票取）、`GET /api/v1/files/{id}/preview`（返回预览策略，需 `file:preview`）；**外发链接（CE 实际落地方，见 [AT-DIFF-06](../development/AT-DIFF-todos.md#at-diff-06-外发分享模块归属)）**：`POST /api/v1/shares`（创建）、`GET / DELETE /api/v1/shares/{token}`、`GET /api/v1/shares/mine`、`POST /api/v1/shares/batch/revoke`（批量失效**所选**：请求体为令牌列表，单次上限 200，回**实际失效条数**）、`POST /api/v1/shares/all/revoke`（**一键失效本人全部生效中链接**；无请求体、**不接受任何范围参数**，作用域由服务端按登录主体决定）；访客免登录通道 `POST /api/v1/shares/{token}/verify`（换**一次性票**）、`POST /api/v1/shares/redeem`（核销取件，回元信息 + **取件票** `contentTicket`；**成功即向链接创建者回推「取件回执」**——`NotifyType 9 = SHARE_ACCESSED`，计入站内信未读、**不进待办**，这是免登录访客场景下创建者唯一能感知「链接真的被用过」的通道）、`GET /api/v1/shares/{token}/content?ticket=`（凭**取件票**流式取字节，支持 `Range` 断点续传、`speedLimit` 限速；凭证走查询串，浏览器原生 `<a href>` 下载无法携带 `Authorization` 头）；**回收站与销毁**：`DELETE /api/v1/files/{id}`（移入回收站，需 `file:edit`）、`POST /api/v1/files/{id}/restore`（还原）、`POST /api/v1/files/batch/recycle`（批量移入）、`GET /api/v1/files/recycle`（回收站分页）、`POST /api/v1/files/recycle/empty`（清空回收站）、`DELETE /api/v1/files/{id}/destroy`（**彻底销毁**：绕过回收站、物理删除并递减引用计数；需 `file:destroy`，该点已收敛为**仅 SUPER_ADMIN**，且 `level>=3` 高敏感文件须关联一张「已通过」的高敏感审批单，否则 4017）；**标签（US-10）**：`GET|POST /api/v1/tags`、`PUT|DELETE /api/v1/tags/{tagId}`、`GET|PUT /api/v1/files/{nodeId}/tags`（全量覆盖，空数组即清空；读 `file:preview` / 写 `file:edit`，不另立 `tag:*` 权限点）；列表多标签筛选复用 `GET /api/v1/files?tagId=` 或 `tagIds=`（多值与 `tagId` 为 **AND**）；**历史版本（US-13，P1）**：`GET|POST /api/v1/files/{nodeId}/versions`（近 N 版列表 / 上传新版本）、`POST /api/v1/files/{nodeId}/versions/{versionNo}/rollback`（回滚生成新版本，统一 `file:version`）；**批量打包下载（US-12，P1）**：`POST|GET /api/v1/packs`（创建 / 我的任务分页）、`GET /api/v1/packs/{taskId}`（任务详情，前端轮询终态）、`GET /api/v1/packs/{taskId}/content`（异步流式 zip 产物下发，支持 `Range` 续传，过期返回 4021，统一 `file:download`） |
| `at-permission` | `/api/v1/audit` | **审计只读面**（US-06，独立于系统管理面）：日志检索 `GET /api/v1/audit/logs`（分页；按操作人 / 对象 / 域动作 / 结果 / 时间过滤，固定 `log_time` 倒序，对齐 `sys_operation_log` 四个索引）、导出 `GET /api/v1/audit/logs/export`（同过滤条件导出 CSV，UTF-8 BOM + RFC 4180 转义，**单次上限 10000 行**）；两端点共用 `audit:log:read`（仅 SUPER_ADMIN / AUDITOR）。审计记录 append-only，**不提供任何写 / 清除端点**（无 `audit:log:clear`） |
| `at-transfer` | `/api/v1/transfers` | 传输任务、分片、合并；**分片上传主线（US-01 / US-02，P0，已落地）**：`POST /api/v1/transfers/precheck`（秒传预检——命中即建引用并回 `data.fileId/nodeId`；未命中回 **`code=4001` + HTTP 200**，`data` 带上传票据 `uploadId / chunkSize / chunkCount`）、`GET /api/v1/transfers/{uploadId}/parts`（已确认分片索引 + 任务固化分片参数，**断点续传据此只补缺片**）、`PUT /api/v1/transfers/{uploadId}/parts/{index}`（multipart 单分片：字节流字段 **`chunk`**、分片指纹字段 **`hash`**，**索引以路径为准**；成功回 `data.received` = 已收分片**索引数组**（非计数，对齐前端 `number[]`））、`POST /api/v1/transfers/{uploadId}/merge`（整件 SHA-256 一致才落库；缺片回 **`code=4002` + HTTP 200**，`data` 带 `received / missing`；**合并成功后在事务提交后发布 `TransferCompletedEvent`** → `NotifyType 8` 传输完成提醒，**发布失败只留痕**、不回滚已落库结果）、`DELETE /api/v1/transfers/{uploadId}`（取消并清理暂存目录）、`PATCH /api/v1/transfers/{uploadId}`（**暂停 / 续传意图登记**，请求体 `{"action":"pause"|"resume"}`，需 `file:upload`；暂停 = CAS `0 排队 / 1 传输中 → 2 暂停`、续传 = `2 暂停 → 0 排队 / 1 传输中`（目标态按已收分片判定）；**重复动作幂等成功**，终态（`3 完成 / 4 失败 / 5 取消`）按「不存在」回 `4101`，合并中（`6`）回 `4102`；`action` 非法回 `2003` 参数格式错误）；**工作台统计**：`GET /api/v1/transfers/statistics`（按登录人聚合「我的上传 / 下载」——条数按结果分成功 / 失败、字节取实际过网量；**登录即可用、不挂权限点**，只回自己数据；无流水时 `successRate=null` 以区分「还没数据」与「全失败 0%」） |
| `at-collaboration` | `/api/v1/notifications`、`/api/v1/todos`、`/api/v1/chat`、`/api/v1/spaces`（规划） | 站内通知（未读快照 / 收件箱分页 / 离线补拉 / 已读；类型见 PRD §4 与 at-common `NotifyType`——本轮新增 `8` 传输完成 / `9` 取件回执 `SHARE_ACCESSED`，并沿用 `4` 外发链接到期前提醒；**`9` 计入未读、不进待办**，`isInbox()` 与未读 SQL 同口径）、审批待办角标、会话消息（IM）：`GET /api/v1/chat/conversations`（**会话列表**——按 `chat_scope + chat_target_id` 分组取 `max(id)` 那行并计未读，固定 `lastMessageId` 倒序、服务端按 `notify.chat-conversation-limit` 收敛上限（默认 50）；**不挂权限点、登录即用**，查询维度写死为登录人本人，故不存在「越权读他人会话」的入参面；单聊附带对端展示名，群聊名由 `sys_group` 解析（**D-11 在会话列表侧的残留已收口**，随建群闭环一并补齐）；查不到群记录时回 `targetName=null` 但**不丢会话**（宁少一个名字，不少一个会话），由前端回落「群聊 #id」）、`GET /api/v1/chat/messages`（会话历史，**倒序**返回 + `beforeId` 游标向上翻页；每条消息带 `readers` = **读过我这条**的人 `{userId, displayName}`，仅「我发的」消息非空——**已读回执的权威来源**，在线增量由 `CHAT_READ` 帧补，见 §7 末节；同一条 VO 还带 `recallStatus`（**1 = 已撤回**，此时 `content` 已清空——判定撤回**只看该标记、不看正文是否为空**）、`recallTime`、`quoteClientMsgId` / `quoteSenderUserId` / `quoteContent`（引用快照三项，供气泡渲染引用块））、`POST /api/v1/chat/messages`（发送，`clientMsgId` 幂等，成功后经 WebSocket 下发 `CHAT` 帧；选填 `quoteClientMsgId` = **引用回复**——服务端校验目标在同一会话内且未撤回（否则回 **1036**），并把**被引用消息的发送人 + 正文快照**写进本次发送的每一行（`quoteSenderUserId` / `quoteContent`，正文按码点截断至 200；**抄快照而不是存外键**——被引用消息随后被撤回时正文已清空，回查会让引用块一起变空白））、`POST /api/v1/chat/messages/recall`（**撤回**——入参 `clientMsgId`（Query），按 `(sender_user_id, client_msg_id)` 定位该逻辑消息的**全部行**批量置 `recallStatus=1` 并清空 `content`，事务提交后向全部参与人推 `CHAT_RECALL` 帧；带 `@RateLimit`（60s / 30 次）；**仅发送人本人、仅 2 分钟窗口内**，超窗回 **1034**、目标不存在或非本人发送回 **1035**；窗口是产品口径故为终态错误，前端须就地提示并撤下撤回入口）、`POST /api/v1/chat/read`（整会话置读，回本次置读条数）、`GET /api/v1/chat/targets/resolve`（**按登录账号解析会话目标**——入参 `query` 按「**登录账号精确匹配优先、回落按用户 ID**」解析（**不接受昵称模糊检索**，故不构成用户目录枚举面），经 SPI `UserLookupPort#findActiveByUsername` 反查后回 `{ targetId, displayName }`，展示名回落登录账号；**登录即用、不挂权限点**，带 `@RateLimit`（60s / 30 次）；「查无此人」与「目标不可用」**统一回 `CHAT_TARGET_INVALID`(1013)**，不区分「不存在 / 已注销」，以免沦为账号存在性枚举器）、`GET /api/v1/chat/groups`（**我加入的群**——建群弹窗「进入已有群」的选择器入口；按登录人取 `sys_group_member` 命中的生效群并聚合成员数，回 `ChatGroupVO{id,name,ownerUserId,memberCount}`，`id` 即群聊会话的 `targetId`；**登录即用、不挂权限点**（查询维度写死为登录人本人，与 `/conversations` 同属「只看得到自己的」口径——加权限点会表现为「建完群却看不到群」，把可用性事故伪装成权限配置问题）；**未加入任何群时回空数组**，前端据此隐藏该入口，空列表不是错误）、`POST /api/v1/chat/groups`（**建群**——入参 `{name, memberIds}`，`memberIds` 按**受邀者**理解、**不含创建者自己**：服务端把登录人写为群主并自动入群（剔除自己后再去重），故「我建的群我居然不在里面」在数据层不可能发生；逐个校验受邀成员为**可用用户**（与单聊发送前同一把尺子，避免造出「名字挂在群里、却永远读不到消息」的僵尸成员）；**建群 + 群主入群 + 受邀者入群在同一事务**，失败整体回滚，不留「没有成员的群」（那会让任何人的消息都发不进去，前端表现为「建群成功但一发就 1012」，比建群失败更难排查）；成功回 `ChatGroupVO`，**返回的 `id` 就是群聊会话的 `targetId`**，前端据此直接进入会话、不必等会话列表刷新；需 **`chat:group:create`**（`sql/V14__chat_group_permission_points.sql`，授 SUPER_ADMIN / DEPT_ADMIN / USER，**不授 AUDITOR**——建群是写操作且决定后续消息可见范围，与审计员「权限锁定只读」冲突）；错误：群名为空回 **2002**、过长（>64，`sys_group.name` 列宽）回 **2001**、去重后无受邀者（含「只填了自己」）回 **1031**、受邀人数 +1（群主）超 `SysGroup.MAX_MEMBERS`(500) 回 **1032**、受邀成员不存在 / 已停用回 **1033**；**群管理**（`sql/V16__chat_group_manage_permission_points.sql`）：`GET /api/v1/chat/groups/{groupId}`（**群详情**——回 `ChatGroupDetailVO{id,name,ownerUserId,memberCount,memberLimit,ability,members}`，其中 `ability` 是**服务端按「我在这个群是什么身份」算好的 5 个布尔**（`canRename / canInvite / canRemoveMember / canDissolve / canQuit`），前端按钮显隐据此判定而不自行推断「我是不是群主」；**登录即用、不挂权限点**——能看的前提是「我是该群成员」，非成员回 **1012**（越权面由成员资格堵住，加权限点会表现为「建了群却看不到群资料」）、`PATCH /api/v1/chat/groups/{groupId}`（**改群名**，入参 `{name}`，同名不多写库），需 **`chat:group:update`** 且群内身份为**群主或管理员**（身份不足回 **1038**）；群名为空回 **2002**、过长（>64，`sys_group.name` 列宽）回 **2001**）、`POST /api/v1/chat/groups/{groupId}/members`（**邀请成员**，入参 `{memberIds}`），需 **`chat:group:invite`** 且群主或管理员；**已在群者幂等跳过**——全员已在群时仍回 200 + 当前详情（报「重复邀请」会让批量邀请里的其他人白等），曾被移除者按 `(group_id, user_id)` **复活该行而不是插入新行**（唯一键 `uk_group_user` 不含 `deleted`，直接 insert 会撞键）；成员总数超 `SysGroup.MAX_MEMBERS`(500) 回 **1032**、受邀者不存在或已停用回 **1033**、群内身份不足回 **1038**）、`DELETE /api/v1/chat/groups/{groupId}/members/{userId}`（**移除成员**，需 **`chat:group:remove`** 且**仅群主**（管理员不足回 **1041**）；目标是群主本身（含群主移除自己）回 **1039**——那会造出没有所有者的群，此后无人能改名 / 邀请 / 解散；目标不是该群成员回 **1040**）、`POST /api/v1/chat/groups/{groupId}/quit`（**退出群聊**——**不挂权限点**：作用对象恒为登录人本人，身份维度说了算；群主退群回 **1039**（想离开只能先解散）、非成员回 **1012**；退出后读不到该群历史是**既定口径**——发送与历史拉取都只认 `sys_group_member`，不为「看旧消息」开旁路）、`DELETE /api/v1/chat/groups/{groupId}`（**解散群聊**，需 **`chat:group:dissolve`** 且仅群主（不足回 **1041**）；**先清全体成员关系、再停群行**——反过来的中间态是「群已停用、成员行仍在」，而发送侧只认成员行，并发下能往一个已解散的群写进消息；路径与改群名同为 `/groups/{groupId}`，靠 HTTP 方法区分：`DELETE` 是资源被移除、`PATCH` 是被修改）、``POST /api/v1/chat/presence/watch`（**订阅对端在线状态并同时取回当前值**（单聊）——入参 `scope` / `targetId`，回 `ChatPresenceVO{userId,status,lastActiveAt}`；三态口径：`ONLINE` 绿点 / `OFFLINE` 灰点 / `UNSTABLE` 红点 =「网络状态不佳」（连接还在但心跳迟到，判据为 **1.5 × 心跳间隔**，即 30s 心跳下 45s）；**登录即用、不挂权限点**，带 `@RateLimit`（60s / 240 次）；服务端订阅窗口 **2min**，前端打开会话即订阅、每 30s 续订续期；群聊回 **2001**、订阅自己回 **1013**；Redis 读取失败降级为 `OFFLINE` 但不判失败（状态点属辅助信息，宁缺不弹错））、`POST /api/v1/chat/typing`（**转发「我在输入」瞬时信号**（单聊）——入参 `scope` / `targetId` / `typing`，请求方即输入者，服务端换算成**接收人视角**后仅向对端推 `TYPING` 帧，**不落库、不计未读、不补推**；带 `@RateLimit`（60s / 120 次），前端按键节流约 3s 一次并自动续订；群聊回 **2001**、目标填自己回 **1013**、目标不可用回 **1013**）；**WebSocket 长连接** `GET /api/ws/notify`（握手 `?token=<accessToken>`，帧协议见 §7 末节）；外发链接原规划属本模块，CE 已改落 `at-file`（[AT-DIFF-06](../development/AT-DIFF-todos.md#at-diff-06-外发分享模块归属)） |

### 🎯 方法语义

| 方法 | 语义 | 说明 |
| --- | --- | --- |
| `GET` | 🔍 查询 | `GET /api/v1/files` 列表；`GET /api/v1/files/{id}` 详情；不改状态 |
| `POST` | ➕ 创建 / 动作 | `POST /api/v1/files` 注册文件；`POST /api/v1/transfers/{id}/merge` 合并（动作） |
| `PUT` | ♻️ 全量更新（幂等） | 少用 |
| `PATCH` | 🔧 部分更新 | `PATCH /api/v1/transfers/{id}` 暂停 / 续传状态迁移 |
| `DELETE` | 🗑️ 删除（进回收站） | 逻辑删除由后端处理 |

## 2️⃣ 统一响应体 `Result<T>`

所有接口（成功与失败）返回统一结构：

```jsonc
{
  "code": 0,            // 业务状态码：0 成功；非 0 见 ErrorCode
  "message": "成功",     // 人类可读提示（成功或失败原因）
  "data": { ... },       // 业务载荷；无数据为 null
  "traceId": "f3a9...",  // 链路追踪 ID，一次请求内唯一，排障凭证
}
```

```jsonc
// ✅ 成功
{ "code": 0, "message": "成功", "data": { "id": "185317..." }, "traceId": "a1..." }

// 🔀 失败：HTTP 200 + code 分支（流程分支码，见错误码表 4001/4002）
{ "code": 4001, "message": "秒传未命中，请按分片上传", "data": { "uploadId": "u_88" }, "traceId": "a2..." }

// ❌ 失败：HTTP 状态随错误码映射（此处 401）
{ "code": 1002, "message": "登录态已过期，请重新登录", "data": null, "traceId": "a3..." }
```

**契约要点**：HTTP 状态表达“传输/资源层语义”，`body.code` 才是业务判据；二者均须由服务端保证。

## 3️⃣ 分页结构

列表接口统一使用 `current` / `pageSize` 查询参数，并返回 `PageResult<T>`：

> 💻 代码实现：`server/at-common/.../result/PageResult.java`。
> 📏 `pageSize` 上限 100 由 `MybatisPlusConfig` 的分页插件强制收敛（超限自动降为 100，不报错）；
> 页码溢出返回空列表而非回退首页。

| 请求参数 | 说明 |
| --- | --- |
| `current` | 页码，从 1 开始，默认 1 |
| `pageSize` | 每页条数，默认 20，最大 100 |
| `sort` | 排序，`-createTime` 表示 createTime 倒序；支持多字段逗号分隔 |

```jsonc
{
  "code": 0, "message": "成功",
  "data": {
    "records": [ ... ],      // 当前页数据
    "total": 1024,           // 总条数
    "current": 2,            // 当前页码（回显请求值）
    "pageSize": 20,          // 每页条数
    "pages": 52              // 总页数
  },
  "traceId": "a1..."
}
```

## 4️⃣ 时间格式

- ⏱️ 时间字段统一 **ISO-8601** 字符串输出。
- 📅 本地时间字段（如 `createTime` / `updateTime`，对应 `LocalDateTime`）输出为 `2026-09-06T14:30:00`（无时区）。
- 🌍 涉及跨时区 / 事件时间的字段使用带偏移格式（`OffsetDateTime` / `Instant`）：`2026-09-06T14:30:00+08:00`，比较与存储建议统一 `UTC`。
- 📥 入参同理接受 ISO-8601，后端负责解析校验。
  - ⚠️ **`yyyy-MM-dd HH:mm:ss`（空格分隔）不是 ISO-8601**：后端 `LocalDateTime` 字段（未配 `@JsonFormat`）只认
    `2026-09-06T14:30:00` 这种 `T` 分隔格式；交空格格式会在反序列化阶段抛 `HttpMessageNotReadableException`，
    被 `GlobalExceptionHandler` 统一回成 **`2004` 请求体格式错误，请检查 JSON 与字段类型**。
    症状是「表单校验全过、一提交就报请求体格式错误」，排查时优先看请求体里的时间字段。
    前端一律走 `web/src/utils/datetime.ts` 的 `formatLocalDateTime(date)` / `toBackendDateTime(value)` 归一，
    禁止在组件里把 `dayjs(...).format('YYYY-MM-DD HH:mm:ss')` 直接当请求体（回归见 `ShareModal.test.tsx`）。

> 🆔 **ID 一律以字符串下发**（与上表同属「字段序列化」口径，故并入本节）：
> `id` / `nodeId` / `fileId` / `folderId` / `uploadUserId` 等均为 **19 位雪花 ID**，超出 JS
> `Number.MAX_SAFE_INTEGER`（2^53-1）。若按 JSON number 下发，浏览器 `JSON.parse` 时末位会被**静默取整**，
> 前端再拿它去拼 `/v1/files/{nodeId}/preview`、`/v1/files/{nodeId}/ticket` 这类路径就查不到资源
> ——典型症状是「列表里能看到刚上传的文件，点预览 / 下载却失败」。
> - 服务端：VO 上 ID 字段统一标 `@JsonSerialize(using = ToStringSerializer.class)`；契约回归见
>   `server/at-file/src/test/java/com/anttransfer/file/model/vo/FileDomainIdJsonContractTest.java`
>   （反射扫描全部对外 VO，新增 ID 字段漏标即失败）。
> - 前端：一律用 `string` 承接（`web/src/services/file/types.ts` 有专门注释），**禁止 `Number()` / `parseInt()` 归一**；
>   判「未传」用 `toOptionalId`，不要用 `toOptionalNumber`。
> - ➗ **计数字段除外**：`sizeBytes` / `total` / `level` / `status` 等仍是数字，不要连带字符串化。
> - ⬅️ 入参方向无需前端转换：ID 传字符串，Jackson 可正常反序列化为 `Long`。
> - 📤 **两个「文件 ID」不是一回事，别混用**：`sys_file`（物理层）与 `sys_file_node`（引用层）各有一套雪花 ID。
>   外发分享是**物理文件**维度——创建分享的 `fileId` 与 `sys_share_link.file_id` 关联的都是 `sys_file.id`，
>   即列表返回的 **`FileNode.fileId`**，**不是 `FileNode.id`**（那是条目 ID）。
>   两者分属不同值空间，传错会查不到物理文件，被回成 **`4005` 文件不存在或已被删除**（该码与「无权访问」刻意不可区分，
>   所以从报错上看不出是 ID 用错）。前端回归见 `web/src/pages/file/components/ShareModal.test.tsx` 与
>   `web/src/pages/shares/components/CreateShareModal.test.ts`。

## 5️⃣ 鉴权（双令牌）

- 🚪 除**免登录白名单端点**外，请求头携带：

```
Authorization: Bearer <accessToken>
```

| 端点 | 说明 | 免登录 |
| --- | --- | --- |
| `POST /api/v1/auth/token` | 登录：body `{username, password}` → 双令牌 | ✅ |
| `POST /api/v1/auth/token/refresh` | 刷新：body `{refreshToken}` → 新令牌对（**旧 refresh 单次有效**） | ✅ |
| `POST /api/v1/auth/logout` | 登出：全端吊销（DB `token_epoch+1`，已签发 access/refresh 即刻失效） | ❌ |
| `GET /api/v1/auth/me` | 当前用户摘要（含角色编码，角色变更即时生效） | ❌ |
| `PUT /api/v1/auth/password` | 本人自助改密：body `{oldPassword, newPassword}`；成功后**全端**令牌失效（含发起本次请求的当前会话） | ❌ |
| `POST /api/v1/users/me/avatar` | **本人自助换头像**：multipart 字段 `file`（PNG / JPG / GIF / WebP，≤ 2 MiB）；**不挂权限点**，不接受任何 `userId` 入参；成功后回本人摘要（含新头像地址）并广播 `PROFILE` 帧 | ❌ |
| `GET /api/v1/users/{userId}/avatar?v=<存储 key>` | 头像**直出**：只回图片字节（`ETag` = 存储 key、`Cache-Control: public, max-age=600`、`nosniff`）；`?v=` 只是缓存版本号，服务端**不校验**（否则换头像后在途页面全变碎图） | ✅ |

- 🔁 `accessToken` 过期（HTTP 401 + `code=1002`）时，前端**静默**调用 refresh 端点换取新令牌对并重放原请求一次；刷新失败（401 + `code=1006` / refresh 过期 / **旧 refresh 已被使用过**）跳转登录页。
- 🚨 同一 refresh token 被使用两次（重复提交 / 泄露重放）时，服务端按疑似盗用处理：**吊销该用户全部会话**并返回 `code=1006`（PRD US-07）。
- 🚫 无权限访问（HTTP 403 + `code=1003`）提示且不引导登录。
- 🔑 **自助改密（`PUT /api/v1/auth/password`）结果分两类**：
  - `code=0`（成功）：服务端已 `token_epoch + 1`（**含发起本次请求的 access token**），前端**必须清本地令牌并回登录页**，
    否则后续请求只会拿到 401 + `code=1001`；
  - `code=1029`（原口令不正确）/ `code=1030`（新口令不合规）：属 HTTP 400 的**请求被拒**，会话仍然有效 ——
    就地提示、**不得清令牌、不得跳登录**，弹窗保持打开让用户修正。
- 🖼️ **头像直出是唯一「按设计公开」的匿名读路径**（`GET /api/v1/users/{userId}/avatar`）。放行依据三条：
  内容低敏感（**只有图片字节**，不得追加昵称 / 部门 / 工号等信息，否则必须改为「换票 + 凭票取字节」）、
  用户 ID 不可枚举、端点限流（**60s / 300 次**，按源 IP + 路径，防「拿已知 ID 批量遍历」）。
  「有账号但没头像」与「没有这个账号」**回同一个 `4005`**，不把 ID 有效性变成可探测信息。
- ⚠️ **白名单条目的 ID 段必须是数字正则** `{userId:[0-9]+}` 而**不是** `*`：Spring Security 的路径放行
  **不看 HTTP 方法**，用 `*` 时写路径 `POST /api/v1/users/me/avatar` 会被同一条匿名放行顺带吃掉，
  「谁能改头像」就被静默放宽成匿名可调。回归护栏见 `SecurityConfigTest`
  的 `builtInWhitelist_shouldNotPermitSelfAvatarUpload`（反向断言写路径不匹配 **+** 正向断言数字读路径仍匹配）。

> ℹ️ 停用账号的即时吊销（GAP-02）：管理面 `PATCH /api/v1/system/users/{id}/status` 停用时，
> 在**同一事务**内递增 `token_epoch` 并在提交后清 Redis 纪元镜像键，该用户全部在途会话**当场失效**；
> 详见 [error-codes.md §五 服务端副作用注明](error-codes.md)。

## 6️⃣ 错误处理策略

- 🎯 业务可控失败：抛 `BusinessException(ErrorCode)`，网关统一转换为 `Result`，HTTP 状态 = `ErrorCode.httpStatus`。
- ✅ 参数校验：`@Valid` / 参数缺失 / 类型不匹配 / JSON 不可读，统一归入 2xxx 且 HTTP 400。
- 🆘 未预期异常：兜底为 5001（HTTP 500），完整堆栈仅服务端可见（含 traceId 日志）。
- 🎫 完整错误码表（HTTP 映射 + 中文提示 + 前端行为）：见 **[error-codes.md](./error-codes.md)**。

## 7️⃣ 前端对接约定

- 📡 业务判据恒为 `body.code`；响应体保持 `Result` 完整结构（不做 `data` 拆包），以保证 B 类分支码能读到 `data` 走业务分支。
- 🚫 **B 类流程分支码（1008 / 1009 / 4001 / 4002）禁止弹错误提示**：HTTP 200 + `code≠0` 属正常分支（已有生效授权 / 已有在审申请 / 秒传未命中 / 分片缺失），任何位置弹窗都会打断主流程。
- 🔁 网络层行为：C 类的 `1002` 在响应拦截器内**静默 refresh（单飞）+ 重放原请求一次**，调用方无感知；刷新失败或 `1001 / 1006` → 清除令牌跳 `/user/login`；`1007` 仅提示「账号或密码错误」、不清会话不跳转；D 类（403）就地提示不引导登录；G 类（429）提示退避；H 类（5xx）用通知展示 `traceId` 供上报。
- 🗂️ 更细的分流以 **[错误码表 §二 处理策略分类](./error-codes.md#二处理策略分类按具体情况具体分析)** 为准（A 成功 / B 流程分支 / C 凭证失效 / D 拒绝不跳登录 / E 请求需修正 / F 状态失效冲突 / G 限流退避 / H 系统兜底），拦截器应按策略而非 HTTP 状态硬编码行为。
- 💻 已按本契约改造完成：`web/src/requestErrorConfig.ts`（拦截器与策略分流）、
  `web/src/utils/result.ts`（`Result` / `PageResult` 类型 + A~H 策略表，镜像后端 `ErrorCode`）、
  `web/src/utils/token.ts`（双令牌存储）；20 例单测覆盖策略分流与「B 类不弹窗」红线。
  ⚠️ `web/src/services/ant-design-pro/**` 仍为 Ant Design Pro 模板示例（`/api/currentUser` 等），
  接入首个真实业务接口时应删除并以 `/api/v1/**` 服务层替换。

### 🔌 WebSocket 长连接（IM / 通知下行）

> ⚖️ **上行走 HTTP、下行走 WebSocket**是刻意的不对称取舍：上行需要幂等键、业务错误码与重试语义（帧不具备），
> 下行只需要「尽快到达」，且丢失可由重连补拉兜底。因此 WebSocket 不承载任何写操作。

- 🌐 地址：`ws://<host>:8080/api/ws/notify?token=<accessToken>`（非浏览器客户端可改用 `Authorization: Bearer <token>` 头）。
  该路径位于**免登录白名单**（浏览器 WebSocket 构造器无法设置请求头），但**放行不等于免鉴权**：
  握手阶段校验 JWT，失败直接以 HTTP 401 拒绝升级，连接不会建立。
- 💓 心跳：服务端每 30s 下行 `{"type":"PING"}`；客户端每 30s 上行 `{"type":"PING"}`，服务端回 `PONG` 并刷新活跃时间。
  **90s 内无任何上行帧**即判定掉线并清理会话（关闭码 `4002`）。建议客户端回 PONG——否则客户端侧「静默假死」只能等服务端超时。
- 📦 帧信封（上下行统一）：`{"type":"...","data":{...},"ts":1789000000000}`。
  下行 `type`：`CONNECTED`（连接就绪，含用户 ID 与未读快照）/ `NOTIFY`（系统通知单条）/ `CHAT`（会话消息单条）/
  `CHAT_READ`（已读回执，见下）/ `CHAT_RECALL`（消息撤回，见下）/ `PROFILE`（用户头像变更，见下）/
  `PRESENCE`（对端在线状态变更，见下）/
  `TYPING`（对端输入状态，见下）/ `UNREAD`（三口径未读快照）/ `PONG`。`ERROR` 仅承载协议层错误，**不承载业务错误码**。
- ✅ `NOTIFY` 帧载荷 = 单条站内通知（未读快照 / 收件箱分页 / 离线补拉同构）。**本轮新增/沿用三类（2026-09-29）**：
  `8` 传输完成（at-transfer 合并成功后发布 `TransferCompletedEvent`）、`9` 取件回执 `SHARE_ACCESSED`
  （访客核销后回推**链接创建者**）、`4` 外发链接**到期前**提醒（定时任务，幂等为「Redis 占位键 + `existsForBiz` 兜底」，
  **发送失败释放占位键**以便下轮重试）。**三类均计入站内信未读、都不进待办**——待办角标只服务审批类流程分支，
  把通知塞进待办会让「待办清零」变成不可能达成的目标。
- ✅ `CHAT` 帧载荷 = `NotifyMessageVO`（发送返回 / 拉历史 / 下行推送共用同一结构）。**`@` 提及按「行」下发**：
  `mentioned: true` **只在被点名者那一条帧上出现**（群消息是写扩散的，同一条消息每人一行，
  `mentioned` 是行属性而非消息级属性），发送人自己收到的那帧恒为 `false`。
  客户端据此高亮气泡即可，**禁止用正文里的 `@昵称` 反推**（重名、昵称含空格、发送后改字都会误判）。
  相关上行与列表字段：
  - `POST /api/v1/chat/messages` 新增可空 `mentionUserIds`（字符串数组，≤ 500 项，缺省 / `null` = 本条不点名任何人）。
    服务端与**群成员求交集**，**非成员 / 发送人自己 / 重复项一律静默剔除**：不报错、不驳回整条消息
    （客户端手里的成员名单可能是旧快照，而点名失败不该让整句话发不出去）。单聊忽略该字段。
  - 会话列表（`GET /api/v1/chat/conversations`）新增 `mentionUnreadCount`：该会话「未读**且**被点名」的条数。
    **它是 `unreadCount` 的子集，两个数不能相加**——角标数字仍取 `unreadCount`，仅在 `mentionUnreadCount > 0` 时
    换强调色 / 在摘要前加「[有人@我]」。标记已读（`POST /api/v1/chat/sessions/read`）同时把两者清零。
  - 保留期：消息服务端仅保留最近 `anttransfer.collaboration.notify.message-retention-days`（默认 30，**下限 30 硬钳制**）
    天的会话消息，超期**物理删除**（分批清理，非软删除）。客户端不要假设历史可无限回翻；
    超过保留期的 `clientMsgId` 幂等键也一并失效（重复提交会被当作新消息）。
- ✅ `CHAT_READ` 帧载荷：`{"chatScope":1,"chatTargetId":"<id>","reader":{"userId":"<id>","displayName":"张三"},"clientMsgIds":["<幂等键>"]}`。
  三个口径要点（实现详见 `NotifyMessageService#markSessionRead` / `ChatReadReceiptVO`）：
  - **方向**：由**读者**置读时产生，**只推给发送人**——「谁读了我发的」。别人发的消息不会给我推这个帧。
  - **`chatTargetId` 是发送人视角的会话目标**（单聊 = 读者本人，群聊 = 群 ID），服务端已换算；
    客户端回执必须比对 `(chatScope, chatTargetId)` 是否匹配当前会话，否则会把 A 会话的读者画到 B 会话上。
  - **按 `clientMsgIds`（幂等键）匹配消息**而非消息 ID：发送人本地可能还挂着只有幂等键的乐观行。
  - 一帧携带一位读者 + 本次被置读的若干条消息；同一条消息被多人读会到达多帧，客户端**按 `userId` 去重**（幂等）。
- ✅ `PRESENCE` 帧载荷：`{"userId":"<id>","status":"ONLINE"|"OFFLINE"|"UNSTABLE","lastActiveAt":<epoch millis|null>}`。
  三个口径要点（订阅入口见 `POST /api/v1/chat/presence/watch`，判定见 `WsPresenceService`）：
  - **三态语义**：`ONLINE` 绿点（最近活跃在健康窗口内）/ `OFFLINE` 灰点（无活跃记录，含 Redis 读失败的服务端降级）/
    `UNSTABLE` 红点 =「网络状态不佳」——**不是断线**，而是连接还在、心跳却已超出 `1.5 ×` 心跳间隔（30s 心跳 → 45s 判据）；
    「断线」会直接表现为 `OFFLINE`（连接关闭即清活跃记录），两者含义不同，不要合并。
  - **`userId` 是状态发生变化的那个用户**（不是接收人视角的目标），客户端必须与当前会话的对端比对后再改点，
    否则会把 A 的状态画到 B 的会话上；且**只有订阅过的对端才会收到**（打开会话时经 `presence/watch` 注册，2min 窗口）。
  - **`lastActiveAt` 离线时为 `null`**：不提供「最后在线时间」，以免把在线状态退化成活跃度追踪面。
- ✅ `TYPING` 帧载荷：`{"chatScope":1,"chatTargetId":"<id>","typing":true|false}`。
  三个口径要点（上报入口见 `POST /api/v1/chat/typing`）：
  - **`chatTargetId` 是接收人视角的会话目标**（单聊 = 输入者本人），与 `CHAT_READ` 同一换算口径；
    客户端按 `(chatScope, chatTargetId)` 比对当前会话，**不要**拿它反推「我是谁」。
  - **纯瞬时信号**：不落库、不计未读、离线不补推。`typing=true` 由发送端每约 3s 续订一次；
    客户端**必须实现空闲兜底**（建议 6s），否则丢帧 / 对端崩溃会让「对方正在输入…」永久挂住。
  - `typing=false`（停止输入 / 发送后）照常下发，客户端应立即收起提示，不必等空闲兜底。
- ✅ `CHAT_RECALL` 帧载荷：`{"clientMsgId":"<幂等键>","senderUserId":"<id>","chatScope":1,"chatTargetId":"<id>","recallTime":"2026-09-26T10:00:00"}`。
  三个口径要点（上行入口见 `POST /api/v1/chat/messages/recall`，实现见 `ChatService#recall` / `ChatRecallVO`）：
  - **撤回是「整条逻辑消息」的动作，不是「某一行」的动作**：写扩散下一条消息落 N 行（单聊 2 行、群聊 N 行），
    各行 id 不同、单聊的 `chat_target_id` 还互指对端，但共享同一个 `(sender_user_id, client_msg_id)`。
    服务端按这两列批量置 `recall_status = 1` **并清空 `content`**，再**按行逐条**推给该消息的**全部参与人**（含撤回者自己的其他端）——
    只撤自己那一行会表现为「我撤了，他还能看到」。客户端匹配只能用 `clientMsgId`，不能用消息 id。
  - **`chatTargetId` 是本接收人视角的会话目标**（单聊 = 撤回者，群聊 = 群 ID），与 `CHAT_READ` / `TYPING` 同一换算口径；
    客户端必须比对 `(chatScope, chatTargetId)` 是否匹配当前打开的会话，否则会把 A 会话的消息标成「已撤回」。
    `senderUserId` 是撤回者（= 原消息发送人），用于渲染「谁撤回了一条消息」。
  - **不重推 `CHAT` 帧**：`CHAT` 的语义是「来了一条新消息」，重推会被客户端当新消息插流，
    未读数与会话摘要各多算一次。撤回不产生新消息，帧语义必须与之一致。
  - **本帧是加速通道**：真值在库里（`recall_status = 1`），丢了只表现为「重新拉历史后才看到已撤回」，
    **不需要补偿重发**。客户端判定「已撤回」只看 `recallStatus`，**不能用正文是否为空**——
    撤回时正文确实被清空，但空正文本身是合法状态（文件 / 审批类消息的展示文案可为空）。
- ✅ `PROFILE` 帧载荷：`{"userId":"<id>","avatarUrl":"<头像直出地址>"|null}`。
  四个口径要点（写侧**双入口**：本人 `POST /api/v1/users/me/avatar`、管理员 `POST /api/v1/system/users/{id}/avatar`；
  实现见 `WsBroadcaster#broadcast` / `ChatProfileVO`）：
  - **全员广播，不按用户扇出**（`userId` 过滤在服务端为 `null`，投给所有在线连接）。产品口径是
    「头像一变，所有能看到它的地方立刻换图」——除本人其他标签页 / 设备外，会话对端、群成员列表、
    用户管理列表展示的这张头像也要立刻换。收件人集合无法廉价算出：要精确匹配就得维护一张
    「谁在关注谁」的订阅表并让它与群成员关系变更保持对账；而本帧载荷只有 `userId + 免登录可读的直出地址`，
    全员广播的暴露面与「让对方直接访问该 URL」完全相同。它与 `PRESENCE` 的订阅集合是两回事，**不要复用后者**。
  - **客户端必须按 `userId` 判断，且分两步**：`userId` 是「头像被换掉的那个人」，不是接收人视角的目标。
    **任何人**的 `PROFILE` 帧都要写入本地头像覆盖表（否则群里别人的头像不会跟着换），
    但**只有 `userId` == 当前登录人时才更新登录态**（否则会把自己的顶栏头像改成别人的）。
  - **`avatarUrl` 为 `null` 表示「该用户当前没有头像」**，不是「本次没带上地址」：客户端必须用它
    **压掉**页面数据里的回落值，不能因为「本地还没有覆盖记录」就继续显示旧头像。
  - **加速通道**：真值在 `sys_user.avatar_url`，丢了只表现为「本端要等下次拉会话列表 / 用户列表才看到新头像」，
    **不补推、不需要补偿逻辑**。跨版本兼容：滚动发布期间旧实例收到 `userId=null` 的帧会按原逻辑丢弃，
    退化为「下次拉取时刷新」，属可接受降级。
- 🔁 可靠性：消息**先落库再推送**，WebSocket 只是加速通道而非唯一通道——离线用户仍可在
  `GET /api/v1/notifications/offline` 补拉。故**推送丢失无需补偿重发**，客户端也不必实现 ACK。
  `CHAT_READ` 同理：**它只是加速通道**，阅读事实存在会话消息行上，进入会话时由
  `GET /api/v1/chat/messages` 的 `readers` 字段（每条消息「谁读了我发的这条」）权威回正——
  故发送人离线期间发生的阅读不会补推，也**不必补推**。
- 🔢 重连后：立即调 `GET /api/v1/notifications/offline` 补齐离线提醒并清红点；未读以 `UNREAD` 快照为准——
  服务端推的是**权威未读快照**而非已读回执，多端并发不会互相覆盖。
  ⚠️ 别把 `NotifyMessageVO.readStatus` 当已读回执用：写扩散下「我发的」那一行接收人就是我自己，
  该字段恒为已读（1）；「谁读了我发的」只看 `readers` 与 `CHAT_READ`。
- ⚠️ 边界：鉴权仅在握手做一次，令牌过期 / 登出**不会**断开已建立的长连接（详见 `WebSocketConfig` 类注释）。
  客户端应在登出或刷新令牌失败时**主动关闭**连接并停止重连。
- ♻️ 重连策略：指数退避（1s / 2s / 4s …… 上限 30s），避免服务端重启后全量客户端同时冲击。

## 8️⃣ 在线文档

接口定义基于 SpringDoc OpenAPI 3 自动生成，启动后端后访问：

- 📖 Swagger UI：<http://localhost:8080/api/swagger-ui/index.html>
- 📄 OpenAPI JSON：<http://localhost:8080/api/v3/api-docs>

> 🔒 生产 profile 默认关闭文档暴露（`springdoc.api-docs.enabled=false`），避免线上泄露接口面。

## 9️⃣ 兼容性

- ➕ 新增字段、新增错误码（分段内未占用号）为**非破坏性**，直接发布。
- 🚨 修改已发布 `code` / 资源路径 / 删除字段为**破坏性**，须升 `/api/v2` 或经评审统一灰度。
