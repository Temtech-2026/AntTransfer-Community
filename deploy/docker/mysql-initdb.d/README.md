# mysql-initdb.d — 本地/编排 MySQL 自定义初始化入口

本目录按只读方式挂载到 MySQL 容器的 `/docker-entrypoint-initdb.d`：

- `docker-compose.dev.yml` / `docker-compose.yml` 均通过
  `./deploy/docker/mysql-initdb.d:/docker-entrypoint-initdb.d:ro` 引用；
- 目录内 `*.sh`、`*.sql`、`*.sql.gz` 仅在数据目录为空（**首次**建卷）时按文件名顺序执行，
  已存在的数据卷不会重复执行（MySQL 官方镜像行为）。

## 能放什么

仅放「数据库层、Flyway 不管理」的一次性自定义脚本，例如：

- 创建开发/测试专用账号与授权；
- 调整镜像默认参数无法覆盖的库属性；
- 注入仅本机调试用的自定义脚本。

## 不能放什么

**不要**放入 `V*.sql`（Flyway 迁移脚本，包括 `sql/V1__schema.sql`、`sql/V2__init_data.sql`）。

原因：建表与初始化数据已由后端 Flyway 统一承担（应用启动时自动增量迁移，
见 `sql/README.md`）。若这里也挂入 V2，首次建卷会先于 Flyway 把固定 ID 的主数据插入，
随后 Flyway 启动重复执行 V2 时必然主键冲突，导致应用启动失败。

需要调整表结构/主数据时，一律按 Flyway 规范新增 `sql/V{n}__*.sql`（`V*.sql` 只增不改）。
