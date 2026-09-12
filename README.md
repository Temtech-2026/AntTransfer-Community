# 🐜 AntTransfer CE

> **AntTransfer CE** 是一个开源的「内容 / 文件安全传输与协作共享」解决方案 —— Spring Boot 3 模块化单体后端 + Ant Design Pro 前端，**开箱即用、易于二次开发**。
>
> **AntTransfer CE** is an open-source solution for secure file/content transfer & collaboration — a Spring Boot 3 modular-monolith backend plus an Ant Design Pro frontend, *ready to run and easy to extend*.

<!-- 徽章位：接入 CI 后可补充真实 workflow 状态与版本徽章 -->
![Java](https://img.shields.io/badge/Java-21-orange.svg?logo=openjdk)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5.14-6DB33F.svg?logo=springboot)
![Maven](https://img.shields.io/badge/Maven-3.9-C71A36.svg?logo=apachemaven)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1.svg?logo=mysql)
![Redis](https://img.shields.io/badge/Redis-7.x-DC382D.svg?logo=redis)
![Flyway](https://img.shields.io/badge/Flyway-versioned-CC0200.svg)
![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)
![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)

---

## ✨ 功能特性 / Features

- 🧱 **模块化单体**：后端 `server/` 下 8 个 Maven 模块（`at-common` / `at-gateway` / `at-auth` / `at-transfer` / `at-permission` / `at-file` / `at-collaboration` / `at-bootstrap`），模块间禁止循环依赖，可平滑演进拆分微服务；
- 📦 **统一返回体与错误码**：`Result<T>`（code / message / data / traceId），分段业务错误码（`0 / 1xxx / 2xxx / 4xxx / 5xxx`）；
- 🛤️ **全链路追踪**：`X-Trace-Id` 透传 + MDC 日志关联，全局异常兜底；
- 🔑 **领域骨架**：认证鉴权（`at-auth`）、RBAC 权限点（`at-permission`）、传输任务与断点续传模型（`at-transfer`）、文件元数据/秒传（`at-file`）、协作空间与分享（`at-collaboration`）；
- 🗄️ **数据库版本化**：Flyway 迁移（脚本仓库 `sql/`），`dev` 默认关闭、`prod` 默认开启并支持存量库基线；
- 📖 **接口文档**：SpringDoc OpenAPI 3（Swagger UI），生产默认关闭；
- 🖥️ **前端工程**：`web/` 基于 Ant Design Pro v6（Umi Max + React 19 + TypeScript），已配置 `/api` 代理到后端；
- 🛠️ **工程化**：Makefile 统一入口、Docker 多阶段镜像、`docker compose` 一键编排、GitHub Actions CI、Spotless 许可证校验。

## 📁 项目结构 / Project Layout

```text
anttransfer-community/
├── README.md  LICENSE  CHANGELOG.md
├── CONTRIBUTING.md  CODE_OF_CONDUCT.md  SECURITY.md
├── Makefile  docker-compose.yml  docker-compose.dev.yml  .env.example
├── .github/{ISSUE_TEMPLATE,workflows,CODEOWNERS}
├── docs/{getting-started,architecture,api,deployment,development}
├── server/                # 后端 Maven 多模块
│   ├── at-common / at-gateway / at-auth / at-transfer
│   └── at-permission / at-file / at-collaboration / at-bootstrap
├── web/                   # 前端 Ant Design Pro（Node ≥ 22）
├── sql/                   # Flyway 脚本：V1__schema.sql / V2__init_data.sql / migrations/
├── deploy/{docker,kubernetes,helm}
├── scripts/
└── tests/{e2e,performance}
```

### 🧩 后端模块一览

| 模块 | 职责 |
| --- | --- |
| `server/at-common` | 共享内核：`Result<T>` / 错误码 / `BaseEntity` / 链路 Trace / 业务异常 |
| `server/at-gateway` | 统一接入层：全局异常、TraceId 过滤器、CORS |
| `server/at-auth` | 认证鉴权：登录态 / 用户上下文 / `@RequireLogin` |
| `server/at-transfer` | 传输任务核心：任务实体 / 状态机 / 断点续传骨架 |
| `server/at-permission` | 权限控制：RBAC 权限点 / `@RequirePermission` |
| `server/at-file` | 文件存储：`FileObject` 元数据 / 秒传预留 |
| `server/at-collaboration` | 协作共享：协作空间 / 分享骨架 |
| `server/at-bootstrap` | 聚合启动模块（唯一可运行，含 `application*.yml`） |

> ⚠️ **架构铁律**：业务模块与 `at-gateway` 之间禁止互相依赖，只允许依赖 `at-common`；`at-common` 禁止反向依赖任何 `at-*` 模块；版本统一在父工程 `dependencyManagement` 锁定。

## 🚀 快速开始 / Quick Start

> 📌 前提：JDK 21、Maven 3.9+（可用 `./mvnw`）、Node ≥ 22（前端）、Docker（可选，用于一键拉依赖）。

```bash
# 1️⃣ 一键启动完整环境（MySQL + Redis + 后端，端口 8080）
docker compose up -d --build

# —— 或 —— 仅启动本地依赖（MySQL/Redis），后端用 IDE/命令行跑：
docker compose -f docker-compose.dev.yml up -d
./mvnw -pl server/at-bootstrap -am spring-boot:run

# 2️⃣ 前端（默认 http://localhost:8000，/api 已代理到后端）
cd web && npm install && npm run dev

# 3️⃣ 验证
# 接口文档（Swagger UI）：http://localhost:8080/api/swagger-ui/index.html
# OpenAPI JSON：        http://localhost:8080/api/v3/api-docs
```

也支持 `make help` 查看全部常用命令（build / test / run / dev-up / web-dev …）。

### ⚙️ 关键环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `SPRING_PROFILES_ACTIVE` | `dev` | 运行环境：`dev` / `prod`（prod 关闭 Swagger、默认开启 Flyway） |
| `SERVER_PORT` | `8080` | 服务端口 |
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | 本地 `anttransfer` 库 | MySQL 连接（生产必须覆盖） |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | 本地 Redis | Redis 连接 |
| `FLYWAY_ENABLED` | dev `false` / prod `true` | 是否执行 Flyway 迁移 |

## 📚 文档 / Documentation

- 🚀 [快速开始](docs/getting-started/README.md) · 🏗️ [架构说明](docs/architecture/README.md) · 🔌 [API 约定](docs/api/README.md)
- 📋 [产品需求 PRD](docs/prd/README.md) · ☁️ [部署指南](docs/deployment/README.md) · 💻 [开发指南](docs/development/README.md)
- 🤝 [贡献指南](CONTRIBUTING.md) · 🛡️ [行为准则](CODE_OF_CONDUCT.md) · 🔒 [安全策略](SECURITY.md) · 📝 [更新日志](CHANGELOG.md)

## 🗺️ 路线图 / Roadmap

- 🖥️ 前端页面按领域落地（登录/传输/文件/协作），替换模板示例页；
- 🧪 各业务模块接口与测试完善，接入 E2E（`tests/e2e`）与性能基线（`tests/performance`）；
- 📦 Kubernetes/Helm 正式部署物、首个稳定版本 1.0.0。

## 🛡️ 安全漏洞披露 / Security Policy

请勿在公开 Issue 中暴露安全漏洞细节，报告方式与支持范围见 [SECURITY.md](SECURITY.md)。

## 📄 许可证 / License

**AntTransfer CE** 以 [Apache License 2.0](LICENSE) 协议开源；`web/` 目录内含 Ant Design Pro 模板的 MIT 授权声明（见 `web/LICENSE`）。

```text
Copyright (c) 2026 AntTransfer Community Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
```
