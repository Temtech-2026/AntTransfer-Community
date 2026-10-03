# 🤝 贡献指南（Contributing Guide）

感谢你愿意为 **AntTransfer Community（CE）** 贡献代码、文档或想法 ❤️。花几分钟读完本页，能让你的贡献更快被合并。

> 🌐 英文要点见文末 [English Key Points](#-english-key-points)。
> 参与即视为同意遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)；**安全漏洞请走私密渠道**（[SECURITY.md](SECURITY.md)），不要开公开 Issue。

## 📖 项目一览

- 🖥️ 后端：`server/`，Java 21 + Spring Boot 3.5 的 Maven 多模块「模块化单体」。
- 🎨 前端：`web/`，Ant Design Pro（Umi Max + React 19 + TypeScript）。
- 🗄️ 数据库：MySQL 8.x（Flyway 版本化迁移），缓存 Redis 7.x。
- 📚 文档：`docs/`，含架构、API、部署、开发指引。

### ⚠️ 架构铁律（后端）

1. 业务模块（`at-auth` / `at-transfer` / `at-permission` / `at-file` / `at-collaboration`）与接入层 `at-gateway` 之间**禁止互相依赖**，只允许依赖共享内核 `at-common`；
2. `at-common` 禁止反向依赖任何业务模块；
3. `at-bootstrap` 是唯一可运行模块，独占 `spring-boot-maven-plugin`。

## 🛠️ 本地开发

**前置要求**：JDK 21（JDK 不对会在构建最开始被 maven-enforcer 拦下）、Maven 3.9+（可用 `./mvnw`）、Node.js 22+（前端 `engines` 强制；Node 18 会被 utoopack 拒绝）、MySQL 8.x、Redis 7.x。

推荐使用 Makefile（见 `make help`）；不使用 Make 时直接执行等价命令：

```bash
# 后端：启动 at-bootstrap（两步；等价：make run）
# ① 先装依赖模块到本地仓库  ② 再单独启动
# 注意：② 不要加 -am —— spring-boot:run 是 CLI goal，带 -am 会作用到根聚合 POM
# （packaging=pom，无 main class）并报 "Unable to find a suitable main class"。
./mvnw -DskipTests -pl server/at-bootstrap -am install
./mvnw -pl server/at-bootstrap spring-boot:run

# 前端
cd web && npm install && npm run dev

# 一键拉起开发依赖（MySQL/Redis，仅用于本地联调）
docker compose -f docker-compose.dev.yml up -d
```

后端默认端口 `8080`，全局前缀 `/api`；本地配置见 `server/at-bootstrap/src/main/resources/application*.yml`，敏感项一律走环境变量。

## 🌿 分支与提交

### 分支命名

从最新的 `master` 切出特性分支，**不要直接在 `master` 上提交**；一个分支只做一件事。

| 变更类型 | 分支命名示例 |
| --- | --- |
| 新功能 | `feat/chunk-upload-resume` |
| 缺陷修复 | `fix/refresh-token-race` |
| 文档 | `docs/deploy-nginx` |
| 重构（不改行为） | `refactor/share-service` |
| 测试 | `test/share-quota` |
| 杂项（构建 / 依赖 / CI） | `chore/bump-spring-boot` |

`master` 有更新时建议先 `rebase`，保持历史线性、便于回溯。

### 提交信息：Conventional Commits

格式 `<type>(<scope>): <描述>`，`scope` 取模块名或目录名（如 `at-auth` / `web` / `sql` / `ci`）：

| type | 用途 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | 缺陷修复 |
| `docs` | 文档 |
| `refactor` | 重构（不改变外部行为） |
| `test` | 测试 |
| `chore` | 杂项（构建、依赖、工具） |

示例：`feat(at-transfer): 支持分片断点续传`、`fix(at-auth): 修复刷新令牌竞态`。

