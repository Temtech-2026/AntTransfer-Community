# 🐜 AntTransfer CE

> **AntTransfer CE** 是一个开源的「内容 / 文件安全传输与协作共享」解决方案 —— Spring Boot 3 模块化单体后端 + Ant Design Pro 前端，**开箱即用、易于二次开发**。
>
> **AntTransfer CE** is an open-source solution for secure file/content transfer & collaboration — a Spring Boot 3 modular-monolith backend plus an Ant Design Pro frontend, *ready to run and easy to extend*.

<!-- 徽章位：接入 CI 后可补充真实 workflow 状态与版本徽章 -->
![Java](https://img.shields.io/badge/Java-21-orange.svg?logo=openjdk)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5.14-6DB33F.svg?logo=springboot)
![Maven](https://img.shields.io/badge/Maven-3.9-C71A36.svg?logo=apachemaven)
![MySQL](https://img.shields.io/badge/MySQL-8.4-4479A1.svg?logo=mysql)
![Redis](https://img.shields.io/badge/Redis-7.x-DC382D.svg?logo=redis)
![Flyway](https://img.shields.io/badge/Flyway-versioned-CC0200.svg)
![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react)
![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)

---

## ✨ 功能特性 / Features

- 🧱 **模块化单体**：后端 `server/` 下 8 个 Maven 模块（`at-common` / `at-gateway` / `at-auth` / `at-transfer` / `at-permission` / `at-file` / `at-collaboration` / `at-bootstrap`），模块间禁止循环依赖，可平滑演进拆分微服务；
- 📦 **统一返回体与错误码**：`Result<T>`（code / message / data / traceId），分段业务错误码（`0 / 1xxx / 2xxx / 4xxx / 5xxx`）；
- 🛤️ **全链路追踪**：`X-Trace-Id` 透传 + MDC 日志关联，全局异常兜底；
- 🔑 **领域骨架**：认证鉴权（`at-auth`）、RBAC 权限点与审批（`at-permission`）、传输任务与断点续传（`at-transfer`）、文件元数据/秒传/外发分享（`at-file`）、协作空间与站内轻 IM（`at-collaboration`）；
- 🔔 **站内通知与轻 IM**：传输完成提醒、外发链接到期前提醒、取件回执（`NotifyType 4 / 8 / 9`），会话消息支持 `@` 提及与「有人@我」未读，消息保留期 ≥ 30 天并由定时任务自动清理；
- 🔌 **CE/EE 扩展点**：7 个 SPI（身份源 / 内容扫描 / 水印 / 存储编解码 / 病毒扫描 / 审批人解析 / 传输策略）已就绪——CE 提供直通实现，EE 以 Bean 覆盖即可接入，业务代码内**无 `if (eeEnabled)` 分支**；
- 🗄️ **数据库版本化**：Flyway 迁移（脚本仓库 `sql/`），`dev` / `prod` 默认均自动迁移（`FLYWAY_ENABLED` 默认 `true`），并支持存量库基线；
- 📖 **接口文档**：SpringDoc OpenAPI 3（Swagger UI），生产默认关闭；
- 🖥️ **前端工程**：`web/` 基于 Ant Design Pro v6（Umi Max + React 19 + TypeScript），已配置 `/api` 代理到后端；
- 🛠️ **工程化**：Makefile 统一入口、Docker 多阶段镜像、`docker compose` 一键编排、GitHub Actions CI、Spotless 许可证校验。

## 🖼️ 界面预览 / Screenshots

> 📸 **截图位（待补充）**：首个可用版本发布前替换为真实界面截图，建议存放于 `docs/images/` 并以相对路径引用。

| 登录 / Sign in | 传输任务 / Transfers |
| :---: | :---: |
| _截图待补充_ | _截图待补充_ |

| 文件管理 / Files | 协作空间 / Collaboration |
| :---: | :---: |
| _截图待补充_ | _截图待补充_ |

<!-- 替换示例：删除上方占位表格，取消注释并按真实文件名修改
| ![登录](docs/images/screenshot-login.png) | ![传输任务](docs/images/screenshot-transfers.png) |
| --- | --- |
| ![文件管理](docs/images/screenshot-files.png) | ![协作空间](docs/images/screenshot-collaboration.png) |
-->

## 📁 项目结构 / Project Layout

```text
anttransfer-community/
├── README.md  LICENSE  CHANGELOG.md
├── CONTRIBUTING.md  CODE_OF_CONDUCT.md  SECURITY.md  SUPPORT.md
├── Makefile  docker-compose.yml  docker-compose.dev.yml  .env.example
├── .github/{ISSUE_TEMPLATE,workflows,CODEOWNERS,PULL_REQUEST_TEMPLATE.md}
├── docs/{getting-started,architecture,api,deployment,development}
├── server/                # 后端 Maven 多模块
│   ├── at-common / at-gateway / at-auth / at-transfer
│   └── at-permission / at-file / at-collaboration / at-bootstrap
├── web/                   # 前端 Ant Design Pro（Node ≥ 22）
├── sql/                   # Flyway 脚本唯一事实源：V1__schema.sql ~ V21（构建期复制进 at-bootstrap）
├── deploy/{docker,kubernetes,helm}
├── scripts/
└── tests/{e2e,performance}
```

### 🧩 后端模块一览

| 模块 | 职责 |
| --- | --- |
| `server/at-common` | 共享内核：`Result<T>` / 错误码 / `BaseEntity` / 链路 Trace / 业务异常 / **CE-EE 扩展点 7 个 SPI 契约（`com.anttransfer.common.spi`）** |
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
# ↑ 容器 MySQL 映射到宿主机 3307（刻意避开你本机自装 MySQL 的 3306）；application.yml
#   默认 DB_URL 即 localhost:3307，两者对齐：容器没起来时后端会直接连接失败，
#   而不是静默连上本机 3306 的库。
# 后端分两步（等价：make run）：先装依赖模块到本地仓库，再单独启动 at-bootstrap。
# 启动命令不要加 -am，否则 CLI goal 会作用到根聚合 POM 并因找不到 main class 而失败。
./mvnw -DskipTests -pl server/at-bootstrap -am install
./mvnw -pl server/at-bootstrap spring-boot:run

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
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | `localhost:3307/anttransfer`（= dev 容器库） | MySQL 连接（生产必须覆盖；改用本机自装 MySQL 时显式指向 3306） |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | 本地 Redis | Redis 连接 |
| `FLYWAY_ENABLED` | `true` | 是否执行 Flyway 迁移（`dev` / `prod` 默认均开启，置 `false` 可临时关闭） |

## 📚 文档 / Documentation

- 🚀 [快速开始](docs/getting-started/README.md) · 🏗️ [架构说明](docs/architecture/README.md) · 🔌 [API 约定](docs/api/README.md)
- 📋 [产品需求 PRD](docs/prd/README.md) · ☁️ [部署指南](docs/deployment/README.md) · 💻 [开发指南](docs/development/README.md)
- 🤝 [贡献指南](CONTRIBUTING.md) · 🛡️ [行为准则](CODE_OF_CONDUCT.md) · 🔒 [安全策略](SECURITY.md) · 🆘 [支持渠道](SUPPORT.md) · 📝 [更新日志](CHANGELOG.md)

## 🗺️ 路线图 / Roadmap

- ✅ ~~前端页面按领域落地（登录/传输/文件/协作），替换模板示例页~~（已完成：登录 / 工作台 / 文件 / 分享 / 会话 / 消息中心 / 审计 / 权限地图）；
- 🔌 **CE/EE 差异化接口已就绪**：7 个扩展点具备 CE 默认实现与 `@ConditionalOnMissingBean` 装配门禁，
  EE 可直接以 Bean 覆盖接入（口径见 [架构落地说明 §2](docs/architecture/architecture.md)）；
- 🧪 各业务模块接口与测试完善，接入 E2E（`tests/e2e`）与性能基线（`tests/performance`）；
- 📦 Kubernetes/Helm 正式部署物、首个稳定版本 1.0.0。

## 🛡️ 安全漏洞披露 / Security Policy

请勿在公开 Issue 中暴露安全漏洞细节。优先使用 GitHub Security Advisory（仓库 → `Security` → `Report a vulnerability`）；备用联系方式：`temtech2026@163.com`。完整报告方式与支持范围见 [SECURITY.md](SECURITY.md)。

## 📄 许可证 / License

**AntTransfer CE** 以 [Apache License 2.0](LICENSE) 协议开源；`web/` 目录内含 Ant Design Pro 模板的 MIT 授权声明（见 `web/LICENSE`）。

```text
Copyright (c) 2026 AntTransfer Community Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
```
