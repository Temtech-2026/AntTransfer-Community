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
#
# 依赖分层缓存：构建阶段按「预热包 → 仅 POM → 解析依赖 → 源码 → 打包」切层，
#   改业务代码不会重新解析依赖（顺序理由与已接受的代价见阶段一注释）。
#
# 运行阶段（安全与运维口径）：
#   · 非 root：进程以 uid/gid 10001（anttransfer）运行，只拥有 /app 与两个数据目录；
#   · 健康检查：内置 HEALTHCHECK 打 /api/actuator/health（免登录；DB / Redis 失联即
#     unhealthy，首启 90s 宽限窗口用于跑完 Flyway 全量迁移）。
# =====================================================================

# ---------- 阶段一：构建 ----------
FROM maven:3.9.16-eclipse-temurin-21 AS builder

# ===================== 版本元数据（构建期注入） =====================
# 为什么必须由外部传入：.dockerignore 排除了 .git/，构建上下文里没有版本库，
# 镜像内无法自行 `git rev-parse HEAD`。故由构建命令经 --build-arg 传入
# （compose 侧见根 docker-compose.yml 的 server.build.args），
# 一路带到两个可查位置：
#   ① 应用内的 META-INF/build-info.properties → GET /api/actuator/info
#   ② 运行阶段的 OCI 镜像标签 → docker image inspect anttransfer/server:latest
# 未传时回落 unknown：宁可显示 unknown，也不静默沿用上一次构建的版本号
# （那会让「查到的版本」指向错误提交，比没有版本号更危险）。
ARG GIT_COMMIT=unknown
ARG GIT_BRANCH=unknown

WORKDIR /app

# ===================== 依赖分层缓存（按「依赖 / 源码」切层） =====================
# 目的：让「依赖解析」与「源码编译」落在不同镜像层——改一行业务代码不再重新解析依赖。
# 顺序：① 预热包 → ② 只放 POM → ③ 解析依赖 → ④ 放源码 → ⑤ 编译打包。
#   · ①②③ 三层的输入只有「预热包 + 各模块 pom」，依赖坐标不变即命中缓存；
#   · ④⑤ 随源码变更重建，但不再触碰 Maven 仓库。
# ⚠️ 已知代价（刻意接受）：预热包会被 ① 与 ④ 各复制一次（本机实测 713 MB），多占一份构建缓存。
#   原因：预热包必须早于「依赖解析」出现才有意义（晚于它时依赖早已在线下载完毕），
#   而 .dockerignore 无法「既排除某路径、又让 COPY 取到它」。考虑到 CI 场景该包通常不存在
#   （① 退化为只复制几个 KB 的说明文件），此处选择保住预热能力、接受这份缓存冗余。
# =====================================================================

# ① 依赖预热包（可选）：把随上下文上传的本地 Maven 仓库包解压到镜像的默认仓库路径。
#    · 归档根目录即仓库内容本身（脚本以本地仓库为工作目录、按文件清单打包），
#      故直接解压到 /root/.m2/repository 即可，无需多套一层目录；
#    · 文件不存在时只打印提示、不报错——CI 与未生成依赖包的场景仍走在线解析；
#    · 只复制 deploy/docker/ 而不是全仓：这一层不会被任何源码改动击穿；
#    · 不再删除压缩包：后续 ④ 的 COPY . . 本就会把它重新带回来，删了也是徒劳。
COPY deploy/docker/ /app/deploy/docker/
RUN set -eux; \
    mkdir -p /root/.m2/repository; \
    bundle=/app/deploy/docker/m2/m2-repository.tar.gz; \
    if [ -f "$bundle" ]; then \
        echo "[m2] 解压本地依赖包，预热 /root/.m2/repository ..."; \
        tar -xzf "$bundle" -C /root/.m2/repository; \
        echo "[m2] 预热完成：$(find /root/.m2/repository -type f | wc -l) 个文件"; \
    else \
        echo "[m2] 未提供本地依赖包，本次构建将在线解析全部依赖"; \
    fi

# ② 只复制 POM（父工程 + 8 个模块）：依赖坐标的唯一输入，也是缓存边界。
#    逐个显式列出的原因：COPY 的通配符会把匹配到的文件拍平进目标目录、丢失模块层级，
#    而 Maven 必须按真实路径找到各模块 pom。⚠️ 新增模块时此处须同步补一行。
COPY pom.xml ./
COPY server/at-common/pom.xml server/at-common/
COPY server/at-auth/pom.xml server/at-auth/
COPY server/at-transfer/pom.xml server/at-transfer/
COPY server/at-permission/pom.xml server/at-permission/
COPY server/at-file/pom.xml server/at-file/
COPY server/at-collaboration/pom.xml server/at-collaboration/
COPY server/at-gateway/pom.xml server/at-gateway/
COPY server/at-bootstrap/pom.xml server/at-bootstrap/

# ③ 解析依赖与插件（不编译）：依赖缓存边界所在层。
#    为什么能用 go-offline 而不是 package：它只解析、不执行生命周期阶段，因此不需要源码，
#    正好可以放在源码复制之前——这正是分层缓存生效的前提。
#    注：go-offline 偶有漏网构件，后续 ⑤ 的 package 会按需补齐，不影响正确性。
RUN mvn -B -ntp -DskipTests dependency:go-offline

# ④ 复制全部源码（多模块工程；target/ 与前端 node_modules/ 已由 .dockerignore 排除）
COPY . .

