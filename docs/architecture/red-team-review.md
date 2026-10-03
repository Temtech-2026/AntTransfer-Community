# 🛡️ AntTransfer CE 红队评审报告（设计期 · 越权 / 并发 / 事务边界 / 空指针与边界值 / 契约）

| 项 | 内容 |
| --- | --- |
| 评审类型 | 设计期红队（Red Team）——对**已落地代码 + 设计基线 + DDL** 做对抗性审查 |
| 评审主题 | 越权（对象级/垂直越权、鉴权漏洞面）· 并发（竞态、幂等、锁）· 事务边界（事务失效、长事务、一致性）· **空指针与边界值** · **PRD / API 契约漏审** |
| 版本 / 日期 | v1.0 · 2026-09-06 · **v1.1 增补 2026-09-13**（新增「空指针与边界值」主题 E、「PRD / API 契约漏审」主题 F、四列速览表） |
| 对象 | `server/` 8 模块（骨架代码）、`sql/`（V1__schema.sql + V2__init_data.sql；原 V3 已于 2026-09-06 并入 V1）、`docs/prd/README.md`、`docs/architecture/*`、`docs/api/*`、`web/src`（模板） |
| 配套 | 修复方向已同步进 [system-design.md](./system-design.md)；两文档编号互通 |

> 评审方法说明：本系统处于“架构/设计基线已定稿、Controller-Service 尚未实现”的阶段，
> 因此发现分为两类：**已存在缺陷**（代码/DDL/文档可证）与 **To-Be 设计缺陷**
> （将在实现时必然产生漏洞或错误的基线口径）。后者同样按缺陷处理并给出红线。

> 发现编号体系：`V-*` = 越权，`C-*` = 并发，`T-*` = 事务边界，`D-*` = 其他安全顺带，
> `N-*` = 空指针 / 缺省值，`B-*` = 边界值，`PRD-*` = 需求契约漏审，`API-*` = 接口契约漏审；
> 编号与 [system-design](./system-design.md) 正文引用互通（如 `[T-01]`、`[C-01]`），两文档须同步维护。
>
> **v1.1 补充**：应落地清单要求，全文按「**问题描述 / 风险等级（高/中/低） / 触发条件 / 修改建议**」
> 四列输出速览（见下节）；八维度中此前缺失的「**空指针与边界值**」补为主题 E，
> PRD / api-spec 的条目级漏审补为主题 F。

> **口径提示（2026-09-06 二次重置）**：下述各 [T-xx] / [V-xx] / [C-xx] 提出时点，`sql/V1__schema.sql`
> 尚为旧表族命名（`user` / `permission_grant` / `file_object` / `transfer_record` / `transfer_part` /
> `share` 等，逻辑删除列 `is_delete`）。V1 当日二次重置为 `sys_` 前缀 16 表四族
> （`sys_user` / `sys_dept` / `sys_role` / `sys_permission` / `sys_approval_request` /
> `sys_user_file_permission` / `sys_file` / `sys_upload_task` / `sys_share_link` …，`deleted`，
> 完整演进见 `sql/V1__schema.sql` 文件头）。正文表名保留审查时点命名，处置状态以各条「处置」为准。

## 📊 严重度定义

| 级别 | 含义 | 发布门槛 |
| --- | --- | --- |
| **S0** | 阻断（必然造成数据损坏 / 权限击穿 / 架构返工） | 必须修复后才能进入对应功能开发 |
| **S1** | 高（大概率被利用的越权或并发问题） | 相关 P0 功能发布前必须修复 |
| **S2** | 中（边界条件触发，或运维/合规风险） | 1.0 发布前处理或显式接受风险 |
| **S3** | 低 / 备忘 / 文档勘误 | 随手处理 |

> **风险等级换算**（v1.1 四列表用）：**高** = S0 / S1 · **中** = S2 · **低** = S3。原有 S* 级别保留在详细章节，两套口径一一对应。

## 🧾 发现速览（四列视图）

> 本表为**全量发现的速查入口**，四列即需求口径：**问题描述 / 风险等级 / 触发条件 / 修改建议**。
> 逐条证据、位置与处置状态见下方对应主题的详细章节。

### 速览 A · 越权（V-*）

| 问题描述 | 风险等级 | 触发条件 | 修改建议 |
| --- | --- | --- | --- |
| `[V-01]` 对象级（行级）鉴权无统一机制，按 ID 访问接口天然水平越权 | **高** | 任意登录用户在拥有 `file:download` 等权限点时，遍历 `files/{id}/content`、`transfers/{id}/parts`、`applications/{id}`、`shares/{id}` | 统一 `AccessControlService` 做资源级判定；所有按 ID 访问先校验「当前用户是 Owner/成员/被授权人」；评审门禁禁止「先 `selectById` 再业务」 |
| `[V-02]` 数据范围「本人-本部门-全部」无模型支撑 | **高** | 实现 PRD US-04 三维度时，表上无 `department` / `user.department_id` / `role.data_scope` | 已关闭：随 `sql/V1__schema.sql` 落 `department`（ancestors 物化路径）/`user.department_id`/`role.data_scope`；列表数据范围由权限切面统一拼装 |
| `[V-03]` 审批人身份若信任请求参数，可自审自批 / 扮演审批人 / 任意转审 | **高** | 构造 `PATCH applications/{id}` 携带 `approverId` / `reassignTo` | 审批接口**不接受审批人参数**；`approver_id` 服务端从登录态推导并 CAS（`WHERE id=? AND status=0 AND approver_id=<当前人>`）；转审目标须非申请人且对该资源有审批权；禁自批并记审计 |
| `[V-04]` 敏感级别无数据落点，「高级资源默认拦截」无法实现 → 默认放行 | **高** | 判定逻辑退化为「查不到授权就按普通 RBAC 放行」 | 文件级已落 `sys_file.level` / `space_id`；`space.level` 随 at-collaboration 待建；等级解析「显式文件级 > 继承空间级 > 低」全部收敛 `AccessControlService` |
| `[V-05]` 三权分立互斥只有产品话术，无数据层约束 | **高** | 批量导入 / 管理接口 / 并发绕过 UI 校验，使同一账号同时具 `system_admin` + `security_admin` | 服务层角色变更事务内校验互斥组；数据层以互斥组常量 + `user_role` 唯一约束兜底；部分关闭，随 at-permission 落地 |
| `[V-06]` 鉴权默认「裸奔」，注解漏标即放行 | **高** | 新增 Controller 忘记标 `@RequireLogin` / `@RequiresPerm` | 鉴权拦截器对 `/api/**` **默认 DENY** + 集中单一白名单文件；免登录端点须走白名单变更评审 |
| `[V-07]` 外发分享创建不校验源文件权限 → 任意文件可外传、分享可被他人撤销 | **高** | 普通用户对**无权下载**的文件 `POST /api/v1/shares`；或他人凭 `shareId` 撤销分享 | 创建分享前对源文件执行与「下载」等价的 AccessControl；token 用高熵不透明随机串；撤销/查询/重置提取码强制校验 `share.owner_user_id` 或安全管理员；下载通道不回显存储信息 |
| `[V-08]` 前端令牌存储未定，localStorage 存 access token = XSS 即会话劫持 | **中** | 文件名 / 分享链接参数回显富文本触发 XSS | access token 存内存（刷新恢复）或短时效 httpOnly cookie；refresh 走 httpOnly + Secure + SameSite（配 CSRF）；CSP 收敛 + 回显一律编码 |

### 速览 B · 并发（C-*）

| 问题描述 | 风险等级 | 触发条件 | 修改建议 |
| --- | --- | --- | --- |
| `[C-01]` 权限申请冲突判重非原子 | **高** | 双击 / 双标签并发提交同一申请 | 增加活动态单飞列 `dedupe_key`（终态置 NULL）并建唯一索引，插入走 `INSERT ... ON DUPLICATE KEY` 感知 1009；Redis `SETNX(at:apply:{uid}:{res})` 前置判重，DB 唯一约束仍为最终防线 |
| `[C-02]` 审批「通过/驳回/转审/撤销」并发 → 重复审批、状态漂移、重复授权 | **高** | 当前审批人与转审后审批人（或兜底安全管理员、超管）同时操作同一单 | 所有审批动作 CAS：`UPDATE ... SET status=<目标> WHERE id=? AND status=0 AND approver_id=<当前人>`；影响行数≠1 ⇒ 抛 4102 并提示刷新；事件按去重键只发一次 |
| `[C-03]` 授权到期回收与在途下载的语义未定义 | **高** | 大文件下载过程中授权恰好到期 | 明确「**授权校验只在入口做一次，在途下载/上传不因到期中断**」并写入 use-case-flows 与测试用例；回收只改 DB 状态，不断流 |
| `[C-04]` 到期回收定时任务多副本重入 / 重复通知 | **中** | 多实例并行扫描同一批到期授权 | 回收批处理用一条原子 UPDATE + 影响行数再发事件；多副本前引入调度锁（ShedLock 或 `SELECT ... FOR UPDATE` 游标）；事件带 `application_id` 幂等键，监听侧去重 |
| `[C-05]` refresh 轮换与重放检测易被低估，退化成「永远有效的登录」 | **高** | RT 仅做无状态签名校验、无服务端状态 | RT 落 Redis 白名单（`at:token:refresh:{userId}`）+ Lua 原子轮换（`GETDEL` 比对后 `SET` 新值）；检测复用旧值 ⇒ `sys_user.token_epoch + 1` 并失效 AT/RT，强制重登 |
| `[C-06]` 传输状态迁移与分片进度更新存在读-改-写与并发累加 | **高** | 「开始/暂停/取消/合并」与「分片到达」并发；≤5 分片并发累加进度 | 全部迁移 CAS（行数≠1 ⇒ 4102）；状态机补 `6 合并中`；进度由 `uploaded_indexes` 去重派生或 `transferred_size = transferred_size + ?` 原子累加，禁止读改写 |
| `[C-07]` 秒传 / 合并的并发去重缺失 | **高** | 两个会话同时上传同一 SHA-256 文件 | 以 `sys_file` 的 `uk_sha256_size (sha256, size_bytes)` 为物理唯一键；merge 落库走 `INSERT ... ON DUPLICATE KEY UPDATE ref_count=ref_count+1`，或捕获唯一键冲突后复用既有 `file_id`，**禁止「先查后插」**；多余物理副本进孤儿清理 |
| `[C-08]` 外发下载次数非原子扣减会超卖；提取码错误计数非原子会漏锁 | **高** | 第 10/11 次并发下载；并发提交错误提取码 | 次数用单条原子 `UPDATE ... SET downloaded_count=downloaded_count+1 WHERE id=? AND downloaded_count<download_limit`（行数=1 才发流）；错误计数用 Redis `INCR`+`EXPIRE` 滑动窗口（不落库）；`download_limit` / `downloaded_count` 已在 DDL，扣减达上限时同步置 `status=2`（已失效） |
| `[C-09]` 取消 / 暂停与分片写入并发 | **中** | 分片校验通过、状态检查通过后、写盘前用户取消 | 分片写入后复核任务非终态（终态则丢弃 + 标孤儿）；merge 只认 `uploaded_indexes` 与任务状态双一致；孤儿分片由清理任务按任务创建时间回收 |
| `[C-10]` 上传并发上限（≤5/任务、活动任务 ≤50）无实现载体 | **中** | 单用户开启上百连接并发传分片 | at-transfer 入口 Redis 计数 / 本地令牌桶，超限抛 4103（429）；多实例计数放 Redis，单实例可本地实现并预留切换 |

