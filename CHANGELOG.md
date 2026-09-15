# 📝 Changelog

本项目所有重要变更均记录于此。
格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased] 🔄

### ✨ Added（新增）

- 🧱 仓库由「脚手架单体」演进为 AntTransfer CE 模块化单体：`server/` 下 8 个 Maven 模块
  （`at-common` / `at-gateway` / `at-auth` / `at-transfer` / `at-permission` / `at-file` / `at-collaboration` / `at-bootstrap`）。
- ⚖️ Apache-2.0 `LICENSE`，全部 Java/pom 文件许可证头，Spotless `verify` 阶段自动校验。
- 📂 标准开源工程骨架：`docs/`、`deploy/`、`scripts/`、`tests/`、`.github/`（CI、Issue 模板、CODEOWNERS）。
- 🧰 根编排：`Makefile`、`docker-compose.yml`（MySQL/Redis/server 全栈）、`docker-compose.dev.yml`（本地依赖）。
- 🗄️ `sql/` 采用 Flyway 版本化布局：`V1__schema.sql`（建表）、`V2__init_data.sql`（初始化数据）。
- 🐳 Dockerfile 多阶段构建（JDK 21 / Maven 3.9 → JRE 运行镜像）。
- 👤 初始化数据 `sql/V2__init_data.sql`：内置角色 SUPER_ADMIN/AUDITOR/DEPT_ADMIN/USER（sys_role）、
  文件菜单树与七个原子文件权限点 + 审计只读权限点（sys_permission / sys_role_permission）、
  初始化管理员 admin（BCrypt cost=10 真实密文，默认口令 Admin@123，首次登录须改密）。
- 📐 新增 [架构落地说明 `docs/architecture/architecture.md`](docs/architecture/architecture.md)：8 模块职责与依赖方向、
  **四层包结构（`controller` / `service` / `repository` / `model`）**、跨模块协作三通道（SPI 依赖倒置 + 写单事务 + 事件只承载副作用）、
  一次请求的统一处理链路（Filter→Controller→Service→Repository）、**CE/EE 扩展点清单**（`IdentityProvider` /
  `ContentScanInterceptor` / `WatermarkProvider` / `CryptoCodec` / `VirusScanner` / `ApprovalNodeResolver` /
  `TransportStrategy` + `FileStore`，含契约草案与 PRD §8 命名映射）、部署拓扑（Nginx / Web / Server / MySQL / Redis / 存储）。
- 🛡️ [红队评审](docs/architecture/red-team-review.md) 升级至 **v1.1**：新增「四列速览表（问题描述 / 风险等级 / 触发条件 / 修改建议）」、
  主题 E「空指针与边界值」（`N-01~N-11` / `B-01~B-07`）与主题 F「PRD 与 API 契约漏审」（`PRD-01~PRD-09` / `API-01~API-06`），
  补 `D-06`；发现总数 32 → **66**（高 27 / 中 34 / 低 5），八维度排查已全覆盖。
- 📐 [架构落地说明 `docs/architecture/architecture.md`](docs/architecture/architecture.md) §4 扩充「⏸ 延期登记」至 **D-1 ~ D-7**，并新增
  「🎯 本阶段 DoD 现状对照」表；同步更新 [红队评审](docs/architecture/red-team-review.md) 发布门禁第 7 条与待回改项裁决说明：
  - **D-4**（= D-3「对外契约 4 项」· DoD-3）：写接口 `Idempotency-Key` 幂等键定义缺失、免登录端点集中化与防刷未补、前后端确认无留痕 → 须在**写首个 Controller 之前**完成（硬前置）；
  - **D-5**（DoD-4）：分片上传 / 审批两组接口未定稿——审批动作端点路径（approve / reject / reassign / 撤销 / 待办 / 列表 / 详情）缺失、
    字段级 schema（DTO 字段、`precheck` 参数位置、`parts` hash 载体）缺失、`docs/api/README.md` §1 前缀表缺 `/permission/applications` → 须在**进入 Phase 4 之前**完成（硬前置）；
  - **D-6**（DoD-1 ①）：CE/EE 功能边界未书面冻结（PRD 仍 `v0.2-draft · 待评审`）→ 范围评审后置 `frozen`；
  - **D-7**（= A-2 范围侧 · DoD-1 ②）：战略规划书 0.3 节原文未入库，`§1.1 ↔ 0.3 节` 逐项对应不可验证 → 原文入库后逐项核对并出具「无遗漏」结论。
  - DoD 现状：**② 达成**（13 个用户故事、P0 占 9）/ **③ 基本达成**（缺 D-4）/ **①、④ 部分达成**（D-6 / D-7 / D-5 + SPI 接缝 A-6）；
    风险分级：🟢 口径 / 文档类（D-1 / D-2 / D-6 / D-7）、🔴 有兼容成本类须前置（D-4 / D-5）、⚠️ 接缝类（A-6 / D-2 的 7 个 SPI 仍未建）。
- 🧩 延期登记再扩充 **D-8 ~ D-12** 并落地配套结构变更（[architecture.md §4 ⏸ 延期登记](docs/architecture/architecture.md)）：
  - **D-8**（= N-1 · ✅ **已收口**）：`at:share:lock:{token}` TTL 口径裁定为 **30 min** —— 以 PRD US-03「连续 5 次 → 临时锁定（30 分钟）」为需求权威源，
    与 `RedisKeyConstants.SHARE_LOCK_TTL_SECONDS`、`system-design` §5.3 / §7.1、红队 [C-08] **四处一致**；15 min 系与 `at:login:fail`（确为 15 min）串行误抄。项目内本已一致，**无需回改**；
  - **D-9**（= N-2 · 随 D-5 收口）：动态菜单「有数据、无字段、无接口」→ V4 已补路由元数据列，`GET /api/v1/permission/menus` 挂 **Phase 5** 路由守卫阶段，字段级 schema 并入 **D-5**；
  - **D-10**（= N-3）：审计留存 ≥ 6 个月的 `AuditArchiveScheduler`（**先归档后删除** + 分布式锁 + 失败告警）未实现 → 待审计写入方落地后（Phase 3~4）；
  - **D-11**（= N-4）：群组 / 空间成员模型缺失 → V4 新建 `sys_group_member` / `sys_space`，`at-collaboration` 落地时接管读写；
  - **D-12**（= N-5 · ✅ **CE 口径已定**）：外部协作者受限身份 → V4 补 `sys_user.user_type`（CE 恒为 `1`，存量行为零变化）；
    **CE 裁定维持 PRD §2.1 P6**（外部协作者 = **无平台账号**、只走外发链接通道），**不创建外部协作者账号**，该列仅作 **EE / 受限账号预留**；
    EE 将来若启用受限账号，属需求变更，须先经 **D-6** 范围评审（同步改写 PRD P6 与 US-03 验收标准）。
- 🗄️ 新增 `sql/V4__menu_route_user_type_and_collaboration.sql`（**纯增量**；「V3」已被 `V3__add_user_token_epoch.sql` 占用，故版本号顺延）：
  `sys_permission` 补 `route_path` / `component` / `icon` / `visible`；`sys_user` 补 `user_type`（默认 `1`-内部用户）；
  新建 `sys_group_member`（唯一键 `uk_group_user`）与 `sys_space` —— **`sys_` 前缀表由 16 增至 18**。V1 / V2 / V3 属已发布脚本，按 Flyway checksum 约定**未回改**。
- 🧵 `at-collaboration` 骨架实体 `CollaborationSpace` 表名由 `collaboration_space` 对齐为 **`sys_space`** 并补 `group_id`；
  [docs/api/README.md](docs/api/README.md) §1 前缀表登记 `/api/v1/permission/menus`。
- 🔑 Redis Key 规约收敛：限流键 `at:rl:{类}#{方法}[:业务key]:{维度}` 原由 at-gateway `RateLimitAspect`
  **手拼前缀**，现回归 at-common `RedisKeyConstants`（新增 `RATE_LIMIT_PREFIX` 常量 + `rateLimitKey(...)` 工厂方法），
  `system-design` §7.1 Key 规划表同步补录该行 —— 至此**全仓无手拼 Redis Key**（DoD-4 达成）。
- 🐳 `docker-compose.dev.yml` 的 MySQL / Redis 宿主端口改为**可覆盖**（`${MYSQL_PORT:-3306}` / `${REDIS_PORT:-6379}`），
  与 `docker-compose.yml`、`.env.example` 口径对齐；宿主机 3306 已被本机 MySQL 服务占用时，
  复制 `.env.example` 为 `.env` 设 `MYSQL_PORT=3307` 即可，**无需停掉本机服务**（默认值不变，向后兼容）。
- ⬆️ **前端大文件分片上传模块（web/src/services/upload + workers + hooks + components/ChunkUpload）**：
  - `utils/sha256.ts` + `workers/hash.worker.ts`：纯 TS 增量 SHA-256（FIPS 180-4 向量校验），在 Worker 内**一趟读取**同时产出全文件摘要与逐片摘要，
    有 `crypto.subtle` 时自动走原生实现；主线程不参与计算，10 GiB 文件也不会卡 UI；
  - 上传主流程（`ChunkUploadController`，与 React 解耦的纯 TS 引擎）：**哈希 → 秒传预检 → 查询服务端已收分片 → 只补缺失片 → 合并**；
    服务端是切片口径与已收分片的**唯一权威**，其 `chunkSize` 变化会触发本地重算，票据过期（4101）自动作废重走预检；
  - 并发与容错：单文件并发分片数 1~5（默认 3，超上限会被服务端 4103 拒绝）、失败**指数退避重试 3 次**（含 ±20% 抖动，封顶 30 s）、
    不可重试错误（如 4003 完整性失败）**立即失败**不做无谓重试；暂停 / 继续 / 取消 / 重试 / 移除全链路可用；
  - 断点续传：进度与已收分片落 localStorage（按「名称 + 大小 + 修改时间」匹配），刷新后提示「检测到未完成的上传」，**重新选择同一文件即续传**
    （浏览器不允许持久化 `File` 对象）；若同名同大小但摘要已变，则作废旧票据重传，避免合并出损坏文件；
  - UI（`components/ChunkUpload`）：AntD 拖拽上传 + **整体进度**（字节加权）+ 单文件进度 / 速率 / 重试次数，分片大小与并发数可调；
  - 单测 24 例（`sha256.test.ts` / `uploadCore.test.ts` / `ChunkUploadController.test.ts`）：标准向量、padding 边界、分片边界、
    退避曲线、存储与恢复、秒传、并发上限、重试、暂停续传、取消、票据失效等路径全覆盖。
