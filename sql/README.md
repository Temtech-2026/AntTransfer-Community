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
├── V12__chat_attachment.sql                        # 增量：会话文件附件授权（用途档位 + 有效期 + 下载次数 三轴限制）
├── V13__chat_read_receipt.sql                      # 增量：会话已读回执索引（idx_sender_session）
├── V14__chat_group_permission_points.sql           # 增量：会话域权限点（chat:group:create）
├── V15__chat_message_recall_quote.sql              # 增量：会话消息撤回窗口 + 引用回复
├── V16__chat_group_manage_permission_points.sql    # 增量：群管理权限点
├── V17__share_access_notify_type.sql               # 增量：notify_type 注释口径扩至 9（外发链接取件回执）
├── V18__chat_mention_and_retention.sql             # 增量：会话消息 @ 提及行级标记（mentioned）+ 保留期清理索引
├── V19__chat_peer_alias.sql                        # 增量：对端备注（sys_chat_peer_alias，(我, 他) 私有属性）
├── V20__chat_mention_all_and_group_notify_preference.sql  # 增量：@所有人 提及档位（mention_type）+ 群成员免打扰与提及提醒偏好（sys_group_member 三列）
├── V21__user_notify_sound_setting.sql              # 增量：用户消息提示音设置（+1 表 sys_user_notify_setting）
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