### 速览 C · 事务边界（T-*）

| 问题描述 | 风险等级 | 触发条件 | 修改建议 |
| --- | --- | --- | --- |
| `[T-01]` 跨模块写编排没有事务载体（上传主线「写 `sys_file` + 改 `sys_upload_task`」与依赖铁律冲突） | **高** | at-transfer 需同时写 at-file 的表，却禁止跨模块依赖 | 采用 **SPI 依赖倒置**：接口定义在 `at-common.spi`，at-file 实现；at-transfer 编排 Service 注入接口并在**同一 `@Transactional`** 内完成双表写入。门禁：跨模块写必须出现在编排者的一个事务内，禁止「先提交再发事件补写」 |
| `[T-02]` 审批时序自相矛盾：「事件后写授权表」与「授权不留空档」不可能同真 | **高** | 审批事务提交成功后监听方写 `sys_user_file_permission` 失败，或监听重试重复执行 | `application.status=1` 与授权插入**必须在同一审批事务内**；`PermissionGrantEvent` 仅在 `AFTER_COMMIT` 发布且负载只承载通知/审计；同步修订 [use-case-flows §2.3](./use-case-flows.md) 步骤 6/7 |
| `[T-03]` 文件合并/重组（GB 级 IO）不得放进 DB 事务 | **高** | merge 服务整体 `@Transactional`，10 GiB 重组 + 重算 SHA-256 期间持连接与行锁数分钟 | 事务只包「状态迁移 + 元数据落库」短操作；IO 放事务外，先 CAS 进 `6 合并中` 占位，完成后一条短事务置 `3 已完成` 并落 `sys_file`；失败回 `4 失败` 可重试。门禁：`@Transactional` 方法体内禁止文件流与远程调用 |
| `[T-04]` 存储介质与 DB 元数据无法同原子，孤儿文件/分片与秒传副本需补偿回收 | **中** | 分片写盘成功但任务/part 落库失败；merge 落库失败但整件已在磁盘；秒传冲突产生多余副本 | 按「创建时间 + 无活跃任务」两条件清理；对象存储键设计为 `uploads/{yyyy}/{mm}/{taskId}/...` 便于前缀扫描；删除前复核 `sys_upload_task` / `sys_file` 引用，防删在用 |
| `[T-05]` 审计写入的事务边界与「不可篡改、留存 ≥6 个月」实现路径缺失 | **高** | 审计与业务同事务 ⇒ 审计失败回滚业务；不同事务 ⇒ 业务成功但审计丢失 | 审计走 `AFTER_COMMIT` 异步 + 落库失败重试/告警（补偿队列）；审计表对应用只暴露 insert/select，DB 账号无 DML 权限；归档 = 导出 + 受限账号物理删除；`AuditSink` 作为 SPI 预留 |
| `[T-06]` `AFTER_COMMIT` 事件投递无可靠性保障，必达类通知会丢 | **中** | 事务提交后进程崩溃，事件未处理 | 通知/待办落 `sys_notify_message`（或 outbox）并在**业务事务内**一并写入；事件仅触发异步推送/邮件；多端已读用 CAS 同步 |
| `[T-07]` `user` 表遗留自增主键与 camelCase，与新规约冲突且 ID 可枚举 | **中** | at-auth 用 MP + `BaseEntity` 写自增表；或登录/注册接口泄露自增用户 ID | 已关闭：`sys_user` 为雪花主键 + snake_case + `deleted`；脚手架 `post*` 表已从 V1 移除 |
| `[T-08]` 时间写入者与时钟口径未统一（`update_time` 双写方 + 过期判定跨时钟源） | **中** | 容器时区/主机时区错配或 DST，`expire_at` 应用生成 vs DB `now()` 比较漂移 | 统一「DB 权威时钟」：审计时间戳 `DEFAULT CURRENT_TIMESTAMP` 与 `on update` **二选一**；到期比较一律 SQL 侧 `expire_at <= NOW()`，应用只传阈值 |
| `[T-09]` 事务内禁止远程调用 / Redis 关键写未成文，双写顺序不明 | **中** | 对象存储 PUT / Redis 操作放进 DB 事务 ⇒ 事务回滚但远端已生效；或 DB 提交成功但 Redis 写失败 | 事务内只允许 DB 访问；Redis 写入放事务后或做成可容忍丢失的加速缓存；强一致双写（令牌吊销）明确「先 DB 后 Redis + 补偿清理」或「以 DB 为准、Redis 丢失自愈」 |

### 速览 D · 其他安全顺带（D-*）

| 问题描述 | 风险等级 | 触发条件 | 修改建议 |
| --- | --- | --- | --- |
| `[D-01]` CORS 全放开 + `allowCredentials(true)` 是越权放大器 | **中** | 任意站点带凭证跨域读取本服务响应（登录态走 Cookie 时即 CSRF/跨域读取） | prod 从配置读 `cors.allowed-origins`；凭 Cookie 场景优先同源反代；需跨域时显式白名单，不匹配的 Origin 一律不返回 CORS 头 |
| `[D-02]` `X-Trace-Id` 入站未清洗 → MDC/日志注入与审计关联污染 | **中** | 客户端携带含换行/控制字符/超长字符串的 traceId | 入站 traceId 白名单校验 `[A-Za-z0-9-]{1,64}`；不合法即忽略并重生成（不拒绝请求） |
| `[D-03]` 登录防爆破 / 账号锁定 / 限流只有错误码，无机制 | **高** | 密码喷洒、密码暴力破解、提取码枚举 | 登录/refresh 做 IP + 账号维度 Redis 计数（如 5 次/分钟临时禁 + 阈值后账号锁定）；与 [C-08]/[C-10] 共用同一 Redis 原子计数限流工具 |
| `[D-04]` 初始凭据与散列策略未定：`root/123456` 默认值 | **低** | 复制默认配置直接上线 | 密码一律 BCrypt（cost≥10）；提供 `.env.example` 强制占位并在 prod 文档置顶「修改默认口令」；外网部署强制反代 TLS |
| `[D-05]` 文档勘误：`ResultUtils` 不存在、时序文档待修订 | **低** | 开发者按文档引用不存在的工具类 | 随 [T-02] 修订一并更新 `architecture/README` 与 `development/README` 引用 |
| `[D-06]` 文档勘误（v1.1 新增）：`AT-DIFF-todos.md` AT-DIFF-04 验收行错误码陈旧 | **低** | 按该行做回归验收时，`403(1004)` / `401(1003)` 与 2026-09-13 的 1xxx 重编号后实际返回不符，导致误判 | 将该行更新为「AUDITOR 无权限 `403(1003)`」「refresh 复用打击 `401(1006)`」；并核对 `docs/api/error-codes.md` 附录 B 迁移表 —— ✅ **2026-09-13 已修复**：AT-DIFF-04 验收行已更新；全仓扫描另修正 `CHANGELOG.md` 4 处与 `AuthFlowIntegrationTest` 注释 1 处陈旧字面量（附录 B 第一张表为骨架期历史记录，保留不动，由紧随其后的「第二次调整」表覆盖） |

### 速览 E · 空指针与边界值（`N-*` / `B-*`，v1.1 新增）

