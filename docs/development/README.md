# 💻 开发指南（Development）

面向开发者：如何在本仓库高效、规范地写代码。

## 🗂️ 仓库导航

```
├── server/                 # 后端 Maven 多模块（见 docs/architecture）
├── web/                    # 前端 Ant Design Pro
├── sql/                    # Flyway 版本化 SQL（唯一事实源，V1~V21 顺序执行）
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
| 单元/集成（后端） | 各模块 `src/test/java` | JUnit 5 + Mockito + Testcontainers | **794 用例全绿**（2026-10-03 复跑；09-29 为 661 例、09-14 为 383 例）；覆盖率由 JaCoCo 统计（整体 **44.16%**、安全 **55.08%** 为 10-03 基线），`./mvnw verify` 出报告 |
| 单元/组件（前端） | `web/src/**/*.test.ts(x)` | Vitest + Testing Library | 已接入，**78 文件 / 1093 用例全绿**（2026-10-03 复跑；09-29 为 73 文件 / 828 例、09-14 为 21 文件 / 225 例）；`npm test`（`npm run test:coverage` 出覆盖率） |
| E2E | `tests/e2e` | Playwright（规划） | 空，见该目录 README |
| 性能 | `tests/performance` | JMeter + wrk（方案已就位）；k6（规划） | 见 [tests/performance/README.md](../../tests/performance/README.md) |

- 🔌 **联调准备（Step 1）**：OpenAPI → Apifox 集合导入步骤与端到端冒烟用例集（S01–S17）见
  [joint-debug-prep.md](./joint-debug-prep.md)。
- ✅ **交付质量 DoD（4 项完成标准）**：冒烟用例集 / 覆盖率与 CI 阻断 / 压测基线 / 前端测试与构建的
  **逐项核对结论、覆盖率基线数据与待办清单**见 [dod.md](./dod.md)（2026-09-14 首次实跑核对；**用例数与覆盖率基线 2026-10-03 全量刷新**）。
  注意与 [`architecture.md` § 🎯 本阶段 DoD](../architecture/architecture.md)（**阶段范围 DoD**）区分。

## ⚠️ 技术债与待裁决差异（AT-DIFF）

- 📋 索引页：[AT-DIFF-todos.md](./AT-DIFF-todos.md)（共**登记 11 项**外部计划 vs 仓库契约差异；其中
  **代码内仍留 `TODO[AT-DIFF-` 标记的为 3 处**——AT-DIFF-02 / 03 / 05，其余已裁决并回写文档或代码）。
- 🔍 审计命令：`grep -rn "TODO\[AT-DIFF-" server/`（应 **3 处**；发布前应为 0）。
- 📌 涉及「错误码口径 / 接口命名 / 鉴权架构」的裁决项，改动前先在此登记。
- 🌐 **国际化（i18n）登记**：2026-09-29 对**后增 5 语**（`ja-JP` / `ko-KR` / `fr-FR` / `ru-RU` / `es-ES`）
  做语言级校对时，新识别 **8 项方案层问题**（复数形态缺失 / 术语表缺失 / `zh-CN` 源文案陈旧 /
  法式排版规范 / 语言包覆盖度等）。**非译文错误**（译文错误已当轮修完），
  均登记在 [AT-DIFF-todos.md](./AT-DIFF-todos.md) **文末**「🌐 国际化（i18n）登记（I18N-01 ~ I18N-08）」，
  按「整体完工后统一裁决」处理，**不阻塞上线**。
- ✅ **前端 `/api` 代理链路已回归**（原挂账项，非 AT-DIFF）：配置侧已核对一致，并已于
  2026-09-29 在前后端齐备的环境下实测通过（前端全量 **73 文件 / 828 用例**全绿）——
  测试规模已于 2026-10-03 增至 **78 文件 / 1093 例**（仅复跑 `npm test`，代理链路本身的
  人工联调未再复跑）——详见 [web/README.md](../../web/README.md) 的「`/api` 开发代理链路（已回归）」。
  若仍失败，按 CORS → 路径拼接 → 后端白名单顺序排查，不再按「未实测」处理。

## 🚀 提交与合入

- 🤝 遵循 [CONTRIBUTING.md](../../CONTRIBUTING.md)：Conventional Commits、PR 到 `master`、CI 全绿。
- ✅ 提交前自检：`./mvnw -DskipTests package && ./mvnw spotless:check`。
