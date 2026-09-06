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

> 💡 本地无 Docker 时，请自行准备 MySQL（库 `anttransfer`）与 Redis，并执行
> `sql/V1__schema.sql` 建表（或用 Flyway：`FLYWAY_ENABLED=true` 启动后端自动迁移）。

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
- 🗄️ **Flyway 行为**：开发默认关闭（`FLYWAY_ENABLED=false`），生产默认开启，脚本位于 `sql/`。

> 📚 更多细节：[开发指南](../development/README.md)、[架构说明](../architecture/README.md)。