| 问题描述 | 风险等级 | 触发条件 | 修改建议 |
| --- | --- | --- | --- |
| `[N-01]` token 解析链路空指针：claims 缺失 / 空串 Authorization 头 | **高** | 请求头形如 `Authorization: Bearer`（其后的 token 为空串），或旧版/伪造 token 缺 `ver` claim，`JwtTokenProvider` 取值后直接拆箱 | 取 claim 一律走「判空 + 缺省」分支：`ver` 缺失按 `TOKEN_INVALID(1006)` 处理；Bearer 后为空串直接判 401；禁止对 `Long`/`Integer` 装箱值直接运算 |
| `[N-02]` 异常出口空指针/信息丢失 | **中** | 抛出的异常 `getMessage()` 为 null，或 `Result` 包装 `traceId` 未填充 | `GlobalExceptionHandler` 对 `message` 做兜底（取 `ErrorCode` 默认文案）；`Result` 构造统一注入 `TraceUtils.getTraceId()`（可能为 null 时给空串） |
| `[N-03]` 空文件（`file_size = 0`）导致分片数为 0，合并判定「齐全」误通过 | **高** | 上传 0 字节文件（或 `Content-Length: 0`），`chunkCount = ceil(0/8MiB) = 0` | 上传入口拒绝 `size <= 0`（返回参数错误码）；`chunkCount` 计算用 `max(1, ceil(...))`；合并前校验「`uploaded_indexes` 去重后长度 == `chunkCount`」 |
| `[N-04]` 秒传预检参数未校验：`sha256` 格式/长度、`fileName` 路径穿越 | **高** | 传入非 64 位 hex 的 `sha256`，或 `fileName` 含 `../`、`/`、`\`、`%2e%2e` | `@Pattern(^[a-f0-9]{64}$)` 强校验 sha256 与 length/unit 配套；文件名只取 basename 并过滤路径分隔符与控制字符；存储键由服务端生成，禁止拼接客户端文件名 |
| `[N-05]` 分片 `index` 越界 / 负数 | **高** | `PUT /transfers/{id}/parts/{index}` 传 `-1`、`chunkCount` 之外或重复 index | 入口校验 `0 <= index < chunkCount`；`uploaded_indexes` 的读-改-写须与任务行 CAS 同事务（防丢更新），并评估 `varchar(8192)` 容量上限；越界返回参数错误码，重复 index 走幂等覆盖而非累加 |
| `[N-06]` 分片大小与 `Content-Length` 边界 | **中** | 最后一片 < 8 MiB、缺失 `Content-Length`、或体积远超 `chunkSize` | 显式传入 part size 并由服务端核对（非最后一片必须等于 `chunkSize`，最后一片 `0 < size <= chunkSize`）；缺失长度直接拒绝；累计超 `file_size` 拒绝 |
| `[N-07]` 分享字段的空值与越界：提取码空串 / 超长、`download_limit` 越界、`expire_at` 缺省 | **中** | 提交空串或超长提取码（表为 `extract_code_hash NOT NULL`，BCrypt 散列）；`download_limit` 传 0 / 负数 / 极大值；不传 `expire_at`（表为 NOT NULL） | 提取码入口强校验「≥6 位字母数字」并在落库前 BCrypt，空串直接拒绝；`download_limit` 默认 10、`<= 0` 或超上限拒绝；`expire_at` 缺省由服务端补「创建后 7 天」；下载扣减按 [C-08] 原子 UPDATE |
| `[N-08]` 审批「期望到期时间」为 null / 过去 / 超上限（`sys_user_file_permission.expire_at` 可空，`null` = 长期有效） | **中** | 请求体不带 `desiredExpireAt`，或传入过去时间、超最长授权期 | 明确 `null` 语义为「长期有效」而非「立即过期」，并按策略兜底默认有效期；过去时间拒绝（列注释要求 `expire_at > create_time`）；超上限截断或拒绝；判定统一 SQL 侧 `expire_at <= NOW()` |
| `[N-09]` 组织树 `ancestors` 为 null（根部门）导致子树匹配失效 | **中** | 根部门 `ancestors` 为空/null 时按 `LIKE` 匹配子树 | 建表设 `ancestors NOT NULL DEFAULT ''`；根部门用 `''` 而非 NULL；数据范围判定统一 `ancestors LIKE 'x,%' OR id = x`（含自身） |
| `[N-10]` 分页参数越界 | **中** | `pageNum <= 0`、`pageSize` 超大或非数字 | 统一分页参数校验：`pageNum >= 1`、`1 <= pageSize <= 100`，越界回退默认值而非放行（防全表扫描） |
| `[N-11]` Redis 缓存值反序列化 null | **中** | `at:perm:{userId}` 命中空值/空 JSON，或 `at:token:access` 被 DEL 后回源得到 null | 缓存读取统一「null 即视为未命中 → 回源 DB 并回填」；空集合缓存空对象（非裸 null）避免穿透；禁止把 null 写入缓存 |
| `[B-01]` 时间边界判定 | **中** | `expire_at == now` 的瞬间，或 DST 切换 | 统一闭开区间语义并成文（如「有效 = `expire_at > NOW()`」）；全部比较走 DB 时区，禁止应用侧时间参与判定 |
| `[B-02]` 分享次数末次边界与状态联动 | **高** | `downloaded_count == download_limit - 1` 时并发下载；`download_limit` 传 0 / 负数 | 原子 `UPDATE ... SET downloaded_count=downloaded_count+1 WHERE id=? AND downloaded_count < download_limit`（行数=1 才发流）；`<= 0` 在创建时即拒绝；扣减成功且达上限时同步置 `status=2`（已失效），避免「次数用尽仍可下载」 |
| `[B-03]` 进度累加越界（`transferred_size > file_size`） | **中** | 分片重传/重复 PUT 导致累计叠加，进度 > 100% | 进度按 `uploaded_indexes` 去重派生，或原子累加时加 `AND transferred_size + ? <= file_size` 条件；超出即告警并按实际值修正 |
| `[B-04]` 文件名/路径超 DB 列宽 | **中** | 文件名超过 `sys_file.file_name` 列长（或全路径超长） | 入口限制长度（与列宽一致，含 UTF-8 MB4 按字符计），超长返回参数错误码而非截断后写库；写库异常不得裸抛 500 |
| `[B-05]` 枚举值越界（`level` / `data_scope` / `status` 非定义值） | **高** | 请求体传 `level=0`/`level=9`、`data_scope=4` 等非法枚举 | 反序列化用枚举 + `@Valid` 强校验，非法值直接 400；业务判定禁止 `else` 兜底默认放行，必须 `switch` 默认分支抛错 |
| `[B-06]` 数值类型与上限溢出 | **中** | `chunkCount` 用 `int`、`size_bytes` 用 `int`；接近 10 GiB 上限时溢出 | 容量/大小/计数一律 `long`；`chunkCount` 用 `int` 但需满足 `chunkCount <= Integer.MAX_VALUE`（10 GiB/8 MiB ≈ 1280，安全）；上限值集中定义常量并在入口校验 |
| `[B-07]` 编码边界：中文 / emoji 文件名、提取码大小写与全角 | **低** | 文件名含 emoji（MB4）、URL 编码往返；提取码输入含前后空格/全角字母 | 库表字符集 `utf8mb4`；文件名走 URL 编码往返测试；提取码规范化（trim + 统一大小写或明确区分）+ 长度/字符集校验 |

### 速览 F · PRD 与 API 契约漏审（`PRD-*` / `API-*`，v1.1 新增）

| 问题描述 | 风险等级 | 触发条件 | 修改建议 |
| --- | --- | --- | --- |
| `[PRD-01]` 指标口径漂移：账号停用后的失效时延在 PRD 与 system-design 两处不一致 | **中** | 按 PRD 的保守时延写验收，而实现按 `token_epoch` 权威模型即时失效 | 确认后单向对齐：建议保留 PRD 作为**上界承诺**（≤2 min），在 system-design 注明实际为即时失效；避免两份文档各写一套 |
| `[PRD-02]` US-05 表述暗示「发布事件后再写授权记录」，与 [T-02] 修订后的口径冲突 | **高** | 开发者照 PRD 字面实现，把授权写表放到事件监听里 | 修订 US-05 验收文字为「**授权写入与审批状态变更在同一事务内**，事件仅承载通知/审计」 |
| `[PRD-03]` 状态枚举命名与状态码未定义映射（PRD 用英文态名，设计用 0~6 数字码） | **中** | 前后端各自定义态名，出现 `PAUSED` vs `status=2` 双写 | 补「状态码 ↔ 枚举名 ↔ 文案」单一映射表（上传 0~6、申请 0~4、授权 1~3），前后端共用 |
| `[PRD-04]` 秒传性能指标（P95 < 5s / 1 GiB）无索引与查询计划门禁 | **中** | 秒传查询未命中 `(sha256,size_bytes)` 唯一索引 → 全表扫描 | 明确该唯一索引为性能前置条件，并加 `EXPLAIN` 评审门禁（禁止 `type=ALL`） |
| `[PRD-05]` 工作台性能指标（P95 < 1s）无聚合数据源设计 | **中** | 统计口径直接 `count(*)` 多表扫描 | ~~落统计聚合表或 Redis 计数器，明确数据来源与刷新频率；指标与实现方案一并写入验收~~ ✅ **2026-09-29 已收口（含口径修正）**：数据源 = 共享内核审计账本 `sys_operation_log`（append-only），`TransferStatisticsMapper#aggregateUserTransfer` **单表**按 `(action, result)` 分组求和——**不存在「多表扫描」**；聚合结果最多 4 行、与流水条数无关，过滤走 `idx_user_time (user_id, log_time)` 收敛到单人区间。「另立统计表 / Redis 计数器」**明确不采纳**：账本与业务动作同源，再造一张表只能靠双写维持一致，而双写必然漂移（取舍见 Mapper 类注）。刷新频率为**实时查询**（非预聚合、无缓存层），P95 < 1s 由「单人区间 + ≤ 4 组结果 + 表按 `log_time` 归档」保证。消费点与证据：`GET /v1/transfers/statistics` + `TransferStatisticsServiceTest` 5 例 + `TransferStatisticsIntegrationTest` 3 例 |
| `[PRD-06]` 打包/批量上限（如 200 个 / 20 GiB）无配额服务载体 | **中** | 超限请求无统一拦截点 | 落配额校验服务 + 明确错误码（409x 段）；入口统一校验，避免各接口自行判断 |
| `[PRD-07]` US-08「通知必达」与 [T-06] 的 `AFTER_COMMIT` 丢失风险冲突 | **中** | 审批提交后进程崩溃，通知事件丢失 | 通知落 `sys_notify_message` 表并**与业务同事务**写入；事件只负责异步推送/邮件，失败可重试。📌 **2026-09-29 新增的三类通知沿用该口径**：传输完成（`8`，`TransferEventPublisher` 提交后发布，发布失败只留痕、不影响已落库结果）、取件回执（`9`）、链接到期前提醒（`4`，定时任务）均属 `AFTER_COMMIT` 非关键副作用，**不反向阻塞业务事务** |
| `[PRD-08]` §8 Won't 扩展点自认「接口尚未建立」，与架构要求的可插拔接缝脱节 | **中** | EE 立项时需改已发布业务代码才能接入 | 按 [architecture.md §2](./architecture.md) 建立 SPI 契约 + CE 默认实现（Noop/单级/明文），并回写 PRD §8 命名。✅ **2026-09-29 已落地**：7 个接口建于 `at-common` 的 `com.anttransfer.common.spi`（identity / scan / crypto / watermark / approval / transport），CE 默认实现与 `@ConditionalOnMissingBean` 装配门禁同批完成，PRD §8 命名已回写（**A-6 收口 / D-2 主体收口**） |
| `[PRD-09]` US-05「文件默认继承空间级别」依赖 `space.level`，该列尚未建（[V-04] 开放） | **中** | 验收「高级资源默认拦截」时无空间级数据可继承 | 标注为依赖 at-collaboration 的前置项；在 `collaboration_space` 落地前，验收用例只覆盖文件显式 `level` |
| `[API-01]` 免登录白名单端点（分享下载）散落且缺专门防刷设计 | **高** | 外部协作者直接命中分享下载，绕过登录态限流 | 白名单集中到单一文件维护；分享下载独立限流（IP + shareId 维度）+ 强制提取码校验 + 次数原子扣减（[C-08]） |
| `[API-02]` 秒传预检「未命中」以错误码返回会被前端当失败分支 | **中** | `precheck` 返回 4001 时前端走 `catch`/错误提示 | 改为 200 + `data.needUpload=true/false`；或明确该类「非错误」码在前端策略表中归为成功分支（见 `web/src/utils/result.ts`） |
| `[API-03]` 写接口幂等键未在契约中定义，但设计红线要求幂等 | **中** | 客户端重试创建申请/分享/上传任务，产生重复资源 | 契约层定义 `Idempotency-Key` 请求头（或其等价业务键），明确服务端以唯一约束 + 返回既有资源实现幂等；与 [C-01] 的 `dedupe_key` 对齐 |
| `[API-04]` 分页参数无上界声明 | **中** | `pageSize=100000` 触发全表扫描 | 契约声明 `1 <= pageSize <= 100`，越界回退默认并提示（与 [architecture.md §1.5](./architecture.md) 一致） |
| `[API-05]` 错误码为多源：`error-codes.md` / 后端 `ErrorCode` / 前端 `STRATEGY_BY_CODE` 三处需人肉同步 | **中** | 1xxx 段重编号后前端策略表未同步 → 错误处理走错策略（如 1003 误跳登录） | 明确「后端 `ErrorCode` 为单一权威源」，前端断言（`result.ts` 单测）覆盖全部码；契约文档由枚举生成或加同步检查项 |
| `[API-06]` 分享下载未定义 Range / 断点语义，与 [C-03]「在途不中断」相关 | **低** | 外部下载器对大文件发起 `Range` 请求，或授权在下载中途到期 | 契约明确支持 `Range` 与 `206/416` 边界；与 [C-03] 共同定义「入口校验一次、在途不中断」 |

---

# 🚷 主题 A · 越权（V-*）

### [V-01] S1 — 对象级（行级）鉴权无统一机制，按 ID 访问接口将天然水平越权

