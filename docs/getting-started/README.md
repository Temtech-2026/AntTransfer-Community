# 🚀 快速开始（Getting Started）

⏱️ 10 分钟在本机跑通 AntTransfer CE。

## 📋 环境要求

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| ☕ JDK | 21 | 后端编译运行 |
| 📦 Maven | 3.9+ | 后端构建（也可直接用 `./mvnw`） |
| 🟢 Node.js | 20+ | 前端（`web/`） |
| 🗄️ MySQL | 8.x | 主库（默认库名 `anttransfer`） |
| ⚡ Redis | 7.x | 缓存 / 登录态 |
| 🐳 Docker | 24+ | 可选，一键拉起 MySQL / Redis |

## 1️⃣ 第一步：启动基础设施

```bash
# 方式 A：Docker（推荐，一条命令拉起 MySQL + Redis）
docker compose -f docker-compose.dev.yml up -d

# 方式 B：本机已装有 MySQL/Redis，直接复用（库表见 sql/README.md）
```

> 💡 本地无 Docker 时，请自行准备 MySQL（库 `anttransfer`）与 Redis，**建表无需手工执行**：
> Flyway 迁移默认开启（`FLYWAY_ENABLED` 默认 `true`），启动后端即自动执行 `sql/V1__schema.sql`
> （建表）与 `sql/V2__init_data.sql`（初始化数据）。若为已有存量库或已手工建过表，无需改配置——
> `baseline-on-migrate` 会自动打基线后继续，且 V1 为 `create table if not exists` 可安全重入
> （仅勿手工重复执行 V2，其固定 ID 插入会与 Flyway 冲突）。

## 2️⃣ 第二步：启动后端

```bash
./mvnw -pl server/at-bootstrap -am spring-boot:run
# 等价：make run
```

启动成功后：

- 🖥️ 服务地址：<http://localhost:8080>
- 🌐 全局前缀：`/api`（所有接口均在 `http://localhost:8080/api/...`）
- 📖 Swagger UI：<http://localhost:8080/api/swagger-ui/index.html>
- 📄 OpenAPI JSON：<http://localhost:8080/api/v3/api-docs>

## 3️⃣ 第三步：启动前端（可选）

```bash
cd web
npm install
npm run dev
```

前端默认端口与后端代理约定见 `web/` 工程内的 `config`（README 最后会更新导航）。

## ❓ 常见问题

- 🐛 **编译报“不支持发行版本 21”**：确认 `JAVA_HOME` 指向 JDK 21（项目根 `mvnw -v` 可查看当前 JVM）。
- 🔌 **连接数据库失败**：检查 `DB_URL / DB_USERNAME / DB_PASSWORD` 环境变量或
  `server/at-bootstrap/src/main/resources/application*.yml` 默认值。
- 🗄️ **Flyway 行为**：开发与生产**默认均自动迁移**（`FLYWAY_ENABLED` 默认 `true`），脚本位于 `sql/`；如需跳过迁移（例如已手工建表），启动时置 `FLYWAY_ENABLED=false`。

> 📚 更多细节：[开发指南](../development/README.md)、[架构说明](../architecture/README.md)。