- 🖥️ 新增分片上传示例页（前端路由 `/upload`）：`web/src/pages/upload/index.tsx` 用步骤条讲清上传链路，
  上传完成后实时列出文件（名称 / 大小 / 是否秒传 / `fileId`），并给出组件与 Hook 的接入示例；
  配套 `_mock.ts` 以**内存**模拟服务端（票据、已收分片、秒传索引均存活于 dev server 进程），
  因此 `npm run start`（开启 mock）可在**无后端**时完整走通分片上传、秒传与「刷新后重选文件续传」；
  路由与中英文菜单文案（`menu.upload`）同步登记。
- ⬆️ **后端分片上传主线（at-transfer）**：前端分片上传模块（含示例页）已就绪，但后端此前**零落点**（无 precheck / parts / merge），
  本轮把「秒传预检 → 断点续传 → 分片落盘 → 合片校验 → 落库」补齐，端点与前端契约逐字对齐：
  - 端点（`/api/v1/transfers`）：`POST /precheck`（命中秒传直接建引用并回 `fileId/nodeId`）、`GET /{uploadId}/parts`（已收分片清单）、
    `PUT /{uploadId}/parts/{index}`（multipart：字节流字段 `chunk` + 分片指纹字段 `hash`，索引以路径为准；
    成功回 `data.received` = 已收分片**索引数组**而非计数，与前端 `PartUploadedResult.received: number[]` 逐字对齐）、
    `POST /{uploadId}/merge`（合片落库）、`DELETE /{uploadId}`（取消并清暂存）；
  - **B 类流程分支码不抛异常**：秒传未命中 `4001`、缺片 `4002` 均以 **HTTP 200 + `code` 分流 + `data` 载荷**返回
    （上传票据 / `received` + `missing`）。若按异常处理，全局处理器会回 `Result<Void>`，`data` 被静默丢弃，
    前端将同时失去「秒传」与「补传」两条路——故 `at-common` 的 `Result` 新增 `failWithData` 工厂承载分支载荷；
  - `TransferTaskStateStore`：`SELECT ... FOR UPDATE` 行锁 + 状态 CAS（`0 排队 / 1 传输中 / 2 暂停 / 3 完成 / 4 失败 / 5 取消 / 6 合并中`），
    `sys_upload_task.uploaded_indexes` 的读改写不依赖应用层「先查后写」；合片与流式落盘等大 IO 一律留在事务外，
    事务内只碰元数据（短事务 + 大 IO 分离）；
  - `ChunkStore`：分片先写 `.tmp` 再原子改名（避免半个分片被计入已收）、合片**流式**拷贝不整件入内存、
    分片级与整件级 SHA-256 **均由服务端重算**（不信任客户端上报）；
  - 跨模块接缝：`FileIngestPort`（at-common）+ `FileIngestAdapter`（at-file），`at-transfer` **不依赖 `at-file`**，
    合片产物经端口登记，守住「依赖倒置」的架构铁律；
  - 安全与配额：任务归属校验失败一律按「不存在」处理（不区分 403 / 404，避免票据号被枚举探测）、
    单用户进行中任务数超限 `4103`、单文件超限（`max-chunk-size × max-chunk-count`）`4006`、任务 TTL 24 h 顺带回收；
  - 配置：新增 `anttransfer.transfer.*`（8 MiB 默认分片 / 64 MiB 单分片 / 1024 片上限 / 暂存根 / 并发上限 / TTL）与
    `spring.servlet.multipart`（`max-file-size=64MB` / `max-request-size=80MB` / `file-size-threshold=0`）——
    后者此前**完全未配置**，一直沿用 Spring 默认单文件 1 MB，与本能力直接冲突；
  - `V10__upload_task_parent_id.sql` 补 `sys_upload_task.parent_id`：预检上报目标目录，
    **同内容传到不同目录不再互相复用票据**，合片时作为 `folderId` 透传 at-file；
  - 测试：`TransferTaskServiceTest` 18 例（秒传命中 / 复用进行中任务 / 并发上限 / 参数越界 / 续传 / 分片大小与指纹 /
    缺片分支 / 请求过期 / 整件指纹不符 / 归属越权 / 取消）+ `TransferControllerTest` 7 例（HTTP 契约与分支码载荷）。
- 🔐 **权限申请审批闭环（at-permission）**：打通「无权限 → 申请 → 审批 → 授权 → 到期回收」全链路，
  写侧一律 CAS + 行数校验（红线 P-1），事件与缓存副作用统一在**事务提交后**发布：
  - **申请**（`PermissionApplicationService.create` + `ApplicationCreateDTO`）：按 `applyType` / `resourceType` /
    `resourceId` / `purpose` / `desiredExpireAt` 落单为 `PENDING`；落单前三重校验——显式 **Deny 冲突命中即拒**
    （`1003`）、已有生效授权 `1008`、同人同资源存在进行中申请 `1009`（防重复）；按敏感等级
    `LOW/MEDIUM/HIGH` 解析审批人与 SLA（`24h/12h/4h`，`ApprovalProperties`），**未解析出审批人不静默放行**，
    落库待认领并由超时任务升级。
  - **审批三件套**：通过（`approve`）允许审批人**缩小授权范围 / 缩短有效期**（`resolveFinalGrantType` 拒绝放大、
    `resolveExpireAt` 取更早者），同事务写 `sys_user_file_permission`（最终 `expire_time`、来源 `APPROVAL`）并在
    提交后发 `PermissionGrantEvent` + 失效 `at:perm:{userId}`；驳回（`reject`）理由必填并通知申请人；转审
    （`transfer`）经 `PENDING → TRANSFERRED → PENDING` 两段 CAS 改指审批人，`sys_approval_node` 留痕并通知新审批人。
    `ApprovalStateMachine` 覆盖全分支，非法流转抛 `1011`。
  - **通知抽象**（`Notifier` / `PermissionNotifier` + `PermissionNotification`）：站内信 `InboxNotifier`（P0，
    落 `sys_notify_message`）与邮件 `EmailNotifier`（P1，开关控制）可插拔，业务侧只依赖抽象。
  - **定时任务**：`PermissionGrantExpireScheduler` 每小时 CAS 回收过期授权并发 `PermissionExpiredEvent`；
    `ApprovalEscalationScheduler` 每 10 分钟扫描超时未审批单并升级提醒上一级；`EmergencyApprovalScheduler`
    紧急通道（强提醒、1h、仅中敏感及以下）**标记为 P1 开关**。
  - **实时判定与重评估**：`PermissionGrantService.hasActiveGrant/assertActiveGrant` 每次**实时回源**判断
    `expire_time`（不依赖定时任务，过期即判无权限 `1003`）；对外提供 `revokeApprovalGrants(userId)` 作
    「调岗 / 离职」重评估入口——逐条 CAS 回收该用户来源 `APPROVAL` 的授权、发 `PermissionExpiredEvent` 并失效缓存
    （供 4.6 用户管理调用），CAS 抢单失败不重复发事件。
  - **审批人视图**：`PermissionQueryService` + `PermissionApplicationController` 提供「待我审批 / 我发起」分页
    与申请人**权限地图**（权限点 + 来源：角色继承 / 审批获得）。
  - **CE/EE 扩展点**：`ApprovalNodeResolver` + `ApprovalNodeResolverChain`（CE 为 `SingleNodeApprovalResolver`
    单节点，EE 可动态解析多级节点）；ABAC 时间 / IP 规则只留解析扩展点 `AccessRuleResolver` +
    `AccessRuleResolverChain`（Deny 优先、无解析器 `ABSTAIN`，P1）。
  - 🧪 新增单测 70 例（`ApprovalStateMachineTest` / `PermissionApplicationServiceTest` / `PermissionGrantServiceTest` /
    `ApprovalPropertiesTest` / `AccessRuleResolverChainTest`）：状态机全分支、防重复、Deny 冲突、审批三件套与
    CAS 并发抢单、**过期实时判断**、调岗 / 离职重评估全覆盖；纯单测下显式初始化 MyBatis-Plus `TableInfo` 缓存
    （`MybatisPlusTestSupport`），既保留 Lambda 条件构造器（防列名硬编码）又无需启动 Spring 容器。