- **位置**：`at-permission/RequirePermission.java`（仅 `String[] value()` 权限点串）、
  `at-auth/RequireLogin.java`；PRD US-04；[system-design §3.1](./system-design.md)
- **问题**：`@RequirePermission("file:download")` 只能表达“该用户有下载权限点”，
  无法表达“能下载 **fileId=42** 吗”。`file:download` 权限点若按 RBAC 授予全员，
  则任何登录用户可遍历 `GET /api/v1/files/{id}/content`、`transfers/{id}/parts`、
  `applications/{id}`、`shares/{id}` 访问他人资源——**典型的水平越权**。
  文档仅承诺“搜索权限收敛”，未定义文件→空间→成员的归属链校验入口。
- **建议（红线）**：见 [system-design §3.1/3.3](./system-design.md)——统一 `AccessControlService` 做资源级判定；
  所有按 ID 查询/操作先校验“当前用户是资源 Owner/成员/被授权人”。禁止出现
  “先 `selectById(fileId)` 再做业务”而无归属校验的实现；代码评审以该入口为强制门禁。

### [V-02] S1 — 数据范围“本人-本部门-全部”无模型支撑，RBAC 三维度无法落地

- **位置**：PRD US-04（“菜单/操作按钮/数据范围（本人-本部门-全部）三维度”）；
  `sql/V1__schema.sql`（`user` 表无 department 概念）；V3 仅申请/授权表
- **问题**：产品验收要求数据范围维度，但无 `department`/`user.department_id`/`role.data_scope`
  字段，也无组织树。实现时要么丢弃数据范围（违约 US-04），要么拍脑袋加列导致 V1 表反复演进。
- **建议**：V4 脚本一次性引入 `department`、`user.department_id`、`role.data_scope`
  （本人/本部门/全部枚举）；列表类查询统一由“权限切面拼数据范围条件”收敛，禁止各 Service 自行拼。
- **处置（2026-09-06）**：已关闭——`department`（ancestors 物化路径）/`user.department_id`/
  `role.data_scope` 随 `sql/V1__schema.sql` 全量重置落地；「列表查询数据范围由权限切面统一拼装」
  约束不变，实现期执行。

### [V-03] S1 — 审批人身份若信任请求参数，可“自己审批自己 / 扮演审批人 / 任意转审”

- **位置**：use-case-flows §2.3 步骤 5（通过/驳回/转审）；`permission_application.approver_id` 字段；
  `ErrorCode.REASSIGN_INVALID(1010)`
- **问题**：若审批接口以请求体携带 `approverId`/`reassignTo` 进行“更新”，
  攻击者只需构造 `PATCH applications/{id}`：① 把 `approver_id` 改成自己（或直接审批自己的申请单）
  ——**自审自批通过，临时授权即刻到手**；② 转审目标任意指定，1010 校验若只查“用户存在”
  而不查“该用户对该资源有审批权”，则把一个无权用户变成审批人。
  另外：`applicant` 同时是空间 Owner 的情况（自己申请自己的资源）需定义为非法或自动通过，需明确。
- **建议（红线）**：审批接口**不接受审批人参数**；`approver_id` 由服务端从当前登录态推导，
  且必须等于申请单当前 `approver_id`（CAS `WHERE id=? AND status=0 AND approver_id=<当前人>`）；
  转审目标须满足：不是申请人 + 是该资源合法审批人（Owner/对应安全管理员）+ 存在；
  禁止审批人等于申请人（自批）——服务端显式拒绝并记审计。

### [V-04] S1 — 敏感级别无数据落点，“高级资源默认拦截”无法实现 → 存在默认放行风险

- **位置**：`FileObject`/`CollaborationSpace` 实体与规划表均无 `level` 列；V3 仅在
  `permission_application`/`permission_grant` 上出现 `level`
- **问题**：PRD US-05 要求“文件默认继承空间级别；高级资源任何非申请通道不得预览/下载”。
  访问判定需要“资源 level”来决定是否必须命中申请授权；没有 level 数据，
  最容易的偷懒实现是“没查到授权就按普通 RBAC 放行”，恰好满足不了“默认拒绝高级资源”。
  且“文件继承空间”要求 `file_object.space_id` 可反查——该列亦缺失。
- **建议**：V4 落 `space.level`、`file_object.space_id`、`file_object.level`（可空=继承）；
  访问判定按“显式等级文件级 > 继承空间级 > 低”解析，全部收敛在 AccessControlService。
- **处置（2026-09-06）**：文件侧已解决——`sys_file.level`/`space_id` 随 V1（sys_ 二次重置）落地；
  `space.level` 与 `collaboration_space` 表族随 at-collaboration 待建（保持开放）；
  文件级「默认拒绝高级资源」判定收敛在 AccessControlService，实现期执行。

### [V-05] S1 — 三权分立互斥只有产品话术，无数据层约束，易被“顺手多勾一个角色”击穿

- **位置**：PRD US-06（“互斥规则在数据层约束”）；V3/规划无互斥承载
- **问题**：若互斥只在 UI 或 Service 一段 if 里，任何绕过（批量导入、管理接口、并发）都可能
  让同一账号同时具备 `system_admin` + `security_admin`，授权与审计闭环被同一个人闭合。
- **建议**：① 服务层：角色变更事务内校验互斥组；② 数据层：管理角色互斥写成
  “互斥组表/常量 + user_role 变更前后都校验 + 唯一约束兜底（如 `user_role(role_group_id)`）”，
  不依赖“只能一段代码校验”。
- **处置（2026-09-06）**：部分——内置角色集随 `sql/V2__init_data.sql` 定稿为
  SUPER_ADMIN / AUDITOR / DEPT_ADMIN / USER（原三权细分职能并入 SUPER_ADMIN，AUDITOR 仍只读审计、
  写操作一律被权限点拒绝）；V1 `role.built_in` 承载内置标记，但管理角色互斥的数据层约束
  仍按建议 ② 留待 at-permission 实现期落地；保持开放。

### [V-06] S1 — 鉴权默认“裸奔”，注解漏标即放行；需默认 DENY + 集中白名单

- **位置**：`RequireLogin`/`RequirePermission` 为“业务自觉标注”模式（Javadoc），
  当前**无拦截器/AOP 实现**（骨架）；api/README §5 白名单端点散落两处（auth/token、refresh、分享下载）
- **问题**：一旦业务 Controller 大量出现，任何“忘记标 `@RequireLogin`”的接口自动变公开接口
  （信息泄露/越权）。红线：把“默认必须校验”做成平台行为而不是开发纪律。
- **建议**：鉴权拦截器对 `/api/**` 默认要求登录（除集中白名单），`@RequireLogin`/`@RequirePermission`
  仅用于声明更细要求；白名单单一文件维护并加“新增端点默认非白名单”的评审提醒；
  新增免登录端点（如分享下载）必须走审批白名单变更流程。

### [V-07] S1 — 外发分享的创建与治理权限若只做“能建链接”，等于把任意文件外传

- **位置**：PRD US-03 / 用例 A；分享实体尚未建表
- **问题**：若 `POST /api/v1/shares` 只校验“登录”而不校验“发起人对源文件的访问/下载权限”，
  普通用户可为**任意文件**（含其无权下载的敏感文件）生成外发链接并发送给外部——
  权限闭环被分享通道旁路。同理，撤销/锁定查询接口若不限创建者/安全管理员，
  任何知道 shareId 的用户可撤销他人分享（DoS/篡改）。
- **建议（红线）**：创建分享前对源文件执行与“下载”等价的 AccessControl；
  分享 token 使用高熵不透明随机串（如 UUIDv4/24B+），禁止自增/可猜测；
  管理操作（撤销/查询/重置提取码）强制校验 `share.owner_user_id` 或安全管理员角色；
  下载通道不携带/不回显原文件存储信息（API README 已约定）。

### [V-08] S2 — 前端令牌存储未定：localStorage 存 access token = XSS 即会话劫持

- **位置**：`web/` 模板态（Ant Design Pro），登录态存储方式未定；
  docs/api/README §7 注明 requestErrorConfig 仍为模板
- **问题**：本项目是文件协作平台，XSS 面来自富文本/文件名回显/分享链接参数回显。
  若 access token 放 localStorage，任意 XSS 可直接盗 token 调用 API（含下载），等效越权。
- **建议**：access token 存内存（刷新/重新登录恢复）或短时效 httpOnly cookie；
  refresh token 走 httpOnly + Secure + SameSite cookie（配 CSRF 防护）而非 localStorage；
  前端渲染一律转义（React 默认）+ CSP 收敛；文件名/分享码等回显做编码。

---

# ⚡ 主题 B · 并发（C-*）

### [C-01] S1 — 权限申请冲突判重非原子：双击/双标签可制造重复申请单

- **位置**：`permission_application` DDL——`idx_applicant_resource(applicant_id, resource_type, resource_id, status)`
  为普通索引**非唯一**；use-case-flows §2.3 步骤 3（1008/1009）
- **问题**：两次并发请求都先“查无在审申请/无生效授权”，随后都插入成功 → 两条 `status=0` 申请单，
  审批人看到重复待办、审批两次产出两条授权。因“驳回后可再次申请”业务合法，不能简单把
  `(applicant,resource,type,status)` 建唯一（历史驳回会与新申请同状态不同行、或状态复用冲突）。
- **建议**：给表增加活动态单飞列，例如 `dedupe_key`（活动态=`md5(applicant_id|resource_type|resource_id|apply_type)`，
  进入终态后置 NULL）+ 该列唯一索引；插入时携带 `INSERT ... ON DUPLICATE KEY` 感知 1009。
  或申请入口用 Redis `SETNX(at:apply:{uid}:{res}, 1, EX=xx)` 前置判重（DB 唯一约束仍为最终防线）。

### [C-02] S1 — 审批“通过/驳回/转审/撤销”并发：重复审批、状态漂移、重复授权

- **位置**：use-case-flows §2.3 步骤 5；申请状态机 0→1/2/3/4
- **问题**：同一申请单可能被“当前审批人”与“转审后的审批人”（或兜底安全管理员、超管运维）
  同时操作；若实现为 `updateById` 直改，后写覆盖先写 → 驳回后被通过（越权授予）。
- **建议（红线）**：所有审批动作执行 CAS：
  `UPDATE permission_application SET status=<目标>, opinion=?, approver_id=<当前审批人>
   WHERE id=? AND status=0 AND approver_id=<当前审批人>`；
  影响行数≠1 ⇒ 抛 4102/明确冲突（流程已变化），并提示前端刷新。事件/通知以提交后唯一一次为准（防重键）。

### [C-03] S1 — 授权到期回收与访问判定：需要明确“在途下载不中断”语义并防误杀

- **位置**：use-case-flows §2.3 步骤 9 / §2.4（称“无竞态窗口”）
- **问题**：访问判定 `status=1 AND expire_at>now` 单查是原子的（正确）；
  但**已开始的下载**在授权恰好到期时是否中断？若流式校验贯穿整个下载过程，
  大文件下载中回收会切断在途传输；若不校验，则存在“到期后仍在下载”的窗口。
  另有回收定时任务与访问并发：回收先 UPDATE 后新访问自然拒绝，顺序安全。真正要定的是语义。
