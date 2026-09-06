# 💻 开发指南（Development）

面向开发者：如何在本仓库高效、规范地写代码。

## 🗂️ 仓库导航

```
├── server/                 # 后端 Maven 多模块（见 docs/architecture）
├── web/                    # 前端 Ant Design Pro
├── sql/                    # Flyway 版本化 SQL（V1/V2/migrations）
├── deploy/                 # docker / kubernetes / helm 部署物
├── scripts/                # 辅助脚本（db 初始化等）
├── tests/                  # e2e / performance（规划中）
├── docs/                   # 文档
└── Makefile                # 常用命令入口（make help）
```

## ⚡ 日常命令

```bash
make build      # 后端打包（-DskipTests）
make test       # 后端测试
make run        # 本地起后端（at-bootstrap, 端口 8080）
make dev-up     # Docker 拉起本地 MySQL/Redis
make web-dev    # 本地起前端
```

等价原始命令见 [快速开始](../getting-started/README.md) 与 `Makefile`。

## ☕ 后端开发规约

1. **🧭 依赖方向**：遵守架构铁律（业务/接入层 → `at-common`；`at-common` 不反向依赖），新依赖版本一律放父 pom 的 `dependencyManagement`。
2. **📜 许可证头**：Java 文件头部必须有 Apache-2.0 头，CI 中 `spotless:check` 强制校验；本地可 `./mvnw spotless:apply` 自动补。
3. **📦 统一返回体**：Controller 返回 `Result<T>`（at-common 的 `Result` 静态工厂 `Result.ok(...)` / `Result.fail(...)`），业务异常抛 `BusinessException`，由全局处理器转换。
4. **🛤️ 链路追踪**：需要透传请求链路时使用 `at-common` 的 `TraceUtils`。
5. **🧬 实体基类**：继承 `BaseEntity`（`createBy/createTime/updateBy/updateTime/deleted` 公共字段，删除走逻辑删除）；主键默认雪花算法。
6. **🗄️ 新增表流程**：追加 `sql/V{n}__描述.sql`（禁止回改已发布脚本）→ 实体/Mapper → Service → Controller → Swagger 自查。

## 🎨 前端开发规约

- 🧩 技术栈：Ant Design Pro（Umi + React + TypeScript）。
- 🔗 本地联调：`npm run dev` 默认端口，通过 `.env` / `config/proxy.ts` 把 `/api` 代理到 `http://localhost:8080`。
- 🗃️ 新增接口类型建议从后端 OpenAPI 生成或手写 `services/` 下对应 domain 文件，遵循 `src/services` 分层。

## 🧪 测试策略

| 层 | 位置 | 工具 | 现状 |
| --- | --- | --- | --- |
| 单元/集成 | 各模块 `src/test/java` | JUnit 5 + Mockito | 模块落地中 |
| E2E | `tests/e2e` | Playwright（规划） | 空，见该目录 README |
| 性能 | `tests/performance` | k6（规划） | 空，见该目录 README |

## 🚀 提交与合入

- 🤝 遵循 [CONTRIBUTING.md](../../CONTRIBUTING.md)：Conventional Commits、PR 到 `master`、CI 全绿。
- ✅ 提交前自检：`./mvnw -DskipTests package && ./mvnw spotless:check`。
