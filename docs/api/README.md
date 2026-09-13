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
| `at-auth` | `/api/v1/auth` | `token`、`token/refresh`（动作端点） |
| `at-auth` | `/api/v1/users` | **本人**资料 / 当前账号（个人中心自助改密 / 改昵称）；`sys_user` 的表主在本模块 |
| `at-permission` | `/api/v1/system/users`、`/api/v1/roles`、`/api/v1/permission-points`、`/api/v1/permission` | **系统管理面**（管理员「管别人」）：用户管理 `GET /api/v1/system/users`（分页，按操作者数据范围收敛）、`GET /api/v1/system/users/{id}`、`GET /api/v1/system/users/dept-options`（部门下拉）、`GET /api/v1/system/users/role-options`（角色下拉）、`POST /api/v1/system/users`（建号，可带初始角色）、`PUT /api/v1/system/users/{id}`（编辑；**换部门即调岗**，触发权限重评估回收审批授权）、`PATCH /api/v1/system/users/{id}/status`（启停；停用=离职，回收审批授权并吊销在途会话）、`POST /api/v1/system/users/{id}/reset-password`（禁止对自己）、`PUT /api/v1/system/users/{id}/roles`（整集替换角色，禁止对自己）、`DELETE /api/v1/system/users/{id}`（逻辑删除，受保护账号与最后一个超管不可删）；角色管理 `GET /api/v1/roles`（分页）、`GET /api/v1/roles/options`（全量下拉）、`GET /api/v1/roles/{id}`、`POST /api/v1/roles`、`PUT /api/v1/roles/{id}`、`DELETE /api/v1/roles/{id}`（内置角色不可删）、`GET /api/v1/roles/{id}/permissions`、`PUT /api/v1/roles/{id}/permissions`（整集替换；`AUDITOR` 权限锁定只读）；权限点目录 `GET /api/v1/permission-points`（只读全树）；授权申请 `/api/v1/permission/...`；动态菜单 `GET /api/v1/permission/menus`（按登录用户权限点过滤 `type=1` 节点组装树，见 `architecture.md` §4 D-9） |
| `at-file` | `/api/v1/files`、`/api/v1/folders`、`/api/v1/shares` | 文件元数据 / 上传 / 下载；**目录树**：`GET /api/v1/folders/tree`（整树，不分页）、`POST /api/v1/folders`（新建）、`PATCH /api/v1/folders/{id}/rename`、`PATCH /api/v1/folders/{id}/move`、`DELETE /api/v1/folders/{id}`（目录内文件进回收站，不销毁物理文件）；**下载与预览**：`POST /api/v1/files/{id}/ticket`（换票，需 `file:download`）、`GET /api/v1/files/{id}/content`（**免登录**，票取；支持 `Range` 续传、`speedLimit` 任务级限速、`disposition=inline`）、`GET /api/v1/files/{id}/thumbnail`（**免登录**，票取）、`GET /api/v1/files/{id}/preview`（返回预览策略，需 `file:preview`）；**外发链接（CE 实际落地方，见 [AT-DIFF-06](../development/AT-DIFF-todos.md#at-diff-06-外发分享模块归属)）**：`POST /api/v1/shares`（创建）、`GET / DELETE /api/v1/shares/{token}`、`GET /api/v1/shares/mine`；访客免登录通道 `POST /api/v1/shares/{token}/verify`（换票）、`POST /api/v1/shares/redeem`（核销取件）；**回收站与销毁**：`DELETE /api/v1/files/{id}`（移入回收站，需 `file:edit`）、`POST /api/v1/files/{id}/restore`（还原）、`POST /api/v1/files/batch/recycle`（批量移入）、`GET /api/v1/files/recycle`（回收站分页）、`POST /api/v1/files/recycle/empty`（清空回收站）、`DELETE /api/v1/files/{id}/destroy`（**彻底销毁**：绕过回收站、物理删除并递减引用计数；需 `file:destroy`，该点已收敛为**仅 SUPER_ADMIN**，且 `level>=3` 高敏感文件须关联一张「已通过」的高敏感审批单，否则 4017）；**标签（US-10）**：`GET|POST /api/v1/tags`、`PUT|DELETE /api/v1/tags/{tagId}`、`GET|PUT /api/v1/files/{nodeId}/tags`（全量覆盖，空数组即清空；读 `file:preview` / 写 `file:edit`，不另立 `tag:*` 权限点）；列表多标签筛选复用 `GET /api/v1/files?tagId=` 或 `tagIds=`（多值与 `tagId` 为 **AND**）；**历史版本（US-13，P1）**：`GET|POST /api/v1/files/{nodeId}/versions`（近 N 版列表 / 上传新版本）、`POST /api/v1/files/{nodeId}/versions/{versionNo}/rollback`（回滚生成新版本，统一 `file:version`）；**批量打包下载（US-12，P1）**：`POST|GET /api/v1/packs`（创建 / 我的任务分页）、`GET /api/v1/packs/{taskId}`（任务详情，前端轮询终态）、`GET /api/v1/packs/{taskId}/content`（异步流式 zip 产物下发，支持 `Range` 续传，过期返回 4021，统一 `file:download`） |
| `at-permission` | `/api/v1/audit` | **审计只读面**（US-06，独立于系统管理面）：日志检索 `GET /api/v1/audit/logs`（分页；按操作人 / 对象 / 域动作 / 结果 / 时间过滤，固定 `log_time` 倒序，对齐 `sys_operation_log` 四个索引）、导出 `GET /api/v1/audit/logs/export`（同过滤条件导出 CSV，UTF-8 BOM + RFC 4180 转义，**单次上限 10000 行**）；两端点共用 `audit:log:read`（仅 SUPER_ADMIN / AUDITOR）。审计记录 append-only，**不提供任何写 / 清除端点**（无 `audit:log:clear`） |
| `at-transfer` | `/api/v1/transfers` | 传输任务、分片、合并 |
| `at-collaboration` | `/api/v1/notifications`、`/api/v1/todos`、`/api/v1/chat`、`/api/v1/spaces`（规划） | 站内通知（未读快照 / 收件箱分页 / 离线补拉 / 已读）、审批待办角标、会话消息（IM）；**WebSocket 长连接** `GET /api/ws/notify`（握手 `?token=<accessToken>`，帧协议见 §7 末节）；外发链接原规划属本模块，CE 已改落 `at-file`（[AT-DIFF-06](../development/AT-DIFF-todos.md#at-diff-06-外发分享模块归属)） |

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

- 🔁 `accessToken` 过期（HTTP 401 + `code=1002`）时，前端**静默**调用 refresh 端点换取新令牌对并重放原请求一次；刷新失败（401 + `code=1006` / refresh 过期 / **旧 refresh 已被使用过**）跳转登录页。
- 🚨 同一 refresh token 被使用两次（重复提交 / 泄露重放）时，服务端按疑似盗用处理：**吊销该用户全部会话**并返回 `code=1006`（PRD US-07）。
- 🚫 无权限访问（HTTP 403 + `code=1003`）提示且不引导登录。

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
  `UNREAD`（三口径未读快照）/ `PONG`。`ERROR` 仅承载协议层错误，**不承载业务错误码**。
- 🔁 可靠性：消息**先落库再推送**，WebSocket 只是加速通道而非唯一通道——离线用户仍可在
  `GET /api/v1/notifications/offline` 补拉。故**推送丢失无需补偿重发**，客户端也不必实现 ACK。
- 🔢 重连后：立即调 `GET /api/v1/notifications/offline` 补齐离线提醒并清红点；未读以 `UNREAD` 快照为准——
  服务端推的是**权威未读快照**而非已读回执，多端并发不会互相覆盖。
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