> 🧩 **增量迁移（V3 ~ V21）**：上表为 **V1 基线**（16 表）；V3 ~ V7 / V9 / V10 / V12 ~ V21 只做**纯增量**（新增列 / 新增索引 / 新增表 / 新增行 / 更新列注释），不改写既有列语义、不删除任何对象；V8 为**纯数据收敛**（仅删授权行，不动表结构）；V11 为**约束放宽**（仅把 `title` 由 `not null` 改为可空，不改类型 / 长度、不动任何数据）。
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
> - **V12**：**纯增量（+1 表）** —— 新建 `sys_chat_attachment`（会话文件附件授权：**服务端快照** `file_name` / `size_bytes` + **三轴用途限制** `usage_mode`（1-仅预览 / 2-可下载 / 3-可转发转存）+ `expire_at`（与 `sys_share_link` 同口径，`null`=不限期）+ `download_limit` / `download_count`（0=不限次））。授权行是「发送方设定 + 服务端裁决」的唯一权威源，前端上报的任何用途限制都不被采信；`node_id` 是 `sys_file_node` 条目的**逻辑关联**而非外键（源条目删除 / 改名不影响已发出卡片）。唯一键 `uk_sender_client_msg (sender_user_id, client_msg_key)` 承载发送端幂等（连点 / 网络重试不重复建授权），`client_msg_key` 可空（不同于 V5 的会话消息幂等键：授权创建是**单接收方**语义，不需要含 `recipient_user_id`）；因本表恒不置 `deleted=1`（撤销走 `status=1`、到期按 `expire_at` 判定），无需像 V6 文件域那样为规避「删除后重建撞键」而放弃唯一索引。
> - ✅ 由此 **sys_ 前缀表由 16 表经 V4（+2）后，再经 V6（+6）、V12（+1）、V19（+1）、V21（+1）增至 27 表**；`sys_file.space_id` 自 V4 起为**已落地**的逻辑关联（其原注释「空间表随 at-collaboration 版本落地」所指即 `sys_space`）。
> - **V13**：**纯增量（+1 索引，不动结构 / 数据）** —— `sys_notify_message` 补 `idx_sender_session (sender_user_id, chat_scope, chat_target_id, client_msg_id, read_status)`，支撑会话「已读回执」查询。写扩散下「谁读过我的消息」= 取 **sender 为我**且 `read_status=1` 的镜像行；V5 的 `idx_session` 服务的是反方向（我作为接收人的历史与角标），`uk_sender_recipient_client` 虽以 sender 为前缀，但 `client_msg_id` 排在第三列，按它过滤只能扫「我历史上发过的全部行」——故补一个以**发送人视角的会话定位**为前缀的索引（详见该脚本文件头，EE 若改读扩散 + 已读游标则该索引与回执查询一并废弃）。
> - **V14**：**纯数据新增（不改结构）** —— 会话域落权限点：新增菜单根节点 `chat` 与操作点 **`chat:group:create`**（建群），授 SUPER_ADMIN / DEPT_ADMIN / USER，**不授 AUDITOR**（建群写 `sys_group` / `sys_group_member` 并决定后续消息可见范围，与审计员「权限锁定只读」冲突）。会话的读 / 发 / 已读 / 在线状态**一律不设权限点**（查询与写入维度写死在登录主体上，见 `ChatController` 类注），故本域仅此一点；建群接口 `POST /api/v1/chat/groups` 挂 `@RequiresPerm("chat:group:create")`，错误码 1031~1033 见 `docs/api/error-codes.md`。
> - **V13 ~ V16**：会话域收尾 —— 已读回执索引（V13）、建群权限点（V14）、消息撤回与引用回复（V15）、群管理权限点（V16），逐条口径见各脚本文件头。
> - **V17**：**仅更新列注释（不改结构 / 数据）** —— `sys_notify_message.notify_type` 注释口径由 8 扩至 **9**，与 at-common `NotifyType` 编码表对齐：新增 **9 = 外发链接被取件回执**（at-file 在免登录访客成功取件后回推给链接创建者）。9 计入站内信未读（未读 SQL 为 `notify_type not in (6,7)`），**不进待办中心**（待办 SQL 为 `notify_type in (1,2,8)`）；**每次取件各发一条**，故 `bizType + bizId + notifyType` 幂等键在本类型上不可用于去重。
> - **V18**：**纯增量（+1 列 +1 索引，不动数据）** —— `sys_notify_message` 补 `mentioned tinyint not null default 0`（会话消息的 **@ 提及行级标记**）与保留期清理索引。`mentioned` 必须落在**行**上而非消息上：会话消息是写扩散的（一条群消息按成员各落一行），「有人 @ 我」等价于 `mentioned = 1 and read_status = 0` 的等值查询，**无需解析正文昵称**（重名 / 昵称含空格 / 发送后改字都不会误判）；存量行默认 `0`（历史消息本就没有点名语义）。清理索引服务的是 `ChatRetentionScheduler` 的**保留期物理删除**（`order by create_time limit` 分批 DELETE，默认保留 30 天、**下限 30 天硬钳制**），逐条口径与并发锁见该脚本文件头与 `docs/development/AT-DIFF-todos.md` GAP-08。
> - **V19**：**纯增量（+1 表，不动数据）** —— 新建 `sys_chat_peer_alias`（**对端备注**：`owner_user_id` / `peer_user_id` / `alias`，唯一键 `uk_owner_peer (owner_user_id, peer_user_id)`）。它存的是**单方面私有的称呼**（「我这边怎么称呼他」），不是账号昵称——**不写 `sys_user`、不改变对方与其他人的界面**，因此**不挂任何权限点**：归属者恒为登录人，不存在「替别人设备注」的入参面（与 `chat:group:*` 那类「作用对象是共享资源」的写权限不同）。备注**会压过真实昵称参与展示**（前端展示链：备注 → 真实昵称 → 「用户 #id」），故会话列表 VO 新增 `peerAlias` 并**保留** `targetName`（昵称仍是对方真实名，资料卡要并列显示）。⚠️ 唯一键**不含 `deleted`**：取消备注是逻辑删除，取消后再设必须**复活旧行**（直接 insert 撞键）——与 V6 文件域「删除后重建」是同一类坑，此处选择复活而非放弃唯一索引（备注天然一人一行，唯一约束值得保留）。无权限点、无初始化数据，纯表结构。
> - **V20**：**纯增量（+4 列，不新增表）** —— 群聊提醒口径细化：① `sys_group_member` 补 `mute_status` / `notify_on_mention` / `notify_on_mention_all` 三列（**行级私有偏好**：免打扰与两类提及提醒开关只作用于「我在这一个群」的这条成员关系，群主不能替成员关提示音，成员换群另有一套）；② `sys_notify_message` 补 `mention_type`（`0`-未点名 / `1`-@我 / `2`-@所有人），与 V18 的 `mentioned` 并存且 `mention_type > 0` 时 `mentioned` 恒写 `1`——前者回答「有没有被点名」（`idx_session` 的提及未读计数建在它上面，不改判定条件），后者回答「被谁点的」，是同一行的布尔投影，不存漂移。**@所有人 仅群主可用**（非群主以 `1042` 拒，与「移除成员 / 解散群只给群主」同一取舍）；存量行默认「免打扰关 + 两类提及提醒开」，行为与加本版之前完全一致；**未新增索引**（偏好搭 `selectMyGroups` 既有 `(me.user_id = ?)` 访问路径）。
> - **V21**：**纯增量（+1 表）** —— 新建 `sys_user_notify_setting`（**用户消息提示音设置**：`sound_enabled` 总开关 + `sound_preset` 音色（default / chime / bubble / custom）+ 自定义音频四列 `custom_sound_name` / `custom_sound_key` / `custom_sound_size` / `custom_sound_duration_ms`）。**为什么单独一张表而非并进 `sys_user`**：账号表是鉴权 / 用户列表 / 会话标题的热表，不该为多数用户承担恒为 `NULL` 的音频列（与 V19「私有偏好不污染共享账号事实」同一取舍）。时长与字节数由**服务端解析后落快照**（不采信前端上报，否则改请求体即可塞入超长音频）；`custom_sound_key` 是 `NotificationSoundStoragePort` 的**不透明 key 而非 URL**（同 `sys_user.avatar_url` 口径），对外仅经 `GET /api/v1/users/me/notify-setting/sound/content` 登录后回本人。唯一键 `uk_user` 保证一人一行，**永不置 `deleted=1`**（「清空自定义音」是把四个音频列置 `NULL` 并回退内置音色，故不存在「删除后重建撞唯一键」的坑）；**无权限点**（归属者恒为登录人，与 V19 同口径）。
> - ⚠️ V1 头部「群组成员关系不在 CE 落子表，随 at-collaboration 演进版本（V3+）扩展」的**收敛口径已由 V4 提前落地**；V1 属已发布脚本，按下方「已发布脚本禁止修改」**不回改注释**（Flyway checksum），口径演进说明以 `V4__menu_route_user_type_and_collaboration.sql` 文件头为准。
> - ⚠️ `sys_user.avatar_url`（V1 基线列）存的是 `AvatarStoragePort` 的**存储 key（不透明标识），不是可直接访问的 URL**：对外地址由 `urlOf` 拼为 `/api/v1/users/{id}/avatar?v={key}`（见 at-file 的 `LocalAvatarStorage` 与其接口注释）。该口径同样**不回改 V1 的列注释**（Flyway checksum 铁律，改了会让既有库启动即 `Migration checksum mismatch`），需要时以本行为准。

