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
./mvnw clean compile -DskipTests   # 仅全模块编译校验（仓库根执行；server/ 下无 mvnw）
make test       # 后端测试
make run        # 本地起后端（at-bootstrap, 端口 8080）
make dev-up     # Docker 拉起本地 MySQL/Redis
make web-dev    # 本地起前端
```

> ⚠️ **构建入口在仓库根**：`server/` 下既无 `mvnw` 也无 `pom.xml`（聚合 POM 是根 `pom.xml`，
> 以 `<modules>` 聚合 `server/at-*`），因此 `cd server && ./mvnw ...` 一律不成立。
> `make run` 亦为两步（先 `install` 依赖模块，再单独 `spring-boot:run`），原因见 Makefile 内注释。

等价原始命令见 [快速开始](../getting-started/README.md) 与 `Makefile`。

## ☕ 后端开发规约

1. **🧭 依赖方向**：遵守架构铁律（业务/接入层 → `at-common`；`at-common` 不反向依赖），新依赖版本一律放父 pom 的 `dependencyManagement`。
2. **📜 许可证头**：Java 文件头部必须有 Apache-2.0 头，CI 中 `spotless:check` 强制校验；本地可 `./mvnw spotless:apply` 自动补。完整写法（`LICENSE` 文件规范、文件头模板、各语言注释对照）见 [许可证与版权声明规范](./license-header.md)。
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
| 单元/集成（后端） | 各模块 `src/test/java` | JUnit 5 + Mockito + Testcontainers | 383 用例全绿；覆盖率由 JaCoCo 统计（整体 36.5%），`./mvnw verify` 出报告 |
| 单元/组件（前端） | `web/src/**/*.test.ts(x)` | Vitest + Testing Library | 已接入，21 文件 / 225 用例；`npm test`（`npm run test:coverage` 出覆盖率） |
| E2E | `tests/e2e` | Playwright（规划） | 空，见该目录 README |
| 性能 | `tests/performance` | JMeter + wrk（方案已就位）；k6（规划） | 见 [tests/performance/README.md](../../tests/performance/README.md) |

- 🔌 **联调准备（Step 1）**：OpenAPI → Apifox 集合导入步骤与端到端冒烟用例集（S01–S17）见
  [joint-debug-prep.md](./joint-debug-prep.md)。
- ✅ **交付质量 DoD（4 项完成标准）**：冒烟用例集 / 覆盖率与 CI 阻断 / 压测基线 / 前端测试与构建的
  **逐项核对结论、覆盖率基线数据与待办清单**见 [dod.md](./dod.md)（2026-09-14 实跑核对）。
  注意与 [`architecture.md` § 🎯 本阶段 DoD](../architecture/architecture.md)（**阶段范围 DoD**）区分。

## ⚠️ 技术债与待裁决差异（AT-DIFF）

- 📋 索引页：[AT-DIFF-todos.md](./AT-DIFF-todos.md)（外部计划 vs 仓库契约的 5 处差异，
  详细描述与方案嵌在代码内 `TODO[AT-DIFF-01~05]`）。
- 🔍 审计命令：`grep -rn "TODO\[AT-DIFF-" server/`（应 5 处；发布前应为 0）。
- 📌 涉及「错误码口径 / 接口命名 / 鉴权架构」的裁决项，改动前先在此登记。
- 🔗 **前端待联调**（非 AT-DIFF，前端自身挂账项）：`/api` 开发代理链路配置已核对一致、
  尚未实测——详见 [web/README.md](../../web/README.md) 的「待联调：`/api` 开发代理链路」；
  联调时 `POST /api/v1/auth/token` 返回 200 即可关闭本项。

## 🚀 提交与合入

- 🤝 遵循 [CONTRIBUTING.md](../../CONTRIBUTING.md)：Conventional Commits、PR 到 `master`、CI 全绿。
- ✅ 提交前自检：`./mvnw -DskipTests package && ./mvnw spotless:check`。
