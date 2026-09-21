# 🗄️ sql — 数据库脚本

AntTransfer CE 使用 **Flyway** 做数据库版本化迁移，脚本统一存放在本目录。

## 📂 目录约定

```
sql/
├── V1__schema.sql        # CE 完整表族基线（sys_ 前缀 16 表四族，见下方族表）
├── V2__init_data.sql     # 初始化数据：内置角色 SUPER_ADMIN/AUDITOR/DEPT_ADMIN/USER + 菜单树与权限点 + admin
├── V3__add_user_token_epoch.sql                    # 增量：sys_user 补 token_epoch（会话吊销纪元）
├── V4__menu_route_user_type_and_collaboration.sql  # 增量：菜单路由元数据 + user_type + sys_group_member + sys_space
├── V5__collaboration_im_notify.sql                 # 增量：sys_notify_message 补会话维度列 + 会话索引 + 幂等唯一键
├── V6__file_management.sql                         # 增量：目录树 + 文件引用层 + 历史版本 + 标签 + 打包任务（+6 表）
├── V7__pack_task_node_ids.sql                      # 增量：sys_pack_task 补 node_ids（异步打包任务的输入清单）
├── V8__restrict_file_destroy_to_super_admin.sql    # 数据收敛：从 DEPT_ADMIN 回收 file:destroy（仅 SUPER_ADMIN）
├── V9__system_admin_permission_points.sql          # 增量：系统管理面 system:* 原子权限点 + 菜单树
├── V10__upload_task_parent_id.sql                  # 增量：sys_upload_task 补 parent_id（预检上报的目标目录）
├── V11__notify_message_title_nullable.sql          # 增量：sys_notify_message.title 放宽为可空（会话消息无标题）
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

> 🧩 **增量迁移（V3 ~ V11）**：上表为 **V1 基线**（16 表）；V3 ~ V7 / V9 / V10 只做**纯增量**（新增列 / 新增索引 / 新增表 / 新增行），不改写既有列语义、不删除任何对象；V8 为**纯数据收敛**（仅删授权行，不动表结构）；V11 为**约束放宽**（仅把 `title` 由 `not null` 改为可空，不改类型 / 长度、不动任何数据）。
>
> - **V3**：`sys_user` 补 `token_epoch` —— 会话吊销纪元，配合 `at:token:access:{userId}` 缓存镜像实现全端登出 / 改密即失效（见 `architecture.md` §4 D-8 与红队 [C-08]）。
> - **V4**：① `sys_permission` 补菜单路由元数据 `route_path` / `component` / `icon` / `visible`（仅 `type=1` 菜单使用，**不参与权限判定**）；② `sys_user` 补 `user_type`（`1`-内部用户 / `2`-外部协作者；**CE 已裁定维持 PRD、恒为 `1` 不启用**，该列仅作 EE / 受限账号预留，口径见 `architecture.md` §4 **D-12**）；③ 新建 `sys_group_member`（项目 / 群组成员关系，唯一键 `uk_group_user`）与 `sys_space`（协作空间，字段对齐 at-collaboration `CollaborationSpace` 骨架实体，见 §4 **D-11**）。
> - **V5**：`sys_notify_message` 由「系统通知专用」扩展为「系统通知 + 会话消息（IM）」双语义 —— 补 `sender_user_id` / `message_type` / `chat_scope` / `chat_target_id` / `client_msg_id`（**全可空**；存量系统通知行天然为 `NULL` / 默认 `0`，语义与行为完全不变）；新增 `idx_session (recipient_user_id, chat_scope, chat_target_id, id)` 支撑**写扩散**下的单表会话查询（`chat_target_id` 是**接收人视角**的会话定位：单聊=对端 ID、群聊=群组 ID，故同一单聊在双方各自的行里 target 互指，这是有意为之——只有这样才能用 `(recipient, scope, target)` 一次等值查询取到某人的完整双向记录）；新增 `uk_sender_recipient_client (sender_user_id, recipient_user_id, client_msg_id)` 作为会话消息幂等键，**必须含 `recipient_user_id`**：群聊一条消息按成员各落一行、共享同一 `client_msg_id`，若只按 `(sender, client_msg_id)` 唯一，第 2 个成员就写不进去；系统通知三列全 `NULL`，MySQL 唯一索引不对含 `NULL` 的行做重复判定，故互不影响。同时 `MODIFY COLUMN notify_type` 的注释纳入 `6~8`，与 at-common `NotifyType` 编码表对齐。**未新增表**（`sys_` 前缀表仍为 18）。
> - **V6**：文件管理主线落地，新增 6 张引用 / 管理表 —— `sys_folder`（物化路径目录树）、`sys_file_node`（**引用层**：一行 = 用户目录里的一个条目，`owner_user_id` 是防水平越权的唯一依据）、`sys_file_version`（历史版本，**不计入 `sys_file.ref_count`**）、`sys_tag` / `sys_file_tag`（标签及其关联）、`sys_pack_task`（异步打包任务与产物生命周期）。引用层与 `sys_file` 物理层的分离理由、`ref_count` 与回收站/销毁的口径见脚本文件头（PRD US-09/US-10/US-12/US-13）。
> - **V7**：`sys_pack_task` 补 `node_ids` —— 异步打包必须把「要打哪些条目」落库，否则进程重启 / 线程池拒绝后任务清单丢失，只剩永远停在 `status=0` 的僵尸行并持续占用每用户并发名额。
> - **V8**：**纯数据收敛（不改结构）** —— 从 DEPT_ADMIN 回收 `file:destroy` 授权行，使 `@RequiresPerm("file:destroy")` 等价于「仅超级管理员」。属**破坏性授权变更**：部门管理员不再能执行彻底销毁；高敏感（`level>=3`）文件的销毁另须经 `SensitiveDestroyApprovalPort` 校验一张「已通过」的审批单（两条为**与**关系）。
> - **V9**：**纯数据新增（不改结构）** —— 补一组 `system:*` 原子权限点（用户 CRUD / 重置密码 / 启停 / 分配角色 / 调岗离职，角色 CRUD / 分配权限点）及其系统管理面菜单树，承载 at-permission 的系统管理面（不新建 `at-system` 模块）。
> - **V10**：`sys_upload_task` 补 `parent_id` —— 预检上报的目标目录须随任务落库并在合片时透传给 at-file，否则从子目录发起的分片上传会把文件落到根目录；同时使「同内容传到不同目录」不再复用同一上传票据（票据按「目标目录 + 内容」收敛，物理文件层仍秒传）。
> - **V11**：**约束放宽（不改类型 / 不动数据）** —— `sys_notify_message.title` 由 `not null` 改为可空。V5 把该表扩成「系统通知 + 会话消息」双语义时补的 5 列全可空，唯独漏掉 V1 遗留的 `title`；而会话消息本就无标题（`ChatSendDTO` 无 `title` 入参，`ChatService` 落行也不写该列），MyBatis-Plus 默认跳过 null 字段使 `INSERT` 里不出现 `title`，MySQL 严格模式随即报 `Field 'title' doesn't have a default value`，发送单聊 / 群聊恒定 HTTP 500。系统通知侧不受影响（`NotificationDispatcher` 一律显式写入标题）。
> - ✅ 由此 **sys_ 前缀表由 16 表经 V4（+2）后，再经 V6（+6）增至 24 表**；`sys_file.space_id` 自 V4 起为**已落地**的逻辑关联（其原注释「空间表随 at-collaboration 版本落地」所指即 `sys_space`）。
> - ⚠️ V1 头部「群组成员关系不在 CE 落子表，随 at-collaboration 演进版本（V3+）扩展」的**收敛口径已由 V4 提前落地**；V1 属已发布脚本，按下方「已发布脚本禁止修改」**不回改注释**（Flyway checksum），口径演进说明以 `V4__menu_route_user_type_and_collaboration.sql` 文件头为准。

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
