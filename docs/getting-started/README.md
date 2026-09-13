# 🚀 快速开始（Getting Started）

⏱️ 10 分钟在本机跑通 AntTransfer CE。

## 📋 环境要求

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| ☕ JDK | 21 | 后端编译运行（JDK 17 会报「不支持发行版本 21」） |
| 📦 Maven | 3.9+ | 后端构建（也可直接用 `./mvnw`；**构建入口在仓库根，`server/` 下没有 `mvnw`**） |
| 🟢 Node.js | 22+ | 前端（`web/`）；`engines` 强制 ≥ 22，Node 18 会被 utoopack 拒绝 |
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
# ① 先把依赖模块装进本地仓库（首次或依赖有改动时执行一次）
./mvnw -DskipTests -pl server/at-bootstrap -am install

# ② 再单独启动 at-bootstrap
#    ⚠️ 不要加 -am：spring-boot:run 是 CLI goal，带 -am 时会作用到根聚合 POM
#    （packaging=pom，无 main class）并报 "Unable to find a suitable main class"，
#    而 at-bootstrap 反被 SKIPPED。
./mvnw -pl server/at-bootstrap spring-boot:run

# 等价：make run（已按上述两步实现）
```

> 🧱 仅需编译校验时（不启动、不打包），在**仓库根**执行：
> `./mvnw clean compile -DskipTests`（`server/` 下无 `mvnw` 与 `pom.xml`，聚合 POM 在仓库根）。

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
- 🔌 **连接数据库失败**：先确认该连哪个库——默认 `DB_URL` 是
  `localhost:3307/anttransfer`，即 **dev 容器库**（`docker compose -f docker-compose.dev.yml up -d`
  映射到宿主机的端口），账号 `root` / 密码 `123456`。**3307 连不上 = 容器没起来**，这是刻意设计：
  3306 留给你本机自装的 MySQL，避免容器没起来时静默连上本机库。
  若确实要用本机自有 MySQL，显式覆盖 `DB_URL=jdbc:mysql://localhost:3306/anttransfer?...`；
  凭据不同时再用 `DB_USERNAME / DB_PASSWORD` 覆盖，否则 Flyway 报
  `1045 Access denied for user 'root'@'localhost'`。
- 🗄️ **Flyway 行为**：开发与生产**默认均自动迁移**（`FLYWAY_ENABLED` 默认 `true`），脚本位于 `sql/`；如需跳过迁移（例如已手工建表），启动时置 `FLYWAY_ENABLED=false`。

> 📚 更多细节：[开发指南](../development/README.md)、[架构说明](../architecture/README.md)。
