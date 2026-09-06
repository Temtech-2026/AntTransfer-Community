# 🏗️ 系统架构（Architecture）

## 🧭 总览

AntTransfer CE（Community Edition）采用 **模块化单体（Modular Monolith）** 架构：
一个 Spring Boot 进程内以 Maven 多模块强制边界，兼顾单体部署的简单与领域分层的清晰。

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
| `at-common` | 共享内核 | `Result<T>` 统一返回体、错误码、`BaseEntity`、业务异常、链路 `TraceUtils` |
| `at-gateway` | 统一接入层 | 全局异常处理、CORS、链路追踪过滤器等横切能力 |
| `at-auth` | 认证域 | 登录态 / Token / 用户身份 |
| `at-transfer` | 传输域 | 任务调度 / 断点续传 / 进度 |
| `at-permission` | 权限域 | RBAC 权限点 / 角色 |
| `at-file` | 文件域 | 本地 / 对象存储 |
| `at-collaboration` | 协作域 | 多人协作空间 / 分享链接 |
| `at-bootstrap` | 启动聚合 | 聚合全部模块，独占 `spring-boot-maven-plugin` |

> ⚠️ **铁律**（`server/pom.xml` 头部亦有注释约束）：

1. 业务模块与 `at-gateway` **禁止互相依赖**，只允许依赖 `at-common`；
2. `at-common` **禁止反向依赖**任何 `at-*` 业务模块；
3. 版本统一在父工程 `properties` + `dependencyManagement` 中锁定；
4. 模块内跨表操作在服务层编排，避免模块间实体直接耦合。

## ✂️ 横切设计

- 📦 **统一返回体**：`{ code, message, data, traceId }`，由 at-common 的 `Result` 静态工厂（`Result.ok(...)` / `Result.fail(...)`，见 `Result.java` Javadoc）构造，全局异常处理器兜底。
- 🛤️ **链路追踪**：`TraceUtils` 基于 MDC 生成并透传 `traceId`，贯穿入口过滤器与日志。
- 🗄️ **数据访问**：MyBatis-Plus，逻辑删除字段 `deleted` 统一在 `BaseEntity`，主键雪花算法。
- 🔄 **数据库版本化**：Flyway（脚本仓库在 `sql/`），生产 profile 默认开启并支持 `baseline-on-migrate`。

## ☁️ 部署形态

见 [部署文档](../deployment/README.md)：单体镜像 `server/at-bootstrap` fat jar + MySQL/Redis，
容器编排样例在仓库根 `docker-compose.yml` 与 `deploy/` 目录。

## 🔄 核心用例时序

两条核心闭环——**上传主线**（传输引擎）与**权限审批主线**（RBAC 标准流程）——的系统级时序、
领域事件、数据表与状态机约定见 [核心用例时序](./use-case-flows.md)。凡实现传输与审批相关
接口，均须与其中步骤、错误码及表结构口径一致。

## 📌 遗留说明

- 🗄️ `archive/`：迁移前的单体脚手架代码，**不参与构建**（已被 `.dockerignore` 排除），仅供追溯。
- 🗂️ `doc/`：早期草图/示意图，内容将逐步并入本目录后废弃。
