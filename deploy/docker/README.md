# 🐳 Docker 部署物

## 📂 内容

| 文件/位置 | 用途 |
| --- | --- |
| 仓库根 `Dockerfile` | 后端多阶段镜像（构建 → JRE 运行），产物为 `at-bootstrap` fat jar |
| 仓库根 `docker-compose.yml` | 一键编排 MySQL + Redis + server（生产语义） |
| 仓库根 `docker-compose.dev.yml` | 仅本地 MySQL + Redis 依赖 |
| `deploy/docker/mysql-initdb.d/` | MySQL `/docker-entrypoint-initdb.d` 自定义入口（默认空；勿放 `V*.sql`，见内 README） |
| `deploy/docker/m2/` | Maven 依赖预热包投放位（`m2-repository.tar.gz`，由开发机本地仓库导出，见内 README） |
| `deploy/docker/scripts/New-MavenBundle.ps1` | 生成上述依赖包的脚本 |
| `.dockerignore` | 排除 `target/`、`archive/`、`web/node_modules`（约 1.3 GB）等，控制构建上下文 |
| `.github/workflows/docker-image.yml` | 手动触发：构建并推送 `ghcr.io` 镜像 |

## 🖼️ 镜像速览

```bash
# 本地构建
# GIT_COMMIT / GIT_BRANCH：烙进镜像标签（org.opencontainers.image.revision）与应用内
#   build-info（GET /api/actuator/info 的 build.commitId）。.dockerignore 排除了 .git/，
#   构建上下文里没有版本库，不传就只能回落 unknown——查到的"版本"也就失去意义。
docker build -t anttransfer/server:latest \
  --build-arg GIT_COMMIT="$(git rev-parse HEAD)" \
  --build-arg GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD)" .

# 不启容器即可核对镜像版本
docker image inspect anttransfer/server:latest \
  --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'

# 运行（需外部 MySQL/Redis，变量见 docs/deployment/README.md）
docker run --rm -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=prod \
  -e DB_URL='jdbc:mysql://<host>:3306/anttransfer?useUnicode=true&characterEncoding=utf-8&useSSL=false&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true' \
  -e DB_USERNAME=root -e DB_PASSWORD='<pass>' \
  -e REDIS_HOST=<host> -e REDIS_PORT=6379 \
  anttransfer/server:latest
```

> ⚠️ 上述 `docker run` 为最小验证命令，**缺少持久卷与必填密钥**：正式部署请改用根
> `docker-compose.yml`（已挂 `files-data` / `staging-data` 并强制校验密钥），
> 或自行补齐 `-v <卷>:/app/data/files`、`-v <卷>:/app/data/transfer-staging` 与
> `-e AUTH_ACCESS_TOKEN_SECRET=<≥32 字节强随机串>`，详见 `docs/deployment/README.md`。

## ⚡ 构建提速：预热本地 Maven 依赖

容器内从零下载全部依赖，在云服务器上通常要十几分钟，且网络一抖即整段失败。做法是把开发机
已经拉好的仓库直接带上去：

```powershell
# 1) 开发机：导出本地仓库（源约 800 MB → 压缩包约 680 MB，实测 32 秒）
pwsh deploy/docker/scripts/New-MavenBundle.ps1

# 2) 上传到服务器项目目录，与 Dockerfile 同级（该文件被 .gitignore 忽略，不入库）
scp deploy/docker/m2/m2-repository.tar.gz ubuntu@<server>:/path/to/anttransfer/deploy/docker/m2/

# 3) 服务器：正常构建即可，Dockerfile 会先解压预热再执行 mvn package
docker compose up -d --build
```

- 归档内**不含** `_remote.repositories` / `*.lastUpdated` 等解析状态文件——它们记录的是
  「本机从哪个远端仓库下载的」，原样带进容器会让 Maven 判定与当前远端不匹配而重新下载；
  剔除后 Maven 直接视其为本地已安装构件。
- 文件不存在时（CI / 未生成）预热步骤自动跳过，构建退化为在线解析，**不会失败**。
- 本地 `pom.xml` 增删依赖后需重新导出；否则容器内会为新增依赖单独下载（仍能成功，只是慢）。
- 上下文体积实测：排除 `web/node_modules` 后为 **688.9 MB / 820 个文件**（其中 680 MB 就是
  这个依赖包；不带依赖包时约 9 MB）。
- 细节见 `deploy/docker/m2/README.md`。

## 🧱 镜像内容（Dockerfile）

- ⚙️ 基础镜像：构建 `maven:3.9.16-eclipse-temurin-21`，运行 `eclipse-temurin:21-jre`
- 🔥 构建阶段先解压 `deploy/docker/m2/m2-repository.tar.gz`（存在时）预热 Maven 仓库，再执行 `mvn package`
- 🌏 时区 `Asia/Shanghai`，默认 `SPRING_PROFILES_ACTIVE=prod`
- 🔌 暴露端口 `8080`，默认堆 `-Xms256m -Xmx512m`

> 💡 说明：运行时镜像仅包含 fat jar。Flyway 迁移脚本（仓库根 `sql/`）已在 Maven 构建阶段由
> `at-bootstrap` 自动打包进 jar 内 `BOOT-INF/classes/db/migration`，运行时 Flyway 从
> `classpath:db/migration` 命中即可，镜像与部署侧无需再携带 `sql/`。
