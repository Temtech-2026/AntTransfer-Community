# =====================================================================
# AntTransfer CE — Docker 多阶段构建镜像（JDK 21 / Maven 3.9）
#
# 构建产物：at-bootstrap 模块打出的可执行 fat jar
# 运行配置：通过环境变量注入（SPRING_PROFILES_ACTIVE=prod、DB_URL、
#           DB_USERNAME、DB_PASSWORD、REDIS_HOST、REDIS_PORT 等）
#
# 上下文体积：.dockerignore 已排除各模块 target/、历史单体 archive/，以及前端
#   web/node_modules（实测约 13.5 万文件 / 1.3 GB）。后端镜像只用 server/ 下的
#   Java 源码，前端依赖必须排除，否则每次构建都要传输 GB 级上下文。
#
# Maven 依赖预热（云服务器上强烈建议）：
#   deploy/docker/m2/m2-repository.tar.gz 是从开发机 ~/.m2/repository 导出的依赖包
#   （生成脚本：deploy/docker/scripts/New-MavenBundle.ps1）。文件存在时，先解压进
#   镜像内的默认仓库 /root/.m2/repository，容器内 Maven 只需补齐个别缺失构件，
#   不再全量下载；文件不存在时（例如 GitHub Actions 构建）自动跳过，退化为
#   常规在线解析，构建不会因此失败。
# =====================================================================

# ---------- 阶段一：构建 ----------
FROM maven:3.9.16-eclipse-temurin-21 AS builder

WORKDIR /app

# 复制全部源码（多模块工程；target/ 与前端 node_modules/ 已由 .dockerignore 排除）
COPY . .

# ① 依赖预热：把随上下文上传的本地 Maven 仓库包解压到镜像的默认仓库路径。
#    · 归档根目录即仓库内容本身（脚本以本地仓库为工作目录、按文件清单打包），
#      故直接解压到 /root/.m2/repository 即可，无需多套一层目录；
#    · 解压后立刻删掉压缩包，避免它留在构建层里被后续步骤误读；
#    · 文件不存在时只打印提示、不报错——CI 与未生成依赖包的场景仍走在线解析。
RUN set -eux; \
    mkdir -p /root/.m2/repository; \
    bundle=/app/deploy/docker/m2/m2-repository.tar.gz; \
    if [ -f "$bundle" ]; then \
        echo "[m2] 解压本地依赖包，预热 /root/.m2/repository ..."; \
        tar -xzf "$bundle" -C /root/.m2/repository; \
        rm -rf /app/deploy/docker/m2; \
        echo "[m2] 预热完成：$(find /root/.m2/repository -type f | wc -l) 个文件"; \
    else \
        echo "[m2] 未提供本地依赖包，本次构建将在线解析全部依赖"; \
    fi

# ② 编译并打包（跳过测试）；spring-boot-maven-plugin 仅在 at-bootstrap 生效
#    -ntp：关闭下载进度条，日志只保留关键行（依赖已预热，额外下载应接近 0）
RUN mvn -B -ntp -DskipTests package

# ---------- 阶段二：运行 ----------
FROM eclipse-temurin:21-jre

WORKDIR /app

# 拷贝可执行 jar（模块化单体的最终产物；模块位于 server/ 子目录）
COPY --from=builder /app/server/at-bootstrap/target/at-bootstrap-1.0.0-SNAPSHOT.jar app.jar

# 时区与默认激活环境（可被运行时 --env 覆盖）
ENV TZ=Asia/Shanghai \
    SPRING_PROFILES_ACTIVE=prod

# 对外服务端口
EXPOSE 8080

# 启动：JVM 参数按需通过环境变量 / 命令行调整
ENTRYPOINT ["java", "-Xms256m", "-Xmx512m", "-jar", "app.jar"]