- **建议**：明确 **“授权校验只在请求入口做一次，在途下载/上传不因到期中断”**（与多数下载器语义一致），
  并写入 use-case-flows 与测试用例；回收只处理 DB 状态，不打断已打开流。

### [C-04] S2 — 到期回收定时任务：需幂等 + 多副本防重入

- **位置**：use-case-flows §2.4（“回收是幂等写”）
- **问题**：回收本身幂等（CAS 条件更新），但**事件/通知**若不防重，重复触发会重复通知申请人；
  且基线“单机 Compose”，一旦多副本/多实例部署，多个定时器并发扫同一批授权——DB CAS 幂等可兜底，
  但需明确调度锁（`ShedLock` 或 DB `SELECT ... FOR UPDATE` 的批处理游标）。
- **建议**：回收批处理采用一条原子 UPDATE + 影响行数返回再发事件；部署多副本前引入调度锁；
  事件带 `application_id` 幂等键，监听侧去重。

### [C-05] S1 — refresh token 轮换与重放检测的实现难度被低估，易做成“永远有效的登录”

- **位置**：PRD US-07（轮换 + 同 RT 二次使用吊销全部会话）；无 at-auth 实现
- **问题**：若 RT 只做 JWT 无状态签名验证（无服务端状态），则无法实现“一次使用即失效”
  与“被盗重放吊销”——这正是双令牌安全性的核心承诺。骨架尚无任何 Token 存储设计落地。
- **建议**：RT 必须落 Redis 白名单（键 `at:token:refresh:{userId}`，值=最新 refresh 指纹）并**原子轮换**
  （Lua：`GETDEL` 后比对，匹配才 `SET` 新值）；检测到复用旧值 ⇒ bump 会话纪元
  （`sys_user.token_epoch + 1`）并 DEL RT / 失效 AT，要求重新登录；
  相关实现要点与 access 吊销模型（DB 权威纪元，见 [system-design §2](./system-design.md)）。

### [C-06] S1 — 传输任务状态迁移与分片进度更新：读-改-写与并发累加必须禁止

- **位置**：`TransferRecord.status/transferredSize`；use-case-flows §1.1 步骤 4/5
- **问题**：① 前端“开始/暂停/取消/合并”与“分片到达”并发：若 Service 层 `select→if→update`，
  两个请求同时读到 `status=1`，一个置 3 已完成、另一个仍可置 5 已取消——终态被覆盖；
  ② `transferredSize` 若用“查当前值+1+回写”，≤5 并发分片必然丢计数（进度跳变，违反 US-01 验收）；
  ③ 原状态机没有“合并中”，merge 的长处理期间状态仍是“传输中”，前端可再次触发 merge/取消。
- **建议（红线）**：全部迁移走 CAS（`UPDATE ... WHERE id=? AND status=<期望源态>`，行数≠1⇒4102）；
  状态机补 `6 合并中`（[system-design §5.1](./system-design.md)）；进度条由 `transfer_part` 聚合派生或
  `transferred_size = transferred_size + ?` 原子累加，禁止读改写。

### [C-07] S1 — 秒传/合并的并发去重：同文件同时上传会物理双份或唯一约束撞车

- **位置**：PRD US-02（“同一文件只上传一次，不得重复落盘”）；`FileObject.sha256` 无唯一约束
- **问题**：两个用户（或同用户双会话）同时上传同 SHA-256 文件：① 若不做任何唯一约束，两次
  merge 都成功 → 物理存两份，违约 US-02；② 若粗暴建 `(sha256,size_bytes)` 唯一索引，
  “上传中(status=1)”与“可用(status=0)”同哈希共存即冲突，正常业务被 500。
- **建议**：秒传键以独立唯一载体实现，例如去重表
  `file_dedupe(sha256 char(64), size_bytes bigint, file_id bigint, unique(sha256,size_bytes))`
  与 `file_object` 分离；merge 完成时以 `INSERT ... ON DUPLICATE KEY` 幂等收敛：已存在则
  复用既有 `file_id`，本地新副本进孤儿清理（T-04）或立即回收。

### [C-08] S1 — 外发下载“次数上限”非原子扣减会超卖；提取码错误计数非原子会漏锁

- **位置**：PRD US-03（默认 10 次、错 5 次锁 30 min）；`share` 表未建
- **问题**：并发第 10/11 次下载若“先查 used<10 再 used+1 写回”，两个请求都通过检查 →
  实际下载 11 次仍只算 10（超卖窗口）；提取码校验失败计数若“读-写”，并发 5 次错误可绕过锁定。
- **建议（红线）**：次数扣减用单条原子
  `UPDATE share SET downloaded_count=downloaded_count+1 WHERE id=? AND downloaded_count<download_limit`（行数=1 才继续发流）；
  错误计数用 Redis `INCR`+`EXPIRE`（滑动窗口计数）；分享字段 `download_limit/download_used/error_count/locked_until` 入 V4 DDL。

### [C-09] S2 — 取消/暂停与分片写入并发：需要“写后状态检查 + 残留清理”双保险

- **位置**：use-case-flows §1.1 步骤 4；状态机含 5 已取消
- **问题**：分片 PUT 与取消并发时，分片校验通过、状态检查通过后、写盘前用户取消——
  迟到的分片仍落盘；若无后续清理，临时分片 24 h 后靠定时任务清即可（容忍），
  但若合并/删除逻辑与迟到的分片碰撞则需保证不误判“分片齐全”。
- **建议**：分片写入后再次核对任务非终态（终态则丢弃+标记孤儿）；merge 只认
  `transfer_part` 与任务状态双一致；孤儿分片统一由清理任务按任务创建时间回收。

### [C-10] S2 — 上传并发上限（≤5/任务、活动任务 ≤50）无实现载体

- **位置**：PRD §7 并发基线；`TRANSFER_LIMIT_EXCEEDED(4103,429)`
- **问题**：429 语义已定义但无限流组件落地；若不加控制，单用户可开上百连接并发传分片，
  拖垮连接池/磁盘 IO（违反“超限排队而非崩溃”）。
- **建议**：at-transfer 入口做 Redis 计数或本地令牌桶（每任务 ≤5 片在途、活动任务 ≤50），
  溢出抛 4103；多实例时计数放 Redis，单实例可本地实现并预留 Redis 切换。

---

# 🧱 主题 C · 事务边界（T-*）

### [T-01] S0 — 跨模块写编排没有事务载体：上传主线“写 file_object + transfer_record”与依赖铁律冲突

- **位置**：use-case-flows §1.1 步骤 7（at-transfer+at-file 双模块落库）；
  根 `pom.xml` 铁律 1（at-* 禁止互相依赖）
- **问题**：若遵守“at-transfer 不得依赖 at-file”，则“建 file_object + 改 transfer_record +
  标 part 状态”无法放进一个事务方法——拆两个事务则出现“文件元数据已建但任务仍传输中”
  或“任务已完成但无文件记录”的中间态（下次 merge 重试可能重复建 file_object）。
  若破坏铁律直接依赖，模块边界形同虚设。
- **建议（S0 阻塞项）**：采用 **SPI 依赖倒置**（[system-design §1.2](./system-design.md)）：
  在 at-common（或 at-file 的 `api` 子包）定义文件仓储**接口**，at-file 实现之；
  at-transfer 的编排 Service 注入接口并在**同一事务**内完成双表写入。评审门禁：跨模块写
  必须出现在“编排者”服务的一个 `@Transactional` 内；禁止“先写成功再另发事件补写”。

### [T-02] S0 — use-case-flows §2.3 步骤 6/7 自相矛盾：“事件后写授权表”与“授权不留空档”不可能同时成立

- **位置**：use-case-flows §2.3 步骤 6（事务提交后发布事件）→ 步骤 7（监听方写授权表）；
  同文 §2.4“授权不留空档……与访问判定无竞态”
- **问题**：若授权记录**在审批事务之外**（由事件监听方写），则：① 事务提交成功但监听写库失败/
  应用随后宕机 → 审批状态=通过但 `permission_grant` 缺失 → 申请人以为有权限却被拒；
  ② 监听重复执行（重试）→ 重复授权行；③ “无空档”断言不成立。这是把“写关键业务状态”放在
  “非关键事件路径”上的典型设计错误。
- **建议（S0，需修订 use-case-flows §2.3）**：授权写入（`application.status=1` 与
  `permission_grant` 插入）**必须在同一审批事务内完成**；`PermissionGrantEvent` 仅在
  `AFTER_COMMIT` 发布，负载仅承载通知/审计等非关键副作用（接收方失败不影响授权事实）。
  本项与 [C-03] 的“无空档”语义共同构成审批闭环的一致性基线，已写入 [system-design §5.2](./system-design.md)。

### [T-03] S0 — 文件合并/重组（IO、GB 级）不得放进 DB 事务：长事务与事务内做 IO

- **位置**：use-case-flows §1.1 步骤 5/6（重组+整件 SHA-256）；状态机
- **问题**：若“merge 服务”整体加 `@Transactional`，重组 10 GiB 分片 + 重算 SHA-256 期间
  持有数据库连接与行锁数分钟：连接池打满（池仅 20）、binlog/undo 膨胀、影响所有其他接口
  ——同时与“取消”互锁。
- **建议（红线）**：DB 事务只包裹“**状态迁移 + 元数据落库**”的短操作；
  重组/校验 IO 放事务外，通过 CAS 先进 `6 合并中`（[T-01]/[C-06] 状态机）占位，
  IO 完成后一条短事务 `UPDATE ... SET status=3` + 落 `file_object`；失败则回 `4 失败` 可重试；
  重复 merge 由 CAS 拒绝。**评审门禁：任何 `@Transactional` 方法体内禁止文件流与远程调用。**

### [T-04] S2 — 存储介质与 DB 元数据无法同原子：孤儿文件/分片与秒传副本回收需补偿机制

- **位置**：at-file 存储层（本地/对象存储）；PRD §7 可用性口径
- **问题**：分片写盘成功但任务记录/part 表失败 → 孤儿临时分片（已有 24h 保留策略）；merge
  落库失败但重组文件已在磁盘 → 孤儿整件；秒传冲突（[C-07]）产生的多余物理副本。
  若不做回收：磁盘被孤儿占满；若回收太激进：误删在途数据。
- **建议**：按“创建时间 + 无活跃任务”两条件清理；对象存储键设计支持前缀扫描
  （`uploads/{yyyy}/{mm}/{taskId}/...` 便于清 key）；清理任务与文件操作不要求同事务，
  但删除前必须复核 `transfer_record`/`file_object` 引用（防删在用的）。

### [T-05] S1 — 审计写入的事务边界与“不可篡改、留存 ≥6 个月”的实现路径缺失