- 🔗 **外发分享主线（落地于 `at-file`，见 [AT-DIFF-06](docs/development/AT-DIFF-todos.md#at-diff-06-外发分享模块归属)）**：
  创建 / 撤销 / 查询 + 访客**免登录**换票取件。
  - **创建者侧** `ShareController`（`POST /api/v1/shares`、`DELETE|GET /api/v1/shares/{token}`、`GET /api/v1/shares/mine`）
    统一 `@RequiresPerm("file:share")`；`shareToken` = `SecureRandom` + Base64URL（256 bit，不可猜），提取码
    **BCrypt 加盐**落库，`ShareLinkVO` 不含该字段（**绝不回显**）；详情 / 列表仅创建者本人可见（行级归属校验）。
  - **访客侧** `ShareAccessController`（**免登录白名单** `/v1/shares/{token}/verify`、`/v1/shares/redeem`，均带 `@RateLimit`
    防刷）执行严格校验链：令牌存在 → 未撤销 / 未过期 → 提取码 → 次数未耗尽 → 签发一次性票据。票据存 Redis
    （`at:share:ticket:{ticket}`，TTL 5 min，**`GETDEL` 取用即焚**、不落库），核销时**二次校验链接状态**，
    使撤销 / 过期对**已签发**票据即时生效。
  - **次数不超发（[C-08] / P-8）**：核销时先过 Redis `DECR` 前置闸（Lua；键缺失 / Redis 异常一律降级为「仅 DB 裁决」），
    再以 `UPDATE ... WHERE ... AND downloaded_count < download_limit` 的**单条原子 SQL** 作唯一权威裁决，影响行数 = 1 才放行；
    同一条 SQL 用 `CASE` 在「用尽最后一次」时原子收敛 `status=2`（**赋值顺序即正确性**，见 `ShareLinkMapper` 注释）；
    DB 拒绝时回写镜像 `download_limit - downloaded_count`，与 `sys_share_link` 最终一致。
  - **提取码防爆破**：`INCR at:share:lock:{token}` 连错 5 次锁 **30 min**（D-8 口径，可配）；TTL 刷新点设在
    **触发锁定那一刻**而非首次错误，避免「第 5 次错误发生在第 25 分钟 → 只剩 5 分钟锁定」的窗口缩水；
    锁定期内即便提取码正确也拒绝（4011）。
  - **内容扫描扩展点**：`ContentScanInterceptor` + `ContentScanChain`（**Deny 优先** + **fail-closed**：扫描器抛异常按
    拦截处理，绝不因 DLP 故障放行）；CE 实现 `SuffixAndKeywordScanInterceptor` 读**配置化**后缀黑名单
    （默认 `exe/sh/bat/msi/com/scr`）与文件名敏感词，命中即 4007 拦截并写 `SHARE_BLOCKED` 审计；EE 可挂 AI DLP。
  - **审计**：取件成功写 `SHARE_DOWNLOAD` / `SHARE_PREVIEW`（匿名操作人 + IP + UA + 时间 + 剩余次数，UA 落 detail），
    锁定写 `SHARE_CODE_LOCKED`，创建 / 撤销写 `SHARE_CREATE` / `SHARE_REVOKE`；**审计失败只告警不阻断业务**。
  - 🧪 **测试**：`ContentScanChainTest`（6 例：黑名单 / 敏感词 / Deny 短路 / fail-closed / 应急开关）；
    `ShareQuotaConcurrencyIntegrationTest`（Testcontainers MySQL 8.4 + Redis 7，**额度 3 / 并发 12 →
    恰好 3 成功、9 个 4004**，`downloaded_count` 恒为 3、链接收敛 `status=2`、Redis 镜像归零；提取码连错 5 次锁定 4011）。
    ⚠️ 该集成测试在开发中**真实捕获**「锁定键与错误计数键共用同一 Redis Key → 仅用 `hasKey` 判定导致第 1 次错误即
    被误判锁定」的缺陷，已改为 **比值（`>= maxCodeErrors`）** 判定修复，并保留用例为回归防线。
- 💬 **站内通知与 IM 长连接（`at-collaboration`，US-08）**：
  - **通知域统一收敛**：删除 `at-permission` 自带的站内信 / 邮件实现与渠道开关（`notify` 包、`PermissionNotifier`、
    `PermissionNotification`、本地 `NotifyMessage` 实体与 Mapper），统一为 `at-common` 的
    `NotificationPort` / `NotificationCommand` / `NotifyType` SPI，由 `at-collaboration` 独占实现——
    否则「两套渠道开关 + 两处落库」必然出现口径分歧；跨模块事件（`PermissionGrantEvent` /
    `PermissionExpiredEvent` 等）一并收归 `at-common`，消除模块间反向依赖。
  - **WebSocket 通道**：原生 `TextWebSocketHandler` + JSON 信封，**不引入 STOMP**——本场景所有下行都是
    「按用户点对点推送」，没有广播主题，STOMP 只会多一层目的地解析却仍要自建会话注册表 / 心跳 / 跨实例广播
    （`SimpleBroker` 不支持集群）；协议面更小、可测、跨语言客户端直接可用。
    握手复用 JWT 鉴权（浏览器 WebSocket 构造器无法设头，令牌走 `?token=`），30s 心跳探测 + 90s 超时清理僵尸连接，
    多实例经 Redis Pub/Sub `at:ws:channel` 广播且**只推给本机已连接用户**。
  - **可靠性口径**：消息**先落库（`sys_notify_message`）再推送**，WebSocket 仅作加速通道——离线用户走
    `GET /api/v1/notifications/offline` 补拉并清红点，故推送丢失**无需补偿重发、客户端无需 ACK**；
    校验通过后立即下发 `CONNECTED`（携带未读快照），突发重连不产生「红点闪回」。
    ⚠️ 已知边界：鉴权只在握手做一次，令牌过期 / 登出不会断开**已建立**的连接（`WebSocketConfig` 类注释已登记）。
  - **数据模型（`sql/V5__collaboration_im_notify.sql`）**：`sys_notify_message` 补会话维度列
    （`sender_user_id` / `message_type` / `chat_scope` / `chat_target_id` / `client_msg_id`，全可空，向后兼容）
    与 `idx_session`、`uk_sender_recipient_client` 索引；采用**写扩散落库**（单聊 2 行 / 群聊 N 行），
    查询恒为单表按 `(recipient_user_id, chat_scope, chat_target_id)` 走索引。
    唯一键**必须含 `recipient_user_id`**：群聊共享同一 `clientMsgId`，若只按 `(sender, clientMsgId)` 约束，
    第 2 个成员的消息会因幂等键冲突写不进去。
  - **三口径未读分离**：inbox（导航栏红点）/ todo（待办角标）/ chat（会话角标）各自成板；
    离线补拉只清 inbox，**待办已读必须由处置动作驱动**，不会被补拉顺带清掉。
  - **端点**：`GET /api/v1/notifications`（收件箱分页）、`GET /unread`、`GET /offline`、
    `POST /{id}/read`、`POST /read-all`；`GET /api/v1/todos`、`GET /api/v1/todos/count`；
    `POST|GET /api/v1/chat/messages`、`POST /api/v1/chat/read`。
    所有接口 **userId 一律取自登录态**，不提供任何以入参指定用户的口子（越权入口）。
    单条已读失败抛 `BusinessException(RESOURCE_NOT_FOUND)` 而非返回 `Result.fail`，
    避免「HTTP 200 + 业务错误码」与其余接口的错误语义不一致。
  - 🐛 **修复 afterCommit 静默丢数据**：审批事件在 `afterCommit` 回调中到达时，外层事务已提交但连接仍绑定线程、
    事务同步仍 `active`，此时 `REQUIRED` 传播会「加入」一个已完成的事务，导致 INSERT **既不提交也不回滚**
    （无异常、无日志，数据静默消失）。改为 `TransactionTemplate` + `PROPAGATION_REQUIRES_NEW`
    挂起旧事务另开新事务写入。
  - 🧪 受影响的 `at-permission` 单测（`PermissionApplicationServiceTest` / `PermissionGrantServiceTest` /
    `ApprovalPropertiesTest`）同步改用 `NotificationPort` / `NotificationCommand` mock 与断言。
- 🗂️ **文件域（at-file）目录树 / 分页列表 / 物理去重落地**（`FolderService` / `FileNodeService` /
  `FileContentService` / `FileCleanupScheduler` / `FolderController` / `FileController`）：
  - **目录树（物化路径）**：`sys_folder.path` 以「父路径 + 自身 ID」拼接，前缀查询即可取整棵子树，移动目录时
    一次性重写子孙 `path` / `depth`；移动前用**路径前缀**判成环（目标是自身或子孙），改名不影响子孙路径。
    `GET /api/v1/folders/tree` 一次返回整树（`children` 空数组而非 `null`），另有 `POST /api/v1/folders`、
    `PATCH /{id}/rename`、`PATCH /{id}/move`、`DELETE /{id}`。
  - **删除目录 ≠ 销毁文件**：目录删除只把目录及其子孙目录下的文件**移入回收站**并逻辑删除目录，
    `ref_count` 不变、文件仍可还原；只有「彻底销毁 / 清空回收站 / 回收站到期清理」才递减引用计数。
  - **物理去重（内容寻址 + 引用计数）**：`sys_file` 以 `uk_sha256_size` 唯一键保证同内容仅一份物理字节；
    首次入库 `ref_count=1`，秒传命中 / 复制 `+1`；递减走带 `ref_count > 0` 守卫的原子 SQL，
    **归零且引用表实际行数为 0**（双计数交叉校验，防计数漂移误删）才回收物理文件。
  - **物理回收放到事务提交之后**（`AfterCommitUtils`）：删字节不可回滚，若在事务内删盘又回滚会留下
    「库里有行、盘上无字节」的坏数据；故提交后先删元数据行、再删字节，回调执行前再复核一次计数，
    期间被并发秒传把引用加回去则放弃回收。
  - **IO 与事务分离**（`FileContentService` vs `FileNodeService`）：磁盘探测 / 落盘在事务外完成，短事务只写元数据；
    `sha256` 由服务端流式计算，不信任客户端上报值。
  - **分页列表多条件筛选 + 排序**：`folderId` / `keyword` / `ext` / `level` / `uploadUserId` /
    `minSize|maxSize` / `startTime|endTime` / `tagId`（空集合 = 无结果，不退化为忽略条件）；排序为
    **白名单字段映射物理列**（杜绝注入）并恒定追加主键，避免排序键相同时翻页重复 / 漏行；
    `pageSize` 收敛到 100，与分页插件上界口径一致。
  - **秒传幂等**：同用户已有同内容正常态条目时直接复用、不重复建行也不重复计数，重复秒传不会灌大 `ref_count`。
  - **权限四档**：`file:preview` / `file:upload` / `file:edit` / `file:destroy`，`file:destroy` 只给到
    「彻底销毁 / 清空回收站」；`level=3` 高敏感文件的销毁在审批联动能力到位前 **fail-closed** 一律拒绝。
  - 回收站到期清理（`FileCleanupScheduler`，cron 默认 `0 30 3 * * ?`，可配）分批循环、每批一个独立事务，
    避免长事务与磁盘 IO 尖峰。
- ⬇️ **文件域（at-file）下载票据 / Range 流式下载 / 缩略图 / 预览落地**
  （`FileDownloadTicketService` / `FileDownloadService` / `FilePreviewService` / `FileTypePolicy`）：
  - **下载票据（短时 + 绑定用户与文件）**：`POST /api/v1/files/{id}/ticket` 在登录态下校验
    `file:download` 与条目归属后签发，TTL 默认 5min（可配）。票据绑定 `userId + nodeId + 取件范围`，
    核销时逐项比对，任一不符即 `4018`。**只校验不销毁**——同一用户重试 / 断点续传 / 多线程分段拉取
    都会重复取件，一次即焚会把正常行为判成失效（与分享域访客票据的「一次即焚」刻意相反）。
  - **`/content`、`/thumbnail` 必须放行匿名**：`<a href>` 原生下载、`<img src>`、播放器与下载工具
    **都无法携带 Authorization 头**，凭证只能走查询串。故权限判定被前移到换票阶段，
    取件端点在服务层复核「票据绑定 + 当次重新读库的条目归属」（不信票据里的归属快照），
    并各自挂 `@RateLimit` 抗票据爆破。
  - **票据 scope 防权限降级**：预览票（`file:preview` 签发）只能取缩略图与「可安全内联」类型，
    **强制 inline 且不可改判为 attachment**；否则 `file:preview` 等价于 `file:download`，权限点形同虚设。
  - **Range 断点续传**：单段 `bytes=a-b` / `bytes=a-` / 后缀式 `bytes=-N` 均支持，
    206 + `Content-Range` + `Accept-Ranges`；起点越界回 **416 + `bytes */total`**（正常协议协商，不记失败审计）；
    多段 Range 按整份下发（多段响应需 `multipart/byteranges`，收益与复杂度不成正比）。
  - **任务级可选限速 + 全局兜底**：`speedLimit`（字节/秒，**未传取 `defaultSpeedLimit`，显式传 0 表示不限速**，
    两者语义不同）；每条下载流一个独立漏桶（任务粒度 = 一次传输），叠加全局桶即天然取更严者，
    顺序先任务后全局以免全局桶等待被单任务长等待挤占。**超限表现为背压等待而非掐断**——
    响应头早已发出，掐断只会让用户拿到半截文件且无法续传。
  - **补上 `BandwidthLimiter.evictIdle` 的调用方**：此前该方法零调用，而每条下载流都会建桶，
    等于一条稳定的内存泄漏（桶极小、增长慢，最容易被忽略到 OOM 才暴露）。
    现由 `FileCleanupScheduler` 每小时回收 1h 无活动的桶，与回收站清理错峰。
  - **图片缩略图**：等比缩放到最长边 256（默认），**小图不放大**；带 alpha 转 PNG、否则 JPEG。
    **防解压炸弹**：先只读图片头取尺寸做准入（`thumbnailMaxSourcePixels`，默认 4000 万像素）再决定是否解码，
    否则一个几 MB 的 PNG 可解出几万 × 几万的位图直接打爆堆；解码器初始化即关闭 `ImageIO` 磁盘缓存。
  - **PDF / 文本预览，Office 仅下载**：策略由服务端判定并随 `PreviewVO` 下发
    （`text` / `pdf` / `image` / `download-only` / `none`），前端只分发不判断，避免两端策略漂移。
    文本读前 2 MiB 后以 **JSON 字符串**返回（而非内联 `text/plain`，让 `.txt` 里的 HTML 无从执行）；
    编码判定为「严格 UTF-8 → 严格 GBK → ISO-8859-1 兜底」，并处理 UTF-8/UTF-16 BOM 与
    **末尾被截断的多字节字符**（逐字节退避重试，把「内容被截断」与「编码不对」区分开）。
    Office 系一律 `download-only`（服务端转码需 LibreOffice / POI 全量依赖，CE 不做）。
  - **内联渲染仅限 PDF 与光栅图**：内联时 MIME 按白名单**反查**给出，绝不回显客户端自报的
    `contentType`（否则等于让上传者指定浏览器用什么引擎渲染，存储型 XSS）；全链路带
    `X-Content-Type-Options: nosniff`。下载（attachment）才回显原 `contentType`，有 attachment + nosniff 兜底。
  - **下载文件名兼容老客户端**：同时给 ASCII 回退名与 RFC 5987 `filename*=UTF-8''` 编码名，
    并剔除控制字符 / 引号 / 反斜杠，避免头结构被破坏。
- 🧨 **文件域（at-file）文件管理四项能力落地**（`TagService` / `FileVersionService` / `PackService` +
  `TagController` / `FileVersionController` / `PackController`；数据层见 `sql/V6` / `V7` / `V8`）：
  - **彻底销毁（`file:destroy`）**：**绕过回收站**直接逻辑删除条目并 `ref_count - 1`，归零后物理回收。
    两条准入为**与**关系——① RBAC 的 `file:destroy`（`V8` 已从 DEPT_ADMIN 回收，等价「仅 SUPER_ADMIN」）；
    ② `level>=3` 高敏感文件必须关联一张「已通过」的高敏感审批单，经 `at-common` 的
    `SensitiveDestroyApprovalPort` SPI 校验（**不跨模块直读 at-permission**，守模块边界铁律），
    不满足统一 `4017`（策略 D，就地提示不跳登录）。此前的「审批联动到位前 fail-closed」口径就此收口。
  - **物理回收统一三道闸**（`FileNodeService#registerPurgeIfOrphaned`，公开供版本服务复用）：
    `sys_file.ref_count` / `sys_file_node` 存活行数 / **`sys_file_version` 存活版本数**任一非零即不回收。
    历史版本刻意不占 `ref_count`，第三道闸专治「版本列表已看不到某版、字节却永远留在盘上」的静默泄漏。
  - **标签与多标签搜索**：标签 CRUD + 文件打/取消标签（全量覆盖，空数组即清空；**先断关联再删标签**，
    避免出现「筛一个不存在的标签却有结果」）；列表页标签批量回显；搜索复用 `GET /files?tagId=` 或
    `tagIds=`，多标签为 **AND**（`having count(distinct tag_id)=N` 与单标签结果取交集）。
    越权口径与文件条目一致：别人的标签按「不存在」处理，不泄露 ID 空间。
  - **历史版本（P1，`versionKeepCount` 默认近 10 版）**：新版本上传走与主链路同一套
    `acquireContentReference`（同一去重与计数口径，避免两份实现漂移）；**回滚不是拨指针**，
    而是把目标版本内容复制成一条更高的 `versionNo`，使「谁在何时回滚到哪一版」永久可查；
    超限裁剪先逻辑删版本行**再**复核孤儿内容（顺序反了会把当前版算进引用、永远回收不掉）。
  - **批量打包下载（P1）**：**异步任务 + 磁盘产物**而非请求内边压边发——产物是普通 zip，`Range` 直接作用其上
    （可续传），文件数 / 合计大小 / 每用户并发全部在**创建入口**判掉（`4019` / `4103`），产物到期定时清理；
    打包线程池为独立有界池 + 中止策略（拒绝即判失败，不静默排队），提交挂在 `AfterCommitUtils` 上；
    zip 条目名做 **zip-slip 剥离 + 长度截断 + 同名去重**（`a/报告.pdf` 与 `b/报告.pdf` 不会互相覆盖）；
    僵尸任务（线程池拒绝 / 进程重启）由定时任务按超时收口，防止每用户并发名额泄漏成永久故障。
  - 📇 新增错误码 `4013`~`4023`（目录 / 回收站 / 票据 / 打包 / 标签 / 版本）已登记
    [error-codes.md](docs/api/error-codes.md)，接口前缀与语义已同步 [api/README.md](docs/api/README.md) §1。

- 👥 **系统管理面（用户 / 角色 / 权限点）落地于 `at-permission`，不新建 `at-system` 模块**：
  - 🧭 **落点裁决**：`sys_user` 的表主是 `at-auth`，故用户主数据的写入经 at-common 新增的
    `UserAdminPort` SPI 委托给 `at-auth`（`UserAdminPortAdapter`），与既有 `UserLookupPort` /
    `SensitiveDestroyApprovalPort` / `NotificationPort` 同构——**读写分道**：at-permission 只做
    「谁能管、能管到谁」的授权判定，用户行本身仍由表主单事务落库，跨模块边界不出现对方表名。
  - 🗂️ `sql/V9__system_admin_permission_points.sql`：新增 `system:user:*` / `system:role:*` 权限点，
    **仅授予 SUPER_ADMIN**；AUDITOR 一个 `system:*` 都不给。
  - 🔐 **四条不可绕过的红线**（数据层 + 服务层双保险，服务层判定见 `RoleAdminService` / `UserAdminService`）：
    ① **内置角色不可删不可改数据范围**（`SUPER_ADMIN` / `AUDITOR` / `DEPT_ADMIN` / `USER`）；
    ② **AUDITOR 权限集锁定只读**，任何变更请求一律 `1021`（改「审计员能不能看审计」= 让被审计者改考卷）；
    ③ **防提权**：数据范围非「全部」的操作者不能把角色范围改到超过自身、不能授予自身不具备的权限点、
    不能分配自己不持有的角色；
    ④ **防自锁**：`SUPER_ADMIN` 的必需管理能力（`assign-perm` / `user:list` / `user:assign-role`）不可削空、
    系统内最后一个可用超管不可停用 / 删除 / 摘角色，`admin` 受保护账号必须始终持有超管角色。
  - 🚫 **不得对自己操作**：停用 / 删除 / 重置口令 / 改角色四类动作对自己调用一律 `1023`
    （应走个人中心），杜绝「自查自升」与「一键自锁」两条最短路径。
  - 🔁 **调岗 / 离职触发权限重评估**：部门变更、停用（离职）、删除均调用 4.2 的
    `PermissionGrantService#revokeApprovalGrants` 回收其审批类授权，并 `invalidate` 权限缓存；
    部门未变化时不触发，避免无谓回收。**该副作用无返回值、漏调不报错**，故用 verify 钉死在单测里。
  - 🧾 **唯一性口径**：`uk_username` 是纯 username 唯一键、逻辑删除行仍占名，故建号查重走
    `countUsernameAnyState`（含删除行），撞名返回 `1016` 业务错误而非数据库异常 500。
  - 🔑 重置口令 / 停用 / 删除同步 **`token_epoch + 1`** 吊销在途会话，改密后旧 token 立即失效。
  - 📇 新增错误码 `1015`~`1028`（用户 / 角色 / 内置角色保护 / 防提权 / 防自锁）已登记
    [error-codes.md](docs/api/error-codes.md)；接口前缀 `/v1/system/users`、`/v1/roles`、
    `/v1/permission-points` 与逐端点权限点已同步 [api/README.md](docs/api/README.md) §1 与
    [frontend-permission-map.md](docs/development/frontend-permission-map.md)。
  - 🧪 新增单测 36 例（`RoleAdminServiceTest` 17 例 / `UserAdminServiceTest` 19 例）：
    四条红线逐条断言「抛的是哪一条」而非「抛了异常」、授权替换的「复活 / 停用 / 新增」三分类、
    缓存按角色持有者广播失效、数据范围收敛与分页上界。

- 🧾 **审计日志域（§4.6 审计与合规 · US-06）**：共享内核 + 权限/审批域全量埋点 + 检索导出接口「三件套」落地：
  - **共享内核下沉**：`sys_operation_log` 的实体与 Mapper 由 `at-file` 迁至 `at-common`
    （`com.anttransfer.common.audit.{OperationLog, repository.OperationLogMapper}`），落实 V1 表注释
    「审计族归口 at-common / at-permission」，使跨域（FILE / PERMISSION / AUTH）只写各自 logger 而不再「谁写审计就依赖谁」；
    动作字典（`FILE_*` / `SHARE_*` / `USER_*` / `ROLE_*` / `APPLY` / `APPROVE` / `REVOKE`…）与域 / 对象 / 结果常量集中一处，查表即知全集。
    `at-file` 侧 10 个 service 与两个审计器（`FileAuditLogger` / `ShareAuditLogger`）**仅切 import，行为零变化**；
  - **写侧埋点**（口径沿用 `FileAuditLogger`：**成功记录入调用方业务事务、失败记录走 `REQUIRES_NEW` 独立事务先提交**，保证「业务回滚不留成功假象」且「越权 / 被拒事件不会被回滚吞掉」）：
    `PermissionAuditLogger` + 用户管理 6 处（建号 / 编辑含调岗 / 重置口令 / 启停 / 删除 / 改角色）、
    角色管理 4 处（建 / 改含数据范围前后 / 删 / 授权整集替换含新增与移除差量）、
    审批 4 处（提交 / 通过（另记一条 `GRANT` 授权落地 + 有效期）/ 驳回（记理由）/ 转审（记 from→to））、
    授权回收 1 处（记回收原因、命中与回收条数、grantId 集）；**口令类只记「谁重置了谁」，绝不落口令明文 / 哈希**；
  - **读侧接口**（`AuditLogController`，前缀 `/api/v1/audit`，**独立于 `/v1/system` 管理面**，与四只读权限点受众 AUDITOR 对齐）：
    `GET /api/v1/audit/logs` 分页检索（过滤维度一一对齐 `idx_user_time` / `idx_target` / `idx_module_action` / `idx_log_time` 四个索引，
    固定 `log_time DESC, id DESC`，不接受任意字段排序以免走不了索引的全表排序）与
    `GET /api/v1/audit/logs/export` 导出 CSV（与列表**同一套过滤**，UTF-8 BOM 供 Excel 识别中文 + RFC 4180 转义使含逗号/引号的
    JSON `detail` 不错列；**单次 10000 行硬上界**——导出走 `selectList` 不受分页插件 100 上限约束，故必须自设上界防整表入内存）；
    两端点**共用** `audit:log:read`（仅 SUPER_ADMIN / AUDITOR，二者 data_scope 均为「全部」，审计的全量可追溯性不可按部门切分）。
    操作人展示名经 `UserLookupPort.findContacts` **批量**反查（N+1 → 1，`sys_user` 属 at-auth 表族不直连），查不到回落为空、不阻断；
  - **只读承诺**：服务层仅 `selectPage / selectList`，全链**不提供任何 update / delete / 清除端点**——
    与「审计不可被任何角色修改或删除、仅可归档导出」「`audit:log:clear` CE 从不签发（超管亦无）」两条红线一致；
  - 🧪 新增单测 11 例：`AuditLogQueryServiceTest` 7 例（展示名批量反查 / 系统动作不反查 / 缺联系人回落 / 分页与页码收敛 /
    时间倒挂早失败且不打库 / 导出强制 `LIMIT` 上界 / 导出与列表同过滤）+ `AuditLogCsvTest` 4 例（BOM / 空结果仅表头 /
    逗号引号换行转义与结果语义化 / null 渲染为空串）；同步 4 个既有 Service 单测的构造依赖（注入 `PermissionAuditLogger`）。

- 📊 **工作台「传输量 / 成功率」统计聚合落地（`at-transfer` + 前端接真实接口）**：
  - 新增 `GET /api/v1/transfers/statistics`（`TransferStatisticsController`，**登录即可用、不挂权限点**——只回调用者自己的聚合数字，
    用户 ID 仅从登录态取；一旦开放 `?userId=` 就能越权看他人传输量）；
  - 数据源复用共享内核审计账本 `sys_operation_log` 的 `FILE_UPLOAD` / `FILE_DOWNLOAD` 流水（不另立统计表，避免双写漂移）；
    `detail` 字节键由 `OperationLog` 集中定义（`transferredBytes` / `sentBytes`），写方（at-file）与聚合 SQL 引用同一常量，
    **键名一改即编译失败**，不会退化成「统计悄悄恒为 0」；
  - 口径：条数按 `result` 分成功 / 失败（失败不并入 upload / downloadCount，否则成功率分母自我重复计入）；
    字节取**实际过网量**——上传 `transferredBytes`（秒传命中为 0）、下载 `sentBytes`（`Range` 续传只计本段），
    且**不受结果过滤**（失败前已下发的半份仍是真实流量）；无任何流水时 `successRate` 返回 `null` 而非 `0`，以区分「还没数据」与「全失败」；
  - 字段级契约：`TransferStatisticsVO`（record）与前端 `services/dashboard/types.ts` 的 `TransferStats` 逐一对齐；
    工作台四卡片全部接真实接口，统计拉取失败仅让对应卡片降级为「--」占位（`silent` 请求、不弹错误 toast），整页照常可用；
  - 🧪 单测 5 例（`TransferStatisticsServiceTest`：聚合 / 无数据 null 率 / 全失败 0% / 整数率保留一位小数 / null 列归 0）+
    Testcontainers 集成 3 例（`TransferStatisticsIntegrationTest`，真 MySQL 8.4 校验 JSON 路径与口径：只看自己 / 秒传不计量 /
    失败前已下发算量 / 老流水缺字节键归 0 / 无流水 null 率 / 未登录 401(1001)）。

- 🧪 **质量门禁补齐：JaCoCo 覆盖率接入 `verify` + 前端独立 CI job**（对应交付 DoD 第 2 / 4 条，
  核对结论见 [docs/development/dod.md](docs/development/dod.md)）：
  - 父工程 `pom.xml` 接入 `jacoco-maven-plugin` **0.8.15**：`prepare-agent` 探针 + `verify` 阶段 `report`
    （各模块产出 `target/site/jacoco/{index.html,jacoco.xml,jacoco.csv}`）+ `check` 判定规则
    （**模块整体行覆盖率 ≥ 85%**、**安全逻辑类 ≥ 90%**，与 DoD 门槛一致）；
  - ⚠️ `check` 当前以 `haltOnFailure=false` **report-only** 运行：实测基线（2026-09-14）为
    **整体 36.50%（1892/5184 行）**、**安全包 52.86%（120/227 行）**，远低于目标值 —— 若直接硬门禁会让 CI
    永久红灯并阻断全部合并；达标后删除该参数即成为硬门禁（`pom.xml` 内已就地标注 ⛔）；
  - 打开 CI 中原 `if: false` 的覆盖率步骤，改为 `codecov/codecov-action@v7` 上传各模块 `jacoco.xml`；
    新增仓库根 [`codecov.yml`](codecov.yml)（后端防回归下限 `project target 36%` / `threshold 1%`，
    patch 覆盖率仅公示不阻断）；
  - CI **新增 `frontend` job**（Node 22，`web/` 工作目录）：`npm ci` → `npm test` → `npm run tsc` → `npm run build`，
    前端用例与类型错误自此进入 CI（此前 CI 仅覆盖后端），两个 job 并列即为「测试失败 → CI 红」；
  - 📌 统计口径：85% 按模块（BUNDLE）、90% 按类（CLASS）逐一判定；`at-collaboration` 因暂无测试执行
    不产出 `jacoco.exec`，报告与判定被自动跳过（属「尚未被测」而非「通过」）。
- 📄 **新增 [docs/development/dod.md](docs/development/dod.md)：交付质量 DoD 清单本体 + 逐项核对结论**，
  含四项标准的达成判定、实测证据、分模块覆盖率基线表、差距分析与待办清单；并在
  [docs/development/README.md](docs/development/README.md) § 测试策略建立入口（与 `architecture.md`
  § 🎯 本阶段 DoD「阶段范围 DoD」明确区分，避免两套 DoD 混淆）。

### 🔄 Changed（变更）

- ⚠️ **授权收敛（破坏性）**：`sql/V8__restrict_file_destroy_to_super_admin.sql` 从 DEPT_ADMIN 回收
  `file:destroy` 授权行。部门管理员不再能执行彻底销毁，须由超管操作；前端须同步隐藏 / 禁用销毁入口
  （[frontend-permission-map.md](docs/development/frontend-permission-map.md) 已回写）。
  「谁有资格发起」（权限点）与「高敏感文件需二次背书」（审批单）是相互独立的与关系。

- 🧾 **审计耐久性：失败记录不再被业务回滚吞掉**（`FileAuditLogger`）。失败审计的典型调用形态是
  「记一条 fail，紧接着 `throw`」（如销毁高敏感文件缺审批单 → `4017`），该 INSERT 原先跟随业务事务，
  那声 `throw` 触发的回滚会把它一并抹掉——于是**最需要留痕的「越权 / 缺审批被拒」事件恰恰查不到**，
  审计只在一切顺利时可信。现改为**失败记录走 `REQUIRES_NEW` 独立事务先提交**；
  **成功记录仍加入调用方业务事务**，使「业务回滚了、库里却留着一条成功」不可能发生。
  「审计写失败永不抛异常」的口径不变（审计不得反向让业务失败）。属
  [red-team T-05](docs/architecture/red-team-review.md) 的部分收敛，其余（AFTER_COMMIT 异步 + 补偿队列、
  审计表 DB 账号只 insert/select、归档物理删除）仍开放。
- 🗑️ **删除无归属过滤的批量读 API `TagService#tagsByNodeIds(List<Long>)`**：该签名只吃 `nodeIds`、
  不吃 `ownerUserId`，无论怎么实现都在诱导调用方「先查后校验」，某个列表接口一旦漏做归属过滤，
  它就成了按 ID 批量拖走他人标签的**静默越权通道**（且该方法是死代码：列表页回显实际由
  `FileNodeService#loadTags` 在「已按 `owner_user_id` 过滤完的分页结果」之上完成）。
  现以一条注释钉死该设计口径，杜绝日后重新引入。

- 🧹 `web/biome.json` 忽略范围由 `**/src/services`（整个服务层）收窄为 `**/src/services/ant-design-pro`：
  原规则本意是跳过脚手架生成的服务代码，但一并跳过了**手写**服务层——`src/services/upload/**` 自此纳入 lint 与格式化。
- 🔧 修复页脚（`web/src/components/Footer`）遗留的 4 条类型报错：`web/package.json` 补 `repository` 字段
  （原缺失导致 `tsc --noEmit` 报 TS2339）；同时把仓库地址推导从「写死 github.com」改为**只做规范化**
  （去 `git+` 前缀、`git@host:path` 转 https、去 `.git` 后缀），使 Gitee / GitLab 等非 GitHub 仓库也能正确成链
  —— 否则会静默退回 Ant Design Pro 模板地址，把用户引到别人家的仓库；页脚文案随之改为显示实际托管域名。
- ⚠️ **本地开发默认数据库端口 `3306` → `3307`（杜绝误连本机 MySQL）**：原 `DB_URL` 默认
  `localhost:3306`，容器没起来时会静默连上开发者本机自装 MySQL 并把 Flyway 跑完，形成
  「迁移成功、数据却进了本机库」的假象。现确立口径：**宿主机 `3307` = 本项目容器 MySQL，
  `3306` 留给本机自装 MySQL**——`docker-compose.dev.yml` / `docker-compose.yml` 宿主映射默认
  `${MYSQL_PORT:-3307}`（容器内仍为 3306）、`.env.example` 设 `MYSQL_PORT=3307`、
  `application.yml` / `application-mysql.yml` 默认 URL 与端口同步为 3307。
  **升级须知**：用容器库者无需改动（重新 `up -d` 即映射新端口）；一直使用本机自装 MySQL 者
  请显式设置 `DB_URL`——否则会连 3307 失败，这正是期望的 fail-fast。
- 🔎 新增 dev 启动自检 `DatabaseEndpointLogger`（at-bootstrap）：启动后打印实际 JDBC URL、
  服务端版本、当前库名与 Flyway 已应用版本；若连的是本机地址且端口非 3307，
  追加醒目告警点明「数据写入了本机库，容器库不受影响」。
- ⚠️ **破坏性：认证授权错误码重排（1xxx）** —— 裁决 [AT-DIFF-01]，采纳「权限不足 = `1003 / 403`」口径：
  `1003` 由 `TOKEN_INVALID(401)` 改为 **`NO_AUTH(403)`**，原 Token 非法后移至 `1006`；
  账号锁定 `1005→1004`、账号禁用 `1006→1005`。新排序为
  `1001 未登录 / 1002 过期 / 1003 无权限 / 1004 账号锁定 / 1005 账号禁用 / 1006 Token 无效 / 1007 密码错误`。
  已同步 `ErrorCode`、`docs/api/error-codes.md`（附录 B 迁移表）、at-auth 两个 handler、
  at-permission 注解与切面、at-gateway `GlobalExceptionHandler`、前端 `web/src/utils/result.ts`
  策略表与单测。前端红线更新：**`1003` 属策略 D（就地提示、禁止引导登录），跳登录改用 `1006`**。
- 📦 后端模块物理路径由仓库根迁移至 `server/`，同步修正 Maven 聚合、Dockerfile 产物路径与文档链接。
- 🗄️ 原 `sql/create_table.sql` 整理为 Flyway 风格 `sql/V1__schema.sql`（内容不变）。
- 🔄 `sql/V1__schema.sql` 全量重置为 CE `sys_` 前缀 16 表四族基线：原脚手架示例表
  （`user`/`post`/`post_thumb`/`post_favour` camelCase 版本）移除，`V3__permission_apply.sql`
  审批两张表并入；统一雪花主键、`snake_case`、`tenant_id` 预留列与 `deleted` 逻辑删除规约。
- 🏷️ `sql/V1__schema.sql` 二次重置：表族命名对齐 `sys_` 前缀（`sys_user`/`sys_role`/
  `sys_permission`/`sys_file`…16 表，旧直连命名废弃），权限点表字段 `code/name` 更名为
  `perm_code/perm_name`；逻辑删除列 `is_delete` → `deleted`（同步 at-common `BaseEntity` 与
  全局 logic-delete-field）；`sys_user_file_permission` 增加 `grant_source`（角色继承 / 审批获得）
  来源语义与 `expire_at` 时效回收（PermissionGrant 实体与到期回收定时任务同步适配）。
- ▶️ 应用启动默认执行 Flyway 自动迁移（`FLYWAY_ENABLED` 默认 true）+ `baseline-on-migrate` /
  `baseline-version=0` 存量库基线设定；新增 `application-mysql.yml` / `application-pg.yml`
  数据源 profile 示例与 PostgreSQL 方言/驱动依赖（V1/V2 仍为 MySQL 方言，需改写后启用）。
- 🎭 内置角色模型定稿（随 V2 初始化）：原三权分立细分职能并入 SUPER_ADMIN，四角色
  SUPER_ADMIN/AUDITOR/DEPT_ADMIN/USER；AUDITOR 仅日志只读（audit:log:read），USER 不含 file:destroy。
- ⏰ at-permission 授权到期回收定时任务（PermissionGrantExpireScheduler +
  PermissionExpiredEvent）：@Scheduled 每小时扫描 `sys_user_file_permission` 中
  `expire_at<=now` 的生效授权 CAS 置失效、事务提交后发布事件；同步补齐模块依赖与 @EnableScheduling。
- 🐳 `docker-compose.dev.yml` 按 Flyway 默认自动迁移语义重写：移除 initdb.d 对 V1/V2 的挂载
  （避免与 Flyway 重复执行冲突），建表与初始化数据统一由应用 Flyway 承担；
  initdb.d 改为 `deploy/docker/mysql-initdb.d/` 自定义入口（默认空，含使用说明）。
- 🗝️ Redis Key 规划定稿（at-common `RedisKeyConstants`）：`at:` 统一前缀 + TTL 秒常量 + 键工厂方法，
  覆盖会话 / 登录失败 / 上传任务 / 外发分享 / 权限缓存 / WS 集群广播（镜像 system-design §7.1）。
- 📦 统一响应地基补齐：`PageResult<T>` 分页响应体（`records/total/current/pageSize/pages`，
  对齐 `docs/api/README.md` §3，支持 `PageResult.of(IPage)` 直接转换 MP 分页结果）。
- 🚨 认证授权异常 `AuthException`（at-common）：承载 1xxx 段错误码，与业务异常 `BusinessException`
  分轨处理，供 at-auth 接入 Spring Security 后统一转换 `AuthenticationException` / `AccessDeniedException`。
- 🧩 MyBatis-Plus 装配落地（at-bootstrap `com.anttransfer.bootstrap.mybatis`，**不放在共享内核**）：
  ① 分页插件 `MybatisPlusConfig`（单页上限 100 对齐契约、方言由 `anttransfer.persistence.db-type` 配置）；
  ② 自动填充 `FillMetaObjectHandler`（createTime/updateTime/deleted 兜底 0 + 操作人填充，非空不覆盖）；
  ③ 新增 `CurrentUserProvider` SPI 保留在 at-common（供 at-auth 实现，避免 at-auth 反向依赖
  at-bootstrap），at-common 依赖收敛为 `mybatis-plus-annotation` + `mybatis-plus-core`，
  不再引入 starter / JDBC 传递依赖。
- 🧪 at-common 单测骨架：`ResultTest` / `PageResultTest` / `FillMetaObjectHandlerTest`（17 例），
  为「统一契约」提供回归保护。
- 🔐 认证吊销模型重构（system-design §2.1~2.3）：废除“逐 jti 黑名单 `at:deny:{jti}`”，改为
  “DB `sys_user.token_epoch` 权威 + Redis 缓存/白名单 + JWT `ver` claim”混合模型；refresh 白名单
  键定稿为 `at:token:refresh:{userId}`（原 `at:refresh:{userId}` 废弃）；`token_epoch` 增列
  随 at-auth 会话实现以 Flyway V3 落地。
- 🔢 外发分享次数口径定稿（system-design §5.3）：DB 原子 UPDATE（`downloaded_count < download_limit`）
  为唯一放行裁决防超卖，Redis `at:share:count:{token}` 降级为前置配额闸/镜像（丢失回源自愈）；
  提取码错误锁定键定稿 `at:share:lock:{token}`（连续错 5 次锁 30min，对齐 PRD US-03）。

- 🛡️ 全局异常处理器 `GlobalExceptionHandler` 覆盖 15 类异常，按「认证授权 / 业务 / 参数校验 /
  协议层 / 系统兜底」分轨映射错误码：新增 `AuthException`（1xxx）、`BindException`、
  `HandlerMethodValidationException`、`ConstraintViolationException`、`ServletRequestBindingException`
  （2xxx）、`HttpMediaTypeNotSupportedException`（4007/415）、`HttpRequestMethodNotSupportedException`
  （2001）、`MaxUploadSizeExceededException`（4006/413）、404 统一转 `Result`（4040）。
  红线：**未预期异常只回 `5001 系统繁忙` + traceId，完整堆栈仅落服务端日志**。
- 🎫 新增错误码 `4040 RESOURCE_NOT_FOUND`（HTTP 404，中文提示「资源不存在」），同步
  `docs/api/error-codes.md`；按契约 §9「分段内新增错误码为非破坏性」直接发布。
- 🗂️ 错误码表按「处理策略」分门别类（`docs/api/error-codes.md` 重写）：新增
  **A 成功 / B 流程分支 / C 凭证失效 / D 拒绝不跳登录 / E 请求需修正 / F 状态失效冲突 /
  G 限流退避 / H 系统兜底** 八类策略，每张表增加「策略」列，并补充
  「重试语义」（可安全重试 / 仅一次重放 / 须先刷新状态 / 须重新发起 / 不可重试）与
  「服务端副作用」（提取码计数锁定、通知创建者、令牌吊销）两张注明表；
  `ErrorCode` 枚举逐条以 `【策略 X】` 标注，新增错误码须同步补标注。
- 🧵 新增 `logback-spring.xml`：`CONSOLE_LOG_PATTERN` 增加 `%X{traceId}`，使 `TraceIdFilter`
  写入 MDC 的 traceId 真正贯穿每一行日志（此前仅写入 MDC、无 pattern 消费）。
- 🌐 前端按统一契约改造（原为 Ant Design Pro 模板的 `success/errorCode/errorMessage` 结构）：
  ① 新增 `web/src/utils/result.ts` —— `Result<T>` / `PageResult<T>` 类型与 A~H 处理策略表
  （镜像后端 `ErrorCode`，未登记的错误码降级并在开发期告警）；
  ② 新增 `web/src/utils/token.ts` —— 双令牌存储，SSR/隐私模式下降级为内存；
  ③ 重写 `web/src/requestErrorConfig.ts` —— 业务判据改为 `body.code`、响应体不拆包；
  **B 类流程分支码（1008/1009/4001/4002）绝不弹错误提示**；
  `1002` 在响应拦截器内静默 refresh（单飞）+ 重放原请求一次，`1001/1006` 清会话跳登录、
  `1007` 仅提示；G 类退避提示、H 类通知展示 traceId；请求拦截器注入 `Authorization`；
  ④ 单测 20 例（前端全量 31 例通过），覆盖策略分流与「B 类不弹窗」红线。
- 🧾 at-gateway 增加 `spring-boot-starter-validation`：Boot 2.3+ 起 `@Valid`/`@Validated`
  不再随 web starter 传递，补齐后参数校验才真正生效。

- 🔐 **JWT 认证链路落地（at-auth，system-design §2 定稿模型）**：
  ① 登录校验（BCrypt cost=10 与 V2 admin 密文一致）+ Spring Security 过滤链；
  ② 双令牌：access JWT（HS256，30min，claims 含 `sub/ver=token_epoch`，无角色避免陈旧）
     + refresh 随机不透明串（7d，Redis 白名单只存 SHA-256 指纹）；
  ③ `JwtAuthenticationFilter`：Header 解析 → 验签/过期（1002/1006）→ Redis 纪元缓存比对
     （miss 回源 DB 自愈 P-8）→ 构建 `Authentication` 入 SecurityContext，未认证统一
     `Result` 输出（1001/1002/1006，默认拒绝 V-06）；
  ④ 登出/全端吊销：DB `token_epoch+1`（REQUIRES_NEW 提交）+ 提交后清理 Redis 键；
  ⑤ 登录失败 Redis 计数：5 次锁 15 min（`at:login:fail:{username}`），成功清零；
  ⑥ refresh 原子轮换（Lua）+ 复用打击（指纹不匹配 ⇒ epoch+1 全端吊销）；账号不存在与
  密码错误统一 `1007` 不泄露账号存在性。
- 🗄️ Flyway `sql/V3__add_user_token_epoch.sql`：`sys_user.token_epoch`（会话吊销纪元）。
- 🔌 新增认证端点：`POST /api/v1/auth/token`（登录）/ `POST /api/v1/auth/token/refresh`
  （刷新，白名单）/ `POST /api/v1/auth/logout`（登出，需登录）/ `GET /api/v1/auth/me`；
  `SecurityCurrentUserProvider` 接通 at-common SPI，`createBy/updateBy` 自动填充生效。
- 🧪 at-auth 单测 11 例（JwtTokenProvider 签发/验签/过期/指纹 + AuthService 锁定阈值/状态）。

- 🔐 **RBAC 鉴权落地（at-permission，system-design §3 / 前端映射见 docs/development/frontend-permission-map.md）**：
  ① `AuthenticatedUser` 公共主体验约（at-common），跨模块读 SecurityContext 不破坏依赖铁律；
  ② `@RequiresPerm("file:download")` 注解 + AOP 切面：多角色权限点取**并集**（`sys_role_permission`
     distinct 查询）、**显式 Deny 优先**（`anttransfer.permission.role-deny` 角色黑名单，命中即
     deny 即使他角色已授予）、`any=true` 满足其一；不满足统一 403（1003）；
  ③ `PermissionService`：解析结果缓存 `at:perm:{userId}`（30min，RedisKeyConstants），
     miss 回源 DB 自愈（P-8），授权/角色变更 `invalidate` 主动失效（PRD US-04 即时生效）；
  ④ `AccessControlService`：对象级/数据级守卫——Owner 即本人放行；数据范围 3 全部放行；
     2 本部门及以下（sys_dept.ancestors 祖先链子树判定）；1 仅本人，其余默认拒绝——
     防水平越权（改 fileId 看不到他人文件）的统一入口（红队 V-01/V-06）；
  ⑤ 三权分立：AUDITOR 仅 `audit:log:read`（写类 @RequiresPerm 天然 403）+ role-deny 纵深防御；
     「日志清除」权限点 CE 从不签发，SUPER_ADMIN 亦无（审计不可改删，PRD US-06）；
  ⑥ `GET /api/v1/permission/my` 返回 `{roles, permCodes, dataScope}` 供 Phase 5 前端
     路由守卫 / 按钮显隐与后端一一对应（旧 `@RequirePermission` 标记 @Deprecated）。
- 🧪 at-permission 单测 11 例（并集/Deny 优先/AUDITOR 403/超管无 log:clear/归属与部门范围）。
- 🧭 自测冒烟端点 `SmokeGuardController`（`/v1/smoke/perm/{read,write}`，仅 `anttransfer.smoke.enabled=true`
  且 dev profile 下注册）用于 RBAC 端到端验收；dev profile 追加 Swagger 免登录白名单。
  **2026-09-07 实机自测通过**：Swagger 200；登录返回双 Token；无 Token 访问受保护接口
  401(code=1001)；审计员读 `file:download` 与写 `file:destroy` 均 403；admin/auditor 权限快照正确。
- 🧱 at-gateway 地基补齐：
  ① 访问日志过滤器 `AccessLogFilter`（order=1，随 TraceIdFilter 之后）：单行 access log
     （method/uri/status/耗时/客户端 IP/traceId，uri 不落 query 防敏感参数泄漏）；
  ② 全局异常新增 `AccessDeniedException` → **1003 NO_AUTH（403）** 兜底分支
    （2026-09-13 裁决 AT-DIFF-01：采纳「权限不足 = 1003/403」口径，原 1004 已替换，
    详见 docs/api/error-codes.md 附录 B 与上文 Changed 段的破坏性变更说明）；
  ③ `@RateLimit`（at-common）+ Redis 固定窗口切面（at-gateway）：Lua INCR+EXPIRE 原子计数，
     超限抛新错误码 **4290 RATE_LIMITED**（HTTP 429，策略 G，前端已登记）；Redis 异常降级放行
     仅告警；
  ④ CORS 白名单属性化：`anttransfer.cors.allowed-origin-patterns`（at-gateway 与 at-auth
     同键消费），dev 默认 `*`、生产以 `ANTTRANSFER_CORS_ALLOWED_ORIGINS` 收紧；
  ⑤ 容器级错误页统一为 `Result` JSON（新增 `com.anttransfer.gateway.error` 包）：
     `HttpStatusErrorMapper`（HTTP 状态 → 已登记错误码兜底映射，**绝不新建错误码**）+
     `ApiErrorController`（实现 `ErrorController` 接管 `/error`，Boot `BasicErrorController` 因
     `@ConditionalOnMissingBean` 自动退让）+ `JsonErrorReportValve`（继承 Tomcat `ErrorReportValve`，
     覆盖**绕过 Spring MVC 异常链的连接器级拒绝**：非法 URI(400)、超限请求头/请求行(400)，
     此前一律返回 Tomcat HTML(`HTTP Status 400 – Bad Request`)）+ `TomcatJsonErrorReportConfig`
     （监听 `WebServerInitializedEvent`，仅对 Tomcat 生效，移除 Boot 注入的 `ErrorReportValve`
     并装载本阀门）。响应体只含错误码默认文案 + traceId，真实堆栈仅落服务端日志。

- 📋 新增差异点索引页 `docs/development/AT-DIFF-todos.md`：汇总外部计划与仓库契约的 5 处差异
  （AccessDenied 1003/1004、Filter 权限加载、部门范围拦截器、HTTP JUnit5 测试、接口命名），
  详细描述与方案已嵌代码内 `TODO[AT-DIFF-01~05]`；其中 **AT-DIFF-01 已于 2026-09-13 裁决**
  （改采 1003/403，见上文 Changed 段），余下 02/03/05 项仍开放。
- 🧩 OpenApiConfig（at-bootstrap）：Swagger UI 增加 `bearerAuth` 安全方案与全局 SecurityRequirement，
  登录拿到 access token 后可在 UI Authorize 处填入并在线调试全部受保护接口。
- 🧪 正式集成测试套件 `AuthFlowIntegrationTest`（at-bootstrap，Testcontainers 自动拉起 MySQL+Redis，
  无 Docker 自动跳过）：认证/授权八条全链路断言（登录双 token、401/1001、200、auditor 403/1003、
  登出后旧 token 失效 401/1001、refresh 复用打击 401/1006、错误密码 401/1007）；
  AT-DIFF-04 已办结。

- 📊 **PRD §4.1 实现现状核查「后端」复核（`docs/prd/README.md`）**：原表仍是「审批 / 用户管理 /
  角色管理 / 审计 / 通知 / IM / 待办 / 打包 / 限速 / 秒传 / 外发链接全部未落地」的早期快照，
  与代码严重脱节。本次以 `server/` 实际实现为准重核 P0 全表（**10 → 18 行，补齐 §4 有 P0 而
  原表漏报的 8 项**）+ P1 段 + 横切地基：
  - **状态修正**：秒传 + SHA-256 校验、外发链接、站内通知 由 ⬜ → ✅；
    分级权限申请审批闭环由「闭环全缺」→ 🟡（提交 / 通过 / 驳回 / 转审 / 待我审批 / 我的申请 /
    权限地图七端点已落地，仍缺「申请人主动撤销」端点，以及「每级别自动放行 / 一级审批」的可配规则）；
    三权分立保持 🟡，但补记已实现的内置角色保护与防自锁两条锚点，缺口收敛为
    「角色互斥无数据层约束 / 服务层校验」（`mutex` 全文零命中）；
    分片上传 / 断点续传仍为 ⬜（`at-transfer` 未落地，无 precheck / parts / merge，未消费 `sys_upload_task`）；
  - **新增行**：审计与合规（✅，共享内核 + 三域写入器 + 检索导出 + 只读承诺）；本地账号登录 / 注销 / 改密
    （🟡，缺用户自助改密端点，改密目前仅管理面重置且已带全端吊销）；账号停用 / 启用（🟡，
    **不满足「停用 2 分钟内会话失效」**——`changeStatus` 未联动吊销、Filter 不校验 `status`，旧 access 最长 30 min）；
    敏感级别与审批规则配置（🟡，字段与 SLA 已在，缺「单级自动放行 / 一级审批」可配规则与级别变更审计）；
    上传 / 下载流式接口（🟡，下载 Range 与上传流式 sha256 已在，缺「暂停 / 恢复」所需的分片清单）；
    文件管理（✅，目录 / 移动 / 复制 / 软删 / 回收站 / 恢复 / 销毁 / 清空全链）；共享空间（⬜，
    `sys_space` 仅骨架实体、无 Controller / Service / 成员角色端点）；配置管理 / 健康检查 / 优雅启停（🟡，
    **发现上传上限完全未配置**——无 `multipart.max-file-size` 亦无 `MultipartConfigElement`，沿用 Spring 默认 1 MB；
    无 actuator 健康端点、未开 `server.shutdown=graceful`、compose 中 server 无探针）；
  - **P1 段**：补两处精确缺口——`keyword` 为 LIKE 匹配、**未建全文索引**（§4「全文搜索」未满足）；
    轻 IM 缺 **@ 提及**与「消息保留 ≥ 30 天」策略；
  - **新增盘点**：后端 20 个测试类逐类用例数、Flyway `V1~V9` 用途，以及开放裁决项刷新
    （AT-DIFF-01 已裁决，02 / 03 / 05 待裁决，06~10 已登记未阻塞）；
  - **路径约定**：§4.1 端点统一**省略全局前缀 `/api`**（`server.servlet.context-path=/api`），
    消除同一小节内 `/v1/...` 与 `/api/v1/...` 混用导致的歧义。

- 🧱 **后端功能缺口登记（GAP-01 ~ GAP-08，留待项目完工后回头改进）**：§4.1 复核发现的
  「已落地部分中的缺口」（**非口径差异**，故不落 `TODO[AT-DIFF-]` 标记、AT-DIFF grep 计数仍为 3 处）
  已在 `docs/development/AT-DIFF-todos.md` 新增独立小节登记，并在 `docs/architecture/architecture.md` §4
  延期登记处加交叉引用，**与 D-x 同批关闭**（三条主线跑通后的加固期）：
  ① 上传大小上限未配置（Spring 默认单文件 **1 MB**，`multipart` 段与 `MultipartConfigElement` 全仓零命中，**建议提前**）；
  ② 账号停用未联动吊销会话（不满足「停用 2 分钟内会话失效」：`revokeAll` 未被 `changeStatus` 调用、Filter 不校验 `status`）；
  ③ 无用户自助改密端点（仅管理面 `reset-password`，自助入口与首登强制改密无法闭环）；
  ④ 健康检查端点 / 优雅启停 / compose 中 server 探针三项缺失；
  ⑤ 三权分立缺角色互斥校验（`mutex` 全仓零命中，无数据层约束与服务层校验）；
  ⑥ 敏感级别缺变更端点与变更审计、缺「提级需审批」强制联动；
  ⑦ 全文搜索未建索引（`keyword` 走 LIKE，数据量增长后无法走索引）；
  ⑧ 轻 IM 缺 @ 提及与「消息保留 ≥ 30 天」策略（无归档 / 清理任务）。
  共享空间 / 审批端点 / 分片上传三项已由 **D-11 / D-5** 覆盖，**未重复登记**。

- 🧱 **构建前置门禁：JDK 版本不符时构建一开始就失败**（根 `pom.xml` 新增 `maven-enforcer-plugin`
  的 `requireJavaVersion`，版本区间 `[21,)`，绑定最早的 `validate` 阶段）。此前 `JAVA_HOME` 指向 JDK 17
  时会撞上一种极隐蔽的失败：`target/classes` 里是 JDK 21 编的类（major 65），JDK 17 的 javac 因增量检查
  认定「Nothing to compile」而**跳过重编译**，构建日志一路全绿，直到 `spring-boot:run` 派生 JVM 才抛
  `UnsupportedClassVersionError`（65.0 无法被只认到 61.0 的 JVM 加载）——报错落在运行期、根因却在环境变量。
  现 JDK 不对即失败并直接给出修复指引（`mvnw -v` 可查看当前 JVM）。口径：校验的就是「运行 Maven 的 JDK」
  （它同时是 `spring-boot:run` 派生 JVM 的来源，二者必然一致），下界 21、不设上界（JDK 22/25 照常放行）。

### 🔒 Security（安全）

- 🚫 生产 profile 默认关闭 Swagger / OpenAPI 文档暴露。
- 🔐 JWT 签名算法**固化 HS256**（`JwtTokenProvider`）：原用 jjwt `signWith(SecretKey)` 单参重载，
  会按密钥字节长度**静默选择 HS256/384/512**——算法随密钥长度漂移，与 system-design 定稿口径不符，
  且难过安全评审。现改为显式 `signWith(key, Jwts.SIG.HS256)`，验签后额外校验 JWA 算法头与预期一致
  （不一致即 `1006 TOKEN_INVALID`）；密钥统一经 `buildSigningKey` 校验 **≥ 32 字节** 后以
  `SecretKeySpec("HmacSHA256")` 构造。

## [1.0.0-SNAPSHOT] 🚧 - 开发中

首个功能快照，尚未正式发布。

### 🔄 Changed（变更）

- 📖 校正 Flyway 迁移开关的文档口径为「**`dev` / `prod` 统一默认开启**」（配置侧为准：
  `application.yml` 的 `spring.flyway.enabled=${FLYWAY_ENABLED:true}`，`application-dev.yml`
  未覆盖该项，`application-prod.yml` 亦注明无需重复配置——**配置无误，属文档单侧写反**）：
  修正 `README.md`（特性表 + 环境变量表）、`docs/getting-started/README.md`（快速开始 + 常见问题）、
  `docs/deployment/README.md`、`docs/architecture/README.md` 共 6 处；
  并将「手工执行 `sql/V1__schema.sql` 建表」更正为准确口径——`V1` 全表 `create table if not exists`
  可安全重入，配合 `baseline-on-migrate` 自动打基线，建表无需手工；仅手工重复执行
  `sql/V2__init_data.sql` 会因固定 ID 插入与 Flyway 冲突。
