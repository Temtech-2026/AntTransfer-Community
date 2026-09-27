# ☁️ 部署指南（Deployment）

> 📘 生产环境**日常发版、验证、回滚**的实操流程另见
> [`发版与回滚手册.md`](./发版与回滚手册.md)；本份侧重部署形态、配置项与上线口径。

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
| `DB_USERNAME` / `DB_PASSWORD` | 是 | `root` / **无默认** | 数据库账号密码；`docker-compose.yml` 以 `${VAR:?}` 强制校验，不回落弱口令 |
| `REDIS_HOST` / `REDIS_PORT` | 是 | `localhost:6379` | Redis 地址 |
| `REDIS_DATABASE` / `REDIS_PASSWORD` | 否 | `0` / 空 | Redis 库号与密码 |
| `FLYWAY_ENABLED` | 否 | `true` | 是否执行 Flyway 迁移（`prod` 默认开启，置 `false` 可临时关闭） |
| `AUTH_ACCESS_TOKEN_SECRET` | **是** | 无（`application.yml` 内置值仅供本地 dev） | JWT 签名密钥（HS256，须 ≥ 32 字节）。`docker-compose.yml` 以 `${VAR:?}` 强制校验 |
| `ANTTRANSFER_CORS_ALLOWED_ORIGINS` | 否 | `*`（compose 中已收敛为 `http://localhost:8000`） | CORS 来源白名单，逗号分隔，支持通配；生产禁用 `*` |
| `ANTTRANSFER_FILE_STORAGE_ROOT` | 否 | `./data/files` | 文件正文存储根；容器内须指向挂载点 `/app/data/files` |
| `TRANSFER_STAGING_ROOT` | 否 | `./data/transfer-staging` | 分片暂存根；容器内须指向挂载点 `/app/data/transfer-staging` |

> ⚠️ 后两个存储路径**必须落在持久卷上**：`docker-compose.yml` 已挂载 `files-data` /
> `staging-data` 两个卷并同步注入上述环境变量，否则每次 `up -d --build` 重建容器都会丢失
> 已上传文件与进行中的分片。若改用 `docker run` 手工启动，请自行 `-v` 挂卷并传入这两个变量。

## 🚀 三、部署方式

### 方式 A：☕ Java 直接运行

```bash
java -Xms256m -Xmx512m -jar server/at-bootstrap/target/at-bootstrap-1.0.0-SNAPSHOT.jar \
  --spring.profiles.active=prod \
  --spring.datasource.url='jdbc:mysql://...' ...
```

### 方式 B：🐳 Docker（推荐）

> ⚡ **构建提速（云服务器必读）**：镜像构建阶段会在容器内执行 `mvn package`。不做预热的话，
> 容器要从零下载全部依赖，云服务器上通常十几分钟，且中途任一网络抖动即整段失败。做法是把
> 开发机已拉好的仓库带上去：
>
> ```powershell
> pwsh deploy/docker/scripts/New-MavenBundle.ps1     # 开发机执行，导出依赖包
> scp deploy/docker/m2/m2-repository.tar.gz ubuntu@<server>:<项目目录>/deploy/docker/m2/
> ```
>
> 包存在时 `Dockerfile` 会先解压到镜像内 `/root/.m2/repository` 再 `mvn package`，容器内只需
> 补齐个别缺失构件；包不存在时自动跳过、退化为在线解析（CI 即走此路径，构建不会失败）。
> 另：`.dockerignore` 已排除前端 `web/node_modules`（13.5 万文件 / 1.3 GB），否则每次构建都要
> 传输 GB 级上下文。详见 `deploy/docker/m2/README.md` 与 `deploy/docker/README.md`。


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

> ⚠️ 上面这条 `docker run` 省略了持久卷与必填密钥，仅供快速验证。正式部署请改用根
> `docker-compose.yml`（已挂好卷并强制校验密钥），或自行补上两个存储挂载点
> （`<卷>:/app/data/files`、`<卷>:/app/data/transfer-staging`，并配合
> `ANTTRANSFER_FILE_STORAGE_ROOT` / `TRANSFER_STAGING_ROOT` 两个环境变量）以及
> `AUTH_ACCESS_TOKEN_SECRET=<至少 32 字节的强随机串>`；否则重建容器即丢文件，
> 且会以公开已知的开发默认密钥签发 token。
> 🔒 `docker-compose.yml` 的三点硬化口径（上云前请勿改回）：**① 端口只绑回环**——
> `mysql:3307`、`redis:6379`、`server:8080` 均只映射到 `127.0.0.1`，公网与内网其它机器
> 都无法直连，对外流量统一由前置反向代理走 `80/443` 进入（容器之间仍按服务名互访，
> 不受影响）；**② 密钥强制校验**——`DB_PASSWORD` 与 `AUTH_ACCESS_TOKEN_SECRET` 缺失时
> `docker compose up` 直接报错退出，不会回落到弱口令或公开已知的 dev 默认密钥；
> **③ 数据卷**——`mysql-data` / `redis-data` / `files-data` / `staging-data`，
> 备份范围必须包含后两个，否则用户文件与暂存分片无副本。

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
2. 🔑 `AUTH_ACCESS_TOKEN_SECRET` 已注入 ≥ 32 字节强随机串（**不得**沿用 dev 默认值），
   `ANTTRANSFER_CORS_ALLOWED_ORIGINS` 已收紧为真实前端来源（**不得**为 `*`）；
3. 🗄️ 数据库连接串使用专用低权账号（不要用 `root`）；Redis 已绑定回环，
   如需密码再加 `requirepass` 并同步 `REDIS_PASSWORD`；
4. 💾 `files-data` / `staging-data` 两个卷已挂载且纳入备份，重建容器不丢文件；
5. 🚀 首次启动观察 Flyway 迁移是否成功，确认 `server/at-bootstrap/target` 产物为最新提交；
6. 🌐 反向代理（Nginx/网关）透传 `/api/`（含 `/api/ws/notify` 的 WebSocket Upgrade，
   上传体积上限 ≥ 80MB），并按需开启 HTTPS 与限流。
