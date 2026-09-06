# 🗄️ sql — 数据库脚本

AntTransfer CE 使用 **Flyway** 做数据库版本化迁移，脚本统一存放在本目录。

## 📂 目录约定

```
sql/
├── V1__schema.sql        # CE 完整表族（sys_ 前缀 16 表四族，见下方族表）
├── V2__init_data.sql     # 初始化数据：内置角色 SUPER_ADMIN/AUDITOR/DEPT_ADMIN/USER + 菜单树与权限点 + admin
└── README.md
```

> 🏷️ 2026-09-06（二次重置）：V1 表族统一为 `sys_` 前缀 16 表（早前 user/department/role/
> permission_point/permission_grant/file_object 等直连命名表族废弃，逻辑删除列
> `is_delete` → `deleted`），完整演进见 `V1__schema.sql` 文件头「演进说明」。
> 同日 V2 填充初始化主数据：四内置角色、文件菜单树 + 七个原子权限点 + 审计只读点、
> 初始化管理员 admin（BCrypt cost=10 真实密文，默认口令 `Admin@123`，首次登录须改密；
> 约定见 V2 文件头「初始账号」）。V1/V2 均为 MySQL 8 方言。

## 🧬 V1 表族总览（sys_ 前缀，全表含公共字段与 tenant_id）

| 表族 | 表 | 职责要点 |
| --- | --- | --- |
| 权限族 | `sys_user` / `sys_dept` / `sys_role` / `sys_permission` / `sys_user_role` / `sys_role_permission` / `sys_group` | RBAC：用户/树形部门/角色/权限点（含 `perm_code`）/多对多关联/项目·群组基座 |
| 审批授权族 | `sys_approval_request` / `sys_approval_node` / `sys_user_file_permission` | 申请单（类型/资源/目的/敏感等级/状态/审批人/时效）、EE 多级审批扩展点、对象级实际授权（`grant_source` 角色继承或审批获得 + `expire_at`） |
| 文件传输族 | `sys_file` / `sys_upload_task` / `sys_share_link` | 元数据（SHA-256 + `ref_count` 物理去重）、分片任务（含 `uploaded_indexes` 已传分片索引持久化）、外发链接（提取码散列/有效期/次数） |
| 协作审计族 | `sys_notify_message` / `sys_operation_log` / `sys_login_log` | 站内/离线消息、操作审计（append-only，留存 ≥ 6 个月）、登录成功/失败日志 |

## 📐 命名与执行规则

- 📄 迁移脚本命名：`V{major}__{描述}.sql`，版本号**只增不减**，可执行顺序即版本序。
- 🔒 已发布/已执行的脚本**禁止修改**，任何结构或数据变更请追加新版本：
  `V3__xxx.sql`、`V4__xxx.sql` …
- 🚫 脚本内不要写 `CREATE DATABASE` / `USE`，目标库由应用数据源（`DB_URL`）决定。
- 📦 **脚本随应用生效方式（已统一）**：`at-bootstrap` 在构建期（process-resources 阶段的
  `copy-flyway-migrations`，见 `server/at-bootstrap/pom.xml`）自动把本目录 `V*.sql`
  打包进其 classpath `db/migration`；应用侧 `spring.flyway.locations=classpath:db/migration`
  固定不变，dev（spring-boot:run / IDE）与 prod（fat jar / 容器）共用同一批脚本。
  新增 `V{n}__*.sql` 无需手工复制；改动脚本后重新构建一次（如 `./mvnw -q process-resources`）即同步生效。
- ▶️ 迁移默认开启（`at-bootstrap/application.yml`）：`spring.flyway.enabled=${FLYWAY_ENABLED:true}`，
  应用启动即自动增量迁移；临时关闭部署时置 `FLYWAY_ENABLED=false`。
- 🧭 baseline 设定：`baseline-on-migrate=true` + `baseline-version=0`——空库直接建历史表并按序执行；
  已有手工建表但无 `flyway_schema_history` 的存量库自动打基线后继续；曾按旧版 V1~V3 执行过的库
  哈希与重置版不一致会校验失败，需 `flyway clean` 重放或手工 DROP 重建。
- 🐳 编排（`docker-compose.dev.yml` / `docker-compose.yml`）不再向 MySQL 的
  `/docker-entrypoint-initdb.d` 挂载 `V*.sql`——首次建卷即由应用 Flyway 完成全部建表与
  初始化数据，避免 initdb.d 先灌库导致 Flyway 重复执行 V2（固定 ID 插入）冲突。
  数据库层自定义脚本（Flyway 不管理的操作，如建测试账号）放
  `deploy/docker/mysql-initdb.d/`（默认空目录，见该目录 README）。
- 🗄️ 双数据库支持：MySQL 即默认数据源（`application-mysql.yml` 为显式拆分示例）；
  PostgreSQL 见 `server/at-bootstrap/application-pg.yml`（依赖与 profile 已就绪，但 V1/V2 为
  MySQL 方言，需按 `V1__schema.sql` 文件头「PostgreSQL 差异点」改写脚本后再启用）。