- ✅ 提交信息由 **commitlint**（`web/.commitlintrc.js`，`@commitlint/config-conventional`）在 `commit-msg` 钩子中校验，格式非法会被直接拒绝；除上表 6 类外，规范另允许 `build` / `ci` / `perf` / `style` / `revert`；
- ⚠️ 请**不要**用 `--no-verify` 绕过钩子。若钩子确实误报，请在 PR 里说明原因，而不是静默跳过。

## ✅ 代码规范

### ☕ 后端（Java）

1. 📐 编码风格遵循 **《阿里巴巴 Java 开发手册》**（命名、集合与并发、异常与日志、注释与常量等口径）。
   📌 现状说明：该规范目前是**约定口径、靠 Review 把关**，仓库尚未接入 p3c / Checkstyle 之类自动检查；已自动化的是 **Spotless 许可证头校验**——所有 `src/main|test` 下的 Java 文件必须携带 Apache-2.0 文件头（`spotless:check` 绑定 `verify` 阶段强制，`./mvnw spotless:apply` 自动补齐；完整写法见 [许可证与版权声明规范](docs/development/license-header.md)）。
2. 🔗 不得破坏上文「架构铁律」；新依赖版本统一放父 pom 的 `dependencyManagement`。
3. 🗄️ 数据库变更**只增不改**：新增 `sql/V{n}__描述.sql`，禁止改写已发布脚本。
4. 🧱 统一返回体 `Result<T>` / 业务异常 `BusinessException` / 链路追踪 `TraceUtils` / 实体基类 `BaseEntity` 等约定见 [开发指南](docs/development/README.md)。
5. 🧪 新增或修复行为请附回归用例（JUnit 5 + Mockito；需真实 MySQL / Redis 的用 Testcontainers）。覆盖率门槛与当前基线见 `pom.xml` 的 JaCoCo 注释与 [dod.md](docs/development/dod.md)。

### 🎨 前端（web）

1. 🧹 **Biome 统一负责 lint 与 format**（配置 `web/biome.json`，版本见 `web/package.json`）：

   ```bash
   cd web
   npm run biome       # biome check --write：格式化 + 安全修复（提交前跑一次）
   npm run biome:lint  # biome lint：只检查不修改（CI 口径）
   npm run lint        # biome:lint + tsc --noEmit：提交前应全绿
   npm run tsc         # 仅类型检查
   ```

2. 🪝 `pre-commit` 钩子由 lint-staged 对**暂存文件**自动执行 `biome check --write`（见 `web/.lintstagedrc`），改动会被就地格式化后一起提交；
3. 🧪 用例用 Vitest + Testing Library（`npm test`），新增 Hook / 组件行为请补用例；
4. 🧩 新增接口类型建议从后端 OpenAPI 生成，或按 `src/services` 分层手写。

## 🚀 如何提交贡献（PR 全流程）

1. 🍴 **Fork** 主仓库（Gitee `gitee.com/temtech/AntTransfer-Community`；GitHub 镜像 `github.com/Temtech-2026/AntTransfer-Community` 同样接受 PR）；
2. 🌿 从 `master` 切出特性分支：`git checkout -b feat/xxx`（命名见上表）；
3. ✍️ 小步提交，提交信息遵循 Conventional Commits（会被 commitlint 校验）；
4. 🔍 **提交前自测**（与 PR 模板清单一致）：

   ```bash
   ./mvnw -B -ntp verify                      # 后端：测试 + Spotless 许可证头 + JaCoCo 报告/判定
   cd web && npm run lint && npm test && npm run build   # 前端：Biome lint + 类型检查 + 用例 + 构建
   ```

5. 📤 推送到自己的 Fork，向本仓库 `master` 发起 Pull Request，并按 `.github/PULL_REQUEST_TEMPLATE.md` 的结构填写：**变更说明 / 关联 Issue / 自测清单 / 文档更新确认**。⚠️ 该模板只在 GitHub 自动套用，**Gitee 侧请按同样结构手工填写**；
6. 🤖 等待 CI：`backend`（`./mvnw verify`）、`frontend`（Vitest + tsc + build）、`security`（Dependency-Check / npm audit / gitleaks）三个 job 需全绿。⚠️ `.github/workflows/` 只对 **GitHub 镜像**生效，走 Gitee 主仓库时请本地跑一遍等价命令；
7. 👀 通过 Review（口径见下节）后由维护者合入 🎉。

