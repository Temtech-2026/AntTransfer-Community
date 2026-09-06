# =====================================================================
# AntTransfer CE — Docker 多阶段构建镜像（JDK 21 / Maven 3.9）
#
# 构建产物：at-bootstrap 模块打出的可执行 fat jar
# 运行配置：通过环境变量注入（SPRING_PROFILES_ACTIVE=prod、DB_URL、
#           DB_USERNAME、DB_PASSWORD、REDIS_HOST、REDIS_PORT 等）
# 注意：.dockerignore 已排除 target/ 与 archive/，避免把构建缓存与旧单体代码带进上下文
# =====================================================================

# ---------- 阶段一：构建 ----------
FROM maven:3.9.16-eclipse-temurin-21 AS builder

WORKDIR /app

# 复制全部源码（多模块工程；target 已由 .dockerignore 排除）
COPY . .

# 编译并打包（跳过测试）；spring-boot-maven-plugin 仅在 at-bootstrap 生效
RUN mvn -B -DskipTests package

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
