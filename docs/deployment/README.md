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
| `ANTTRANSFER_COLLABORATION_NOTIFY_MESSAGE_RETENTION_DAYS` | 否 | `30` | 会话消息（站内轻 IM）保留天数。**小于 30 一律按 30 执行**（`NotifyProperties.MIN_MESSAGE_RETENTION_DAYS` 硬钳制），且**不回写配置**——排查时配置里仍是管理员填的值；调大只多花存储，永远安全 |
| `ANTTRANSFER_COLLABORATION_NOTIFY_MESSAGE_CLEANUP_CRON` | 否 | `0 20 4 * * ?`（每日 04:20） | 保留期清理任务 cron；**与文件域清理（每日 03:30）错峰**——两者都写库 / 写盘，同刻执行会让抖动叠加 |
| `ANTTRANSFER_COLLABORATION_NOTIFY_MESSAGE_CLEANUP_BATCH_SIZE` | 否 | `1000` | 保留期清理单批删除行数；单次触发上界 = 本值 × 100（默认 10 万行 / 天） |

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
# GIT_COMMIT / GIT_BRANCH：把提交号烙进镜像标签与应用内 build-info，
#   供 `docker image inspect` 与 `GET /api/actuator/info` 查询线上版本。
#   .dockerignore 排除了 .git/，构建上下文里没有版本库，不传就只能回落 unknown。
docker build -t anttransfer/server:latest \
  --build-arg GIT_COMMIT="$(git rev-parse HEAD)" \
  --build-arg GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD)" .
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
5. 🚀 首次启动观察 Flyway 迁移是否成功，并**核对线上版本**（别再用镜像/文件时间戳去推断）：
   `curl -s http://127.0.0.1:8080/api/actuator/info` 返回的 `build.commitId` 应等于本次发版提交号；
   `docker image inspect anttransfer/server:latest --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'`
   应给出同一个值；前端则查 `curl -s http://<host>/version.json`。
   任一为 `unknown` 即说明构建时没有传 `GIT_COMMIT`（见发版手册 3.1 的 4.5 步）；
6. 🌐 反向代理（Nginx/网关）透传 `/api/`（含 `/api/ws/notify` 的 WebSocket Upgrade，
   上传体积上限 ≥ 80MB），并按需开启 HTTPS 与限流；
7. 📣 **通知链路冒烟**：跑完一次上传合并 → 创建者收到传输完成站内信（`notifyType 8`）；用外发链接核销一次 →
   创建者收到取件回执（`notifyType 9`）且**待办角标不变**（该类型计入未读、**不进待办**）；
8. 🗄️ **保留期任务核验**：确认 `at:chat:retention-lock` 只被一个实例持有、清理日志显示按 ≥ 30 天执行。
   **多实例部署时必查该键**——否则每个实例都会各自跑一遍全量清理。
9. 🩺 **探针暴露面核对**（对外放行前必做）：`GET /api/actuator/info`、`GET /api/actuator/health`
   应为 **200**（负载均衡 / 容器编排 / 发布脚本在无凭证上下文调用它们），
   而 `/api/actuator/env`、`/api/actuator/configprops`、`/api/actuator/beans`、
   `/api/actuator/heapdump` 必须为 **401**。若这些通得过，说明有人把
   `management.endpoints.web.exposure.include` 改成了 `*`，或把免登录白名单写成了 `/actuator/**`
   ——`heapdump` 是完整堆转储下载，一次 GET 即可取走内存中的令牌与用户数据。