### 👀 Review 口径

| 变更范围 | 最少 Review 人数 |
| --- | --- |
| 一般改动（含 `docs/`、`web/` 常规改动） | **1 人** |
| **核心模块**：`server/at-common/`（共享内核）、`server/at-auth/`、`server/at-permission/`、`server/at-file/`、`sql/`（数据库迁移）、`Dockerfile` 与 `docker-compose*.yml`、`.github/workflows/` | **2 人** |

- 📌 落地方式说明：`.github/CODEOWNERS` 只解决「**该请求谁** Review」，GitHub 分支保护也只能设**全局**最少人数、无法按目录区分人数；因此「核心模块 2 人」靠**本节约定 + 维护者把关**，请勿因已有人 Approve 就自行合入；
- 🧾 核心模块改动请在 PR 描述里写清**风险与回滚方式**（迁移脚本、编排变更、鉴权链路尤其如此）；
- 🔍 Reviewer 关注点：架构铁律、越权与鉴权、迁移可回滚、密钥是否入库、文档是否同步、用例是否覆盖新行为。

## 📚 文档更新（与代码同等重要）

| 改动内容 | 需要同步 |
| --- | --- |
| 用户可见的新增 / 变更 / 修复 | `CHANGELOG.md` 的 `[Unreleased]`（Keep a Changelog 体例） |
| 新增或改名环境变量 | `.env.example` + `docs/deployment/` |
| 新增表 / 字段 | `sql/V{n}__*.sql` + `docs/development/README.md` |
| 接口或错误码变化 | `docs/api/README.md`、`docs/api/error-codes.md` |
| 架构或口径裁决 | `docs/architecture/`（必要时登记 `docs/development/AT-DIFF-todos.md`） |

## 💬 问题与讨论

- 🐛 Bug / 💡 需求 / ❓ 使用提问：请使用 Issue 模板（`bug` / `feature` / `question`），渠道总览见 [SUPPORT.md](SUPPORT.md)；
- 🔒 安全问题：**不要**在 Issue 中公开细节，请按 [SECURITY.md](SECURITY.md) 处理；
- 🤝 行为准则：参与即视为遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

## 🌐 English Key Points

- **Flow**: fork → branch off `master` (`feat/*`, `fix/*`, `docs/*`, `refactor/*`, `test/*`, `chore/*`) → commit with **Conventional Commits** (enforced by commitlint through the `commit-msg` hook — please do not use `--no-verify`) → PR against `master`, filling in the PR template.
- **Backend**: Java 21 / Maven multi-module. Follow the **Alibaba Java Coding Guidelines** (a review-enforced convention; tooling currently only enforces the Apache-2.0 license header via Spotless: `./mvnw spotless:apply`). Never edit released Flyway scripts — add `V{n}__*.sql`. Run `./mvnw -B -ntp verify`.
- **Frontend**: **Biome** handles both lint and format (`cd web && npm run biome`); `npm run lint` = Biome lint + `tsc --noEmit`; tests via Vitest (`npm test`); production build via `npm run build`.
- **Review**: at least **1** approval; **2** approvals for core areas — `at-common`, `at-auth`, `at-permission`, `at-file`, `sql/`, `Dockerfile` / `docker-compose*.yml`, `.github/workflows/`.
- **CI**: backend / frontend / security jobs must be green. Workflows cover the GitHub mirror only; when contributing through the primary Gitee repo, run the equivalent commands locally.
- **Docs**: keep `CHANGELOG.md` (`[Unreleased]`), `.env.example`, `docs/api/`, `docs/deployment/` in sync.
- **Security**: report privately per `SECURITY.md` — never in a public issue.
