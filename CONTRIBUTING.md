# 🤝 贡献指南（Contributing Guide）

感谢你愿意为 **AntTransfer Community（CE）** 贡献代码、文档或想法 ❤️。请花几分钟阅读本指南，能让你的贡献更快被合并。

## 📖 项目一览

- 🖥️ 后端：`server/`，Java 21 + Spring Boot 3.5 的 Maven 多模块「模块化单体」。
- 🎨 前端：`web/`，Ant Design Pro（Umi/React）。
- 🗄️ 数据库：MySQL 8.x（Flyway 版本化迁移），缓存 Redis 7.x。
- 📚 文档：`docs/`，含架构、API、部署、开发指引。

### ⚠️ 架构铁律（后端）

1. 业务模块（`at-auth` / `at-transfer` / `at-permission` / `at-file` / `at-collaboration`）与接入层 `at-gateway` 之间**禁止互相依赖**，只允许依赖共享内核 `at-common`；
2. `at-common` 禁止反向依赖任何业务模块；
3. `at-bootstrap` 是唯一可运行模块，独占 `spring-boot-maven-plugin`。

## 🛠️ 本地开发

**前置要求**：JDK 21、Maven 3.9+、Node.js 20+（前端）、MySQL 8.x、Redis 7.x。

推荐使用 Makefile（见 `make help`）；不使用 Make 时直接执行等价命令：

```bash
# 后端：启动 at-bootstrap（-am 连带构建依赖模块）
./mvnw -pl server/at-bootstrap -am spring-boot:run

# 前端
cd web && npm install && npm run dev

# 一键拉起开发依赖（MySQL/Redis，仅用于本地联调）
docker compose -f docker-compose.dev.yml up -d
```

后端默认端口 `8080`，全局前缀 `/api`；本地配置见 `server/at-bootstrap/src/main/resources/application*.yml`，敏感项一律走环境变量。

## ✅ 代码规范

- 📜 所有 `src/main|test` 下的 Java 文件必须携带 Apache-2.0 许可证文件头；`spotless:check` 已绑定 `verify` 阶段自动校验：

  ```bash
  ./mvnw spotless:apply   # 自动补齐文件头（apply 才生效，check 只校验）
  ./mvnw verify
  ```

- 🔗 修改不得破坏上文「架构铁律」：跨模块依赖只允许发生在「业务/接入层 → at-common」或「at-bootstrap → 全部」。
- 🗄️ 数据库变更**不要改写已发布的 Flyway 脚本**，一律新增 `V{n}__xxx.sql`。
- 💬 提交信息建议遵循 Conventional Commits，如 `feat(at-transfer): 支持分片断点续传`、`fix(at-auth): 修复刷新令牌竞态`。

## 🚀 如何提交贡献

1. 🍴 Fork 本仓库并创建特性分支：`git checkout -b feat/xxx`。
2. 🔍 提交前自查：编译通过（`./mvnw -DskipTests package`）、`spotless:check` 通过、相关测试通过。
3. 📤 发起 Pull Request 到 `master`，在描述中说明动机与改动点，如涉及数据库变更请附 Flyway 脚本。
4. 👀 维护者会在 Code Review 后合入；未通过的 CI 需要先修复再继续。

## 💬 问题与讨论

- 🐛 Bug / 💡 需求：请使用 GitHub Issues 模板（bug / feature），便于维护者复现与跟踪。
- 🔒 安全问题：**不要**在 Issue 中公开细节，请按 [SECURITY.md](SECURITY.md) 处理。
- 🤝 行为准则：参与即视为遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。
