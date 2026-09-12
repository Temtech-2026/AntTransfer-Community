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

### 🔄 Changed（变更）

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
  ② 全局异常新增 `AccessDeniedException` → **1004 NO_AUTH（403）** 兜底分支
     （注：与「1003/403」的写法不一致——本仓库契约 1003=TOKEN_INVALID(401) 会触发前端
     跳登录，故拒绝类统一映射 1004，见 docs/api/error-codes.md）；
  ③ `@RateLimit`（at-common）+ Redis 固定窗口切面（at-gateway）：Lua INCR+EXPIRE 原子计数，
     超限抛新错误码 **4290 RATE_LIMITED**（HTTP 429，策略 G，前端已登记）；Redis 异常降级放行
     仅告警；
  ④ CORS 白名单属性化：`anttransfer.cors.allowed-origin-patterns`（at-gateway 与 at-auth
     同键消费），dev 默认 `*`、生产以 `ANTTRANSFER_CORS_ALLOWED_ORIGINS` 收紧。

- 📋 新增差异点索引页 `docs/development/AT-DIFF-todos.md`：汇总外部计划与仓库契约的 5 处待裁决
  差异（AccessDenied 1003/1004、Filter 权限加载、部门范围拦截器、HTTP JUnit5 测试、接口命名），
  详细描述与方案已嵌代码内 `TODO[AT-DIFF-01~05]`。
- 🧩 OpenApiConfig（at-bootstrap）：Swagger UI 增加 `bearerAuth` 安全方案与全局 SecurityRequirement，
  登录拿到 access token 后可在 UI Authorize 处填入并在线调试全部受保护接口。
- 🧪 正式集成测试套件 `AuthFlowIntegrationTest`（at-bootstrap，Testcontainers 自动拉起 MySQL+Redis，
  无 Docker 自动跳过）：认证/授权八条全链路断言（登录双 token、401/1001、200、auditor 403/1004、
  登出后旧 token 失效 401/1001、refresh 复用打击 401/1003、错误密码 401/1007），8 例全绿；
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
