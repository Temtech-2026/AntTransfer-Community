# 🧪 联调准备 Step 1：Apifox 集合 + 端到端冒烟用例集

> 📌 本文件是**联调准备第 1 步**的交付物：把 springdoc 产出的 OpenAPI 变成团队可共用的 Apifox 集合，
> 并给出一条可逐步执行、可断言的端到端冒烟链路。
> 🎯 覆盖主线：建号 → 登录 → 分片上传（含秒传命中 / 断点续传）→ 申请授权 → 审批通过 → 凭票据下载 →
> 创建外发 → 访客凭提取码取件 → IM 消息送达 → 授权到期回收。
> 🔗 契约基准：[docs/api/README.md](../api/README.md)、[错误码全表](../api/error-codes.md)；
> 分组与鉴权实现：`OpenApiConfig`、`application-dev.yml`。

---

## 0️⃣ 环境基座（先说清前提，避免整条链跑偏）

| 项 | 取值 | 出处 |
| --- | --- | --- |
| 服务地址 | `http://localhost:8080` | `application.yml` |
| 全局前缀 | `/api`（`server.servlet.context-path=/api`） | `application.yml` |
| 业务版本段 | `/v1`，故业务 URL 实为 `http://localhost:8080/api/v1/...` | api/README §1 |
| 接口文档 | `http://localhost:8080/api/swagger-ui/index.html` | application-dev.yml |
| OpenAPI JSON | `http://localhost:8080/api/v3/api-docs` | api/README §8 |
| 初始管理员 | `admin` / `Admin@123`（SUPER_ADMIN，不可删除） | `sql/V2__init_data.sql` |
| 冒烟探针 | `GET` / `POST /api/v1/smoke/perm/{read,write}`（仅 dev） | `SmokeGuardController` |
| 授权回收任务 | 每小时整点，cron 可覆盖 `anttransfer.permission.expire-scan-cron` | `PermissionGrantExpireScheduler` |

```bash
make dev-up     # MySQL 3307 / Redis 6379
make run        # 后端；dev 为默认 profile
```

> ⚠️ **两处必须记住的环境差异**
>
> 1. **dev 才开文档**：`application-dev.yml` 打开 `springdoc.swagger-ui.enabled`，
>    `application-prod.yml` 关闭 `springdoc.api-docs` 与 `swagger-ui` —— 导 OpenAPI 只能在 dev / staging 做，
>    联调期间不要为导文档临时打开 prod。
> 2. **dev 才放行文档路径**：`/v3/api-docs/**`、`/swagger-ui/**` 由 `application-dev.yml`
>    的 `anttransfer.auth.permit-all` 追加放行；这是**放行访问路径**而非「接口免鉴权」，
>    业务接口一律仍要 `Authorization`。
>    ⚠️ 该配置键**整体替换而非追加**（Spring Boot 的 profile 配置文档优先级更高，且 List 属性不做合并），
>    所以「产品固有」的匿名入口——登录 / 刷新、外发分享访客侧、文件取件、WebSocket 握手——
>    一律写死在 `SecurityConfig.BUILT_IN_PERMIT_ALL`，**不要**挪进 `permit-all`：
>    否则在写了该键的 profile（正是 dev）下会静默丢失，WebSocket 会一直停在「正在建立实时连接」。

---

## 1️⃣ 从 springdoc 导出 OpenAPI JSON 并导入 Apifox

### 1.1 先对齐分组：实际是 5 个模块组，不是 6 个业务组

`OpenApiConfig` 按 **at-\* 模块包路径**切分（包边界 = 模块边界，架构铁律），共 6 个组（含「全部接口」）：

| springdoc 组名 | 扫描包 | 对应本文件要求的目录 |
| --- | --- | --- |
| `00-全部接口` | `com.anttransfer` | 不单独导入，仅排障用 |
| `01-认证授权` | `com.anttransfer.auth.controller` | `auth` |
| `02-权限管理` | `com.anttransfer.permission.controller` | `permission` + `system`（需二次拆分） |
| `03-传输任务` | `com.anttransfer.transfer.controller` | `transfer` |
| `04-文件存储` | `com.anttransfer.file.controller` | `file` |
| `05-协作共享` | `com.anttransfer.collaboration.controller` | `collaboration` |

> ❗ **口径差异（要求里的 `system` 组不存在）**：要求的 6 组 `auth/transfer/permission/file/collaboration/system` 中，
> **`system` 不是独立 springdoc 分组**。系统管理面（`/v1/system/**`、`/v1/roles/**`、`/v1/permission-points/**`）
> 与审计只读面（`/v1/audit/**`）的 Controller 都在 `at-permission` 模块的 `controller` 包内，被 `02-权限管理` 一并扫走。
> **处理方式：在 Apifox 侧按路径前缀手工拆目录**；不要改 `OpenApiConfig.packagesToScan`
> —— 按业务语义拆包会破坏「包路径即模块边界」的既有约定，属于用文档需求反推代码结构。

### 1.2 导出步骤

