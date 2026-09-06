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
| `at-auth` | `/api/v1/users` | 用户 / 账号 |
| `at-permission` | `/api/v1/roles`、`/api/v1/permission-points` | 角色 / 权限点 / 授权申请 |
| `at-file` | `/api/v1/files` | 文件元数据、上传 / 下载 |
| `at-transfer` | `/api/v1/transfers` | 传输任务、分片、合并 |
| `at-collaboration` | `/api/v1/spaces`、`/api/v1/shares` | 协作空间、外发链接 |

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

- 🔁 `accessToken` 过期（HTTP 401 + `code=1002`）时，前端**静默**调用 refresh 端点换取新令牌对并重放原请求一次；刷新失败（401 + `code=1003` / refresh 过期 / **旧 refresh 已被使用过**）跳转登录页。
- 🚨 同一 refresh token 被使用两次（重复提交 / 泄露重放）时，服务端按疑似盗用处理：**吊销该用户全部会话**并返回 `code=1003`（PRD US-07）。
- 🚫 无权限访问（HTTP 403 + `code=1004`）提示且不引导登录。

## 6️⃣ 错误处理策略

- 🎯 业务可控失败：抛 `BusinessException(ErrorCode)`，网关统一转换为 `Result`，HTTP 状态 = `ErrorCode.httpStatus`。
- ✅ 参数校验：`@Valid` / 参数缺失 / 类型不匹配 / JSON 不可读，统一归入 2xxx 且 HTTP 400。
- 🆘 未预期异常：兜底为 5001（HTTP 500），完整堆栈仅服务端可见（含 traceId 日志）。
- 🎫 完整错误码表（HTTP 映射 + 中文提示 + 前端行为）：见 **[error-codes.md](./error-codes.md)**。

## 7️⃣ 前端对接约定

- 📡 业务判据恒为 `body.code`；响应体保持 `Result` 完整结构（不做 `data` 拆包），以保证 B 类分支码能读到 `data` 走业务分支。
- 🚫 **B 类流程分支码（1008 / 1009 / 4001 / 4002）禁止弹错误提示**：HTTP 200 + `code≠0` 属正常分支（已有生效授权 / 已有在审申请 / 秒传未命中 / 分片缺失），任何位置弹窗都会打断主流程。
- 🔁 网络层行为：C 类的 `1002` 在响应拦截器内**静默 refresh（单飞）+ 重放原请求一次**，调用方无感知；刷新失败或 `1001 / 1003` → 清除令牌跳 `/user/login`；`1007` 仅提示「账号或密码错误」、不清会话不跳转；D 类（403）就地提示不引导登录；G 类（429）提示退避；H 类（5xx）用通知展示 `traceId` 供上报。
- 🗂️ 更细的分流以 **[错误码表 §二 处理策略分类](./error-codes.md#二处理策略分类按具体情况具体分析)** 为准（A 成功 / B 流程分支 / C 凭证失效 / D 拒绝不跳登录 / E 请求需修正 / F 状态失效冲突 / G 限流退避 / H 系统兜底），拦截器应按策略而非 HTTP 状态硬编码行为。
- 💻 已按本契约改造完成：`web/src/requestErrorConfig.ts`（拦截器与策略分流）、
  `web/src/utils/result.ts`（`Result` / `PageResult` 类型 + A~H 策略表，镜像后端 `ErrorCode`）、
  `web/src/utils/token.ts`（双令牌存储）；20 例单测覆盖策略分流与「B 类不弹窗」红线。
  ⚠️ `web/src/services/ant-design-pro/**` 仍为 Ant Design Pro 模板示例（`/api/currentUser` 等），
  接入首个真实业务接口时应删除并以 `/api/v1/**` 服务层替换。

## 8️⃣ 在线文档

接口定义基于 SpringDoc OpenAPI 3 自动生成，启动后端后访问：

- 📖 Swagger UI：<http://localhost:8080/api/swagger-ui/index.html>
- 📄 OpenAPI JSON：<http://localhost:8080/api/v3/api-docs>

> 🔒 生产 profile 默认关闭文档暴露（`springdoc.api-docs.enabled=false`），避免线上泄露接口面。

## 9️⃣ 兼容性

- ➕ 新增字段、新增错误码（分段内未占用号）为**非破坏性**，直接发布。
- 🚨 修改已发布 `code` / 资源路径 / 删除字段为**破坏性**，须升 `/api/v2` 或经评审统一灰度。
