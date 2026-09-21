# 🐳 Docker 部署物

## 📂 内容

| 文件/位置 | 用途 |
| --- | --- |
| 仓库根 `Dockerfile` | 后端多阶段镜像（构建 → JRE 运行），产物为 `at-bootstrap` fat jar |
| 仓库根 `docker-compose.yml` | 一键编排 MySQL + Redis + server（生产语义） |
| 仓库根 `docker-compose.dev.yml` | 仅本地 MySQL + Redis 依赖 |
| `deploy/docker/mysql-initdb.d/` | MySQL `/docker-entrypoint-initdb.d` 自定义入口（默认空；勿放 `V*.sql`，见内 README） |
| `.dockerignore` | 排除 `target/`、`archive/` 等，控制构建上下文 |
| `.github/workflows/docker-image.yml` | 手动触发：构建并推送 `ghcr.io` 镜像 |

## 🖼️ 镜像速览

```bash
# 本地构建
docker build -t anttransfer/server:latest .

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

## 🧱 镜像内容（Dockerfile）

- ⚙️ 基础镜像：构建 `maven:3.9.16-eclipse-temurin-21`，运行 `eclipse-temurin:21-jre`
- 🌏 时区 `Asia/Shanghai`，默认 `SPRING_PROFILES_ACTIVE=prod`
- 🔌 暴露端口 `8080`，默认堆 `-Xms256m -Xmx512m`

> 💡 说明：运行时镜像仅包含 fat jar。Flyway 迁移脚本（仓库根 `sql/`）已在 Maven 构建阶段由
> `at-bootstrap` 自动打包进 jar 内 `BOOT-INF/classes/db/migration`，运行时 Flyway 从
> `classpath:db/migration` 命中即可，镜像与部署侧无需再携带 `sql/`。
