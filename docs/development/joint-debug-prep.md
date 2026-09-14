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
> 2. **dev 才放行文档路径**：`/v3/api-docs/**`、`/swagger-ui/**` 在 `anttransfer.auth.permit-all` 白名单中；
>    这是**放行访问路径**而非「接口免鉴权」，业务接口一律仍要 `Authorization`。

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
| `shareToken` / `shareTicket` | （空） | 外发链接与访客票据 |

**公共请求头**：根目录级设 `Authorization: Bearer {{accessToken}}`；以下端点需单独覆盖为「无需认证」：

- `POST /v1/auth/token`、`POST /v1/auth/token/refresh`（免登录）
- `POST /v1/shares/{token}/verify`、`POST /v1/shares/redeem`（访客通道）
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

### S15 访客核销取件（票据取用即焚）

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
| body | **响应中不含存储路径 / 对象键**（访客免登录，暴露存储位置等于给出绕过票据直连存储的可能） |

**S15b 一次性验证**：**原样重发**同一 `shareTicket` → 断言返回票据失效类错误码（非 0）。
**S15c 计数验证**：`GET {{baseUrl}}/v1/shares/{{shareToken}}` → `downloadedCount` 由 0 变 1、`remainingCount` 由 3 变 2。

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
- 帧信封统一 `{"type":"...","data":{...},"ts":1789000000000}`；下行 `type`：`CONNECTED / NOTIFY / CHAT / UNREAD / PONG`
- 心跳：服务端每 30s 下行 `PING`，客户端**必须回 `PING`**；90s 无任何上行帧即判定掉线并清理（关闭码 `4002`）
- 鉴权只在握手做一次：**登出 / 令牌过期不会断开已建连接**，客户端应在登出时主动关闭
- Apifox 的 WebSocket 断言能力弱，建议手工核对或用浏览器控制台执行

**S16-e 离线补拉**：关闭 WS → admin 再发一条 → `GET {{baseUrl}}/v1/notifications/offline?limit=50`（`Bearer {{accessToken}}`）→ 断言能补到该条。
**S16-f 未读快照**：`GET {{baseUrl}}/v1/notifications/unread` → 断言返回三口径未读结构（导航栏红点 / 待办角标 / 会话角标）。

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
| `userId` | S02 列表反查 | S10 `applicantId` 校验、S16-a `targetId`、S17 DB 断言 |
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

