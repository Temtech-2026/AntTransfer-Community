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

### 🔄 Changed（变更）

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
  `1002` 在响应拦截器内静默 refresh（单飞）+ 重放原请求一次，`1001/1003` 清会话跳登录、
  `1007` 仅提示；G 类退避提示、H 类通知展示 traceId；请求拦截器注入 `Authorization`；
  ④ 单测 20 例（前端全量 31 例通过），覆盖策略分流与「B 类不弹窗」红线。
- 🧾 at-gateway 增加 `spring-boot-starter-validation`：Boot 2.3+ 起 `@Valid`/`@Validated`
  不再随 web starter 传递，补齐后参数校验才真正生效。

- 🔐 **JWT 认证链路落地（at-auth，system-design §2 定稿模型）**：
  ① 登录校验（BCrypt cost=10 与 V2 admin 密文一致）+ Spring Security 过滤链；
  ② 双令牌：access JWT（HS256，30min，claims 含 `sub/ver=token_epoch`，无角色避免陈旧）
     + refresh 随机不透明串（7d，Redis 白名单只存 SHA-256 指纹）；
  ③ `JwtAuthenticationFilter`：Header 解析 → 验签/过期（1002/1003）→ Redis 纪元缓存比对
     （miss 回源 DB 自愈 P-8）→ 构建 `Authentication` 入 SecurityContext，未认证统一
     `Result` 输出（1001/1002/1003/1004，默认拒绝 V-06）；
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
     deny 即使他角色已授予）、`any=true` 满足其一；不满足统一 403（1004）；
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
     同键消费），dev 默认 `*`、生产以 `ANTTRANSFER_CORS_ALLOWED_ORIGINS` 收紧。

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

### 🔒 Security（安全）

- 🚫 生产 profile 默认关闭 Swagger / OpenAPI 文档暴露。

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