- **位置**：PRD US-06/§7（审计不可改删、留存 180 天可配）；`AuditSink` 仅为扩展点话术
- **问题**：① 审计与业务是否同事务？同事务则审计失败回滚业务（可用性风险）；不同事务则业务成功
  但审计丢（合规违约）；② “不可修改/删除”若无实现约束（服务不提供审计 update/delete 通道、
  DB 账号无 DML 权限），基本只能靠纪律；③ 留存 180 天意味着必须有删除/归档任务——与“不可删除”需并存解释。
- **建议**：审计写采用 **AFTER_COMMIT 异步 + 落库失败重试/告警**（审计可缺失性低于业务，但必须有
  补偿队列）；审计表对应用服务只暴露 insert/select；归档任务=导出（对象存储/CSV）+ 物理删除，
  审计日志只增（append-only），物理删除仅限归档组件使用受限账号执行；`AuditSink` 作为 SPI 预留 ES。

> **CE 收敛进展（2026-09-14，部分）**：at-file 的 `FileAuditLogger` 已把审计行按「失败记录不可丢、成功记录不可假」
> 拆成两种事务语义——**失败审计**走 `REQUIRES_NEW` 独立事务（`FileNodeService#destroy` 的「记一条 fail 紧接 throw」
> 若与业务同事务，回滚会把「越权 / 缺审批被拒」这类最需要留痕的事件一并抹掉）；**成功审计**仍加入调用方业务事务，
> 使「业务回滚了、库里却留着一条成功」不可能发生。「永不抛异常」已消解本项①的可用性风险（审计写失败不回滚业务）。
> **仍开放**：AFTER_COMMIT 异步 + 落库失败重试/告警（补偿队列）、审计表 DB 账号只 insert/select、归档导出 + 物理删除。

### [T-06] S2 — AFTER_COMMIT 事件投递无可靠性保障：通知“必达类”会丢

- **位置**：use-case-flows §2.1 领域事件；PRD US-08（审批待办为必达类型）
- **问题**：`@TransactionalEventListener(AFTER_COMMIT)` 后监听方异步处理，进程崩溃即丢事件；
  审批通过但申请人永远收不到通知。通知虽非授权关键路径，但属 US-08 验收项。
- **建议**：通知/待办落一张 `notification`（或 outbox）表并在**业务事务内**一并写入
  （与业务同原子，代价小），事件仅触发“异步推送/邮件”；多端已读同步用 CAS，不产生重复待办。

### [T-07] S2 — V1 `user` 表遗留自增主键与 camelCase，与新规约冲突且可枚举 ID 放大遍历面

- **位置**：`sql/V1__schema.sql`（`user.id bigint auto_increment`、`userAccount` 等 camelCase）
  vs `BaseEntity`（ASSIGN_ID 雪花）+ V3 snake_case 规约
- **问题**：① at-auth 若用 MP + `BaseEntity` 写 user 表，全局 `id-type: assign_id` 与表自增语义打架；
  ② 自增 ID 可顺序枚举，登录/注册接口若泄露用户 ID，横向遍历成本为零；
  ③ 一张表两种命名风格，`map-underscore-to-camel-case` 对 camelCase 列反而要显式 `@TableField`。
- **建议**：V4 对 `user` 表做演进迁移：主键改雪花语义（停止自增用法，存量自增行保留）、
  列更名 snake_case（或 as-is 显式映射并冻结）；脚手架 `post/post_thumb/post_favour` 无业务占用，
  明确下线/冻结，避免新代码误用。
- **处置（2026-09-06）**：已关闭——`sql/V1__schema.sql` 二次重置：旧表族（含 `user`）废弃，
  `sys_user` 为雪花主键 + snake_case（username/password_hash/…），逻辑删除 `deleted`；
  脚手架 `post/post_thumb/post_favour` 已从 V1 移除。

### [T-08] S2 — 时间写入者与时钟口径未统一：update_time 双写方 + 授权过期判定跨时钟源

- **位置**：`BaseEntity.updateTime`（FieldFill.INSERT_UPDATE，应用写）vs V1 DDL
  `on update CURRENT_TIMESTAMP`（DB 写）；JDBC `serverTimezone=Asia/Shanghai`、容器 `TZ=Asia/Shanghai`
- **问题**：同一列两个写入方并存（应用填充与 DB on-update 都会生效，语义混乱、难以排查）；
  `permission_grant.expire_at` 若由应用 `LocalDateTime.now()` 生成、回收判定用 DB `now()`，
  二者同机房通常一致，但容器时区/主机时区错配或 DST 场景会漂移 → 提前回收或延迟回收。
- **建议**：统一“DB 权威时钟”：审计/时间戳保留 DB `DEFAULT CURRENT_TIMESTAMP`（去掉
  `on update` 或统一由应用填充，**二选一**）；授权到期比较一律用 SQL 侧
  `expire_at <= NOW()`（应用只传阈值参数），杜绝双时钟。

### [T-09] S2 — 事务内禁止远程调用/Redis 关键写，双写顺序需成文

- **位置**：at-file 对象存储、Redis 会话（at-auth）、限流（at-transfer）
- **问题**：把对象存储 PUT/Redis 操作放进 DB 事务，会出现“事务回滚但远端已生效”或
  “DB 提交成功但 Redis 写失败”的不一致；基线“DB 为主、Redis 为加速”须细化到编码红线。
- **建议**：事务内只允许 DB 访问；Redis 写入放事务后或做成可容忍丢失的加速缓存；
  需要强一致的双写场景（令牌吊销）明确“先 DB 后 Redis + 补偿清理任务”或
  “以 DB 状态为准、Redis 丢失自愈”。

---

# 🧰 主题 D · 其他安全顺带发现（D-*，非本次主题但临近）

### [D-01] S2 — CORS 全放开 + allowCredentials 的组合在生产是越权放大器

- **位置**：`at-gateway/GatewayWebConfig.java`（`allowedOriginPatterns("*")` + `allowCredentials(true)`）
- **问题**：任意站点可带凭证跨域读取本服务响应（若登录态走 Cookie 则直接 CSRF/跨域读取面）。
  当前 dev 语义可接受，但 Javadoc 已注明需收敛——须在发布前做成配置项白名单。
- **建议**：prod 从配置读 `cors.allowed-origins`；凭 Cookie 场景同源部署优先（反代同域），
  需跨域时显式白名单，不匹配的 Origin 一律不返回 CORS 头。

### [D-02] S2 — X-Trace-Id 入站未清洗：MDC/日志注入与审计关联污染

- **位置**：`at-gateway/filter/TraceIdFilter.java`（直接透传请求头 `X-Trace-Id` 进 MDC）
- **问题**：恶意客户端可携带含换行/控制字符/超长字符串的 traceId，污染日志行、伪造跨用户
  审计关联（用受害者的 traceId 批量请求制造“关联”干扰取证）。
- **建议**：入站 traceId 白名单校验：`[A-Za-z0-9-]{1,64}`，不合法即忽略并重生成（不拒绝请求）。

### [D-03] S1 — 登录防爆破/账号锁定/限流（1004/429）只有错误码，无机制

- **位置**：`ACCOUNT_LOCKED(1004)`、`SHARE_LOCKED(4011)`、`TRANSFER_LIMIT_EXCEEDED(4103)`
- **问题**：登录接口是暴力破解与密码喷洒的天然目标；提取码 5 次锁定若只在前端判断等于没有。
- **建议**：登录/refresh 做 IP+账号维度 Redis 计数（如 5 次/分钟临时禁 + 阈值后账号锁定）；
  与 [C-08] 提取码锁定、[C-10] 上传限流共用一个限流工具（Redis 原子计数）。

### [D-04] S3 — 初始凭据与散列策略未定：`root/123456` 默认值只允许在 dev

- **位置**：`application.yml`（DB_PASSWORD 默认 123456）、docker-compose 默认值、PRD §7（TLS）
- **问题**：默认口令+明文默认值在“复制配置即上线”场景是灾难；密码散列算法未定。
- **建议**：密码一律 BCrypt（cost≥10）；compose 提供 `.env.example` 强制占位并在 prod
  文档置顶“修改默认口令”；对外网部署强制反代 TLS（PRD §7 已述，落地在部署脚本检查）。

### [D-05] S3 — 文档勘误：`ResultUtils` 不存在 / 时序文档待修订

- **位置**：architecture/README §横切（“`ResultUtils` 快速构造”）；实际 at-common 仅 `Result` 静态工厂；
  use-case-flows §2.3 步骤 6/7 待按 [T-02] 修订
- **建议**：随 [T-02] 修订一并更新两处文档引用，消除误导。

### [D-06] S3 — 文档勘误（2026-09-13 新增）：`AT-DIFF-todos.md` 验收行错误码陈旧于 1xxx 重编号

- **位置**：`docs/development/AT-DIFF-todos.md`（AT-DIFF-04 验收清单行「AUDITOR 无权限 403(1004)」/
  「refresh 复用打击 401(1003)」）vs [错误码文档](../api/error-codes.md) 附录 B 迁移表
- **问题**：1xxx 段已于 2026-09-13 按 [AT-DIFF-01] 裁决重编号——权限不足 = `1003`（403）、
  `TOKEN_INVALID = 1006`（401）。AT-DIFF-04 该行仍是重编号前的旧值（`1004` / `1003`），
  而其对应集成测试 Javadoc 已更新。按该行做回归验收会**误判失败**，或反向诱导代码改回旧码。
- **建议**：将该行更新为「AUDITOR 无权限 `403(1003)`」「refresh 复用打击 `401(1006)`」，
  并全仓扫描一次重编号前的 1xxx 字面量（`1004` 出现在「无权限」语境处一律为陈旧值）。
- ✅ **2026-09-13 已修复（D-06 关闭）**：
  - `AT-DIFF-todos.md` AT-DIFF-04 验收行 → `403(1003)` ×2 / `401(1006)`；
  - 全仓扫描共修正 **5 处陈旧字面量**：`CHANGELOG.md` 4 处（跳登录 `1001/1003` → `1001/1006`；
    Filter 验签/过期 `1002/1003` → `1002/1006`；未认证输出 `1001/1002/1003/1004` → `1001/1002/1006`；
    RBAC `403（1004）` → `403（1003）`）与 `AuthFlowIntegrationTest` 重放断言注释（`1003` → `1006`）；
  - 复查结论：后端 `ErrorCode` 枚举、at-auth EntryPoint/DeniedHandler、`JwtAuthenticationFilter`、
    at-permission 注解与切面、at-gateway 全局异常、前端 `result.ts` / `requestErrorConfig`（含单测）
    **均为新口径、无残留**；
  - `docs/api/error-codes.md` 附录 B **第一张表**为骨架期历史记录（其「新编号」列是当时快照），
    由紧随其后的「第二次调整（2026-09-13）」表覆盖，**保留不动**以维持迁移审计链。

---

# 🧮 主题 E · 空指针与边界值（N/B 系列，v1.1 新增）