1. 启动后端并确认文档可用（dev）：

   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/swagger-ui/index.html
   # 期望 200
   ```

2. **先取分组清单，不要手写中文组名的 URL 编码**：

   ```bash
   curl -s -H "Accept: application/json" \
     http://localhost:8080/api/v3/api-docs/swagger-config
   ```

   响应里 `urls[].url` 即各组 api-docs 地址（服务端已做 URL 编码）。

3. 逐组导出 JSON（组名 URL 用上一步返回值，下面编码仅示意）：

   ```bash
   mkdir -p openapi
   curl -s -H "Accept: application/json" \
     "http://localhost:8080/api/v3/api-docs/01-%E8%AE%A4%E8%AF%81%E6%8E%88%E6%9D%83" -o openapi/01-auth.json
   # 其余 02~05 同理；00-全部接口 仅排障时导出
   ```

   > `06-*` 不存在，`02` 一个文件同时承载 permission 与 system 两组目录（见 1.3）。

### 1.3 导入 Apifox 并分组

1. 新建团队项目 `AntTransfer CE 联调`。
2. 导入：**项目设置 → 导入数据 → OpenAPI/Swagger**，逐个 JSON 文件导入；
   导入模式选 **「智能合并」**，覆盖策略选 **「保留 Apifox 侧修改」**
   —— 否则第二次导出会冲掉手写的断言脚本与目录名。
3. 导入后按路径前缀整理目录（Apifox 侧手工移动/改名一次，后续智能合并不会重置）：

   ```text
   auth/           ← 01-认证授权 全部
   transfer/       ← 03-传输任务 全部
   permission/     ← 02-权限管理 中 /v1/permission/**
   system/         ← 02-权限管理 中 /v1/system/**、/v1/roles/**、
                      /v1/permission-points/**、/v1/audit/**
   file/           ← 04-文件存储 全部
   collaboration/  ← 05-协作共享 全部
   ```

   > 把 `audit` 归入 `system` 是「系统管理面只读审计」的语义归类；若团队更希望独立，可在 Apifox 单独建 `audit/`，
   > 这只是集合的展示层，不影响后端任何分组。

### 1.4 环境变量与鉴权配置

**环境（Apifox → 环境管理 → 本地 dev）**：

| 变量 | 值 | 说明 |
| --- | --- | --- |
| `baseUrl` | `http://localhost:8080/api` | **已含 context-path**，请求写 `{{baseUrl}}/v1/...` |
| `accessToken` | （空） | 由登录用例脚本写入 |
| `refreshToken` | （空） | 同上 |
| `adminUserId` / `userId` | （空） | 登录响应 `data.user.id` 写入 |
| `nodeId` / `fileId` | （空） | 合并 / 秒传结果写入 |
| `uploadId` | （空） | precheck 未命中分支写入 |
| `applicationId` | （空） | 申请单 ID |
| `shareToken` / `shareTicket` / `contentTicket` | （空） | 外发链接、访客一次性票据、核销换发的取件票 |

**公共请求头**：根目录级设 `Authorization: Bearer {{accessToken}}`；以下端点需单独覆盖为「无需认证」：

- `POST /v1/auth/token`、`POST /v1/auth/token/refresh`（免登录）
- `POST /v1/shares/{token}/verify`、`POST /v1/shares/redeem`（访客通道）
- `GET /v1/shares/{token}/content?ticket=`（访客通道，凭取件票取字节，凭证走查询串）
- `GET /v1/files/{id}/content`、`GET /v1/files/{id}/thumbnail`（票取，免登录）

**登录接口后置脚本（写入令牌）**：

```js
const body = pm.response.json();
pm.test('登录成功', () => pm.expect(body.code).to.eql(0));
if (body.code === 0 && body.data) {
  pm.environment.set('accessToken', body.data.accessToken);
  pm.environment.set('refreshToken', body.data.refreshToken);
  pm.environment.set('adminUserId', body.data.user.id);
}
```

**目录级通用后置脚本（统一响应体校验）**：

```js
const body = pm.response.json();
pm.test('统一响应体结构', () => {
  pm.expect(body).to.have.property('code');
  pm.expect(body).to.have.property('message');
  pm.expect(body).to.have.property('traceId');
});
```

### 1.5 ⚠️ 三条断言红线（联调最容易误判的地方）

1. **B 类分支码是 HTTP 200**：`4001`（秒传未命中）、`4002`（缺片）、`1008`（已有生效授权）、`1009`（已有在审申请）
   均为 **HTTP 200 + `code≠0`**。Apifox 默认「HTTP 200 = 通过」会把它们判成成功。
   **断言必须写在 `body.code` 上**，不要依赖 HTTP 状态。
2. **字节流端点不吃 `Result`**：`GET /v1/files/{id}/content` 返回**文件字节流**（非 `Result`），
   断言应是 `Content-Length` / `Content-Range` / 状态 200|206，不能断言 `code=0`。
3. **ID 一律用字符串传**：`nodeId` / `fileId` / `uploadId` 是 19 位雪花 ID，超出 JS `Number.MAX_SAFE_INTEGER`。
   Apifox 内部走 JS，若按 JSON number 传会在**发送前**丢末位，导致 `4101` 之类的「查不到任务」。
   故 body 中这些字段**加引号传字符串**（Jackson 能正常解析成 `Long`），path 变量天然是字符串、无需处理。

---

## 2️⃣ 端到端冒烟用例集（S01–S17）

**设计约定**

- 所有断言写到 **`body.code`**，HTTP 状态仅作辅助；`traceId` 在失败时随附件上报。
- 变量全部走 Apifox 环境变量，命名 `{{xxx}}`；每个用例末尾标注**「产出」**供下游引用。
- 「管理员 / 普通用户」两个身份的令牌**必须分开存**（见 S03 提醒），下文用 `adminToken` / `accessToken` 区分。
- 链路假设：普通用户 `zhangsan`（内置 `USER` 角色，不含高危 `file:destroy`），目标目录为**根目录**。

### S01 管理员登录

`POST {{baseUrl}}/v1/auth/token`　`Content-Type: application/json`（免登录）

```json
{ "username": "admin", "password": "Admin@123" }
```

**断言**

| 层 | 断言 |
| --- | --- |
| HTTP | `200` |
| body | `code == 0` |
| body | `data.accessToken`、`data.refreshToken` 非空；`data.tokenType` 非空 |
| body | `data.user.roles` 含 `SUPER_ADMIN` |

**产出**：`adminToken`（后置脚本写入，勿与 `accessToken` 混用）、`adminUserId = data.user.id`

### S02 管理员建号（普通用户）

`POST {{baseUrl}}/v1/system/users`　Header：`Authorization: Bearer {{adminToken}}`（需 `system:user:create`）

```json
{
  "username": "zhangsan",
  "password": "Zhangsan@123",
  "nickname": "张三",
  "email": "zhangsan@example.com",
  "deptId": null,
  "remark": "冒烟用例账号",
  "roleIds": [4]
}
```

> `roleIds: [4]` 是 `V2__init_data.sql` 固定的内置角色 ID：`1 SUPER_ADMIN` / `2 AUDITOR` / `3 DEPT_ADMIN` / `4 USER`。
> `USER` 含常规文件操作但**不含** `file:destroy`，正好用于 S17 的 1003 回收断言与负例 N3。

**断言**：HTTP `200`；`code == 0`。

**产出**：`userId` —— **不依赖建号响应结构**，统一用列表反查（避免因返回体变动而断链）：

```js
// S02 之后追加一个「反查」子步骤：GET {{baseUrl}}/v1/system/users?current=1&pageSize=100
const b = pm.response.json();
const hit = b.data.records.find(u => u.username === 'zhangsan');
pm.environment.set('userId', String(hit.id));   // 字符串存，防精度丢失
```

> ⚠️ 重复执行本用例会因账号已存在而失败。幂等做法：先反查，命中则跳过建号（或每轮用带时间戳的账号名）。

### S03 普通用户登录

`POST {{baseUrl}}/v1/auth/token`（免登录）

```json
{ "username": "zhangsan", "password": "Zhangsan@123" }
```

**断言**：HTTP `200`；`code == 0`；`data.user.roles` 含 `USER` 且**不含** `SUPER_ADMIN`。

**产出**：`accessToken`（后置脚本写入）、`refreshToken`、`userId`

> 🚨 **Apifox 变量覆盖坑**：S01 与 S03 打的是同一个端点，若共用同一套后置脚本，
> S03 会覆盖 S01 写入的令牌。**必须在 S01 的脚本里改写 `adminToken`**，S03 才写 `accessToken`，
> 之后默认目录级请求头用 `{{accessToken}}`（以普通用户身份跑主链），管理动作显式改用 `{{adminToken}}`。

### S04 分片上传 · 预检（未命中分支）

`POST {{baseUrl}}/v1/transfers/precheck`　Header：`Authorization: Bearer {{accessToken}}`

```json
{
  "fileName": "smoke-report.bin",
  "sizeBytes": 20971520,
  "sha256": "<64 位小写 hex，与真实字节一致>",
  "parentId": null
}
```

**断言**（未命中是**正常分支**，不是失败）

| 层 | 断言 |
| --- | --- |
| HTTP | `200`（分支码仍走 200） |
| body | `code == 4001`（秒传未命中，请按分片上传） |
| body | `data.instant == false` |
| body | `data.uploadId` 非空；`data.chunkSize > 0`；`data.chunkCount == ceil(sizeBytes / chunkSize)` |

**产出**：`uploadId`、`chunkSize`、`chunkCount`

> ⚠️ 前提：文件内容必须是**库中不存在的新内容**。若内容撞已有文件，本步会返回 `code=0` + `instant=true`，
> 后续 S05–S08 全部走不通。首次执行整链时用随机生成的文件即可。
> ⚠️ `sha256` 必须与真实字节一致：merge 阶段服务端会**重算并比对**，不一致返回 `4003`。

### S05 断点续传 · 查询已收分片（续传判据接口）

`GET {{baseUrl}}/v1/transfers/{{uploadId}}/parts`

**断言**

| 层 | 断言 |
| --- | --- |
| HTTP | `200` |
| body | `code == 0` |
| body | `data.received` 是**数组**且长度为 `0`（首次上传尚未收片） |
| body | `data.chunkSize`、`data.chunkCount` 与 S04 完全一致（任务固化值） |

**产出**：无（本步是「客户端据 `received` 只补差集」的权威依据）

> 📌 该接口读**数据库**而非暂存目录：目录里的残片可能尚未被事务确认，只有 `received` 是已确认清单。

### S06 逐片上传

`PUT {{baseUrl}}/v1/transfers/{{uploadId}}/parts/{{index}}`　`Content-Type: multipart/form-data`

| 表单字段 | 类型 | 说明 |
| --- | --- | --- |
| `chunk` | file（二进制） | 该分片的字节流 |
| `hash` | text | 该分片的 SHA-256 |

**断言**（每片）

| 层 | 断言 |
| --- | --- |
| HTTP | `200` |
| body | `code == 0` |
| body | `data.received` 是数组，**包含当前 `{{index}}`** |

> 索引**以路径为准**，表单里不要再传 index；`received` 回的是**索引数组**（非计数），
> 与前端 `web/src/services/upload/types.ts` 的 `number[]` 对齐。

**执行方式**：`index` 从 `0` 到 `{{chunkCount}} - 1` 逐个发（Apifox 用「循环」或批量生成 N 条用例）。

### S07 缺片合并（B 类分支码 4002，推荐纳入）

在**故意不传完**的情况下执行 S08 的 merge。

**断言**

| 层 | 断言 |
| --- | --- |
| HTTP | `200` |
| body | `code == 4002`（分片缺失） |
| body | `data.missing` 非空数组，且与「未传的索引」一致 |
| body | `data.received` 与 S06 已确认的索引集合一致 |

> 这条是**契约回归的高价值用例**：`4002` 若被写成抛异常，经全局异常处理器只会回 `Result<Void>`，
> `data.missing` 会丢失，前端被迫多打一次 `GET /parts`。断言 `data` 存在即锁住该红线。

**产出**：无（补传缺片后回到 S06）

### S08 合并落库

`POST {{baseUrl}}/v1/transfers/{{uploadId}}/merge`

```json
{
  "sha256": "<与 S04 完全相同>",
  "chunkCount": {{chunkCount}},
  "sizeBytes": 20971520
}
```

**断言**

| 层 | 断言 |
| --- | --- |
| HTTP | `200` |
| body | `code == 0` |
| body | `data.fileId` 非空（**字符串**） |
| body | `data.sha256 == 请求 sha256`（服务端重算一致） |

**产出**：`fileId`（物理文件 ID）

> ⚠️ **契约不对称（联调需留意）**：merge 结果只回 `fileId`，**不回 `nodeId`**（文件条目 ID），
> 而后续换票（`POST /v1/files/{id}/ticket`）与授权申请（`resourceId`）用的都是 **`nodeId`**。
> 因此本步后需补一次反查：

```js
// 追加子步骤：GET {{baseUrl}}/v1/files?current=1&pageSize=20&sort=-createTime
const b = pm.response.json();
const hit = b.data.records.find(f => f.name === 'smoke-report.bin');  // 字段名以实际响应为准
pm.environment.set('nodeId', String(hit.id));
```

> 该不对称建议后续在 `MergeResultVO` 补 `nodeId`（非破坏性扩展），已列入本文 §5「待确认项」。

### S09 秒传命中（同目录 + 跨目录）

同 S04 的参数**原样再发一次** `POST {{baseUrl}}/v1/transfers/precheck`。

**断言**

| 层 | 断言 |
| --- | --- |
| HTTP | `200` |
| body | `code == 0`（命中走成功码） |
| body | `data.instant == true` |
| body | `data.fileId == S08 的 fileId`（复用同一物理文件，不重复存储） |
| body | `data.nodeId` 非空；`data.uploadId == null`（命中分支不带票据） |

**S09b（跨目录）**：把 `parentId` 改为另一目录 ID 再 precheck，断言同样 `instant == true`。

> `V10__upload_task_parent_id.sql` 补 `parent_id` 的语义是：**同内容传到不同目录不再复用上传票据**，
> 即票据按「目标目录 + 内容」收敛；物理文件层仍秒传。两个断言点分别锁住「文件层秒传」与「票据层不复用」。

**产出**：`nodeId`（若 S08 反查失败，这里可兜底取得）

### S10 申请授权（普通用户发起）

`POST {{baseUrl}}/v1/permission/applications`　Header：`Authorization: Bearer {{accessToken}}`

```json
{
  "applyType": "DOWNLOAD",
  "resourceType": "FILE",
  "resourceId": "{{nodeId}}",
  "level": 1,
  "purpose": "联调冒烟：验证凭票据下载链路",
  "desiredExpireAt": "2026-09-14T18:00:00"
}
```

> `resourceId` 是 `Long`，但**必须加引号按字符串传**（见 §1.5 红线 3）；
> `applyType ∈ {ACCESS, DOWNLOAD, EDIT, SHARE}`，`resourceType ∈ {FILE, SPACE, GROUP}`。

**断言**

| 层 | 断言 |
| --- | --- |
| HTTP | `200` |
| body | `code == 0` |
| body | `data.id` 非空；`data.applicationNo` 非空 |
| body | `data.applicantId == {{userId}}`；`data.resourceId` 与 `{{nodeId}}` 一致 |
| body | `data.approverId`、`data.decidedAt` 均为 `null`（尚未裁决） |

**产出**：`applicationId = data.id`

> ⚠️ **重复提交不是错误**：已有生效授权回 `1008`、已有在审申请回 `1009`，**均为 HTTP 200 + 分支码**
> （见 [错误码表](../api/error-codes.md) B 类）。重跑本用例时若见 1008/1009，属于幂等命中，**不要当失败**。

### S11 审批通过（管理员裁决）

`POST {{baseUrl}}/v1/permission/applications/{{applicationId}}/approve`　Header：`Authorization: Bearer {{adminToken}}`

```json
{
  "grantType": "DOWNLOAD",
  "expireAt": "2026-09-14T18:01:00",
  "opinion": "冒烟通过（有效期 1 分钟，便于验证到期回收）"
}
```

**断言**

| 层 | 断言 |
| --- | --- |
| HTTP | `200` |
| body | `code == 0` |
| body | `data.approverId == {{adminUserId}}`；`data.decidedAt` 非空 |
| body | `data.status` 与 S10 返回的初始态**不同**（已裁决） |
| body | `data.opinion == "冒烟通过..."` |

> `grantType` 可**低于**申请动作（如申请 `EDIT` 批 `ACCESS`）；
> `expireAt` **只可缩短、不可放宽**（不得晚于 `desiredExpireAt`），放宽会被拒。
> `expireAt` 故意设为 1 分钟后，是为 S17 的到期回收准备。

**产出**：无（授权记录已生效）

### S12 凭票据下载

**S12-a 换票**　`POST {{baseUrl}}/v1/files/{{nodeId}}/ticket`（需 `file:download`）

**断言**：`code == 0`；`data.ticket` 非空；`data.nodeId` 与 `{{nodeId}}` 一致；
`data.expiresInSeconds > 0`；`data.downloadUrl` 非空。

**产出**：`ticket`、`downloadUrl`

**S12-b 凭票取字节流**　`GET {{baseUrl}}/v1/files/{{nodeId}}/content?ticket={{ticket}}`（**免登录**）

> 🚨 该端点返回**文件字节流**，不是 `Result` 包装 —— 断言写在响应头/长度上，**不要断言 `code=0`**。

| 断言 | 期望 |
| --- | --- |
| HTTP | `200` |
| `Content-Length` | 等于 `sizeBytes`（20971520） |
| `Content-Type` | 非空 |
| `Content-Disposition` | 含原始文件名 |

**S12-c Range 续传**：同一 URL 加 `Range: bytes=0-1023` → 断言 HTTP `206` + `Content-Range: bytes 0-1023/20971520`。

> 🔧 `downloadUrl` 拼接口径：它是**相对路径**（由前端补 host）。若返回值以 `/v1/...` 开头，拼 `{{baseUrl}}`；
> 若已含 `/api` 前缀，则只能拼 host，**叠加会变成 `/api/api/...`**。实际形态见 §5 待确认项，联调首次执行时确认一次即可。

### S13 创建外发分享

`POST {{baseUrl}}/v1/shares`（需 `file:share`）

```json
{
  "fileId": "{{fileId}}",
  "extractCode": "654321",
  "downloadLimit": 3,
  "expireAt": "2026-09-14T18:03:00"
}
```

> ⚠️ 这里用的是 **`fileId`（物理文件 ID）**，不是 `nodeId` —— 外发分享挂物理文件，换票下载挂条目。
> `extractCode` 明文只在本次请求出现，长度下限由 `anttransfer.file.share.extract-code-min-length`（默认 6）二次校验。

**断言**

| 层 | 断言 |
| --- | --- |
| HTTP | `200` |
| body | `code == 0` |
| body | `data.token` 非空；`data.fileId == {{fileId}}`；`data.fileName == "smoke-report.bin"` |
| body | `data.status == 0`（生效）；`data.remainingCount == 3`；`data.downloadedCount == 0` |
| body | `data.extractCodeRequired == true` |
| body | **响应体中不存在 `extractCode` 字段**（提取码只进不出的红线） |

**产出**：`shareToken = data.token`

> 超出配置硬上限（默认 1000 次 / 30 天）时以 `2005` 拒绝，属负例，可另建用例。

### S14 访客凭提取码换票（免登录通道）

`POST {{baseUrl}}/v1/shares/{{shareToken}}/verify`

```json
{ "extractCode": "654321", "accessType": "download" }
```

> 该端点免登录，**执行前清掉 `Authorization`** 头，以贴近真实访客路径。

**断言**

| 层 | 断言 |
| --- | --- |
| HTTP | `200` |
| body | `code == 0` |
| body | `data.ticket` 非空；`data.shareToken == {{shareToken}}` |
| body | `data.accessType == "download"`；`data.ttlSeconds > 0` |
| body | `data.remainingCount == 3`（换票是**预检快照**，真正扣减在 S15 核销时） |

**产出**：`shareTicket = data.ticket`

### S15 访客核销取件（一次性票据取用即焚，换发取件票）

`POST {{baseUrl}}/v1/shares/redeem`

```json
{ "ticket": "{{shareTicket}}" }
```

**断言**

| 层 | 断言 |
| --- | --- |
| HTTP | `200` |
| body | `code == 0` |
| body | `data.fileName == "smoke-report.bin"`；`data.sizeBytes == 20971520` |
| body | `data.sha256` 与上传时一致；`data.fileId == {{fileId}}` |
| body | `data.accessType == "download"` |
| body | `data.contentTicket` 非空；`data.expiresInSeconds > 0`（核销换发的**取件票**，供 S15d 拉字节） |
| body | **响应中不含存储路径 / 对象键**（访客免登录，暴露存储位置等于给出绕过票据直连存储的可能） |

**产出**：`contentTicket = data.contentTicket`

**S15b 一次性验证**：**原样重发**同一 `shareTicket` → 断言返回票据失效类错误码（非 0）。
**S15c 计数验证**：`GET {{baseUrl}}/v1/shares/{{shareToken}}` → `downloadedCount` 由 0 变 1、`remainingCount` 由 3 变 2。

### S15d 访客凭取件票取字节（支持 Range）

`GET {{baseUrl}}/v1/shares/{{shareToken}}/content?ticket={{contentTicket}}`

> 该端点免登录（浏览器原生 `<a href>` 下载**无法携带 Authorization 头**，凭证只能走查询串），
> 执行前同样清掉 `Authorization` 头。

**断言**

| 层 | 断言 |
| --- | --- |
| HTTP | `200` |
| header | `Accept-Ranges: bytes`；`Content-Length == 20971520` |
| header | `Content-Disposition` 含 `attachment` 与文件名 |

**S15e Range 续传**：带 `Range: bytes=0-1023` 重发 → 断言 `206`、`Content-Range: bytes 0-1023/20971520`、响应体 1024 字节。
**S15f 不再重复扣次数**：重发 S15d 后再次 `GET {{baseUrl}}/v1/shares/{{shareToken}}` → `downloadedCount` 仍为 1
（扣减与审计只发生在 S15 核销那一次；取件票在 TTL 内可重复读，正是它与一次性票的分工）。

**S15g 取件回执（创建者侧断言，2026-09-29 新增）**：用 `{{adminToken}}` 拉通知
`GET {{baseUrl}}/v1/notifications?pageNum=1&pageSize=20` → 断言多出一条 `notifyType == 9`（`SHARE_ACCESSED`）；
再断言该条**计入站内信未读**（`GET /v1/notifications/unread` 的站内信口径 +1）**但不进待办**（待办角标**不变**）。
这条回执是免登录访客场景下创建者唯一能感知「链接真的被用过」的通道，不能只测核销返回而漏掉它。

### S16 IM 消息送达

**S16-a 管理员发单聊消息**　`POST {{baseUrl}}/v1/chat/messages`（`Bearer {{adminToken}}`）

```json
{
  "scope": 1,
  "targetId": "{{userId}}",
  "messageType": 1,
  "content": "联调冒烟：文件已就绪",
  "clientMsgId": "smoke-0001"
}
```

> `scope=1` 单聊（`targetId`=对端用户 ID）、`scope=2` 群聊（`targetId`=群组 ID）；
> `messageType`：1 文本 / 2 文件传输 / 3 审批结果（禁止 0）；
> **`clientMsgId` 必填**，是弱网重发与 HTTP 重试的幂等键。

**断言**：`code == 0`；`data.id` 非空。

**产出**：`chatMsgId = data.id`

**S16-b 幂等重发**：**同一 `clientMsgId`** 再发一次 → 断言 `code == 0` 且 `data.id` 与 S16-a **完全相同**（不重复落库、不重复推送）。

**S16-c 会话历史**　`GET {{baseUrl}}/v1/chat/messages?scope=1&targetId={{adminUserId}}`（`Bearer {{accessToken}}`）

断言：`code == 0`；`data` 是**数组**（该端点返回 `List`，**不是 `PageResult`**），其中含 S16-a 的消息。

**S16-d WebSocket 下行（手工步骤，不纳入自动化）**

- 地址：`ws://localhost:8080/api/ws/notify?token={{accessToken}}`
- 期望帧序：`CONNECTED`（含用户 ID 与未读快照）→ admin 触发 S16-a → `CHAT` 帧
- 帧信封统一 `{"type":"...","data":{...},"ts":1789000000000}`；下行 `type`：`CONNECTED / NOTIFY / CHAT / CHAT_READ / CHAT_RECALL / PRESENCE / TYPING / UNREAD / PONG`
- 心跳：服务端每 30s 下行 `PING`，客户端**必须回 `PING`**；90s 无任何上行帧即判定掉线并清理（关闭码 `4002`）
- 鉴权只在握手做一次：**登出 / 令牌过期不会断开已建连接**，客户端应在登出时主动关闭
- Apifox 的 WebSocket 断言能力弱，建议手工核对或用浏览器控制台执行

**S16-e 离线补拉**：关闭 WS → admin 再发一条 → `GET {{baseUrl}}/v1/notifications/offline?limit=50`（`Bearer {{accessToken}}`）→ 断言能补到该条。
**S16-f 未读快照**：`GET {{baseUrl}}/v1/notifications/unread` → 断言返回三口径未读结构（导航栏红点 / 待办角标 / 会话角标）。

**S16-g 已读回执（`CHAT_READ` 帧 + 历史 `readers`）**

前置：`{{accessToken}}`（发送人，即 admin）与 `{{userToken}}`（对端，即 `{{userId}}`）各开一条 WebSocket，
发送人侧先收到 admin 发消息产生的 `CHAT` 帧。

1. 对端置读：`POST {{baseUrl}}/v1/chat/read`（`Bearer {{userToken}}`），体 `{"scope":1,"targetId":"{{adminUserId}}"}`，
   断言回 `data` = 本次置读条数（`> 0`）。
2. **发送人**那条 WS 上应收到一帧：

```json
{"type":"CHAT_READ","data":{"chatScope":1,"chatTargetId":"{{userId}}","reader":{"userId":"{{userId}}","displayName":"……"},"clientMsgIds":["smoke-0001"]},"ts":1789000000000}
```

   > 三个易错点：① 该帧**只推给发送人**，对端自己的连接上不会有；② `chatTargetId` 是**发送人视角**
   > 的会话目标（单聊回读者本人），照抄库里 `chat_target_id` 会匹配不上窗口；③ 按 `clientMsgIds`
   > （幂等键）对应消息，不是消息 ID。
3. 历史回正（回执是加速通道，不是真值）：`GET {{baseUrl}}/v1/chat/messages?scope=1&targetId={{userId}}`
   （`Bearer {{adminToken}}`）→ 断言 S16-a 那条消息的 `readers` 含 `{{userId}}`；且**对端视角**拉同一会话时，
   自己那条消息的 `readers` 为空数组（`readers` 只表达「谁读了我发的」）。
4. 反例：`readStatus` 不能当回执用——admin 拉自己的消息列表时该字段恒为 `1`（自己那行落库即已读）。
5. 历史优先级：**关闭**发送人 WS → 对端再置读若干条 → 重开发送人 WS 并重拉会话历史 → 断言这些条的
   `readers` 已补齐（回执帧没补推，也不需要补推）。

**S16-h 对端在线状态与「正在输入…」（`PRESENCE` / `TYPING` 帧 + 两个端点）**

前置：`{{accessToken}}`（观察方，即 admin）与 `{{userToken}}`（对端，即 `{{userId}}`）各开一条 WebSocket。

1. 订阅并同时取回当前值：`POST {{baseUrl}}/v1/chat/presence/watch`（`Bearer {{accessToken}}`），
   体 `{"scope":1,"targetId":"{{userId}}"}` → 断言 `code == 0` 且 `data.status` ∈ `ONLINE / OFFLINE / UNSTABLE`，
   `data.userId == "{{userId}}"`（对端此刻在线时应为 `ONLINE`）。
2. **观察方**那条 WS 上，当对端状态**发生迁移**时应收到一帧：

```json
{"type":"PRESENCE","data":{"userId":"{{userId}}","status":"UNSTABLE","lastActiveAt":1789000000000},"ts":1789000000000}
```

   > 三个易错点：① `UNSTABLE`（红点「网络状态不佳」）**不是断线**，而是「连接还在、心跳已超出
   > **1.5 ×** 心跳间隔（30s 心跳 → **45s** 判据）」；真断线直接是 `OFFLINE`，两者含义不同，不要合并；
   > ② `userId` 是**状态发生变化的那个用户**（不是接收人视角的目标），客户端必须与当前会话对端比对后再改点；
   > ③ **只推迁移、平迁不推**——否则每个心跳都会放大成全量推送。
3. 输入信号：`POST {{baseUrl}}/v1/chat/typing`（`Bearer {{userToken}}`），
   体 `{"scope":1,"targetId":"{{adminUserId}}","typing":true}` → 断言 `code == 0`；
   **观察方**（admin）那条 WS 上应收到：

```json
{"type":"TYPING","data":{"chatScope":1,"chatTargetId":"{{userId}}","typing":true},"ts":1789000000000}
```

   再发一次 `"typing":false` → 断言收到停止帧（`typing=false` 照常下发，客户端应立即收起提示）。
   > 两个易错点：① `chatTargetId` 是**接收人视角**的会话目标（单聊 = 输入者本人 `{{userId}}`），
   > 与 `CHAT_READ` 同一换算口径；② 该帧**不落库、不计未读、离线不补推**，客户端必须有 **6s 空闲兜底**，
   > 否则丢帧 / 对端崩溃会让「对方正在输入…」永久挂住（比不显示更糟）。
4. 反例（单聊之外一律拒绝）：`scope=2`（群聊）调 `presence/watch` 或 `typing` → 断言 `code == 2001`；
   `typing` 的 `targetId` 填自己 → 断言 `code == 1013`；`targetId` 指向不可用用户 → 断言 `code == 1013`。
5. 反例（订阅窗口）：`presence/watch` 后**不再续订**并静置 > **2min** → 断言观察方**不再**收到该对端的
   `PRESENCE` 帧（服务端订阅窗口 2min；前端每 30s 续订一次，允许连续丢 3 次才过期）。
6. 反例（辅助信息不弹错）：把 Redis 停掉后调 `presence/watch` → 断言接口仍 `code == 0`，
   但 `data.status == "OFFLINE"`（服务端降级；状态点属辅助信息，宁缺不弹错）。

**S16-i 建群闭环（`POST /v1/chat/groups` + 「我加入的群」）**

> 这一条修的是「群聊有入口、无能力」：此前 `sys_group` / `sys_group_member` 只被**读**（发送前校验成员、
> 投递时按成员写扩散），全系统没有任何创建群组的入口，于是弹窗只能让人手填一个永远不存在的群组 ID。

前置：`{{accessToken}}`（建群人，admin）与 `{{userId}}`（受邀成员，S02 建号所得）。

1. 建群：`POST {{baseUrl}}/v1/chat/groups`（`Bearer {{accessToken}}`）

```json
{
  "name": "联调验证群",
  "memberIds": ["{{userId}}"]
}
```

→ 断言 `code == 0`；`data.id` 是**字符串**（19 位雪花 ID，前端禁止再经 `Number()`）；
`data.ownerUserId` == admin 的用户 ID；`data.memberCount == 2` —— **含群主自己**（上限口径是「群的总人数」，
不是「受邀人数」，与投递侧 `MAX_FANOUT_RECIPIENTS`(500) 同源）。产出 `groupId = data.id`。

2. **DB 断言**（群行与全体成员行**必须同事务**落地，否则会得到「没有成员的群」——它的会话任何人都发不进去）：

```sql
SELECT g.name, g.owner_user_id, m.user_id, m.member_role
FROM sys_group g JOIN sys_group_member m ON m.group_id = g.id
WHERE g.id = <groupId>;
-- 期望：2 行，owner_user_id 非空；创建者那行的 member_role 为群主角色值
```

3. 发群消息：`POST {{baseUrl}}/v1/chat/messages`（`Bearer {{accessToken}}`），
   体 `{"scope":2,"targetId":"{{groupId}}","messageType":1,"content":"群已建好","clientMsgId":"<新幂等键>"}`
   → 断言 `code == 0`；换 `{{userToken}}` 拉 `GET {{baseUrl}}/v1/chat/messages?scope=2&targetId={{groupId}}`
   → 断言能读到该条（写扩散到**成员各自的行**）。
4. 会话列表的群名（D-11 在会话列表侧的残留已收口）：`GET {{baseUrl}}/v1/chat/conversations`（`Bearer {{userToken}}`）
   → 断言该群会话的 `targetName == "联调验证群"`（**不再是 `null`**）。再手工删掉第 2 步那个群行后重拉 →
   断言该会话**仍在列表里**、仅 `targetName` 回 `null`（宁少一个名字，不少一个会话）。
5. 「我加入的群」：`GET {{baseUrl}}/v1/chat/groups`（`Bearer {{userToken}}`）→ 断言 `data` 含 `{{groupId}}`；
   换一个**未加入该群**的账号调同一端点 → 断言**不含** `{{groupId}}`（查询维度写死为登录人本人，故无越权入参面）。
6. 反例（错误码）：
   - `memberIds: []` → `code == 1031`；`memberIds` **只填 admin 自己** → 同样 `code == 1031`（剔除创建者后为空）；
   - `memberIds` 含一个已停用 / 已注销用户 → `code == 1033`（**不逐位回报是哪一个**，否则该端点就是账号存在性枚举器），
     且**整体回滚**：`SELECT COUNT(*) FROM sys_group WHERE name = '联调验证群'` 不新增行（不留半个群）；
   - `name: "   "` → `code == 2002`（去首尾空白后判空）；`name` 65 个字符 → `code == 2001`（`sys_group.name` 列宽 64）；
   - 用 **AUDITOR** 账号调建群 → `code == 1003`（V14 **不授** AUDITOR：建群是写操作且决定后续消息可见范围，
     与审计员「权限锁定只读」冲突）。
7. 前端（弹窗口径，与后端注解互为两层）：
   - 以 **SUPER_ADMIN / DEPT_ADMIN / USER** 打开「发起会话」→ 断言可见**群聊**类型，且该分支是
     **群名输入 + 成员选择**（不是群组 ID 输入框）；建完**直接进入会话**（URL / 会话头标题即群名，左栏可能稍后才出现该会话）；
   - 以 **AUDITOR** 打开 → 断言**整个群聊类型都不渲染**（隐藏而非置灰）；
   - 群聊分支**首条消息留空**提交 → 就地提示 `chat.new.content.required`（会话由消息写扩散而来，
     不发首条消息则服务端不留任何会话记录，而**被拉进群的人正是靠这条消息第一次看到这个群**）；
   - 建群成功后**不填首条消息直接改条件重试**属已知坑：首条消息失败时群已落库，前端只提示、弹窗关闭，
     用户应在聊天框里重发——若停留在弹窗内再点一次「发起」，会建出**第二个同名群**。

**S16-j 消息撤回与引用回复（`POST /v1/chat/messages/recall` + `CHAT_RECALL` 帧 + `quoteClientMsgId`）**

> 这一条修的是「发出去就改不了、也没法针对某条说话」：撤回是**整条逻辑消息**的动作（写扩散下客户端
> 只有 `clientMsgId` 能跨端指认它），引用则**抄快照**而不是存外键。

前置：`{{accessToken}}`（发送人 admin）与 `{{userToken}}`（对端 `{{userId}}`）各开一条 WebSocket；
S16-a 那条消息（`clientMsgId = smoke-0001`）仍在 2 分钟窗口内、且**未被撤回**。

1. 撤回：`POST {{baseUrl}}/v1/chat/messages/recall?clientMsgId=smoke-0001`（`Bearer {{accessToken}}`）
   → 断言 `code == 0`（无 `data`）。**对端**那条 WS 上应收到一帧：

```json
{"type":"CHAT_RECALL","data":{"clientMsgId":"smoke-0001","senderUserId":"{{adminUserId}}","chatScope":1,"chatTargetId":"{{adminUserId}}","recallTime":"2026-09-26T15:00:00"},"ts":1789000000000}
```

   > 三个易错点：① `chatTargetId` 是**接收人视角**的会话目标（单聊回**撤回者**本人 `{{adminUserId}}`，
   > 对端看自己的会话窗口才匹配得上），与 `CHAT_READ` / `TYPING` 同一换算口径；
   > ② 匹配只能用 `clientMsgId`，**不能用消息 ID**（写扩散下同一条消息在双方各有一行、ID 不同）；
   > ③ 撤回**不重推 `CHAT` 帧**——`CHAT` 的语义是「来了一条新消息」，重推会让未读数与会话摘要各多算一次。

2. DB 断言（**整条逻辑消息的全部行一起翻**，只翻自己那行会表现为「我撤了，他还能看到」）：

```sql
SELECT recipient_user_id, recall_status, recall_time, content
FROM sys_notify_message WHERE sender_user_id = <adminUserId> AND client_msg_id = 'smoke-0001';
-- 期望：单聊 2 行 recall_status 均为 1、recall_time 非空；content 已置空串 ''
-- （置状态与清正文一起做，但**判定撤回只看 recall_status**——空正文本身是合法状态）
```

3. 历史回正（帧是加速通道、不是真值）：`GET {{baseUrl}}/v1/chat/messages?scope=1&targetId={{userId}}`
   （`Bearer {{adminToken}}`）→ 断言该条 `recallStatus == 1`、`content` 为空、`recallTime` 非空。
   **再拉一次对端视角**（`Bearer {{userToken}}`，`targetId={{adminUserId}}`）→ 对端那份也应看到撤回态
   （撤回是双方共同的终态，不是「只看得到自己撤回」）。
4. 幂等（多端并发撤回同一端先到）：**同一 `clientMsgId` 再调一次撤回** → 断言仍 `code == 0`，
   且这一步**不再产生第二帧** `CHAT_RECALL`（目标状态已达成，服务端直接返回；这条判定刻意排在时间窗校验之前，
   否则并发时后到的那一端会因窗口已过而收到 1034，用户看到的是「撤回失败」而消息其实早已撤回）。
5. 引用回复：`POST {{baseUrl}}/v1/chat/messages`（`Bearer {{accessToken}}`）

```json
{
  "scope": 1,
  "targetId": "{{userId}}",
  "messageType": 1,
  "content": "刚那条作废，看这条",
  "clientMsgId": "smoke-0002",
  "quoteClientMsgId": "smoke-0001"
}
```

→ 断言 `code == 0`；再拉历史 → 断言 `smoke-0002` 的 `quoteClientMsgId == "smoke-0001"`、
`quoteSenderUserId == "{{adminUserId}}"`、`quoteContent` 为**被引用那条当时的正文快照**。产出 `chatMsgId2 = data.id`。
6. 撤回不影响既有引用（**抄快照的价值就在这一步**）：撤回 `smoke-0002` 自己？——不，撤回 `smoke-0002` 前先确认：
   把第 5 步引用的那条（若还在窗口内可另发一条被引用消息再撤回）撤回 → 重拉历史 → 断言 `smoke-0002` 的
   `quoteContent` **仍然有文字**（引用块不会因为原消息被撤回而变空白）。这一步是「引用存快照而不是存外键」的验收点。
7. 反例（错误码）：
   - 撤回超窗消息 → `code == 1034`（**终态错误**，重试不会有不同结果）。复现办法：`UPDATE sys_notify_message
     SET create_time = DATE_SUB(NOW(), INTERVAL 3 MINUTE) WHERE client_msg_id = '<新幂等键>'` 后再撤（窗口看 `create_time`，不落库）；
   - 用 `{{userToken}}` 撤 admin 发的 `smoke-0001` → `code == 1035`；撤一个不存在的 `clientMsgId` → 同样 `code == 1035`
     （**四种情况同一个码**，分开报会给出「这条幂等键是否存在」的探测面）；`clientMsgId` 传空 / 只传空白 → `code == 2002`（`PARAM_MISSING`）；
   - 引用**已撤回**的消息（第 1 步那条）→ `code == 1036`；引用**另一会话**里的消息 → 同样 `code == 1036`；
     引用不存在的幂等键 → 同样 `code == 1036`。三者都必须**不落任何行**：
     `SELECT COUNT(*) FROM sys_notify_message WHERE client_msg_id = '<被拒的幂等键>'` 为 0；
   - 引用超长正文（> 200 字符）→ 不报错，断言 `quoteContent` 按**码点**截断到 200（emoji 不被截成半个）；
   - 撤回限流：连续调用 31 次（60s 窗口）→ 断言第 31 次被 `@RateLimit` 拦下（与发送同一套限流口径）。
8. 前端（右键菜单只有两条，且**撤回先发请求、成功后才改本地**）：
   - **自己发的**、2 分钟内的消息右键 → 断言菜单含「引用」「撤回」两项；**别人发的**消息右键 → 断言**没有「撤回」项**；
     超过 2 分钟的消息右键 → 仍无「撤回」项（前端 `isRecallable` 含 **30s 钟差容忍**，只控制显隐，**不替服务端裁决**）；
   - 点「引用」→ 断言输入框上方出现引用条（含被引用人 + 正文摘要）；点「取消」→ 引用条消失、发送时不带 `quoteClientMsgId`；
   - 引用状态下发出去的**下一条消息**带引用；发送成功后引用条自动清空；**发送失败时保留**（用户改完正文可直接重试同一句引用）；
   - 切换会话 → 断言引用草稿被清空（否则下一条会挂到另一个会话的引用上，服务端会以 1036 拒绝，但那是发出去之后的事）；
   - 撤回成功后本地应立即切成「已撤回」占位（正文清空但**显示「已撤回」而不是空白**）；用超窗的消息强行撤回（可手改
     `create_time` 后由前端触发）→ 断言**只弹提示、不把本地消息改成已撤回**（失败不能污染本地状态）。

**S16-k 群设置闭环（群详情 / 改名 / 邀请 / 移除 / 退群 / 解散）**

> 这一条修的是「群建完即冻结」：V14 只给了建群，改不了名、拉不进人、移不掉人、也解散不了，
> 而 `sys_group_member` 是发送与历史拉取的**唯一**授权依据——成员关系一旦建错就只能重建一个群。
> 六个端点、四个权限点见 `sql/V16__chat_group_manage_permission_points.sql`。

前置：S16-i 建的群 `{{groupId}}`（admin 为群主）、`{{userToken}}`（受邀成员 `{{userId}}`）、
另一个**未入群**账号 `{{outsiderToken}}`（S02 另建号），以及一个 **AUDITOR** 账号。

1. 群详情（成员限定、**不挂权限点**）：`GET {{baseUrl}}/v1/chat/groups/{{groupId}}`（`Bearer {{accessToken}}`）
   → 断言 `code == 0`，`data` 含 `id / name / ownerUserId / memberCount / memberLimit / members / ability`。
   **以群主看**：`canRename / canInvite / canRemoveMember / canDissolve == true`、`canQuit == false`；
   **换 `{{userToken}}`（普通成员）看**：前四项为 `false`、`canQuit == true`。
   > 这就是「前端不自行推断我是不是群主」的依据：`ability` 由服务端按 `sys_group.owner_user_id` + `member_role`
   > 实时算出，`/chat` 页与即时通讯抽屉只照它显隐（登录态里没有可信的用户主键，推断必然是错的）。
2. 反例（详情）：`{{outsiderToken}}` 看该群 → `code == 1012`（**非群成员**，成员资格就是这里的越权边界）；
   `GET .../groups/999999999999999999` → `code == 1037`（**「不存在」与「已解散」合并成一个码**——
   分开报会给出「这个群 ID 曾经存在吗」的探测面，而对调用方可做的动作完全相同）。
3. 改群名：`PATCH {{baseUrl}}/v1/chat/groups/{{groupId}}`（`Bearer {{accessToken}}`）`{"name":"联调验证群-改"}`
   → `code == 0`，`data.name` 为新名且 `data.ability` 一并返回；DB 断言 `SELECT name FROM sys_group WHERE id = <groupId>`。
   - **同名不多写库**：原样再提交一次 → `code == 0`，`update_time` **不变**；
   - `{"name":"  "}` → `code == 2002`（去首尾空白后判空）；65 个字符 → `code == 2001`（列宽 64）；
   - `{{userToken}}`（群内普通成员）→ `code == 1038`（**群内身份不足**）；**AUDITOR** → `code == 1003`
     （**权限点不足**）。两者必须能分开观测——这是「权限点与群内身份是**两条正交授权线**」的验收点：
     功能给了、身份不够照样拒绝，反之亦然；两条线都不满足时以权限点为准（先拦住功能面）。
4. 邀请成员：`POST {{baseUrl}}/v1/chat/groups/{{groupId}}/members`（`Bearer {{accessToken}}`）
   `{"memberIds":["<outsiderUserId>"]}` → `code == 0`，`data.memberCount` +1。
   - **幂等**：把**已在群的人**（含群主自己）再邀请一次 → `code == 0`、`memberCount` 不变
     （全员已在群仍回 200：报「重复邀请」会让批量邀请里的其他人白等）；
   - **复活**：先按第 5 步移除某人，再用同一 ID 邀请 → 断言 `sys_group_member` 里该行 `deleted` 由 1 回到 0，
     且**不产生第二行**（唯一键 `uk_group_user(group_id, user_id)` **不含 `deleted`**，直接 insert 必撞键）；
   - 反例：把成员灌到 500 后再邀请 → `code == 1032`；邀请不存在的用户 ID → `code == 1033`
     （**不逐位回报是哪一个**，否则端点就成了账号存在性枚举器）。
5. 移除成员：`DELETE {{baseUrl}}/v1/chat/groups/{{groupId}}/members/{{userId}}`（`Bearer {{accessToken}}`）→ `code == 0`；
   随后该成员**发送与拉历史均** `code == 1012`（移出群就是**失去授权**，不是「还能看旧消息」）。
   - 反例：`userId` 换成**群主自己**（含群主移除自己）→ `code == 1039`——那会造出一个**没有所有者的群**，
     此后无人能改名 / 邀请 / 移除 / 解散，群变成只能发消息的死结构；
   - 移除**从未入群 / 已被移除**的 ID → `code == 1040`（对象已不在，刷新详情即可收敛）；
   - 若把管理员身份授给了他人，用**管理员**移除第三人 → `code == 1041`（**仅群主**这档比 `1038` 更严，
     合并两者会让界面上「管理员能改名却不能移除人」无从解释）。
6. 退群：`POST {{baseUrl}}/v1/chat/groups/{{groupId}}/quit`（`Bearer {{userToken}}`）→ `code == 0`；
   随后该账号拉会话列表**不再出现该群**、拉该群历史 `code == 1012`。
   - 反例：群主调 `quit` → `code == 1039`（想离开只能先解散）；非成员调 `quit` → `code == 1012`。
7. 解散：`DELETE {{baseUrl}}/v1/chat/groups/{{groupId}}`（`Bearer {{accessToken}}`）→ `code == 0`。
   DB 断言**两步的顺序**（先清成员、再停群行，先落安全态）：

```sql
-- 期望 0：成员关系先被清空（否则并发下发送侧仍认成员行，能往已解散的群写进消息）
SELECT COUNT(*) FROM sys_group_member WHERE group_id = <groupId> AND deleted = 0;
-- 期望已停用
SELECT status FROM sys_group WHERE id = <groupId>;
```

   - 反例：非群主解散 → `code == 1041`；AUDITOR → `code == 1003`。
8. 前端（`/chat` 页与即时通讯抽屉**同一口径、同一个组件** `ChatGroupPanel`）：
   - `/chat` 选中群会话 → 页头出现「群设置」；抽屉选中同一群 → 抽屉头部出现同一入口（抽屉只留图标，
     无障碍名 `chat.group.title`）。**单聊**两处都不渲染；
   - 按钮显隐 = **权限点 ∧ `ability`**：AUDITOR 打开 → 无改名输入框 / 无邀请 / 无危险操作；普通成员打开 →
     同样没有（**但入口仍在**，他仍要能看群资料）；群主打开 → 改名 / 邀请 / 移除 / 解散齐全且**没有「退出群聊」**
     （`ability.canQuit=false`，不给注定失败的按钮）；
   - 改名成功 → 页头标题与左栏列表项**同时**变成新名（两处同源渲染，只改一处会出现一名两写）；
   - 危险动作一律**弹窗二次确认**（行内气泡易误触；解散为 `critical` 不可逆提示），确认后才发请求；
   - 退群 / 解散成功后**立即关闭该会话**并刷新列表（不能留在详情里对着一个已失效的群继续发消息）；
   - 邀请 / 移除成功后成员名单与人数**用响应即时刷新**（不补一次 GET，也避免「写完之后读到的还是旧值」）；
   - 成员行**群主那条没有「移除」按钮**（`ability.canRemoveMember` 为真时，群主正是「我自己」那一行）；
   - 错误码提示就地弹出、**不清令牌不跳登录**（1037~1041 均为**请求被拒**，会话仍然有效）。

### S16-l `@` 提及与消息保留期（2026-09-29 新增）

**S16-l-1 上行点名（含非法项）**　`POST {{baseUrl}}/v1/chat/messages`（`Bearer {{adminToken}}`）发群消息，body 带
`"mentionUserIds": ["{{userId}}", "{{adminUserId}}", "not-a-member-id", "{{userId}}"]`——故意混入**发送人自己、
非成员、重复项**。断言 `code == 0`（**不因非法项驳回整条消息**，客户端名单可能本就是旧快照），消息正常落库。

**S16-l-2 行属性与未读子集**：
- `GET {{baseUrl}}/v1/chat/messages?scope=2&targetId={{groupId}}`（`{{accessToken}}`）→ 断言该条 `mentioned == true`；
- 同端点换 `{{adminToken}}` → 断言**发送人视角** `mentioned == false`（`mentioned` 是**行属性**而非消息级属性）；
- `GET {{baseUrl}}/v1/chat/conversations`（`{{accessToken}}`）→ 断言 `mentionUnreadCount >= 1` 且
  **`mentionUnreadCount <= unreadCount`**（子集关系，两个数**不能相加**）；摘要前缀出现「[有人@我]」。

**S16-l-3 剔除口径**：`not-a-member-id` / 发送人自己 / 重复 id **不得**产生额外订阅行或额外未读——
DB 断言该 `clientMsgId` 下 `mentioned = 1` 的行数**恰好为 1**。

**S16-l-4 保留期下限硬钳制**：把 `anttransfer.collaboration.notify.message-retention-days` 配成 `7` → 重启后断言
**实际仍按 30 天清理**（`NotifyProperties.MIN_MESSAGE_RETENTION_DAYS` 硬钳制），且**配置回显仍是 7**（不静默改写管理员填的值）；
等一个 cron 周期后 DB 中超过 30 天的会话消息被**物理删除**（非软删），且 `at:chat:retention-lock` 在周期内只被一个实例持有。

### S17 授权到期回收

**先理解机制（这条能否「秒级验证」取决于此）**

| 侧 | 行为 |
| --- | --- |
| 鉴权读取侧 | **实时过滤**已过期授权（`GET /v1/permission/map` 明确为「实时过滤已过期授权」） |
| 状态侧 | 定时任务把 `status=1 AND expire_at<=now` 的授权 **CAS 置 `status=2`** 并记 `revoke_at`，事务提交后逐条发 `PermissionExpiredEvent`；单批 100 条、幂等可重入 |

**执行步骤**

1. S11 的 `expireAt` 已设为 1 分钟后。
2. 让回收在秒级发生（二选一，联调后务必改回）：

   ```bash
   # 启动参数方式（不落盘）
   java -jar at-bootstrap.jar --anttransfer.permission.expire-scan-cron="0/20 * * * * ?"
   # 或临时覆盖 application-dev.yml 的同名配置项
   ```

3. **DB 断言**：

   ```sql
   SELECT status, revoke_at FROM sys_user_file_permission
   WHERE user_id = <userId> AND resource_id = <nodeId>;
   -- 期望：status = 2（到期回收终态），revoke_at 非空
   ```

4. **接口断言**：`GET {{baseUrl}}/v1/permission/map`（`Bearer {{accessToken}}`）→ 该资源**不再出现**（实时过滤，不必等定时任务）。
5. **业务断言**：再次 `POST {{baseUrl}}/v1/files/{{nodeId}}/ticket` → 断言 **HTTP `403` + `code == 1003`**
   （无权限，策略 D：就地提示、**禁止引导登录**）。
6. **幂等断言**：手动再触发一轮（或等下一周期）→ 断言不产生第二条回收记录、`revoke_at` 不被改写。

> ⚠️ 若第 5 步换票仍成功，说明鉴权路径依赖「定时任务已落库」而非实时过滤，
> 则以第 3 步 DB 断言 + 等待一个完整 cron 周期为准，并把该差异记为本条结论（见 §5 待确认项）。

---

## 3️⃣ 变量传递总表（一条链串起来）

| 变量 | 产生于 | 被使用于 |
| --- | --- | --- |
| `adminToken` | S01 登录后置脚本 | S02 建号、S11 审批、S16-a 发消息 |
| `adminUserId` | S01 `data.user.id` | S16-a/C 会话历史 `targetId` |
| `userId` | S02 列表反查 | S10 `applicantId` 校验、S16-a `targetId`、S16-i 受邀成员、S17 DB 断言 |
| `groupId` | S16-i 建群 `data.id` | S16-i 群消息 `targetId`、DB 断言、`/chat/groups` 核对 |
| `accessToken` / `refreshToken` | S03 登录后置脚本 | S04–S06、S10、S12-a、S16-c/e/f、S17 全部用户态请求 |
| `uploadId` | S04 `data.uploadId`（4001 分支） | S05 `GET /parts`、S06 `PUT /parts/{index}`、S08 `merge` |
| `chunkSize` / `chunkCount` | S04（或 S05 复核） | S06 切片循环、S08 `merge` 请求体 |
| `fileId` | S08 `data.fileId`（或 S09） | S13 `POST /v1/shares` 的 `fileId`、S15 校验 |
| `nodeId` | S08 反查 / S09 `data.nodeId` | S10 `resourceId`、S12-a 换票、S17 回收断言 |
| `applicationId` | S10 `data.id` | S11 approve 路径变量 |
| `ticket`（下载票据） | S12-a `data.ticket` | S12-b/c `GET /content?ticket=` |
| `shareToken` | S13 `data.token` | S14 verify 路径、S15c 详情查询 |
| `shareTicket` | S14 `data.ticket` | S15 redeem 请求体、S15b 一次性验证 |

**传递方式**：全部经 Apifox 环境变量（`pm.environment.set` / `{{var}}`），不跨用例手工复制粘贴。
值为 ID 的一律 **`String(x)` 存储**，避免 JS 精度丢失。

---

## 4️⃣ 推荐补充的负例（契约回归，1 分钟/条）

| 编号 | 场景 | 请求 | 期望 |
| --- | --- | --- | --- |
| N1 | 未携带令牌 | `GET /v1/auth/me` 无 `Authorization` | HTTP `401` + `code=1001` |
| N2 | 令牌无效 | 同上，`Bearer garbage` | HTTP `401` + `code=1006` |
| N3 | 越权（写接口） | `zhangsan` 调 `POST /v1/smoke/perm/write`（需 `file:destroy`） | HTTP `403` + `code=1003`，**不引导登录** |
| N4 | 提取码错误 | S14 body 改 `{"extractCode":"000000"}` | `4010`；连续错误超阈值转 `4011` 锁定 |
| N5 | 缺片合并 | 同 S07 | `code=4002` + `data.missing` 非空 |
| N6 | refresh 二次使用 | 同一 `refreshToken` 连发两次 `POST /v1/auth/token/refresh` | 第二次 `code=1006`，且该用户全部会话被吊销 |
| N7 | 分享次数耗尽 | S15 核销到 `remainingCount=0` 后再换票 | 非 0 次数类错误码，不再下发票据 |
| N8 | 分享参数超限 | S13 传 `downloadLimit: 100000` | `2005`（参数超限，非静默裁剪） |
| N9 | 必填缺失 | S04 去掉 `sha256` | HTTP `400` + `2xxx` 参数错误 |
| N10 | 重复申请（B 类分支） | 重发 S10 | `1008`（已有生效授权）或 `1009`（已有在审申请） |

> N3 的价值最高：`1003` 的前端红线是**策略 D（就地提示、禁止引导登录）**，
> 用冒烟探针端点可以在不污染业务数据的前提下把这条红线钉住。

---

## 5️⃣ 待确认项（联调首轮执行后回填结论）

| # | 事项 | 影响 | 处理建议 |
| --- | --- | --- | --- |
| 1 | `downloadUrl` 是否自带 `/api` 前缀 | S12-b 拼接叠加会变成 `/api/api/...` | 首轮执行时确认一次，然后固化到 Collection 变量 |
| 2 | `merge` 只回 `fileId`、不回 `nodeId` | S08 需补一次列表反查，链路多一步且依赖排序稳定 | 建议 `MergeResultVO` **非破坏性**补 `nodeId`（新增字段，不破坏既有契约） |
| 3 | `POST /v1/files/{id}/ticket` 的 `{id}` 语义 | 若是 `nodeId` 则链路自洽；若是 `fileId` 则 S12 改用 `fileId` | 依 `DownloadTicketVO.nodeId` 判断为 nodeId，首轮确认后固定 |
| 4 | 鉴权路径是否**实时过滤**过期授权 | 决定 S17 能否秒级验证，或必须等一个 cron 周期 | 按 S17 第 5 步结果回填；差异需记入结论 |
| 5 | `GET /v1/files` 列表项的文件名字段、`GET /v1/system/users` 的 `username` 字段 | S02 / S08 反查脚本字段名 | 以实际响应修正脚本，勿凭猜测写死 |
| 6 | `GET /v1/permission/menus`（api/README §1 与 architecture D-9 记载） | 该端点在全仓库 `*.java` 中**检索不到实现**，动态菜单尚未落地 | 冒烟用例集不纳入；前端菜单联调前须先落地该端点，或明确改由权限地图派生菜单 |
| 7 | `Long` 型 ID 以字符串传是否被正常接收 | S10 `resourceId`、S13 `fileId` | 首轮验证；若不接受则改用「缩小 ID 的测试数据」或改由前端代理 |

---

## 6️⃣ 维护约定

1. **OpenAPI 变更后**：重新导出并「智能合并」导入 Apifox，务必保留 Apifox 侧修改，
   否则手写的断言脚本、环境变量引用与目录拆分会被覆盖。
2. **新增/删除端点**：同步更新本文件 §2 的用例与 §3 的变量传递表。
3. **分支码语义变更**（如 `4001` / `4002` 的 `data` 载荷调整）：
   必须同步 §1.5 红线、§2 对应断言，以及 [错误码全表](../api/error-codes.md)。
4. **本文件定位**：Step 1 只解决「文档集合可用 + 主链可跑通 + 断言口径统一」；
   后续第 2 步（权限矩阵 / 并发与弱网 / 性能基线）另立文件，不要在本文件里堆叠。

