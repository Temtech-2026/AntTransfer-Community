# 🏗️ AntTransfer CE 模块化单体架构说明（Architecture）

| 项 | 内容 |
| --- | --- |
| 文档定位 | **架构落地说明书**：回答「进程怎么跑、模块怎么分、依赖往哪走、代码怎么放、请求怎么流、扩展点在哪、部署怎么摆」 |
| 版本 / 状态 | v1.0 · 2026-09-13（与 `system-design.md` v0.1-draft 配套；冲突时以本文 §1.3 的修订说明为准） |
| 适用读者 | 二次开发者 / 贡献者（实现前必读）· 评审人（§3 门禁速查）· 运维（§1.6） |
| 技术基线 | Spring Boot 3.5 / Java 21 · Maven 多模块 · MySQL 8.4 + Redis 7 + Flyway · React 19 / Ant Design Pro v6 |
| 关联文档 | [架构总览](./README.md) · [系统设计](./system-design.md) · [核心用例时序](./use-case-flows.md) · [红队评审](./red-team-review.md) · [API 契约](../api/README.md) · [部署指南](../deployment/README.md) · [PRD](../prd/README.md) |

> 🎯 一句话：**一个 Spring Boot 进程内，用 Maven 模块边界 + 依赖铁律 + SPI 依赖倒置，把「单体部署的简单」和「领域边界的清晰」同时拿下。**

---

## 1. 🧭 架构总览

### 1.1 运行形态

**模块化单体（Modular Monolith）**：单进程（`at-bootstrap` 是唯一打 `spring-boot-maven-plugin` 的模块，产出唯一 fat jar）；单库（所有模块共用一个 MySQL schema，因此「跨模块写」天然可放进一个本地事务）；单 Redis（会话纪元 / 白名单、权限点缓存、限流计数、上传进度镜像）。编译期边界由 Maven 强制——**编译不过就是边界破了**。

```text
        ┌──────────────────────────────────────────────┐
        │  web/  React 19 + Ant Design Pro v6（独立构建）│
        └──────────────────────┬───────────────────────┘
                               │ HTTP /api/**（开发期 Umi 代理，生产经 Nginx）
        ┌──────────────────────▼───────────────────────┐
        │  at-bootstrap  ← 唯一可运行单元（fat jar）    │
        │  scanBasePackages=com.anttransfer            │
        └──────────────────────┬───────────────────────┘
   ┌──────────┬──────────┬─────┴────┬──────────┬──────────────┐
   ▼          ▼          ▼          ▼          ▼              ▼
at-gateway  at-auth  at-transfer  at-file  at-permission  at-collaboration
 接入横切    认证域      传输域      文件域      权限域          协作域
   └──────────┴──────────┴─────┬────┴──────────┴──────────────┘
                               ▼  只允许依赖 at-common（依赖铁律 R1）
                          at-common（共享内核）
                               ▲
              MySQL 8（业务数据 / Flyway）  Redis 7（会话 / 缓存 / 限流）
              本地磁盘 或 对象存储（文件物理载体，at-file 存储抽象）
```

### 1.2 模块职责与依赖方向

#### 1.2.1 职责清单