> **为什么单列此主题**：前四主题覆盖了越权 / 并发 / 事务 / 其他安全，但**「空指针与边界值」此前 0 条**，
> 而它恰恰是「代码能跑但结果错」的高发区——尤其本项目存在**大量可选字段**（提取码、到期时间、
> `limit`、`level`）与**数值型外部输入**（分片 index、文件大小、分片数、次数上限）。
> 逐条改法见上文「速览 E · 空指针与边界值」四列表，本节给出**位置与机理**。

## 📍 主题 E · 位置与证据

| 编号 | 涉及位置 | 机理 / 证据 |
| --- | --- | --- |
| `[N-01]` | `at-auth/security/JwtTokenProvider.java`、`JwtAuthenticationFilter.java` | `ver` claim 读取后参与 `token_epoch` 比对；空串 token 与缺失 claim 未先判空 |
| `[N-02]` | `at-gateway/GlobalExceptionHandler.java`、`at-common/Result.java` | 异常 `message` 兜底、`traceId` 注入 |
| `[N-03]` | `at-transfer` 分片初始化、`merge` 齐全判定；`at-file` 秒传 | `ceil(size/chunkSize)` 在 `size=0` 时为 0，`missing` 集合为空即判「齐全」 |
| `[N-04]` | 秒传预检 DTO、`at-file` 存储键生成 | 未强校验 `sha256` 格式；文件名字符未过滤 |
| `[N-05]` | `PUT /transfers/{id}/parts/{index}`；`sys_upload_task.uploaded_indexes` | 路径变量未做区间校验；JSON 索引数组的读-改-写存在丢更新与重复累加 |
| `[N-06]` | 分片上传接口（`Content-Length` / part size 参数） | 未核对片段大小与 `chunkSize` 关系 |
| `[N-07]` | `at-collaboration` 分享创建/下载；`sys_share_link` | 提取码列为 `extract_code_hash NOT NULL`（BCrypt）、`download_limit NOT NULL default 10`、`expire_at NOT NULL` —— 空值场景落在**请求 DTO → 服务端兜底**这一层 |
| `[N-08]` | `at-permission` 审批提交接口；`sys_user_file_permission.expire_at` | `desiredExpireAt` 可空 / 可过去 / 可超上限 |
| `[N-09]` | `sys_dept.ancestors`；数据范围（本人/本部门/全部）子树判定 | 根部门 `ancestors` 若为 NULL，`LIKE` 子树匹配失效 |
| `[N-10]` | 各列表接口分页参数（MyBatis-Plus 分页插件） | 无上界校验 |
| `[N-11]` | `at:perm:{userId}`、`at:token:access` 等缓存读取路径 | 命中空值/空 JSON 时反序列化为 null |
| `[B-01]` | 授权到期判定（`expire_at` 比较）、审计时间戳 | 边界等于、时区/DST |
| `[B-02]` | 分享下载次数扣减（[C-08] 同处） | `download_limit=0/null` 与「最后一次」并发 |
| `[B-03]` | `sys_upload_task.transferred_size` 进度累加 | 重复 PUT / 重传叠加导致 > `file_size` |
| `[B-04]` | `sys_file.file_name` 列宽、写库路径 | 超长文件名截断或裸抛 500 |
| `[B-05]` | `level` / `data_scope` / `status` 等枚举入参 | 非法枚举落入 `else` 兜底默认放行 |
| `[B-06]` | 大小 / 分片数 / 计数变量类型；CE 上限常量 | `int` 承载大容量存在溢出面 |
| `[B-07]` | 文件名 URL 往返、提取码规范化、库表字符集 | emoji(MB4) / 全角 / 空格 |

## 🚩 主题 E · 收敛红线

1. **可选字段三态明确**：CE 中每个可选字段必须写清「缺省 = null / 空串 / 默认值」中的哪一种，
   禁止同一字段两种缺省语义并存（如提取码 null 与 `""` 都当「无提取码」但判定分叉）。
2. **枚举强校验 + 默认分支抛错**：所有枚举型入参走枚举反序列化；`switch` 的 `default` **必须抛错**，
   禁止 `else` 放行——这是「非法值 = 默认放行」这类静默越权的根因（与 [V-04] 同源）。
3. **数值入参先校验后使用**：`index` / `size` / `size_bytes` / `pageSize` / `limit` 一律
   「区间 + 类型」双校验，容量类变量用 `long`。
4. **空集合 ≠ 缺数据**：合并齐全判定、缓存命中判定等，必须区分「集合为空是因为本应为空」
   还是「因为数据缺失」——[N-03] 即此坑。

---

# 📋 主题 F · PRD 与 API 契约漏审（PRD/API 系列，v1.1 新增）

> **为什么单列此主题**：本次评审要求「以挑刺视角审查 PRD 与 api-spec」。前四主题多从
> **实现侧**倒推缺陷，本节直接对 **PRD（`docs/prd/README.md`）与 API 契约（`docs/api/README.md`、
> `docs/api/error-codes.md`）的条目本身**挑刺——多数是**两份文档之间、或文档与设计基线之间的口径漂移**。
> 逐条改法见上文「速览 F · PRD 与 API 契约漏审」四列表。

## 📍 主题 F · 位置与证据

| 编号 | 涉及位置 | 机理 / 证据 |
| --- | --- | --- |
| `[PRD-01]` | PRD §7（指标） vs [system-design §2](./system-design.md)（会话吊销纪元） | 停用失效时延两处口径不同 |
| `[PRD-02]` | PRD US-05 验收文字 vs [T-02] 修订后的 use-case-flows §2.3 | 授权写表位置表述冲突 |
| `[PRD-03]` | PRD 用例态名 vs `system-design §5` 状态机数字码 | 无映射表 |
| `[PRD-04]` | PRD US-02 性能指标 vs `sys_file` 索引设计 | 秒传查询计划无门禁 |
| `[PRD-05]` | PRD US-11 工作台指标 vs ~~无统计聚合设计~~ 已有 `TransferStatisticsService`（`sys_operation_log` 单表聚合） | ~~指标无数据源~~ ✅ **2026-09-29 已收口**（数据源 / 索引 / 证据见上表速览 F，PRD §4.1「工作台数据总览」已置 ✅） |
| `[PRD-06]` | PRD US-12 打包上限 vs 无配额服务/错误码 | 上限无承载 |
| `[PRD-07]` | PRD US-08「必达」 vs [T-06] | 通知可靠性缺口 |
| `[PRD-08]` | PRD §8 Won't 扩展点（自认「接口尚未建立」） vs [architecture.md §2](./architecture.md) | ~~缺 SPI 接缝~~ ✅ **2026-09-29 已落地**（7 SPI + CE 默认实现 + 装配门禁） |
| `[PRD-09]` | PRD US-05「继承空间级别」 vs [V-04]（`space.level` 未建） | 验收不可测 |
| `[API-01]` | `docs/api/README.md` §5 白名单（auth/token、refresh、分享下载） | 免登录端点散落、缺防刷 |
| `[API-02]` | `docs/api/README.md` 秒传预检（`4001` 语义） vs 前端 `result.ts` 策略 | 业务分支被当错误 |
| `[API-03]` | API 契约 vs `P-5` 幂等要求 / [C-01] | 缺幂等键定义 |
| `[API-04]` | API 契约分页参数 vs [architecture.md §1.5](./architecture.md)（pageSize ≤ 100） | 契约未声明上界 |
| `[API-05]` | `error-codes.md` / 后端 `ErrorCode` / `web/src/utils/result.ts` 三源 | 人肉同步、重编号后易漏 |
| `[API-06]` | 分享下载响应契约 vs [C-03] | 未定义 Range / 在途语义 |

## 🚩 主题 F · 收敛红线

1. **单一权威源**：状态码以设计基线（`system-design §5`）为准、错误码以后端 `ErrorCode` 为准；
   PRD/API 文档**引用**而非**复制**，避免二次漂移（本主题 15 条里过半是复制导致的口径分叉）。
2. **指标必须可测**：任何 P95 / 上限 / 时延指标，必须同时给出**数据源、索引或聚合方案、验收方法**，
   否则从 PRD 中降级为「非验收项」（[PRD-04]/[PRD-06] 仍缺此而不可测；
   [PRD-05] 已于 2026-09-29 补齐「数据源 + 索引」口径并明确不另立聚合表，见上表速览 F）。
3. **契约先于实现**：幂等键（[API-03]）、免登录端点清单（[API-01]）、分页上界（[API-04]）
   必须在写第一个 Controller 前落进契约——它们属于「事后补就必然破坏兼容」的那一类。
4. **文档重编号须全量回归**：1xxx 段重编号（[AT-DIFF-01]）后，所有引用处（含验收清单、前端策略表、
   集成测试）必须一次性扫齐，否则出现 [D-06] 那类「文档与测试互相矛盾」。

---

# 🏁 结论与发布门禁

## 📋 汇总

| 主题 | 🔴 高（S0/S1） | 🟡 中（S2） | 🟢 低（S3） |
| --- | --- | --- | --- |
| 越权 | V-01 / V-02 / V-03 / V-04 / V-05 / V-06 / V-07 | V-08 | — |
| 并发 | C-01 / C-02 / C-03 / C-05 / C-06 / C-07 / C-08 | C-04 / C-09 / C-10 | — |
| 事务边界 | T-01 / T-02 / T-03 / T-05 | T-04 / T-06 / T-07 / T-08 / T-09 | — |
| 其他顺带 | D-03 | D-01 / D-02 | D-04 / D-05 / D-06 |
| **空指针与边界值**（v1.1 新增） | N-01 / N-03 / N-04 / N-05 / B-02 / B-05 | N-02 / N-06 / N-07 / N-08 / N-09 / N-10 / N-11 / B-01 / B-03 / B-04 / B-06 | B-07 |
| **PRD / API 契约**（v1.1 新增） | PRD-02 / API-01 | PRD-01 / PRD-03 / PRD-04 / PRD-05 / PRD-06 / PRD-07 / PRD-08 / PRD-09 / API-02 / API-03 / API-04 / API-05 | API-06 |

> 合计 **66 条**（高 27 / 中 34 / 低 5）：V 8 + C 10 + T 9 + D 6 + N 11 + B 7 + PRD 9 + API 6。
> v1.1 相对 v1.0 净增 **34 条**（新增主题 E 18 条 + 主题 F 15 条 + D-06 1 条）。

## 🚦 发布门禁（Gate）

1. **任一 P0 功能开发前**：关闭 T-01（跨模块编排事务）、T-03（事务内禁 IO）；
2. **审批闭环开发前**：T-02（授权写表入审批事务）修订 use-case-flows；
3. **鉴权体系上线前**：V-06（默认 DENY 拦截器 + 白名单）、V-01（对象级鉴权入口）；
4. **P0 整体发布前**：V-05（三权互斥数据约束）、V-03（审批身份服务端推导）、C-01（申请判重唯一化）、
   C-08（次数/计数原子）、D-01（CORS 白名单）、D-02（traceId 清洗）、D-03（登录限流）；
5. **代码评审红线速查**：读改写禁用（P-1）、`@Transactional` 内禁 IO/远程（P-2/T-03）、
   跨模块写必须同事务编排（T-01）、状态迁移一律 CAS 行数校验（C-06）、
   按 ID 资源访问必须过 AccessControlService（V-01）；