## 📐 命名与执行规则

- 📄 迁移脚本命名：`V{major}__{描述}.sql`，版本号**只增不减**，可执行顺序即版本序。
- 🔒 已发布/已执行的脚本**禁止修改**，任何结构或数据变更请追加新版本：
  `V3__xxx.sql`、`V4__xxx.sql` …
- 🚫 脚本内不要写 `CREATE DATABASE` / `USE`，目标库由应用数据源（`DB_URL`）决定。
- 📦 **脚本随应用生效方式（已统一）**：`at-bootstrap` 在构建期（process-resources 阶段的
  `copy-flyway-migrations`，见 `server/at-bootstrap/pom.xml`）自动把本目录 `V*.sql`
  打包进其 classpath `db/migration`；应用侧 `spring.flyway.locations=classpath:db/migration`
  固定不变，dev（`spring-boot:run` / 重新构建后的 IDE 运行）与 prod（fat jar / 容器）共用同一批脚本。
  新增 `V{n}__*.sql` 无需手工复制；改动脚本后重新构建一次（如 `./mvnw -q process-resources`）即同步生效。
  ⚠️ **IDE 自带的增量编译不会执行该插件**：只按「Run」而不跑一次 Maven 时，
  `target/classes/db/migration` 仍停留在旧脚本集，表现是「Java 代码是新的、表却不存在」。
  此时缺表异常若落到兜底 5001，前端只会显示「系统繁忙，请稍后重试 + traceId」，
  真实 SQL 异常仅在服务端日志可见，极易被误判为业务逻辑 bug。新增迁移脚本后请先跑一次 Maven 再启动。
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
