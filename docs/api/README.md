# API 规范（API Specification）

> 本文档定义 AntTransfer CE 对外 HTTP API 的**统一契约**，服务端与前端开发均以此为基准。
> 错误码明细见 [错误码全表](./error-codes.md)，代码实现见 `server/at-common`（`Result` / `ErrorCode`）
> 与 `server/at-gateway`（`GlobalExceptionHandler`）。

## 1. URL 与版本

| 项 | 约定 |
| --- | --- |
| 服务地址 | `http://<host>:8080` |
| 全局前缀 | `/api`（`server.servlet.context-path=/api`，Swagger `/api/swagger-ui/index.html`、OpenAPI `/api/v3/api-docs` 除外） |
| 版本段 | 业务接口统一挂 **`/api/v1`**：版本化在 URL 中显式表达；破坏性变更升级 `/api/v2`，非破坏性扩展不升版本 |
| 资源命名 | **REST 复数资源、小写 + 连字符**，如 `/api/v1/users`、`/api/v1/permission-points`、`/api/v1/transfers` |
| 动作用例 | 认证 / 续期等非资源端点允许动作动词：`POST /api/v1/auth/token`、`POST /api/v1/auth/token/refresh` |

> 各领域 Controller 前缀（模板，具体以模块实现为准）：

| 后端模块 | 前缀 | 典型资源 |
| --- | --- | --- |
| `at-auth` | `/api/v1/auth` | `token`、`token/refresh`（动作端点） |
| `at-auth` | `/api/v1/users` | 用户 / 账号 |
| `at-permission` | `/api/v1/roles`、`/api/v1/permission-points` | 角色 / 权限点 / 授权申请 |
| `at-file` | `/api/v1/files` | 文件元数据、上传 / 下载 |
| `at-transfer` | `/api/v1/transfers` | 传输任务、分片、合并 |
| `at-collaboration` | `/api/v1/spaces`、`/api/v1/shares` | 协作空间、外发链接 |

### 方法语义

| 方法 | 语义 | 说明 |
| --- | --- | --- |
| `GET` | 查询 | `GET /api/v1/files` 列表；`GET /api/v1/files/{id}` 详情；不改状态 |
| `POST` | 创建 / 动作 | `POST /api/v1/files` 注册文件；`POST /api/v1/transfers/{id}/merge` 合并（动作） |
| `PUT` | 全量更新（幂等） | 少用 |
| `PATCH` | 部分更新 | `PATCH /api/v1/transfers/{id}` 暂停 / 续传状态迁移 |
| `DELETE` | 删除（进回收站） | 逻辑删除由后端处理 |

## 2. 统一响应体 `Result<T>`

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
// 成功
{ "code": 0, "message": "成功", "data": { "id": "185317..." }, "traceId": "a1..." }

// 失败：HTTP 200 + code 分支（流程分支码，见错误码表 4001/4002）
{ "code": 4001, "message": "秒传未命中，请按分片上传", "data": { "uploadId": "u_88" }, "traceId": "a2..." }

// 失败：HTTP 状态随错误码映射（此处 401）
{ "code": 1002, "message": "登录态已过期，请重新登录", "data": null, "traceId": "a3..." }
```

**契约要点**：HTTP 状态表达“传输/资源层语义”，`body.code` 才是业务判据；二者均须由服务端保证。

## 3. 分页结构

列表接口统一使用 `current` / `pageSize` 查询参数，并返回 `PageResult<T>`：

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

## 4. 时间格式

- 时间字段统一 **ISO-8601** 字符串输出。
- 本地时间字段（如 `createTime` / `updateTime`，对应 `LocalDateTime`）输出为 `2026-09-06T14:30:00`（无时区）。
- 涉及跨时区 / 事件时间的字段使用带偏移格式（`OffsetDateTime` / `Instant`）：`2026-09-06T14:30:00+08:00`，比较与存储建议统一 `UTC`。
- 入参同理接受 ISO-8601，后端负责解析校验。

## 5. 鉴权（双令牌）

- 除 `POST /api/v1/auth/token`（登录）、`POST /api/v1/auth/token/refresh`（刷新）、外发分享下载等白名单端点外，请求头携带：

```
Authorization: Bearer <accessToken>
```

- `accessToken` 过期（HTTP 401 + `code=1002`）时，前端**静默**调用 refresh 端点换取新令牌对并重放原请求一次；刷新失败（401 + `code=1003` 或 refresh 过期）跳转登录页。
- 无权限访问（HTTP 403 + `code=1004`）提示且不引导登录。

## 6. 错误处理策略

- 业务可控失败：抛 `BusinessException(ErrorCode)`，网关统一转换为 `Result`，HTTP 状态 = `ErrorCode.httpStatus`。
- 参数校验：`@Valid` / 参数缺失 / 类型不匹配 / JSON 不可读，统一归入 2xxx 且 HTTP 400。
- 未预期异常：兜底为 5001（HTTP 500），完整堆栈仅服务端可见（含 traceId 日志）。
- 完整错误码表（HTTP 映射 + 中文提示 + 前端行为）：见 **[error-codes.md](./error-codes.md)**。

## 7. 前端对接约定

- 响应拦截器将响应归一为：`success = body.code === 0`；`body.code !== 0` 弹 `body.message`（SILENT 类型除外）。
- 网络层行为：HTTP 401 → 尝试 refresh 后重放；refresh 失败跳 `/user/login`；HTTP 403 → 无权限提示；HTTP 429 → 限流提示并退避。
- `web/src/requestErrorConfig.ts` 当前为 Ant Design Pro 模板结构（`success/errorCode/errorMessage`），首条业务接口联调前须按本契约改造归一化。

## 8. 在线文档

接口定义基于 SpringDoc OpenAPI 3 自动生成，启动后端后访问：

- Swagger UI：<http://localhost:8080/api/swagger-ui/index.html>
- OpenAPI JSON：<http://localhost:8080/api/v3/api-docs>

> 生产 profile 默认关闭文档暴露（`springdoc.api-docs.enabled=false`），避免线上泄露接口面。

## 9. 兼容性

- 新增字段、新增错误码（分段内未占用号）为**非破坏性**，直接发布。
- 修改已发布 `code` / 资源路径 / 删除字段为**破坏性**，须升 `/api/v2` 或经评审统一灰度。