6. **空指针与边界值（v1.1）**：上传/秒传功能开发前关闭 N-01 / N-03 / N-04 / N-05；
   分享下载功能开发前关闭 B-02；枚举型入参统一「默认分支抛错」（B-05）。
   红线：**可选字段三态明确**、**枚举 default 抛错**、**数值入参先校验后使用**、**空集合 ≠ 缺数据**（见主题 E 收敛红线）；
7. **契约冻结（v1.1）**：**写第一个 Controller 之前**完成——PRD US-05 授权写表表述（PRD-02）、
   免登录端点集中化与防刷（API-01）、写接口幂等键（API-03）、分页上界（API-04）、
   秒传预检返回语义（API-02）。这些一旦有实现方接入即构成兼容成本。
   ⏸ **2026-09-13 登记**：本门禁对应延期项 **D-4**（对外契约收口，含 API-01/03/04、PRD-02 与前后端确认留痕）；
   与之配套的**审批 / 分片上传接口契约定稿**为 **D-5**（须在进入 Phase 4 前完成）。两项属「有兼容成本类」，
   **不适用**「系统功能基本成型后再补」的宽松口径，见 [architecture.md §4 ⏸ 延期登记](./architecture.md)。

## 🔁 需要回改的既有文档/基线清单

| 文件 | 修改项 | 关联 |
| --- | --- | --- |
| `docs/architecture/use-case-flows.md` | §2.3 步骤 6/7：授权写表移入审批事务，事件仅承载通知/审计 | T-02 |
| `docs/architecture/use-case-flows.md` | §1.1 状态机补 `6 合并中`；§2.4“无空档”注释补“入口判定一次、在途不中断” | C-06/C-03 |
| `docs/architecture/README.md` | “ResultUtils”→`Result` 静态工厂 | D-05 |
| `docs/development/README.md` | “ResultUtils.success/error”→`Result.ok/fail`（同类勘误，一并修正） | D-05 |
| `server/at-transfer/.../TransferRecord.java` | Javadoc/字段注释状态机补 `6 合并中`（与文档保持同步） | C-06/T-03 |
| `docs/architecture/system-design.md` | §2.1~2.3：access 吊销重构为“DB `sys_user.token_epoch` 权威 + Redis 缓存 / 白名单”（废除逐 jti 黑名单 `at:deny`）；refresh 键定稿 `at:token:refresh:{userId}` | C-05 |
| `docs/architecture/system-design.md` | §5.3 + 新增 §7.1：分享次数 DB 原子裁决 + Redis 前置配额闸；Redis Key 规划表落地（镜像 at-common `RedisKeyConstants`） | C-08 |
| `server/at-common/.../RedisKeyConstants.java` | 新增：`at:` 前缀 Key/TTL 常量 + 键工厂方法（2026-09-06，会话吊销纪元 / 前置配额闸语义随 C-05/C-08 定稿） | C-05/C-08 |
| `docs/architecture/system-design.md` | §1.3「模块内包规约」：四层包结构定稿，持久层 `mapper` → **`repository`**（与实测包结构及 8 模块 `package-info.java` 一致） | [architecture.md §1.4](./architecture.md) |
| `docs/architecture/architecture.md` | **v1.1 新建**：模块职责/依赖方向、四层包结构、处理链路、CE/EE 扩展点、部署拓扑 | 本次落地 |
| `docs/architecture/README.md` | 增补指向 `architecture.md` 的入口链接（原文仅有职责表与铁律，无四层/链路/扩展点/拓扑） | 本次落地 |
| `docs/development/AT-DIFF-todos.md` | AT-DIFF-04 验收行错误码更新为 `403(1003)` / `401(1006)`；全仓扫描重编号前的 1xxx 陈旧字面量（✅ 2026-09-13 已完成） | D-06 |
| `docs/prd/README.md` | §8 扩展点命名对齐附录 C（`IdentityProvider` 等 7 接口）+ 建立「接口尚未建立」的 SPI 接缝（✅ 2026-09-29）；US-05 授权写表表述按 [T-02] 修订（⏸ 仍待，随 D-3） | PRD-02 / PRD-08 |
| `docs/api/README.md` | 补：写接口幂等键、分页上界、免登录端点集中化与分享下载防刷、秒传预检返回语义（`4001` → 200+data 或前端策略表归入成功分支） | API-01~API-04 |
| `docs/api/error-codes.md` · `web/src/utils/result.ts` | 确立「后端 `ErrorCode` 为单一权威源」；前端策略表断言覆盖全部码，重编号后回归 | API-05 / D-06 |
| `docs/architecture/system-design.md` | §1.2 SPI 规则收紧为「接口统一定义在 `at-common` 的 `com.anttransfer.common.spi`」；§4.1 `sys_notify_message` 补 `mentioned` / `notify_type=9` / 保留期清理；§5.1 补 `TransferCompletedEvent`；§5.3 补取件回执与到期前提醒；§7.1 补 `at:chat:retention-lock`；§8 现状核对刷新 | A/B/C 三批（✅ 2026-09-29） |
| `docs/architecture/use-case-flows.md` | 头部状态刷新；§1.1 步骤 7 补 `TransferCompletedEvent`；§2.1 事件表补通知类副作用；补 @提及、取件回执、下载水印等已落地步骤 | A/B/C（✅ 2026-09-29） |
| `docs/api/README.md` | §1 前缀表补 `mentionUserIds` / `mentionUnreadCount` 与通知类型 8/9/4；§7 补三类系统通知帧 | A/B（✅ 2026-09-29） |
| `docs/api/error-codes.md` | §五副作用补取件回执（`9`）/ 传输完成（`8`）/ 到期前提醒（`4`）；`4011` 锁定提醒改为「恰好跨过阈值发一次」 | A（✅ 2026-09-29） |
| `docs/development/README.md` · `dod.md` | 测试用例统计刷新（后端 661 例 / 前端 73 文件 828 例；⚠️ **当轮仅复跑 `test`，未重跑 JaCoCo `verify`**，故覆盖率基线仍沿用 2026-09-14 版）；AT-DIFF 计数由「5 处」更正为「登记 11 项、代码内 3 处」 | 回归（✅ 2026-09-29） |
| `docs/development/README.md` · `dod.md` | **用例数与覆盖率基线全量刷新**（重跑 `./mvnw -B -ntp verify` + `npm test`）：后端 **794 例** / 前端 **78 文件 1093 例**；覆盖率整体 **36.50% → 44.16%**、安全 **52.86% → 55.08%**（口径：包名含 `security`，与 `pom.xml` 的 `*security.*` 规则一致）；`at-collaboration` 首次产出报告并纳入判定；同时更正 §2「14 处 license header 真违规」为**已由 `3d21b20` 收口**，并新增「主仓库（Gitee）无任何 CI 配置」的缺口登记 | 回归（✅ 2026-10-03） |
| `docs/deployment/README.md` | 环境变量表补 `message-cleanup-cron` / `message-retention-days`（下限 30 硬钳制）；上线清单补通知回执与保留期清理核验 | B（✅ 2026-09-29） |
| `docs/architecture/red-team-review.md` · `docs/prd/README.md` §4.2 | 工作台指标（US-11）数据源收敛并回写红队三处表述（速览 F / 位置与证据 / 收敛红线）：`TransferStatisticsService` 直读 `sys_operation_log` 单表聚合（走 `idx_user_time`），**不另立统计表 / 不用 Redis 计数器** | PRD-05（✅ 2026-09-29） |

> 上表前三项及随附的同类勘误/实体注释同步已于 **2026-09-06 回写完成**。
> **v1.1 新增行**中，`docs/architecture/architecture.md`（新建）与 `docs/architecture/README.md`（增补入口）**已落地**；
> `system-design.md` §1.3、`docs/prd/README.md` §8、`docs/api/README.md`、`docs/development/AT-DIFF-todos.md` AT-DIFF-04、
> `web/src/utils/result.ts` 为**待回改项**；其中涉及对外契约的（错误码权威源 / 幂等键 / 分页上界 / 免登录端点防刷）
> 须在写首个 Controller 之前完成（见发布门禁第 7 条）。
> 🔄 **2026-09-29 更新**：`docs/prd/README.md` §8 命名回写、`AT-DIFF-todos.md` AT-DIFF-09、`docs/api/README.md`
> 的**本轮通知 / 提及契约部分**已落地；`system-design.md` §1.3（`mapper` → `repository`）、幂等键 / 分页上界 /
> 免登录端点防刷、`web/src/utils/result.ts` 仍属 **D-3 待回改项**（未改动）。本轮 A/B/C 三批新增的同步行见上表末尾六行，
> 另加 PRD-05 收口一行（工作台指标数据源），**均已完成**。
> ⏸ **2026-09-13 裁决**：上述待回改项**已登记为延期项**（先记录、不阻塞当前开发），见 [architecture.md §4 ⏸ 延期登记](./architecture.md)：
> D-1（跨模块协作口径）、D-2（附录 C / PRD §8 命名权威源）、D-3（红队待回改项整体）；
> 其中「对外契约 4 项」按 DoD-3 收口口径单列为 **D-4**（写接口幂等键 / 免登录端点防刷 / 前后端确认留痕）；
> 审批与分片上传接口契约定稿单列为 **D-5**；范围侧新增 **D-6**（CE/EE 边界书面冻结）、**D-7**（战略规划书 0.3 节逐项核对）。
> **D-4 须在写首个 Controller 之前、D-5 须在进入 Phase 4 之前**完成（硬前置）；其余（D-1 / D-2 / D-6 / D-7）随三条主线推进回头补齐。
> 2026-09-06 追加：认证吊销与分享次数口径随 at-common `RedisKeyConstants` 定稿一并回写
> （system-design §2 / §5.3 / §7.1 与 red-team [C-05] / [C-08]）；`sys_user.token_epoch`
> 增列迁移在 at-auth 会话实现时随 Flyway V3 提供。
> `sql/` 表族已于同日全量重置为 V1（18 表），原「V4 待写」的表/列多已落地
> （见 [system-design §4.1 表族地图](./system-design.md) 状态列）；内置角色 / 权限点等
> 枚举主数据随 `V2__init_data.sql`（2026-09-06）初始化。

> **v1.1（2026-09-13）**：新增主题 E（空指针与边界值，N-*/B-*）、主题 F（PRD/API 契约漏审，PRD-*/API-*）
> 与顶部「四列速览表」；补 D-06。八维度覆盖情况：越权 ✅ / 分片并发与合并幂等 ✅ / 审批状态机并发 ✅ /
> 事务边界与事件时机 ✅ / Redis 与 DB 一致性 ✅ / 外发链接被刷与提取码爆破 ✅ / **空指针与边界值 ✅（本次补齐）** /
> PRD 与 api-spec 条目级审查 ✅（主题 F）。

> 本报告为设计期红队，随实现进度应**按模块迭代复评**（尤其认证与审批落地后），
> 并将新增发现追加到对应章节。
