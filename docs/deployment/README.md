# ☁️ 部署指南（Deployment）

## 📦 一、制品形态

后端为模块化单体，最终产物是 **`server/at-bootstrap` 打出的可执行 fat jar**：

```bash
./mvnw -DskipTests package
# 产物：server/at-bootstrap/target/at-bootstrap-1.0.0-SNAPSHOT.jar
```

依赖项：MySQL 8.x、Redis 7.x（均需独立部署或随编排一起拉起）。

## ⚙️ 二、环境变量（重要）

> 🚫 生产不修改配置文件，一律以环境变量注入（默认值见 `server/at-bootstrap/src/main/resources/application*.yml`）：

| 变量 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| `SPRING_PROFILES_ACTIVE` | 是 | `dev` | 生产置 `prod`（关闭 Swagger、Flyway 默认开启） |
| `SERVER_PORT` | 否 | `8080` | 服务端口 |
| `DB_URL` | 是 | `localhost:3307/anttransfer`（dev 容器库端口） | MySQL JDBC URL |
| `DB_USERNAME` / `DB_PASSWORD` | 是 | `root` / `123456` | 数据库账号密码 |
| `REDIS_HOST` / `REDIS_PORT` | 是 | `localhost:6379` | Redis 地址 |
| `REDIS_DATABASE` / `REDIS_PASSWORD` | 否 | `0` / 空 | Redis 库号与密码 |
| `FLYWAY_ENABLED` | 否 | `true` | 是否执行 Flyway 迁移（`prod` 默认开启，置 `false` 可临时关闭） |

## 🚀 三、部署方式

### 方式 A：☕ Java 直接运行

```bash
java -Xms256m -Xmx512m -jar server/at-bootstrap/target/at-bootstrap-1.0.0-SNAPSHOT.jar \
  --spring.profiles.active=prod \
  --spring.datasource.url='jdbc:mysql://...' ...
```

### 方式 B：🐳 Docker（推荐）

```bash
# 完整环境：MySQL + Redis + server
docker compose up -d --build        # 可选变量见 .env.example

# 仅构建并运行后端镜像（外部已备好 MySQL/Redis）
docker build -t anttransfer/server:latest .
docker run -d --name at-server -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e DB_URL='jdbc:mysql://<mysql-host>:3306/anttransfer?useUnicode=true&characterEncoding=utf-8&useSSL=false&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true' \
  -e DB_USERNAME=root -e DB_PASSWORD='<password>' \
  -e REDIS_HOST=<redis-host> -e REDIS_PORT=6379 \
  anttransfer/server:latest
```

### 方式 C：☸️ Kubernetes / Helm

样例清单与说明见 `deploy/kubernetes/`、`deploy/helm/`（Helm Chart 预留目录，待发布后补充）。

## 🗄️ 四、数据库迁移（Flyway）

- ▶️ 生产 profile 默认 `FLYWAY_ENABLED=true`，启动时自动执行 `classpath:db/migration` 下的迁移；
- ✅ 对存量库已开启 `baseline-on-migrate`，可安全接入；
- 📂 脚本仓库 `sql/` 为唯一权威来源：构建期由 `at-bootstrap` 自动打包进 jar 内
  `classpath:db/migration`（见其 `pom.xml` 的 `copy-flyway-migrations`），无需手工同步或挂载；
  新增迁移脚本后重新构建产物/镜像即可。

## ✅ 五、上线检查清单

1. 🔒 `SPRING_PROFILES_ACTIVE=prod`，密码均走环境变量，`*.pem/*.key/.env` 不入仓库；
2. 🗄️ 数据库连接串使用专用低权账号；Redis 建议开启 `requirepass`；
3. 🚀 首次启动观察 Flyway 迁移是否成功，确认 `server/at-bootstrap/target` 产物为最新提交；
4. 🌐 反向代理（Nginx/网关）透传 `/api/`，并按需开启 HTTPS 与限流。