| 模块 | 定位 | 核心职责 | 拥有的表族 | 对外契约入口 |
| --- | --- | --- | --- | --- |
| `at-common` | 共享内核 | `Result` / `PageResult` / `ErrorCode` / `BusinessException` / `BaseEntity` / `TraceUtils` / `RedisKeyConstants` / `AuthenticatedUser` / **SPI 接口定义** | —（不持表） | 被所有模块依赖 |
| `at-gateway` | 接入横切 | 全局异常处理、CORS、`TraceIdFilter`、`AccessLogFilter`、`@RateLimit` 限流切面 | — | 对全 `/api/**` 生效 |
| `at-auth` | 认证域 | 登录 / 登出 / 刷新令牌、双令牌签发验签、`sys_user` 身份、`LoginUser` 上下文、登录失败计数 | `sys_user` / `sys_dept` / `sys_group` / `sys_login_log` | `/api/v1/auth/**`、`/api/v1/users/**` |
| `at-permission` | 权限域 | RBAC（角色-权限点-数据范围）、`@RequiresPerm` AOP、`AccessControlService` 行级守卫、申请-审批-授权闭环、到期回收 | `sys_role` / `sys_permission` / `sys_user_role` / `sys_role_permission` / `sys_approval_request` / `sys_approval_node` / `sys_user_file_permission` | `/api/v1/roles/**`、`/api/v1/permission-points/**`、`/api/v1/permission/**` |
| `at-transfer` | 传输域 | 传输任务状态机、分片并发上传、断点续传、合并编排、进度累加、限并发 | `sys_upload_task` | `/api/v1/transfers/**` |
| `at-file` | 文件域 | 文件元数据（`sys_file`）、秒传去重、SHA-256 校验、存储抽象（本地 / 对象存储）、孤儿清理、**外发分享（有效期 / 提取码 / 次数 / 内容扫描 / 取件审计，[AT-DIFF-06](../development/AT-DIFF-todos.md#at-diff-06-外发分享模块归属)）** | `sys_file`、`sys_share_link`、`sys_operation_log`（写入方） | `/api/v1/files/**`、`/api/v1/shares/**` |
| `at-collaboration` | 协作域 | 共享空间与成员、**站内通知与 IM 长连接**（通知域独占实现：落库先于推送、离线补拉、三口径未读 inbox/todo/chat、Redis Pub/Sub 多实例广播、WebSocket 握手鉴权与心跳清理）；外发链接**原规划**属本模块，CE 已改落 `at-file`（[AT-DIFF-06](../development/AT-DIFF-todos.md#at-diff-06-外发分享模块归属)） | `sys_notify_message`（含会话消息维度，V5 增量）、`sys_space` / `sys_group_member`（结构已随 V4 落地） | `/api/v1/notifications/**`、`/api/v1/todos/**`、`/api/v1/chat/**`；**WebSocket** `GET /api/ws/notify`（握手 `?token=`，帧协议见 [api/README.md §7](../api/README.md)）；`/api/v1/spaces/**`（规划） |
| `at-bootstrap` | 启动装配 | 聚合全部模块、MyBatis-Plus / Flyway / OpenAPI 配置、`@SpringBootApplication`、集成测试宿主 | — | 无 HTTP 契约 |

#### 1.2.2 依赖铁律（编译期强制）

> 权威来源：根 `pom.xml` 头部注释 + [架构总览](./README.md)。**违反即编译失败。**

| # | 规则 |
| --- | --- |
| R1 | 业务模块（`at-auth` / `at-transfer` / `at-file` / `at-permission` / `at-collaboration`）**只允许依赖 `at-common`**，不得互相 `import` 对方任何类 |
| R2 | `at-common` **禁止反向依赖**任何 `at-*`（否则成环） |
| R3 | `at-gateway` 与业务模块**互不依赖**（靠组件扫描 + 全局异常横切） |
| R4 | `at-bootstrap` 可依赖全部模块——它是组合根（Composition Root），只有它做装配 |
| R5 | 版本统一在父 `pom.xml` 的 `properties` + `dependencyManagement` 锁定，业务模块不写版本号 |

```text
依赖方向（箭头 = 允许依赖）
  at-bootstrap ──► 全部 at-*
  业务模块 / at-gateway ──► at-common
  at-common ──► （仅第三方库）

禁止：at-transfer ──► at-file、at-auth ──► at-permission、at-common ──► at-*
```

#### 1.2.3 依赖矩阵

| 依赖方 ↓ / 被依赖 → | at-common | at-gateway | at-auth | at-permission | at-transfer | at-file | at-collaboration | at-bootstrap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `at-common` | — | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `at-gateway` | ✅ | — | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `at-auth` | ✅ | ❌ | — | ❌ | ❌ | ❌ | ❌ | ❌ |
| `at-permission` | ✅ | ❌ | ❌ | — | ❌ | ❌ | ❌ | ❌ |
| `at-transfer` | ✅ | ❌ | ❌ | ❌ | — | ❌ | ❌ | ❌ |
| `at-file` | ✅ | ❌ | ❌ | ❌ | ❌ | — | ❌ | ❌ |
| `at-collaboration` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | — | ❌ |
| `at-bootstrap` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |

### 1.3 跨模块协作规则（SPI / 事件总线 / 装配）

> ⚠️ **本节最需先读。**「业务模块只依赖 at-common」是**编译期依赖**铁律；但上传主线（`at-transfer` 写 `sys_file`）与审批主线（`at-permission` 写 `sys_user_file_permission`）都需要**跨模块改变业务状态**。纯依赖倒置或纯事件总线**任一单独使用都会踩 S0 缺陷**（见 [红队 T-01/T-02](./red-team-review.md)）。故协作按「**读写分道**」三通道落地：

| 通道 | 用途 | 实现方式 | 约束 |
| --- | --- | --- | --- |
| **① SPI 依赖倒置（读 + 写编排）** | 跨模块**查询/校验**，以及跨模块**关键状态写入** | 接口定义在 `at-common` 的 `com.anttransfer.common.spi`；实现方模块内提供 `@Component`；编排方注入**接口** | 编排方**禁止 import** 他模块 `service` / `repository` 实现类；跨模块写必须落在编排方**同一个 `@Transactional`（同库本地事务）**内 |
| **② 事件总线（进程内，副作用）** | 通知、审计、缓存失效、后处理管道 | Spring `ApplicationEventPublisher` + `@TransactionalEventListener(AFTER_COMMIT)` | **只承载非关键副作用**：监听方失败**不回滚**业务；**不得承载「授权记录」这类关键状态写入**（[T-02]） |
| **③ `at-bootstrap` 装配（组合根）** | 装配服务、线程池、调度、配置 | 组件扫描 `com.anttransfer` | 只有 `at-bootstrap` 引依赖；业务模块互不可见 |

**三条铁律（评审门禁）**：① **读走 SPI**——跨模块查询一律面向 `at-common` 接口；② **写走单事务**——跨模块写必须在一个 `@Transactional` 方法体内完成（`P-3`），**禁止**「先写 A 表提交 → 再发事件补写 B 表」；③ **事件只做副作用**——`AFTER_COMMIT` 监听方做通知/审计/缓存失效，事件载荷不得携带「必须落库才成立」的关键状态。

> 📌 **与「跨模块只走事件总线」的口径差异（待裁决）**：外部计划书要求「跨模块只走事件总线」。本仓库**当前采纳上表「读写分道」口径**，因为纯事件总线会直接命中 [T-01]（跨模块写无事务载体，S0）与 [T-02]（授权写表落在事务外，S0），上传与审批主线的一致性会被击穿。若后续裁决坚持纯事件总线，须同步重审 [T-01]/[T-02]/[T-03] 与 [use-case-flows §1.1-7 / §2.3-5](./use-case-flows.md)。详见 §4。

**SPI 接口清单（定义在 `at-common`，按领域分包：`common.spi` / `common.file` / `common.mybatis` / `common.security` …）**：

| SPI 接口 | 提供方（实现） | 消费方（编排） | 用途 |
| --- | --- | --- | --- |
| `FileMetadataPort` | `at-file` | `at-transfer`（合并落库编排） | 建/查 `sys_file` 元数据，供上传合并在同一事务内调用 |
| `FileIngestPort` | `at-file`（已有 `FileIngestAdapter`，**已落地**） | `at-transfer`（秒传预检 + 合并落库） | 秒传命中即建引用（`tryInstant` → `Optional<FileIngestResult>`）；合片产物**逐流**传入登记（`ingest(FileIngestCommand, InputStream)`）。配套 `FileIngestCommand`（userId / 文件名 / 目标目录 / SHA-256 / 字节数）与 `FileIngestResult`（`fileId` / `nodeId`，**以字符串过线**规避 JS 大整数精度丢失）。**上表 `FileMetadataPort` 尚未建**：本轮按「更窄的意图端口」落地，后续若两者并存须收敛为一个，勿留双入口 |
| `PermissionCheckPort` | `at-permission` | `at-auth`（过滤器可选加载权限，[AT-DIFF-02](../development/AT-DIFF-todos.md) 方案 B） | 按 userId 取权限点/数据范围。**尚未建**：CE 当前为惰性解析（`@RequiresPerm` 切面触发 `PermissionService` → Redis 缓存），AT-DIFF-02 方案 B 未采纳；与 AT-DIFF-02 中提及的 `PermissionAuthorityProvider` 命名尚未收敛，落地前须二选一 |
| `CurrentUserProvider` | `at-auth`（已有 `SecurityCurrentUserProvider`） | `at-permission` 及业务模块 | 取当前登录用户身份（**已落地**） |
| `NotificationPort` | `at-collaboration`（通知域，**已落地**） | `at-permission` / `at-transfer` | 写站内通知（`sys_notify_message`）；配套 `NotificationCommand`（收发件人 / 类型 / 业务锚点）与 `NotifyType` 编码表。**渠道开关与落库实现统一收敛于此域**——原先 `at-permission` 自带的站内信 / 邮件实现与开关已删除，避免两套口径分歧 |

> ✅ 已落地样板：`at-common` 的 `com.anttransfer.common.mybatis.CurrentUserProvider` + `com.anttransfer.common.security.AuthenticatedUser`，由 `at-auth` 的 `SecurityCurrentUserProvider` 实现；`com.anttransfer.common.file.FileIngestPort` 由 `at-file` 的 `FileIngestAdapter` 实现（分片上传主线）。新增 SPI 请照此办理。

### 1.4 四层包结构

各业务模块内部**统一四层**，主包名固定，禁止自创层级：

| 层 | 包名 | 职责 | 禁止事项 |
| --- | --- | --- | --- |
| **L1 接入层** | `controller` | 参数绑定、`@Valid` 校验、鉴权注解（`@RequireLogin` / `@RequiresPerm`）、组装 `Result` | ❌ 不写业务逻辑 · ❌ 不直接调用 `repository` · ❌ 不写 `@Transactional` |
| **L2 业务层** | `service` | 业务规则、状态机、`@Transactional` 边界、跨模块 SPI 编排 | ❌ 事务内做文件 IO / 远程调用（`P-2`）· ❌ 自调用事务（`P-7`） |
| **L3 持久层** | `repository` | MyBatis-Plus Mapper（`@Mapper` 自动扫描，无需 `@MapperScan`） | ❌ 不写业务分支 · ❌ 不跨表拼业务逻辑 |
| **L4 模型层** | `model` | `model/entity`（表实体，继承 `BaseEntity`）· `model/dto`（入参）· `model/vo`（出参视图） | ❌ 实体不直接作为 API 入/出参（避免越界暴露字段） |

```text
server/at-<module>/src/main/java/com/anttransfer/<module>/
├── controller/            # L1 接入层
├── service/               # L2 业务层（@Transactional 唯一落点）
├── repository/            # L3 持久层（*Mapper，@Mapper 自动扫描）
├── model/
│   ├── entity/            # L4 表实体（继承 BaseEntity）
│   ├── dto/               # L4 入参
│   └── vo/                # L4 出参视图
├── config/                # 横切子包：模块内 @Configuration / @ConfigurationProperties
├── event/                 # 横切子包：领域事件（ApplicationEvent）
├── annotation/            # 横切子包：模块内自定义注解（如 @RequiresPerm）
├── aspect/                # 横切子包：注解切面实现
├── security/              # 横切子包：鉴权上下文（如 AuthzContext）
└── job/                   # 横切子包：定时任务（如 PermissionGrantExpireScheduler）
```

**横切子包按需存在**，不强制每模块齐全；但**四层主包名不可改名、不可合并**。

> ⚠️ **与 `system-design.md` §1.3 的偏差（需回写）**：该节把持久层写作 `mapper`，与本仓库**实测包结构（`repository`）**及 8 个模块 `package-info.java` 的声明不一致。**权威口径以本节 `repository` 为准**，`system-design.md` §1.3 需同步勘误（已登记进 [红队评审·回改清单](./red-team-review.md)）。

### 1.5 一次请求的统一处理链路

```text
浏览器 / 外部协作者
   │  HTTP  /api/**
   ▼
[0] Nginx（生产）          TLS 终结 · 静态资源 · /api 反代 · 限流 · 透传 X-Trace-Id
   ▼
[1] Filter 链（Servlet）
    ├─ TraceIdFilter        生成/清洗 traceId → MDC（入站 X-Trace-Id 需字符集校验，[D-02]）
    ├─ AccessLogFilter      访问日志（耗时/状态码/traceId）
    └─ Spring Security 过滤链
         ├─ JwtAuthenticationFilter  access JWT 验签 + ver/token_epoch 比对 → SecurityContext
         └─ 授权判定                 默认 DENY（白名单除外）→ 403 / 1003
   ▼
[2] DispatcherServlet → @RestController（L1 controller）
    └─ @RequiresPerm AOP 切面        PermissionService（at:perm 缓存 → 多角色并集 + Deny 优先）
   ▼
[3] Service（L2 service）
    ├─ @Transactional 边界（仅 public 跨 Bean 入口生效，P-7）
    ├─ AccessControlService         行级对象鉴权（归属 + 数据范围 1/2/3）
    ├─ 状态机 CAS / 原子计数（P-1 / P-6）
    ├─ 跨模块写编排（SPI 接口，同一事务，P-3）
    └─ AFTER_COMMIT 事件发布（非关键副作用）
   ▼
[4] Repository（L3 repository，MyBatis-Plus Mapper）
    └─ 逻辑删除 deleted · 雪花主键 ASSIGN_ID · 分页插件（pageSize ≤ 100）
   ▼
[5] MySQL 8 / Redis 7 / 存储后端
   ▼
[6] Result<T> { code, message, data, traceId }
    └─ 异常统一由 at-gateway GlobalExceptionHandler 分轨映射（15 类 → ErrorCode.httpStatus）
```

**链路关键约束速查**：

| 环节 | 约束 | 出处 |
| --- | --- | --- |
| `[1]` 鉴权 | 默认 DENY + 集中白名单；禁止「漏标注解即放行」 | [V-06] |
| `[2]`→`[3]` | Controller **不得**写业务，Service 是唯一事务边界 | `P-7` |
| `[3]` 事务 | 事务内**禁止文件 IO / 远程调用 / 关键 Redis 写** | `P-2` / [T-03] / [T-09] |
| `[3]` 状态变更 | 一律 `UPDATE ... WHERE id=? AND status=<期望态>` + 行数校验 | `P-1` |
| `[3]` 计数 | DB 原子 UPDATE 或 Redis 原子指令，禁止读改写 | `P-6` |
| `[3]` 事件 | 仅 `AFTER_COMMIT` 且只承载副作用 | `P-3` |
| `[4]` 数据访问 | 按 ID 访问必须先过 `AccessControlService` 归属校验 | [V-01] |
| `[6]` 返回 | 业务判据恒为 `body.code`；HTTP 状态由 `ErrorCode.httpStatus` 决定 | API 契约 §2 |

### 1.6 部署拓扑

```text
                        ┌───────── Internet / 内网用户 ─────────┐
                        │                                       │
                        ▼ HTTPS                                 ▼ HTTPS
        ┌───────────────────────────────────┐
        │  Nginx（反向代理 / TLS 终结 / 限流）│  :443
        │  ├─ location /        → web 静态产物（dist）
        │  └─ location /api/    → proxy_pass http://server:8080
        └───────────────┬───────────────────┘
                        │ http（容器内网）
        ┌───────────────▼───────────────────┐
        │  server  (at-bootstrap fat jar)    │  :8080（仅内网，不直接对公网）
        └───┬────────────────────────┬───────┘
            │ JDBC :3306             │ RESP :6379
   ┌────────▼────────┐      ┌────────▼────────┐
   │  MySQL 8.4      │      │  Redis 7        │
   │  业务数据/Flyway │      │  会话/缓存/限流  │
   └─────────────────┘      └─────────────────┘
            │
   ┌────────▼─────────────────────────────┐
   │  存储后端（at-file 存储抽象）          │
   │  本地磁盘 volume  或  对象存储 S3/COS  │
   └──────────────────────────────────────┘
```

| 组件 | 制品 | 端口 | 暴露面 | 持久化 | 说明 |
| --- | --- | --- | --- | --- | --- |
| Nginx | 官方镜像 / 宿主安装 | 443（80 跳转） | **公网** | 证书挂载 | TLS 终结、静态资源、`/api` 反代、限流、透传 `X-Trace-Id` / `X-Forwarded-For` |
| Web | `web/` 构建产物 `dist/` | — | 经 Nginx | 无 | React 静态文件，无服务端进程 |
| Server | `at-bootstrap` fat jar（多阶段 `Dockerfile`） | 8080 | **仅内网** | 无（无状态，可水平扩展） | 唯一业务进程 |
| MySQL | `mysql:8.4` | 3306 | 仅内网 | **volume** | 权威数据源；Flyway `classpath:db/migration` 启动时迁移 |
| Redis | `redis:7` | 6379 | 仅内网 | 可选 AOF/RDB | 仅加速与轻态；遵循 `P-8`，丢失可自愈 |
| 存储后端 | 宿主目录 volume 或对象存储 | — | 视方案 | **volume / 对象存储** | 挂载到 server；密钥走环境变量 |

**网络与安全**：① 只有 Nginx 暴露公网，`server` / MySQL / Redis 不映射宿主公网端口；② 生产强制 TLS（PRD §7：Compose 默认 HTTP 仅内网）；③ DB / Redis 用**专用低权账号**，密码走环境变量（禁止默认 `root/123456` 上线，[D-04]）；④ `prod` profile 默认关闭 Swagger / actuator 调试端点（`P-10`）。

**伸缩与高可用**：`server` 无状态可水平扩展，但扩展前须补齐「定时任务调度锁」（[C-04]）与「限流计数改用 Redis」（[C-10]），否则多副本会重复扫描 / 重复通知；MySQL / Redis 单机为 CE 基线（可用性 ≥ 99.9% 含自动重启），主从 / 哨兵不在 CE 范围；K8s / Helm 样例见 `deploy/kubernetes/`、`deploy/helm/`（Helm Chart 待补）。

---

## 2. 🧬 CE / EE 扩展点清单

> **原则**：CE 不实现的能力，**在架构上留出接缝**——先定接口，CE 提供默认实现（或不装配），EE 立项时按同一接口插入，**不改已发布业务代码**。
> 📌 权威接口命名以**附录 C** 为准：`IdentityProvider` / `ContentScanInterceptor` / `WatermarkProvider` / `CryptoCodec` / `VirusScanner` / `ApprovalNodeResolver` / `TransportStrategy`。
> ✅ **落地状态（2026-09-29）**：7 个接口**已全部在 `at-common` 的 `spi` 包建立**，CE 默认实现与 `@ConditionalOnMissingBean` 装配门禁**同批落地**（实际签名见 §2.2，落地清单见 §2.3，测试入口见 §2.3 末列）。据此 **`A-6` / `D-2` 的「接口未建」部分关闭**；`D-2` 残留「附录 C 原文入库」一项见 §2.4。
> ⚠️ 本文原 2026-09-13 记录「以下接口当前全部尚未在代码中建立」——该状态**已失效**，保留为历史沿革。

### 2.1 扩展点总表

| # | 接口 | 承载能力（Won't 项） | 归属模块 | 接口位置 | CE 默认实现 | EE 计划实现 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `IdentityProvider` | SSO / OIDC / LDAP / SAML | `at-auth` | `at-common` SPI | `LocalIdentityProvider`（账号密码 + BCrypt） | `OidcIdentityProvider` / `LdapIdentityProvider` |
| 2 | `ContentScanInterceptor` | AI DLP（内容扫描 / 敏感词 / 涉密识别） | `at-file` | `at-common` SPI（**✅ 2026-09-29 上收**，原 CE 暂落 `at-file`，见 [AT-DIFF-09](../development/AT-DIFF-todos.md#at-diff-09-contentscaninterceptor-落点)） | **`SuffixAndKeywordScanInterceptor`**（后缀黑名单 + 文件名敏感词，命中即 4007 并审计；实现留在 `at-file`） | `DlpContentScanInterceptor` |
| 3 | `WatermarkProvider` | 盲水印 / DRM | `at-file`（下载与分享下载；`at-transfer` 为**计划位**，其链路上目前无流式渲染点，见 §2.3 注） | `at-common` SPI | `NoopWatermarkProvider`（原样返回输入流） | `BlindWatermarkProvider` / `DrmWatermarkProvider` |
| 4 | `CryptoCodec` | KMS 存储加密（信封加密） | `at-file`（存储层） | `at-common` SPI | `PlainCryptoCodec`（明文直通） | `KmsEnvelopeCodec` |
| 5 | `VirusScanner` | 杀毒 / 木马扫描 | `at-file` | `at-common` SPI | `NoopVirusScanner`（PASS） | `ClamAvVirusScanner` |
| 6 | `ApprovalNodeResolver` | 动态多级审批 / 会签 | `at-permission` | `at-common` SPI（**✅ 2026-09-29 上收**） | `SingleNodeApprovalResolver`（CE 固定 `node_seq=1`） | `MultiNodeApprovalResolver`（读 `sys_approval_node`） |
| 7 | `TransportStrategy` | QUIC / HTTP3 | `at-gateway` + `at-transfer` | `at-common` SPI | `HttpTransportStrategy`（落 `at-gateway`；**装配为 Bean 名称级**，EE 新增协议与 HTTP **共存**而非顶替，见 §2.3） | `QuicTransportStrategy` |

> 🔗 **与 PRD §8 命名的映射**（两处口径需统一，见 §2.4）：
>
> | 附录 C 命名（本文权威） | PRD §8 现用名 | 处理 |
> | --- | --- | --- |
> | `IdentityProvider` | `AuthenticationProvider` | 取附录 C |
> | `ContentScanInterceptor` + `VirusScanner` | 「后处理管道 Hook（DLP/杀毒共用一条 SPI）」 | 附录 C 拆两接口，但共用**同一条有序管道** |
> | `WatermarkProvider` | 「内容渲染处理器」（水印/DRM） | 取附录 C |
> | `CryptoCodec` | 「`FileStore` 信封加密包装器接口」 | `FileStore` 是存储抽象宿主，`CryptoCodec` 是其内层编解码 |
> | `ApprovalNodeResolver` | 审批链 `Policy` 接口 | 取附录 C |
> | `TransportStrategy` | 「传输网关协议层抽象」 | 取附录 C |
> | （附录 C 未列） | `FileStore`（存储抽象）、`AuditSink`（审计出口）、组织边界抽象 | **保留 PRD 现名**；`FileStore` 见 §2.2-8 |
> | （附录 C 未列） | 多租户「组织边界抽象」 | CE 不建租户列，仅约定账号/组织模型不写死单租户假设 |

### 2.2 接口契约（**已落地**，与代码一致）

> **✅ 2026-09-29**：以下签名已落地，与 `server/at-common/src/main/java/com/anttransfer/common/spi/` 下源码一致；业务方按本节理解接缝即可，不必再翻源码。
> 变更纪律：**包位置与语义不得漂移**；确需改签名时同步回写本节与 §2.1。原「契约草案（示意签名）」措辞作废——草案与实际实现的差异已在下方逐条标注，是本节的价值所在。

```java
package com.anttransfer.common.spi;      // 实际按子包组织：identity / scan / crypto / watermark / approval / transport

// 1) 认证入口（spi.identity）：CE 本地账号，EE 接 SSO / OIDC / LDAP
public interface IdentityProvider {
    String providerId();                                             // "local" / "oidc" / "ldap"
    boolean supports(AuthenticationRequest request);
    AuthenticatedUser authenticate(AuthenticationRequest request);    // 失败抛 AuthException
}
record AuthenticationRequest(String username, String rawPassword) {}

// 2) 外发内容扫描（spi.scan）：CE「后缀黑名单 + 文件名敏感词」，EE 接 AI DLP
//    ⚠️ 与草案差异：去掉 `int order()` 与 `ScanVerdict`，改由 @Order 排序 + ScanResult.deny(reason)
public interface ContentScanInterceptor {
    ScanResult scan(ScanContext context);      // 有序管道 + Deny 优先 + fail-closed（抛异常按拒绝）
}
record ScanContext(Long fileId, String originalName, String extension, long sizeBytes, Long ownerUserId) {}
record ScanResult(boolean denied, String reason) { allow(); deny(String reason); }

// 3) 病毒扫描（spi.scan）：入库前管道，CE Noop PASS，EE 接 ClamAV 等
public interface VirusScanner {
    String scannerId();
    VirusScanResult scan(VirusScanContext context);
}
record VirusScanContext(String sha256, String originalName, String extension, long sizeBytes,
                        Long ownerUserId, ContentAccess content) {}    // content 为惰性访问器：不读则零开销
record VirusScanResult(boolean infected, String threat) { clean(); infected(String threat); }

// 4) 下载渲染（spi.watermark）：CE 原样透传，EE 加水印 / DRM
//    ⚠️ 与草案差异：包装的是**输入流**，而非草案的 OutputStream——直接改响应体/响应头会把水印语义
//       与 HTTP 细节（Content-Length / Range / 背压）纠缠在一起；包输入流让所有写出路径共享实现
public interface WatermarkProvider {
    String providerId();
    InputStream wrap(InputStream source, WatermarkContext context);
}
record WatermarkContext(Long fileId, String originalName, Long ownerUserId,
                        Long requesterUserId, String requesterName, boolean inline) {}

// 5) 存储编解码（spi.crypto）：CE 明文直通，EE 接 KMS 信封加密；由存储层读写两侧织入
public interface CryptoCodec {
    String codecId();                                                // "plain" / "aes-gcm-kms"
    OutputStream encrypt(OutputStream sink, CryptoContext context);
    InputStream decrypt(InputStream source, CryptoContext context);
}
record CryptoContext(String storageKey, long sizeBytes) {}           // storageKey = 内容寻址键（明文摘要）

// 6) 审批节点解析（spi.approval）：CE 单节点，EE 多级 / 会签 / 按组织架构动态解析
//    ⚠️ 与草案差异：`ApprovalRequestContext` → `ApprovalContext`，`ApprovalNode` → `ResolvedNode`
public interface ApprovalNodeResolver {
    boolean supports(ApprovalContext context);
    List<ResolvedNode> resolve(ApprovalContext context);             // CE 恒 1 个 nodeSeq=1
}
record ApprovalContext(Long applicationId, Long applicantId, String applyType,
                       String resourceType, Long resourceId, int level, Long suggestedApproverId) {}
record ResolvedNode(Long approverId, int nodeSeq, int nodeType) { single(Long approverId); }

// 7) 传输协议策略（spi.transport）：CE 仅 HTTP(S)，EE 可插 QUIC
public interface TransportStrategy {
    String protocol();                                              // "http" / "quic"
    boolean supports(TransportRequest request);
}
record TransportRequest(String scheme, int port, boolean secure) {}

// 8) 存储抽象（PRD §8 命名，附录 C 未列）：**CE 未单列 `FileStore` 接口**
//    CE 实际为 at-file 的 `FileStorage`（接口）+ `LocalFileStorage`（本地磁盘实现）；
//    `CryptoCodec` 在存储层读写两侧织入（写包 OutputStream、读包 InputStream），
//    「切换加密方案不改调用方」已由 `CryptoCodec` 达成，故未再加一层 FileStore。
//    EE 接对象存储时再评估是否引入（§2.4-3）。
```

**装配方式**：CE 用 `@ConditionalOnMissingBean` 提供默认实现，EE 实现类以同类型 Bean 顶替；**接口全部定义在 `at-common` 的 `spi` 子包**，实现方在各自模块内——业务模块仍只依赖 `at-common`（满足 R1）。

| SPI | CE 默认实现（所在模块） | CE 装配类 | 顶替方式 |
| --- | --- | --- | --- |
| `IdentityProvider` | `LocalIdentityProvider`（at-auth，BCrypt 本地账号） | `IdentitySpiConfig` | 类型级 `@ConditionalOnMissingBean` |
| `ContentScanInterceptor` | `SuffixAndKeywordScanInterceptor`（at-file） | 直接 `@Component` 进 `ContentScanChain` | **有序叠加**（`@Order`，不顶替——CE 规则必须继续生效） |
| `VirusScanner` | `NoopVirusScanner`（at-file） | `FileSpiConfig` | 类型级 |
| `WatermarkProvider` | `NoopWatermarkProvider`（at-file） | `FileSpiConfig` | 类型级 |
| `CryptoCodec` | `PlainCryptoCodec`（at-file） | `FileSpiConfig` | 类型级 |
| `ApprovalNodeResolver` | `SingleNodeApprovalResolver`（at-permission） | `ApprovalResolverConfig` | 类型级 |
| `TransportStrategy` | `HttpTransportStrategy`（at-gateway） | `TransportSpiConfig` | **Bean 名称级**（`httpTransportStrategy`）——见下方注 |

> **装配注（2026-09-29）**：
> ① 上表「类型级」即架构原则的原始口径；**`TransportStrategy` 例外用 Bean 名称级**——协议是**集合**而非单点能力，若按类型顶替，EE 只新增一个 QUIC 实现就会把 CE 的 HTTP 挤掉，部署随即失去 HTTP 通道（功能回退，不是差异化）。故：EE **替换** HTTP 通道 → 声明同名 Bean `httpTransportStrategy`；EE **新增**协议（QUIC / 私有隧道）→ 任意 Bean 名声明，与 CE 的 HTTP **共存**，由 `TransportStrategyRegistry` 按 `@Order` 选协议并在**启动期拒绝重复 protocol**（配置错误即启动失败，而不是让请求随机走一个实现）。
> ② `ContentScanInterceptor` 同理不设 Noop 兜底：它不是「能力开关」，而是 CE 必须生效的外发闸门（后缀黑名单），EE 的 DLP 以 `@Order` 叠加而非替换它。
> ③ 共同红线：**能力差异只由 Bean 是否存在表达**，业务代码禁止 `if (eeEnabled)`（§2.3 / G-11）。

### 2.3 建立时机与门禁

| 原则 | 说明 |
| --- | --- |
| **不晚于首个功能落地** | 例：`at-file` 实现存储时**同时**抽出 `FileStorage` + `CryptoCodec`；`at-permission` 实现审批时**同时**以 `ApprovalNodeResolver` 承载单级实现。否则 EE 化时被迫改已发布接口 |
| **CE 必须有默认 Bean** | 每个 SPI 在 CE 必须可运行（Noop / 单级 / 明文），不得让 `@Autowired` 因缺实现而启动失败 |
| **接缝不引入运行时分支** | 通过 `List<XxxSpi>` 有序管道 + `@ConditionalOnMissingBean` 装配，禁止在业务代码里 `if (eeEnabled)` |
| **建立即登记** | 新增 SPI 时在 §2.1 登记，并在 `red-team-review.md` 回改清单留痕 |

#### ✅ 落地登记（2026-09-29）

七个接缝**同批建立**（而非各自随功能零散落），同时锁定「接口 + CE 默认实现 + 装配门禁 + 消费点 + 回归测试」五项，避免出现「接口建了但没人调用」的假接缝。

| SPI | 接口 | CE 默认实现 | 消费点（谁读它） | 回归测试入口 |
| --- | --- | --- | --- | --- |
| `IdentityProvider` | `common.spi.identity` | `at-auth/extension/LocalIdentityProvider` | `AuthService.login()` → `IdentityProviderChain`（`@Order` 取首个 `supports`） | `IdentityProviderChainTest` / `LocalIdentityProviderTest` / `IdentitySpiConfigTest` |
| `ContentScanInterceptor` | `common.spi.scan` | `at-file/extension/SuffixAndKeywordScanInterceptor` | `ShareLinkService` → `ContentScanChain`（Deny 优先 + fail-closed） | `ContentScanChainTest`（既有） |
| `VirusScanner` | `common.spi.scan` | `at-file/extension/NoopVirusScanner` | `FileContentService` 入库前 → `FileScanPipeline.assertClean` | `FileSpiDefaultsTest` |
| `WatermarkProvider` | `common.spi.watermark` | `at-file/extension/NoopWatermarkProvider` | `FileDownloadService.stream(...)`（下载 + 分享下载，经 `WatermarkResource`） | `FileSpiDefaultsTest` |
| `CryptoCodec` | `common.spi.crypto` | `at-file/extension/PlainCryptoCodec` | `LocalFileStorage` 写盘 / 取流两侧（经 `CodecResource`） | `FileSpiDefaultsTest` |
| `ApprovalNodeResolver` | `common.spi.approval` | `at-permission/extension/SingleNodeApprovalResolver` | `PermissionApplicationService` → `ApprovalNodeResolverChain` | `ApprovalResolverSpiTest` |
| `TransportStrategy` | `common.spi.transport` | `at-gateway/transport/HttpTransportStrategy` | `TransportStrategyRegistry`（装配校验 + 选协议；**CE 侧不读取**，属 EE 接线点） | `TransportStrategyRegistryTest` |

> **两条设计口径（本批新增，后续 SPI 沿用）**：
> ① **认证失败的计数留在编排层**（`AuthService`），身份源只回答「是不是本人」——否则换 SSO 后「错 5 次锁 30 min」会因身份源不同而失效或误锁；链内实现互斥、取首个匹配而非串行试错（避免一次登录触发多次远端认证）。
> ② **内容寻址存储下，扫描命中不删物理内容**：同一 sha256 的字节被多个文件记录共享，删除会连带破坏其它引用；命中只**拒绝本次登记**并落审计。
>
> **注（WatermarkProvider 归属）**：CE 的实际渲染点在 `at-file`（下载与匿名分享下载共用 `FileDownloadService`）；`at-transfer` 当前链路是分片落盘（`ChunkStore`），无流式渲染点，故其 §2.1 归属为**计划位**——EE 若在传输侧做实时加水印，再接该点，接口无需改动。

### 2.4 待统一项

1. ⏳ **唯一残留**：附录 C 原文**仍未入库**（全仓库检索 7 个接口名，除本次落地代码与文档外无外部原文命中）——命名已按附录 C 落地到**代码与文档**（`at-common` SPI 子包 + §2.1 / §2.2 / PRD §8 三处一致），故「实现时接口名反复」的风险**已实际消除**；仍需在附录 C 可得时补入 `docs/`（或明确放弃该溯源要求）。原 [A-2] 的实质影响已解除，仅剩溯源留痕；
2. ✅ **已收口（2026-09-29）**：PRD §8 的接口名已按 §2.1 映射表回写（`AuthenticationProvider` → `IdentityProvider`；「后处理管道 Hook」→ `ContentScanInterceptor` + `VirusScanner`；「内容渲染处理器」→ `WatermarkProvider`；「`FileStore` 信封加密包装器接口」→ `CryptoCodec`；审批链 `Policy` → `ApprovalNodeResolver`；「传输网关协议层抽象」→ `TransportStrategy`）；
3. ⏳ `AuditSink` / 组织边界抽象在附录 C 中缺失，暂保留 PRD 命名待裁决；
4. ⏳ **`FileStore` 未以接口形式建立**（§2.2-8）：CE 由 `FileStorage` + `CryptoCodec` 覆盖其职责。EE 接对象存储时需判断是「新增 `FileStore` 抽象」还是「`FileStorage` 再出一个实现」——**届时按最小改动裁决**，不预建空接口（预建接口而无消费方，正是 §2.3「建立时机」要避免的假接缝）。

---

## 3. 📐 评审门禁速查（实现必守）

| # | 门禁 | 判据 | 出处 |
| --- | --- | --- | --- |
| G-1 | 模块依赖 | `at-*` 业务模块 `pom.xml` 只出现 `at-common`；无跨模块 `import` | §1.2.2 R1 |
| G-2 | 跨模块写 | 跨模块状态变更在**同一 `@Transactional`** 内完成；无「提交后再补写」 | §1.3 铁律② |
| G-3 | 事件用途 | `@EventListener` 监听方仅做通知/审计/缓存失效，不回滚业务、不写关键状态 | §1.3 铁律③ |
| G-4 | 四层归位 | `controller` 无业务 / 无 `@Transactional` / 不直连 `repository`；持久层包名恒为 `repository` | §1.4 |
| G-5 | 状态机 | 所有状态流转为 CAS `UPDATE ... AND status=?`，校验影响行数 | `P-1` |
| G-6 | 事务边界 | 事务内无文件 IO / HTTP / 关键 Redis 写；`@Transactional` 不写在 `controller`、不自调用 | `P-2` / `P-7` |
| G-7 | 计数 | 进度 / 下载次数 / 失败次数用 DB 原子 UPDATE 或 Redis 原子指令 | `P-6` |
| G-8 | 对象鉴权 | 按 id 取资源前必须过 `AccessControlService`（归属 + 数据范围） | [V-01] |
| G-9 | 默认拒绝 | 新增端点若无白名单条目，必须显式声明鉴权注解 | [V-06] |
| G-10 | 返回契约 | 统一 `Result<T>`，业务码取自 `ErrorCode`，HTTP 状态由 `httpStatus` 决定 | API 契约 §2 |
| G-11 | 扩展点 | CE 缺 EE 能力时以 SPI + Noop 默认实现留接缝，禁止写死 `if (eeEnabled)` | §2.3 |

---

## 4. 📌 待裁决与开放项

| # | 事项 | 现状 | 影响 | 建议裁决 |
| --- | --- | --- | --- | --- |
| A-1 | 「跨模块只走事件总线」vs「SPI + 单事务」 | 本文采纳读写分道（§1.3） | 若改纯事件总线，将重开 [T-01]/[T-02]（S0） | 维持读写分道；若坚持事件总线须同步改 `use-case-flows` §1.1-7 / §2.3-5 |
| A-2 | 附录 C 原文缺失 | 🟡 **已降级**：7 个接口名已按附录 C 落地到代码与文档（`at-common` SPI + §2.1/§2.2/PRD §8 三处一致），仅剩「原文溯源」留痕 | 「实现时接口名反复」的风险已实际消除 | 附录 C 可得时补入 `docs/`，或明确放弃该溯源要求（见 §2.4-1） |
| A-3 | PRD §8 命名与附录 C 不一致 | ✅ **已收口（2026-09-29）**：PRD §8 按 §2.1 映射表回写 | — | 无需动作（若后续新增 Won't 项，按 §2.1 映射表同批回写） |
| A-4 | `system-design.md` §1.3 写 `mapper` | 实测为 `repository` | 新人按文档建包会跑偏 | 回写 §1.3 为四层 + `repository` |
| A-5 | 多副本部署前置条件 | 未补调度锁 / Redis 限流 | 水平扩展会重复扫描 / 通知 | 扩展前先落 [C-04] / [C-10] |
| A-6 | SPI 接口尚未建立 | ✅ **已收口（2026-09-29）**：7 个接口 + CE 默认实现 + 装配门禁同批落地（§2.3 落地登记） | — | 无需动作。后续新增 SPI 按 §2.3 四项门禁执行 |

### ⏸ 延期登记（2026-09-13 裁决：先记录、**不阻塞当前开发**，待系统功能基本成型后回头完成）

以下各项**不影响当前编码推进**，按「记录在案 → 回头补齐」处理。
其中 **D-4 / D-5 含对外契约，属发布门禁第 7 条与 Phase 4 的硬前置**；**D-1 / D-2 / D-6 / D-7 / D-9 属口径与契约类**，可延后或随 D-5 收口；**D-8 / D-12 已当场收口**（D-8 项目内本已一致无需回改；D-12 裁定 **CE 维持 PRD**、`user_type` 列仅作 EE / 受限账号预留）；**D-10 / D-11 为结构 / 实现类**，其**结构部分已随 `sql/V4__menu_route_user_type_and_collaboration.sql` 落地**（分级见文末）。

**回头时机**：上传 / 审批 / 分享三条主线功能基本跑通、进入加固与 EE 规划之前（即 Phase 2 收尾、Phase 3 之前）；**D-4 / D-5 例外，须在写首个 Controller / 进入 Phase 4 编码前收口**。

| 延期内编号 | 口径 | 当前临时采用（不阻塞开发） | 回头需完成 | 触发时机 / 判据 |
| --- | --- | --- | --- | --- |
| **D-1**（= A-1） | 跨模块协作口径：「只走事件总线」vs「读走 SPI + 写走单事务」 | 按本文 §1.3 读写分道（`P-3`）实现；SPI 定义在 `at-common`，事件只承载副作用 | 与外部计划书对齐最终口径；**若坚持纯事件总线**，须重审 [T-01] / [T-02] / [T-03]，并同步改 `use-case-flows` §1.1-7 / §2.3-5 与对应集成测试 | 三条主线跑通后；或外部计划书给出权威口径时 |
| **D-2**（= A-2 / A-3） | CE/EE 扩展点命名的权威源：附录 C 7 接口 vs PRD §8 现名 | 🟡 **主体已收口（2026-09-29）**：7 个接口已按附录 C 命名落地到 `at-common` SPI（§2.3 落地登记）；② **已完成**——`docs/prd/README.md` §8 已按 §2.1 映射表回写，双名并存消除 | ① **残留**：将附录 C 原文补入 `docs/`（或明确放弃）——仅影响溯源，不再影响实现 | 附录 C 原文可得时（不阻塞任何开发） |
| **D-3** | 红队 v1.1「待回改项」是否代为改动 | 已在 [红队评审·回改清单](./red-team-review.md) 登记；**截至 2026-10-02 剩余 3 项未改动**（`docs/prd/README.md` §8 已回写、AT-DIFF-04 已修复，见右栏） | 回改 `system-design.md` §1.3（`mapper` → `repository`）、`docs/api/README.md`（幂等键 / 分页上界 / 免登录端点防刷）、`web/src/utils/result.ts`；而 `docs/prd/README.md` §8 **已于 2026-09-29 回写**、`docs/development/AT-DIFF-todos.md` AT-DIFF-04 错误码 **已于 2026-09-13 修复**（`403(1003)` / `401(1006)`）、`docs/api/README.md` 秒传预检语义 **已明确**（见 D-4）——**此三项已完成、不再列入本项** | 随首轮功能实现一并回改；**「对外契约 4 项」按发布门禁第 7 条须在写首个 Controller 前完成** |
| **D-4**（= D-3「对外契约 4 项」 · DoD-3） | 统一响应体 / 分页 / 错误码的「对外契约」收口与「经前后端确认」留痕：`Result<T>` / `PageResult<T>` / 错误码表已定稿并被遵守，但 **API-03 写接口幂等键尚无定义**（`docs/api/README.md` 全文无 `Idempotency-Key`），免登录端点「集中化白名单 + 防刷」未补齐，「经前后端确认」只有「已完成改造」的事实描述、**无评审结论与日期** | `Result<T>`、分页 `PageResult<T>`（默认 20 / 上限 100，由 `MybatisPlusConfig` 强制收敛）、错误码表 + A~H 策略**按现状实现**（后端 `ErrorCode` 为单一权威源，前端 `result.ts` 镜像策略表 + 20 例单测）；免登录端点已列 §5 表、秒传预检语义已明确 | ① 在 `docs/api/README.md` 补 **`Idempotency-Key` 写接口幂等键**定义（适用范围 / 生成规则 / 重放响应）；② 补免登录端点「集中化白名单 + 防刷约定」；③ 补一份前后端确认留痕（评审结论 + 日期），使「经确认」可追溯 | 写第一个 Controller 之前（**硬前置**，发布门禁第 7 条；与 D-3 同源，此处按 DoD-3 收口口径单列） |
| **D-5**（DoD-4） | **审批线**核心接口未「定稿」，尚不足支撑 Phase 4 直接照做（上传线已于 2026-09-14 落地收口） | **上传线 ✅ 已落地**（五端点 + 字段级 schema 由实现定稿：multipart 字段 `chunk` / `hash`、索引取路径、`precheck` 用 JSON body、`received` 回索引数组）；**剩余仅审批线**——按 §2.3 已定的 `POST /api/v1/permission/applications` 单端点推进 | ① 补齐审批线缺失端点：审批动作（approve / reject / reassign，**路径未定**，仅红队 [V-03] 出现过一次 `PATCH applications/{id}`）、撤销、待办 / 我的申请 / 详情查询、审批规则配置；② 为**审批线**补字段级 schema（DTO 字段名 / 类型 / 必填；上传线的 `chunk` / `hash` 载体与 `precheck` JSON body 已由 2026-09-14 实现定稿），消除 Phase 4 歧义；③ `docs/api/README.md` §1 前缀表补 `at-permission` 的 `/permission/applications`（现以 `/api/v1/permission/...` 泛化列出、未单列；`/permission/menus` 已于 2026-10-02 入表并标注「规划中 · 尚未实现」，见 **D-9**）；④ 解除两份文档 `draft` 标记并落「定稿」版本；⑤ 与 **D-9** 合并推进：为 `GET /api/v1/permission/menus` 补字段级 schema（节点 `routePath` / `component` / `icon` / `visible`、父子层级、排序与权限过滤口径） | 进入 Phase 4 编码前（**硬前置**） |
| **D-6**（DoD-1 ①） | CE/EE 功能边界未「**书面冻结**」：`docs/prd/README.md` 仍标 `v0.2-draft · 待评审`，无评审结论 / 冻结日期 | 以 PRD §1.1（范围表）+ §4（功能清单）+ §8（Won't）三表**内部自洽**为准推进 | 组织一次范围评审，把 PRD 状态由 `draft` 置为 `frozen`，并留下评审结论 / 日期 / 参与方；同步冻结 §1.1 / §4 / §8 / §2.1 各处清单 | M1 里程碑评审前（或范围发生变更时） |
| **D-7**（= A-2 范围侧 · DoD-1 ②） | 「P0/P1 清单与**战略规划书 0.3 节**逐项对应无遗漏」当前**无法验证**：战略规划书（含 0.3 节 P0 / P1 / EE 三栏原文）未入库，附录 C 原文亦零命中 | 按 §1.1 内注释「战略规划书当前为外部归档文档，入库后在此补精确章节引用」暂缓；先完成**内部自洽核对**（已核对：§1.1 P0 8 类 / P1 12 项被 §4 全覆盖；§8 Won't 9 项与 §1.1 Won't 栏一一对应；§2.1 覆盖全部 9 个 Won't 能力） | ① 战略规划书入库并落实 §1.1 的章节引用；② 对 0.3 节三栏与 §1.1 / §4 / §8 **逐项比对并出具「无遗漏」结论** | 战略规划书可得时；不晚于 D-6 的范围评审 |
| **D-8**（= N-1 · ✅ **已收口**） | `at:share:lock:{token}` 提取码锁定 TTL 存在两套口径：**15 min**（需求口述清单）vs **30 min**（代码与全部文档） | **采纳 30 min**（2026-09-13 裁定）：`RedisKeyConstants.SHARE_LOCK_TTL_SECONDS = 30 * 60L`、`system-design.md` §5.3 与 §7.1、PRD US-03「连续 5 次 → 临时锁定（30 分钟）」、红队 [C-08] **四处一致**；15 min 系与 `at:login:fail`（确为 15 min）串行误抄 | 无需回改（项目内本已一致）。后续若确需调整 TTL，须同步 4 处：`RedisKeyConstants` / `system-design` §5.3+§7.1 / PRD US-03 / CHANGELOG，并重开红队 [C-08] | **不适用（已收口）** |
| **D-9**（= N-2 · 随 D-5 收口） | 动态菜单「有数据、无字段、无接口」：`sys_permission` 无路由元数据；server 端全仓检索 `menu` / `Menu` 关键字 **0 命中**；菜单树仅 2 个根节点 + 8 个操作点 | **列已落地**：`sql/V4__menu_route_user_type_and_collaboration.sql` 为 `sys_permission` 增列 `route_path` / `component` / `icon` / `visible`（默认 `visible=1`），**未回填**路由值（前端路由未定，避免臆造路径） | ① 新增 `GET /api/v1/permission/menus`：按当前用户 `at:perm:{userId}` 快照过滤 `type=1` 节点、按 `parent_id` / `sort_no` 组装树；② 前端确定路由后回填 V2 的 10 条权限点（`100` / `101` / `110`~`116` / `120`）的 `route_path` / `component` / `icon`；③ 字段级 schema 并入 **D-5** 同批收口；④ 前端接入路由守卫与菜单渲染 | **Phase 5（前端路由守卫阶段）**；契约部分随 **D-5**（进入 Phase 4 前，硬前置） |
| **D-10**（= N-3） | 审计留存 ≥ 6 个月的**归档清理任务未实现**：`sys_operation_log` / `sys_login_log` 的 append-only 结构与 `idx_log_time` 已就位，但全仓 `@Scheduled` 仅 `PermissionGrantExpireScheduler` 一处，无归档 / 清理实现 | 表结构与留存策略注释已就位（V1 第 31~33 / 402~404 行）；且**当前无写入方**（两表无实体 / Mapper），空表归档无意义，故暂不实现 | 新增 `AuditArchiveScheduler`（建议独立 `at-audit` 域，或先落 `at-permission`，与 `PermissionSchedulingConfig` 同构）：**先归档后删除**——按 `idx_log_time` 分批查询 → 导出（CSV / JSONL 至归档目录或对象存储）→ **校验成功** → 按同批次**物理** `delete`（append-only 表禁用逻辑删除）；失败即中断并告警；批大小 / cron 走配置（`anttransfer.audit.archive-*`）；**多实例须加 Redis 分布式锁**（与 A-5 同源，参照 `PermissionSchedulingConfig` 第 24~26 行既定要求） | 审计日志**写入方落地后**、进入加固阶段前（Phase 3~4）；不早于数据源可用 |
| **D-11**（= N-4） | 群组 / 空间成员模型缺失：`sys_group` 无成员子表，`sys_file.space_id` 为悬空逻辑关联，群聊 / 群组空间 / 低敏感审批人解析均无数据承载 | **结构已落地**：`sql/V4__menu_route_user_type_and_collaboration.sql` 新建 `sys_group_member`（`group_id` / `user_id` / `member_role`，唯一键 `uk_group_user`）与 `sys_space`（字段对齐 `CollaborationSpace` 骨架实体）；该实体 `@TableName` 已同步为 `sys_space`。**群组侧读写已于 2026-09-26 接管**：`at-collaboration` 落 `SysGroup` 实体 / `SysGroupMapper` / `ChatGroupService` 四层，新增 `POST` + `GET /api/v1/chat/groups`（建群 + 我加入的群，权限点 `chat:group:create` 见 `sql/V14__chat_group_permission_points.sql`），**群关系的完整生命周期已于同日补齐**——新增群详情 / 改群名 / 邀请 / 移除 / 退群 / 解散六个端点与四个权限点（`chat:group:update` / `invite` / `remove` / `dissolve`，见 `sql/V16__chat_group_manage_permission_points.sql`；群内身份与权限点是**两条正交的授权线**，服务端须合取），`ChatService` 会话列表同步解析群名（此前群聊恒 `targetName=null`）；**空间侧（`sys_space`）仍为骨架**，无 Controller / Service / 成员角色端点 | ① at-collaboration 落地实体 / Mapper / 四层（controller-service-repository）接管两表读写（**群组侧 ✅ 2026-09-26；空间侧待落地**）；② 群聊 / 群组空间与 `ApprovalNodeResolver`（低敏感审批人解析）接入成员数据（群聊侧 ✅ 已于发送前逐条校验成员身份；**群组空间与审批人解析待接入**）；③ 若最终裁决 **CE 不做**成员 / 群聊，则回退为「仅群组文件归集」，并把 `group_id` / `space_id` 标注为 CE 不启用（标注须落 V4+ 与 `sql/README.md`，**不得回改 V1**——Flyway checksum） | Phase 3（at-collaboration 落地时）；受 **D-6** 范围冻结约束（先确认 CE 是否做协作空间） |
| **D-12**（= N-5 · ✅ **CE 口径已定**） | 「外部协作者」受限身份无承载：`sys_user` 无身份标识列；**且与 PRD 存在口径冲突** | **列已落地**：`sql/V4__menu_route_user_type_and_collaboration.sql` 为 `sys_user` 增列 `user_type`（默认 1-内部用户，存量行为不变）；**CE 口径已定（2026-09-13）：维持 PRD，不创建外部协作者账号**，外发只走匿名链接通道 | ① **口径已裁定**：PRD §2.1 P6 定义「外部协作者 = **无平台账号**，只走外发链接通道」，**CE 采纳维持 PRD**，`user_type=2` 仅作 EE / 受限账号预留（CE 恒为 1、不启用）；② **EE 启用前置**：若将来启用受限账号，属**需求变更**，须先经 **D-6** 范围评审（同步改写 PRD P6 与 US-03「无需登录」验收标准），再限定登录入口与权限点（仅外发通道、禁 `file:destroy` 等高危点）并纳入 **D-5** 契约补全 | **CE 侧不阻塞（已裁定，无需动作）**；EE 拟启用受限账号时先过 **D-6**，不晚于该次范围评审 |

> **风险分级**：
>
> - 🟢 **口径 / 文档类**（延后无损）：**D-1**（跨模块口径）、**D-2**（扩展点命名）、**D-6**（范围书面冻结）、**D-7**（0.3 节逐项核对）——只影响认知与文档一致性，不影响继续开发。
> - 🔴 **有兼容成本类**（须前置）：**D-4**（幂等键 / 免登录端点防刷 / 前后端确认留痕）、**D-5**（审批端点 + 字段级 schema）——延期到「系统差不多」之后再补，会回头改已实现的 Controller、前端策略表与已定契约；其中 **D-4 须在写首个 Controller 前、D-5 须在进入 Phase 4 前**落掉。D-3 的文档勘误部分可延后。
> - ✅ **接缝类·已落地（2026-09-29）**：**A-6 已收口**——7 个 **CE/EE 扩展点**（含 CE 默认实现、`@ConditionalOnMissingBean` 装配门禁、消费点与回归测试）已同批建立并写入 §2.3 落地登记；**D-2** 主体收口，仅剩「附录 C 原文入库」的溯源残留。仍须区分：§1.3 的 `FileIngestPort` 属**跨模块协作端口**（模块间依赖倒置，随分片上传主线落地），与 CE/EE 扩展点是两回事，勿混谈。
> - 📌 **能力差异的表达方式（新增红线）**：CE/EE 差异**只由 Bean 是否存在表达**，业务代码禁止 `if (eeEnabled)`（§2.3 / G-11）。本轮唯一偏离「类型级顶替」的是 `TransportStrategy`（改用 Bean 名称级，理由是协议为集合、类型级顶替会造成功能回退），已登记在 §2.2 装配注。
> - ✅ **已收口**：**D-8**（`at:share:lock` TTL 裁定 **30 min**）——2026-09-13 当场裁决，项目内本已一致，**无需回改**。
> - 🏗️ **结构已落地 / 实现待补**：**D-9**（菜单路由列 + 菜单接口）、**D-10**（审计归档任务）、**D-11**（成员 / 空间两表 + at-collaboration 消费）、**D-12**（`user_type` 列 + 协作者口径）——DDL 已随 `sql/V4__menu_route_user_type_and_collaboration.sql` 落地，Java 侧实现与契约补全按各自触发时机执行；其中 **D-9 的接口契约随 D-5 前置**，**D-12 的 CE 口径已定**（维持 PRD，列仅作 EE 预留，不阻塞）。**D-11 的群组侧消费已于 2026-09-26 落地**（`SysGroup` / `SysGroupMapper` / `ChatGroupService` + `POST`/`GET /api/v1/chat/groups` + 会话群名解析，权限点 `chat:group:create` 见 `sql/V14`），**空间侧（`sys_space`）仍待落地**。

> **📌 配套清单（2026-09-14，2026-09-29 更新）**：以 `server/` 实际代码复核 `docs/prd/README.md` §4.1 后端现状时，
> 另识别出 **8 项实现缺口**（~~上传上限未配置~~、停用未联动吊销会话、无自助改密、健康检查与优雅启停缺失、
> 角色互斥无校验、敏感级别无变更审计、全文索引未建、~~轻 IM 缺 @ 提及与保留期~~），已登记在
> [`docs/development/AT-DIFF-todos.md`](../development/AT-DIFF-todos.md) § 🧱 后端功能缺口登记（GAP-01 ~ GAP-08），
> 与本节 **D-x 同批关闭**（时机：三条主线跑通后的加固期）。其中 **GAP-01「上传上限」已随分片上传主线落地（2026-09-14）**：
> `spring.servlet.multipart`（单文件 64 MB / 单请求 80 MB / 阈值 0）与 `anttransfer.transfer.*`（默认分片 8 MiB / 单分片上限
> 64 MiB / 片数上限 1024，超限 4006）已配置，单用户进行中任务上限 4103 ——「默认 1 MB 挡掉大文件」已不复存在
> （剩余 Nginx `client_max_body_size` 与前端前置校验待补）。
> 共享空间 / 审批端点 / 分片上传三项已由 **D-11 / D-5** 覆盖，未重复登记。
> ✅ **GAP-08「轻 IM 缺 @ 提及与保留期」已于 2026-09-29 关闭**：`sql/V18__chat_mention_and_retention.sql`
> 落 `notify_message.mentioned` 行级标记 + 保留期清理索引，上行 `mentionUserIds`、下行 `mentioned` / `mentionUnreadCount`，
> 并由 `ChatRetentionScheduler` 按 ≥30 天下限物理分批清理（详见 [AT-DIFF-todos GAP-08](../development/AT-DIFF-todos.md)）。

### 🎯 本阶段 DoD 现状对照（2026-09-13 核对；2026-09-29 复核对）

核对口径来源：`docs/prd/README.md`（§1.1 范围表 / §3 用户故事 / §4 功能清单 / §8 Won't）、`docs/api/README.md`（§2 返回体 / §3 分页 / §5 免登录端点）、`docs/api/error-codes.md`、`docs/architecture/use-case-flows.md`（§1.1 上传 / §2.3 审批）。

| # | 完成标准（DoD） | 当前状态 | 证据 | 缺口 → 对应延期项 |
| --- | --- | --- | --- | --- |
| 1 | CE/EE 功能边界书面冻结；P0/P1 清单与 0.3 节逐项对应无遗漏；Won't 项只留扩展点不排期 | 🟡 **部分达成** | PRD §1.1 范围表 + §4 功能清单 + §8 Won't 三表齐备且**内部自洽**（§1.1 P0 8 类 / P1 12 项被 §4 全覆盖；§8 Won't 9 项与 §1.1 Won't 栏一一对应；§2.1 覆盖全部 9 个 Won't 能力）；Won't 未排期（§9 延至 M3 评估） | ① 未「冻结」（仍标 `v0.2-draft · 待评审`，无评审结论 / 日期）→ **D-6**；② 战略规划书 0.3 节原文未入库，逐项核对**不可验证** → **D-7**；③ ~~7 个 SPI 接缝代码尚未建立~~ → ✅ **2026-09-29 已建立**（7 个 SPI 落地 + CE 默认实现 + 装配门禁，见 §2.3；**A-6 收口**、**D-2 主体收口**，仅剩「附录 C 原文入库」的溯源残留） |
| 2 | 至少 6 个核心用户故事带可测试验收标准 | ✅ **达成（超额）** | PRD §3 共 **13** 个（US-01~US-13），P0 占 9 个，各含独立「验收标准」且多为数值化判据：8 MiB 分片 / 并发 ≤ 5 / 秒传 P95 < 5 s / 错 5 次锁 30 min / access 30 min + refresh 7 d / 首屏 P95 < 1 s | 无硬缺口。可优化项：US-10 统计中心未给数据口径与延迟，属定性表述 |
| 3 | 统一响应体、分页、错误码表经前后端确认，后续代码一律遵守 | 🟡 **基本达成** | `Result<T>` + `PageResult<T>` + `error-codes.md` 全表与 A~H 策略**已定稿**；后端 `ErrorCode` 单一权威源、前端 `result.ts` 镜像策略表 + 20 例单测；分页上界（默认 20 / 上限 100）由分页插件强制收敛；免登录端点表（§5）、秒传预检语义（§2 示例 + §7 B 类）已明确 | ① **API-03 写接口幂等键未定义**（`docs/api/README.md` 全文无 `Idempotency-Key`）→ **D-4**；② 「经前后端确认」无评审结论 / 日期留痕，仅「已完成改造」事实描述 → **D-4**。**属发布门禁第 7 条硬前置** |
| 4 | 分片上传、审批两组核心接口契约定稿（Phase 4 直接照做） | 🟡 **部分达成（上传线 ✅ / 审批线待 D-5）** | 上传线：**✅ 已落地（2026-09-14）**——`use-case-flows` §1.1 的 5 端点（`precheck` / `GET parts` / `PUT parts` / `merge` / `DELETE`）+ 字段级 schema（`chunk` / `hash`、索引取路径、`received` 回索引数组）+ 错误码 + 7 态状态机 + 事务口径，均有控制器 / 服务层测试兜底（25 例）；审批线：§2.3 已定 `POST /api/v1/permission/applications` + 三选一审批 + 申请 5 态 / 授权 3 态 + 事件 + 到期回收 | ① **审批动作端点路径缺失**（approve / reject / reassign / 撤销 / 待办 / 列表 / 详情查询）；② **审批线字段级 schema 缺失**（上传线 `precheck` JSON body 与 `parts` 的 `chunk` / `hash` 载体已由 2026-09-14 实现定稿）；③ `docs/api/README.md` §1 前缀表缺 `/permission/applications`；④ 两份文档仍标 `draft` → **D-5**（**剩余仅审批线**）。**属 Phase 4 硬前置** |

> **小结**：4 条 DoD 中 **② 达成**；**③ 基本达成但有硬缺口（D-4）**；**① 部分达成（D-6 / D-7）**；**④ 上传线已达成（2026-09-14），剩审批线（D-5）**。
> 对外契约相关的 **D-4 / D-5 须在写首个 Controller 与进入 Phase 4 前收口**；其余（D-1 / D-2 / D-6 / D-7）可随三条主线推进回头补齐，与 D-1~D-3「不阻塞当前开发」的既有裁决一致。

---

## 5. 🔗 关联文档

| 文档 | 关系 |
| --- | --- |
| [架构总览 README](./README.md) | 模块职责与铁律的原始出处；本文是其落地化展开 |
| [系统设计 system-design.md](./system-design.md) | 技术设计基线（状态机 / 红线 P-1~P-10 / Redis Key 规划）；§1.3 待勘误 |
| [核心用例时序 use-case-flows.md](./use-case-flows.md) | 上传 / 审批两条主线的逐步时序，对应本文 §1.5 链路 |
| [红队评审 red-team-review.md](./red-team-review.md) | 缺陷与门禁来源；本文 §3 的 G-* 由其发现收敛而来 |
| [API 契约](../api/README.md) · [错误码](../api/error-codes.md) | 处理链路 §1.5-[6] 的返回契约与错误码分段 |
| [部署指南](../deployment/README.md) | §1.6 拓扑的部署操作手册（制品 / 环境变量 / Compose / K8s） |
| [PRD](../prd/README.md) | §2 扩展点承载的 Won't 能力清单（§8）与验收口径 |