# ⑤ 编译并打包（跳过测试）；spring-boot-maven-plugin 仅在 at-bootstrap 生效
#    -ntp：关闭下载进度条，日志只保留关键行（依赖已在 ③ 解析，额外下载应接近 0）
#    -Dgit.commit / -Dgit.branch：喂给 build-info goal 的 additionalProperties，
#      写入 META-INF/build-info.properties（键为 build.commitId / build.branch），
#      最终由 GET /api/actuator/info 回显；父 pom 中两者的默认值为 unknown
RUN mvn -B -ntp -DskipTests package \
        -Dgit.commit="${GIT_COMMIT}" \
        -Dgit.branch="${GIT_BRANCH}"

# ---------- 阶段二：运行 ----------
FROM eclipse-temurin:21-jre

# 构建期 ARG 不跨阶段继承，运行阶段必须重新声明，否则 LABEL 取到空值
ARG GIT_COMMIT=unknown
ARG GIT_BRANCH=unknown

# OCI 标准标签：不启容器、不调接口即可读出「本镜像由哪个提交构建」。
# 查询：docker image inspect anttransfer/server:latest \
#         --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'
# 回滚留底镜像（prev-*）同样带此标签，回滚后能立刻确认退回到了哪个提交。
LABEL org.opencontainers.image.title="AntTransfer CE server" \
      org.opencontainers.image.version="1.0.0-SNAPSHOT" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.ref.name="${GIT_BRANCH}"

WORKDIR /app

# 拷贝可执行 jar（模块化单体的最终产物；模块位于 server/ 子目录）
COPY --from=builder /app/server/at-bootstrap/target/at-bootstrap-1.0.0-SNAPSHOT.jar app.jar

# ===================== 非 root 运行（本阶段补齐） =====================
# 为什么要补：此前镜像未声明 USER，容器内进程以 uid 0 运行——一旦上传解析 / 路径穿越类
#   缺陷被利用，攻击者直接拿到容器内 root（可改镜像内任意文件、可写挂载卷、便于向宿主机内核面提权）。
#   降权后影响面收窄为「仅自己拥有的数据目录可写」。
# 为什么固定 uid/gid = 10001：编排侧要对齐同一个数字（K8s securityContext.runAsUser、
#   宿主目录 chown），靠用户名会在换基础镜像后因同名不同号而悄悄错位。
# 为什么必须先建好 data 目录并 chown：Docker 初始化「具名卷」时，会把镜像内该路径的**属主与权限**
#   一并复制进卷（本项目 files-data → /app/data/files、staging-data → /app/data/transfer-staging，
#   见 docker-compose.yml）。若此处不预建目录并改属主，卷会以 root 属主初始化，降权进程写不进去——
#   症状是登录、查询全部正常，唯独**上传全部失败**，排查成本极高。
#   ⚠️ 若改用 bind mount 而非具名卷，宿主目录需自行 chown 10001:10001。
#   ⚠️ chown 覆盖整个 /app，故 app.jar 的属主也一并变为 anttransfer（运行时只需读权限）。
#   ⚠️ 目前运行期不向 /app 之外落任何数据（日志走 stdout）；将来若新增落盘路径，
#      必须在此处补建目录 + chown，否则又会出现「只有那个功能写不进去」。
RUN set -eux; \
    groupadd --system --gid 10001 anttransfer; \
    useradd --uid 10001 --gid anttransfer --home-dir /app --no-create-home \
            --shell /usr/sbin/nologin anttransfer; \
    mkdir -p /app/data/files /app/data/transfer-staging; \
    chown -R anttransfer:anttransfer /app

USER anttransfer

# 时区与默认激活环境（可被运行时 --env 覆盖）
ENV TZ=Asia/Shanghai \
    SPRING_PROFILES_ACTIVE=prod

# 对外服务端口
EXPOSE 8080

# ===================== 健康检查（本阶段补齐） =====================
# 探针地址必须带 context-path 前缀：application.yml 的 server.servlet.context-path=/api，
#   故真实路径是 /api/actuator/health；该端点在 at-auth SecurityConfig 的匿名白名单内
#   （探针的调用方是负载均衡 / 编排 / 发布脚本，天然没有登录态），且 show-details=never，
#   只回 {"status":"UP"}，不吐数据源地址 / 磁盘路径 / Redis 版本等组件明细。
# 判定语义：health 聚合了 DB 与 Redis 健康指示器——依赖失联即返回 503，探针判 unhealthy。
#   这正是「一键编排」需要的口径：compose 侧 mysql / redis 用 condition: service_healthy
#   兜住启动顺序，本探针兜住运行期的依赖失联（此前 server 自身没有任何探针）。
# curl 由 eclipse-temurin 官方镜像自带（已实测 which curl → /usr/bin/curl），无需额外安装；
#   将来若更换基础镜像，须重新确认该命令存在，否则探针会恒为 unhealthy 而看起来像「应用挂了」。
# --start-period 刻意给到 90s：首启要跑完 Flyway 全量迁移（sql/V1 ~ V21），
#   过早判定失败会让编排反复重启一个正在正常迁移的实例，把「首启慢」放大成「永远起不来」。
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/api/actuator/health || exit 1

# 启动：JVM 参数按需通过环境变量 / 命令行调整
ENTRYPOINT ["java", "-Xms256m", "-Xmx512m", "-jar", "app.jar"]
