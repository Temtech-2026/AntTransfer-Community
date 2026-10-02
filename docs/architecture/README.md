# 🏗️ 系统架构（Architecture）

## 🧭 总览

AntTransfer CE（Community Edition）采用 **模块化单体（Modular Monolith）** 架构：
一个 Spring Boot 进程内以 Maven 多模块强制边界，兼顾单体部署的简单与领域分层的清晰。

> 📐 本文是**总览**（模块职责 + 依赖铁律）。**四层包结构、跨模块协作三通道、一次请求的统一处理链路、
> CE/EE 扩展点清单、部署拓扑**见 [架构落地说明 architecture.md](./architecture.md)。

```
                    ┌──────────────────────────────┐
                    │        web/  (Ant Design Pro)│  ← 前端（开发期经代理联调）
                    └──────────────┬───────────────┘
                                   │ HTTP /api/*
                    ┌──────────────▼───────────────┐
                    │   at-bootstrap  (唯一可运行)  │
                    │   聚合装配 + Spring Boot 启动 │
                    └──────────────┬───────────────┘
        ┌──────────────┬───────────┼───────────┬───────────────┐
        ▼              ▼           ▼           ▼               ▼
   at-gateway      at-auth    at-transfer  at-permission   at-collaboration
   接入/横切        认证鉴权     传输任务      RBAC 权限       协作共享
        └──────────────┴───────────┼───────────┴───────────────┘
                                   ▼
                             at-common（共享内核）
                                   ▲
        MySQL（业务数据/Flyway）   Redis（缓存/登录态）   本地文件/对象存储
```

## 🧩 模块职责与依赖铁律

| 模块 | 定位 | 典型职责 |
| --- | --- | --- |
| `at-common` | 共享内核 | `Result<T>` 统一返回体、错误码、`BaseEntity`、业务异常、链路 `TraceUtils`；**CE/EE 扩展点 7 个 SPI 契约**（`com.anttransfer.common.spi`）与通知类型 / 命令 |
| `at-gateway` | 统一接入层 | 全局异常处理、CORS、链路追踪过滤器等横切能力；`TransportStrategy` 注册与选择 |
| `at-auth` | 认证域 | 登录态 / Token / 用户身份（`IdentityProvider` 链路，CE 默认本地 BCrypt） |
| `at-transfer` | 传输域 | 任务调度 / 断点续传 / 进度 / 分片合并；合并成功发布 `TransferCompletedEvent` |
| `at-permission` | 权限域 | RBAC 权限点 / 角色 / 审批编排；审批人解析经 `ApprovalNodeResolver` |
| `at-file` | 文件域 | 本地 / 对象存储；`ContentScanInterceptor` / `WatermarkProvider` / `CryptoCodec` 消费点 |
| `at-collaboration` | 协作域 | 多人协作空间 / 分享链接 / **站内通知与轻 IM**（含 `@` 提及、保留期清理） |
| `at-bootstrap` | 启动聚合 | 聚合全部模块，独占 `spring-boot-maven-plugin` |

> ⚠️ **铁律**（仓库根父 POM `pom.xml` 头部亦有注释约束）：

1. 业务模块与 `at-gateway` **禁止互相依赖**，只允许依赖 `at-common`；
2. `at-common` **禁止反向依赖**任何 `at-*` 业务模块；
3. 版本统一在父工程 `properties` + `dependencyManagement` 中锁定；
4. 模块内跨表操作在服务层编排，避免模块间实体直接耦合；
5. **CE/EE 扩展点的接口一律定义在 `at-common` 的 `com.anttransfer.common.spi`**（模块私有协作端口除外）；
   能力差异**只由 Bean 是否存在表达**（`@ConditionalOnMissingBean`），业务代码禁止 `if (eeEnabled)`。

## ✂️ 横切设计

- 📦 **统一返回体**：`{ code, message, data, traceId }`，由 at-common 的 `Result` 静态工厂（`Result.ok(...)` / `Result.fail(...)`，见 `Result.java` Javadoc）构造，全局异常处理器兜底。
- 🛤️ **链路追踪**：`TraceUtils` 基于 MDC 生成并透传 `traceId`，贯穿入口过滤器与日志。
- 🗄️ **数据访问**：MyBatis-Plus，逻辑删除字段 `deleted` 统一在 `BaseEntity`，主键雪花算法。
- 🔄 **数据库版本化**：Flyway（脚本仓库在 `sql/`），`dev` / `prod` 默认均开启（`FLYWAY_ENABLED` 默认 `true`）并支持 `baseline-on-migrate`。
- 🔌 **CE/EE 扩展点**：7 个 SPI（`IdentityProvider` / `ContentScanInterceptor` / `WatermarkProvider` / `CryptoCodec` / `VirusScanner` / `ApprovalNodeResolver` / `TransportStrategy`）+ CE 默认实现 + `@ConditionalOnMissingBean` 装配门禁，完整清单与装配规则见 [architecture.md §2](./architecture.md)。

## ☁️ 部署形态

见 [部署文档](../deployment/README.md)：单体镜像 `server/at-bootstrap` fat jar + MySQL/Redis，
容器编排样例在仓库根 `docker-compose.yml` 与 `deploy/` 目录。

## 🔄 核心用例时序

三条闭环——**上传主线**（传输引擎）、**权限审批主线**（RBAC 标准流程）与**站内通知 / 轻 IM 主线**——
的系统级时序、领域事件、数据表与状态机约定见 [核心用例时序](./use-case-flows.md)。
凡实现上述相关接口，均须与其中步骤、错误码及表结构口径一致。

## 📌 遗留说明

- 🗄️ `archive/` 与 🗂️ `doc/`：迁移前的单体脚手架代码与早期草图/示意图，**均已从仓库移除**（`git ls-files` 无记录，工作区亦不存在）。
  `.dockerignore` 仍保留 `archive/` 排除项，以防本地残留目录被卷入构建上下文。
