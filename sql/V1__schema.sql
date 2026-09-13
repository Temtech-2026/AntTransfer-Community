-- =====================================================================
-- V1__schema.sql — AntTransfer CE 初始表结构（Flyway 版本化脚本 V1）
--
-- 演进说明：2026-09-06 二次全量重置。此前脚手架的 user / department / role /
--   permission_point / permission_grant / file_object / transfer_record 等
--   直连命名表族废弃，统一为 sys_ 前缀（sys_user/sys_dept/...）16 表四族基线，
--   并把逻辑删除列由 is_delete 更名为 deleted（与 at-common BaseEntity 对齐）：
--
--   权限族：    sys_user / sys_dept / sys_role / sys_permission / sys_user_role /
--               sys_role_permission / sys_group
--   审批授权族：sys_approval_request / sys_approval_node / sys_user_file_permission
--   文件传输族：sys_file / sys_upload_task / sys_share_link
--   协作审计族：sys_notify_message / sys_operation_log / sys_login_log
--
--   相较旧族的两点收敛（避免空表占位，统一归口）：
--     a) 群组成员关系不在 CE 落子表——sys_group 仅立「项目/群组」组织单元基座，
--        成员/文件挂靠等协作关系随 at-collaboration 演进版本（V3+）扩展；
--     b) 分片明细不再独立成表——「已传分片索引」持久化于 sys_upload_task 的
--        uploaded_indexes 列（JSON 数组），EE 超大分片场景再拆分独立子表。
--
-- 设计口径（与 at-common BaseEntity / at-bootstrap application.yml 对齐）：
--   1. 主键 id bigint 雪花（MyBatis-Plus ASSIGN_ID 由应用分配，DB 不做自增）；
--   2. 公共字段固定为 create_by/create_time/update_by/update_time/deleted，
--      deleted 逻辑删除（全局 logic-delete-field: deleted），值 0-未删 1-已删；
--   3. 命名统一小写 snake_case；普通索引前缀 idx_，唯一键前缀 uk_；
--   4. tenant_id 全表保留 not null default 0（CE 恒为 0，EE 多租户扩展位，
--      CE 不建租户表；业务查询须按需带上该维度）；
--   5. 外键一律不建物理 FOREIGN KEY，仅逻辑关联（同 ID 段雪花、应用层保证归属）；
--   6. 状态机迁移全部走 CAS（UPDATE ... WHERE id=? AND status=<期望源态>），
--      语义见 docs/architecture/use-case-flows.md 与 system-design.md；
--   7. append-only 表（sys_operation_log / sys_login_log）不提供应用层 update/delete
--      能力：update_by/update_time/deleted 恒不启用（deleted 恒 0），仅由归档任务
--      按 log_time 整表清理（操作日志留存 ≥ 6 个月）。
--
-- PostgreSQL 差异点（本文件为 MySQL 8 方言，若需 PG 需按下列规则改写）：
--   a) 类型映射：tinyint → smallint；datetime → timestamp（无时区；跨时区业务用
--      timestamptz）；bigint / varchar 一致；时间默认 CURRENT_TIMESTAMP 两库均有；
--   b) 列内 on update CURRENT_TIMESTAMP 为 MySQL 专有，PG 需触发器或用应用层
--      MetaObjectHandler 统一填充（本项目本就计划应用层填充）；
--   c) 行内 KEY / UNIQUE KEY 语法 PG 不支持，须改为建表后独立语句
--      CREATE [UNIQUE] INDEX ...（UNIQUE 亦可写为 CONSTRAINT uk_... UNIQUE(cols)）；
--   d) 表/列 COMMENT 子句 PG 不支持，须改为 COMMENT ON TABLE/COLUMN ...；
--   e) collate = utf8mb4_unicode_ci / ENGINE=InnoDB 为 MySQL 专有，PG 无表级写法；
--   f) sys_ 前缀已避开 user/role/share 等两库保留字，无需任何转义写法。
--
-- Flyway 约定：
--   1. 文件名规则 V{major}__{描述}.sql，版本号只增不减；已执行脚本禁止回改；
--   2. 本脚本不含 CREATE DATABASE / USE，目标库由连接配置（JDBC URL）决定；
--   3. 曾按旧版表族（18 表或脚手架）建过库的环境哈希与重置版不一致会校验失败，
--      须 flyway clean 后重放或手工 DROP 重建（本地见 sql/README.md）。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 一、权限族（at-auth / at-permission RBAC）
-- ---------------------------------------------------------------------

-- 用户表：认证主体与 RBAC 主体（sys_ 前缀避开 user 保留字）
create table if not exists sys_user
(
    id             bigint                             not null comment '雪花 ID' primary key,
    username       varchar(64)                        not null comment '登录账号（唯一；大小写规范化由应用保证）',
    password_hash  varchar(100)                       not null comment '密码散列（BCrypt）',
    nickname       varchar(64)                        null comment '昵称 / 姓名',
    avatar_url     varchar(512)                       null comment '头像地址',
    email          varchar(128)                       null comment '邮箱（允许空，非空值去重由应用保证）',
    mobile         varchar(32)                        null comment '手机号',
    dept_id        bigint                             null comment '所属部门 ID（逻辑关联 sys_dept，null=未分配）',
    status         tinyint                            not null default 0 comment '账号状态：0-正常 1-禁用（1005） 2-锁定（1004）',
    last_login_time datetime                          null comment '最近登录时间',
    remark         varchar(255)                       null comment '备注',
    tenant_id      bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by      bigint                             null comment '创建人用户 ID（逻辑关联 sys_user）',
    create_time    datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by      bigint                             null comment '更新人用户 ID（逻辑关联 sys_user）',
    update_time    datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted        tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除',
    unique key uk_username (username),
    key idx_dept (dept_id)
) comment '用户' collate = utf8mb4_unicode_ci;

-- 树形部门表：支撑 RBAC 数据范围「本部门及以下」（sys_dept 递归自关联）
create table if not exists sys_dept
(
    id             bigint                             not null comment '雪花 ID' primary key,
    parent_id      bigint                             not null default 0 comment '父部门 ID（0=根部门，逻辑关联本表）',
    name           varchar(64)                        not null comment '部门名称',
    ancestors      varchar(500)                       not null default '/' comment '祖先链路径，如 /0/12/34/，供子树查询与数据范围过滤',
    leader_user_id bigint                             null comment '部门负责人用户 ID（逻辑关联 sys_user）',
    sort_no        int                                not null default 0 comment '排序号（升序）',
    status         tinyint                            not null default 1 comment '状态：0-停用 1-启用',
    tenant_id      bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by      bigint                             null comment '创建人用户 ID（逻辑关联 sys_user）',
    create_time    datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by      bigint                             null comment '更新人用户 ID（逻辑关联 sys_user）',
    update_time    datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted        tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除',
    key idx_parent (parent_id),
    key idx_ancestors (ancestors(64))
) comment '树形部门' collate = utf8mb4_unicode_ci;

-- 角色表：RBAC 角色；内置角色集 SUPER_ADMIN/AUDITOR/DEPT_ADMIN/USER 由
-- sql/V2__init_data.sql 初始化（原三权分立细分职能并入 SUPER_ADMIN）；
-- 管理角色互斥由应用层强制，数据层不建互斥约束
create table if not exists sys_role
(
    id         bigint                             not null comment '雪花 ID' primary key,
    code       varchar(64)                        not null comment '角色编码（唯一），内置：SUPER_ADMIN/AUDITOR/DEPT_ADMIN/USER（见 V2 初始化数据）',
    name       varchar(64)                        not null comment '角色名称',
    data_scope tinyint                            not null default 1 comment '数据范围：1-本人 2-本部门及以下 3-全部',
    built_in   tinyint                            not null default 0 comment '是否内置：1-内置角色（禁止删除）',
    remark     varchar(255)                       null comment '备注',
    tenant_id  bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by  bigint                             null comment '创建人用户 ID（逻辑关联 sys_user）',
    create_time datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by  bigint                             null comment '更新人用户 ID（逻辑关联 sys_user）',
    update_time datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted    tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除',
    unique key uk_role_code (code)
) comment '角色（RBAC）' collate = utf8mb4_unicode_ci;

-- 权限点表：菜单 / 操作按钮 / 数据范围三维度统一存放，成树形
--   type=1 菜单（parent_id=0 顶层菜单）；type=2 操作/按钮点挂所属菜单之下
create table if not exists sys_permission
(
    id          bigint                             not null comment '雪花 ID' primary key,
    perm_code   varchar(128)                       not null comment '权限点编码（唯一），如 file 菜单、file:preview 原子操作点',
    perm_name   varchar(64)                        not null comment '权限点名称',
    type        tinyint                            not null default 1 comment '维度：1-菜单 2-操作 / 按钮 3-数据范围',
    parent_id   bigint                             not null default 0 comment '父权限点 ID（0=根，逻辑关联本表，权限点成树）',
    sort_no     int                                not null default 0 comment '排序号（升序）',
    tenant_id   bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by   bigint                             null comment '创建人用户 ID（逻辑关联 sys_user）',
    create_time datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by   bigint                             null comment '更新人用户 ID（逻辑关联 sys_user）',
    update_time datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted     tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除',
    unique key uk_perm_code (perm_code),
    key idx_parent (parent_id)
) comment '权限点 / 菜单（含 perm_code）' collate = utf8mb4_unicode_ci;

-- 用户-角色关联表（RBAC 多对多）
create table if not exists sys_user_role
(
    id          bigint                             not null comment '雪花 ID' primary key,
    user_id     bigint                             not null comment '用户 ID（逻辑关联 sys_user）',
    role_id     bigint                             not null comment '角色 ID（逻辑关联 sys_role）',
    tenant_id   bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by   bigint                             null comment '创建人用户 ID（逻辑关联 sys_user）',
    create_time datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by   bigint                             null comment '更新人用户 ID（逻辑关联 sys_user）',
    update_time datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted     tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除',
    unique key uk_user_role (user_id, role_id),
    key idx_role_id (role_id)
) comment '用户-角色关联' collate = utf8mb4_unicode_ci;

-- 角色-权限点关联表（RBAC 多对多，角色静态文件动作的授权数据源）
create table if not exists sys_role_permission
(
    id            bigint                             not null comment '雪花 ID' primary key,
    role_id       bigint                             not null comment '角色 ID（逻辑关联 sys_role）',
    permission_id bigint                             not null comment '权限点 ID（逻辑关联 sys_permission）',
    tenant_id     bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by     bigint                             null comment '创建人用户 ID（逻辑关联 sys_user）',
    create_time   datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by     bigint                             null comment '更新人用户 ID（逻辑关联 sys_user）',
    update_time   datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted       tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除',
    unique key uk_role_permission (role_id, permission_id),
    key idx_permission_id (permission_id)
) comment '角色-权限点关联' collate = utf8mb4_unicode_ci;

-- 项目 / 群组表：面向协作的轻量组织单元基座（CE 仅立结构；
-- 成员关系、成员角色与文件挂靠随 at-collaboration 演进版本扩展）
create table if not exists sys_group
(
    id            bigint                             not null comment '雪花 ID' primary key,
    name          varchar(64)                        not null comment '项目 / 群组名称',
    group_type    tinyint                            not null default 1 comment '类型：1-项目 2-群组',
    owner_user_id bigint                             not null comment '负责人 / 群主用户 ID（逻辑关联 sys_user）',
    description   varchar(255)                       null comment '描述',
    status        tinyint                            not null default 1 comment '状态：0-停用 / 已解散 1-生效',
    tenant_id     bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by     bigint                             null comment '创建人用户 ID（逻辑关联 sys_user）',
    create_time   datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by     bigint                             null comment '更新人用户 ID（逻辑关联 sys_user）',
    update_time   datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted       tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除',
    key idx_owner (owner_user_id)
) comment '项目 / 群组' collate = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 二、审批与授权族（at-permission）
--   时序口径见 docs/architecture/use-case-flows.md §2（文档与脚本保持同步）。
-- ---------------------------------------------------------------------

-- 权限申请单：一次「无权限 → 申请 → 审批」的完整留痕
create table if not exists sys_approval_request
(
    id                bigint                             not null comment '雪花 ID' primary key,
    application_no    varchar(32)                        not null comment '申请单号（对用户可读，如 AP20260906001）',
    applicant_id      bigint                             not null comment '申请人用户 ID（逻辑关联 sys_user）',
    apply_type        varchar(16)                        not null default 'ACCESS' comment '申请类型：ACCESS-访问 DOWNLOAD-下载 EDIT-编辑 SHARE-外发',
    resource_type     varchar(16)                        not null default 'FILE' comment '目标资源类型：FILE-文件 SPACE-空间 GROUP-项目/群组（CE 默认 FILE）',
    resource_id       bigint                             not null comment '目标资源 ID（逻辑关联，CE 下为 sys_file.id）',
    level             tinyint                            null comment '资源敏感级别：1-低 2-中 3-高',
    purpose           varchar(500)                       not null comment '申请目的 / 理由',
    desired_expire_at datetime                           null comment '申请人拟授权到期时刻（null=永久；以审批实际批复为准）',
    status            tinyint                            not null default 0 comment '状态：0-待审 1-通过 2-驳回 3-转审 4-撤销',
    approver_id       bigint                             null comment '当前 / 最近审批人用户 ID（逻辑关联 sys_user）',
    opinion           varchar(500)                       null comment '审批意见 / 驳回理由',
    decided_at        datetime                           null comment '最近批复 / 处理时刻（status 进入终态时写入）',
    tenant_id         bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by         bigint                             null comment '创建人用户 ID（逻辑关联 sys_user）',
    create_time       datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by         bigint                             null comment '更新人用户 ID（逻辑关联 sys_user）',
    update_time       datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted           tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除',
    unique key uk_application_no (application_no),
    key idx_applicant_resource (applicant_id, resource_type, resource_id, status),
    key idx_approver (approver_id, status),
    key idx_status_created (status, create_time)
) comment '权限申请单' collate = utf8mb4_unicode_ci;

-- 审批节点表：CE 固定单级审批（node_seq 恒为 1）；多级 / 会签等 EE 能力
-- 经本表 + 审批链 Policy 接口扩展，不改变 CE 现有闭环
create table if not exists sys_approval_node
(
    id              bigint                             not null comment '雪花 ID' primary key,
    approval_id     bigint                             not null comment '申请单 ID（逻辑关联 sys_approval_request）',
    node_seq        int                                not null default 1 comment '节点序号（CE 恒为 1；多级审批按序追加）',
    node_type       tinyint                            not null default 1 comment '节点类型：1-单级审批（预留：2-会签 3-或签）',
    approver_id     bigint                             null comment '节点审批人用户 ID（转审即更新此处，逻辑关联 sys_user）',
    status          tinyint                            not null default 0 comment '节点状态：0-待处理 1-同意 2-驳回 3-转审 4-作废',
    opinion         varchar(500)                       null comment '节点审批意见',
    acted_at        datetime                           null comment '节点处理时间',
    tenant_id       bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by       bigint                             null comment '创建人用户 ID（逻辑关联 sys_user）',
    create_time     datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by       bigint                             null comment '更新人用户 ID（逻辑关联 sys_user）',
    update_time     datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted         tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除',
    unique key uk_approval_node (approval_id, node_seq),
    key idx_approver (approver_id, status)
) comment '审批节点（预留，多级审批扩展点）' collate = utf8mb4_unicode_ci;

-- 文件授权表：对象级「实际授权」明细（user × 资源 × 动作）
--   ——与 sys_role_permission（角色静态动作）互补：本表表达对特定文件/资源的
--   显式授权，带来源与到期时间；到期由定时任务按 idx_expire 扫描 CAS 回收
--   （PermissionGrantExpireScheduler，见 at-permission 模块）。
--   来源语义：grant_source=1（角色继承）行由「角色对对象级资源的数据范围/授权
--   策略」放平生成（expire_at 通常为 null=跟随角色长期有效）；grant_source=2
--   （审批获得）行在申请单批复通过时写入（expire_at 取批复的时效时间点）。
create table if not exists sys_user_file_permission
(
    id             bigint                             not null comment '雪花 ID' primary key,
    application_id bigint                             null comment '来源申请单 ID（逻辑关联 sys_approval_request；角色继承来源为 null）',
    user_id        bigint                             not null comment '被授权人用户 ID（逻辑关联 sys_user）',
    resource_type  varchar(16)                        not null default 'FILE' comment '目标资源类型：FILE-文件 SPACE-空间 GROUP-项目/群组（CE 默认 FILE）',
    resource_id    bigint                             not null comment '目标资源 ID（逻辑关联；CE 下为 sys_file.id）',
    grant_type     varchar(16)                        not null default 'DOWNLOAD' comment '授权动作：ACCESS-访问 DOWNLOAD-下载 EDIT-编辑 SHARE-外发 DESTROY-销毁（与 sys_permission.perm_code 动作语义对齐）',
    grant_source   tinyint                            not null default 2 comment '授权来源：1-角色继承 2-审批获得（申请单批复写入）',
    level          tinyint                            null comment '授权级别：1-低 2-中 3-高',
    approve_by     bigint                             null comment '审批人用户 ID（逻辑关联 sys_user；角色继承来源可为 null）',
    expire_at      datetime                           null comment '授权到期时刻（到期回收判据；null=长期有效 / 跟随角色，须大于 create_time）',
    status         tinyint                            not null default 1 comment '状态：1-生效 2-到期回收 3-撤销',
    revoke_at      datetime                           null comment '实际回收 / 撤销时间',
    tenant_id      bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by      bigint                             null comment '创建人用户 ID（逻辑关联 sys_user）',
    create_time    datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by      bigint                             null comment '更新人用户 ID（逻辑关联 sys_user）',
    update_time    datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted        tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除',
    key idx_user_resource (user_id, resource_type, resource_id, status),
    key idx_user_expire (user_id, status, expire_at),
    key idx_expire (status, expire_at),
    key idx_source (grant_source, application_id)
) comment '文件授权明细（实际授权，来源：角色继承 / 审批获得）' collate = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 三、文件与传输族（at-file / at-transfer）
-- ---------------------------------------------------------------------

-- 文件元数据表：一行 = 一份物理文件（内容去重唯一）
--   模型口径：同 sha256 + size_bytes 视为同一物理文件（uk 唯一约束），秒传命中
--   不新建行、不产生新物理副本，仅 ref_count + 1 并复用 fileId；删除 / 回收引用时
--   ref_count - 1，归 0 后由清理任务回收物理数据。
create table if not exists sys_file
(
    id             bigint                             not null comment '雪花 ID' primary key,
    sha256         varchar(64)                        not null comment '文件内容 SHA-256（小写 hex，物理去重键，与 size_bytes 联合唯一）',
    size_bytes     bigint                             not null comment '文件大小（字节）',
    original_name  varchar(255)                       not null comment '原始文件名（首个引用上传时命名，下载回显默认值）',
    content_type   varchar(128)                       null comment '文件 MIME 类型',
    storage_type   tinyint                            not null default 1 comment '存储类型：1-本地磁盘 2-对象存储（S3/OSS/COS）',
    bucket_name    varchar(128)                       null comment '桶 / 存储空间名称（对象存储场景）',
    object_key     varchar(512)                       null comment '对象存储键（对象存储场景，如 uploads/2026/09/xx.bin）',
    storage_path   varchar(512)                       null comment '本地存储相对路径（本地磁盘场景）',
    url            varchar(512)                       null comment '对外访问 URL（可选，存储后端直链）',
    ref_count      int                                not null default 1 comment '引用计数：指向该物理文件的引用数（首次入库=1；秒传命中 +1；引用删除 / 回收 -1，归 0 可回收物理数据）',
    group_id       bigint                             null comment '归属项目 / 群组 ID（逻辑关联 sys_group，null=个人文件）',
    space_id       bigint                             null comment '归属协作空间 ID（预留逻辑关联，空间表随 at-collaboration 版本落地；null=个人直传）',
    upload_user_id bigint                             not null comment '上传人用户 ID（逻辑关联 sys_user）',
    level          tinyint                            not null default 1 comment '敏感级别：1-低 2-中 3-高（文件默认低）',
    status         tinyint                            not null default 0 comment '文件状态：0-可用 1-上传中 2-不可用 / 已下线',
    tenant_id      bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by      bigint                             null comment '创建人用户 ID（逻辑关联 sys_user）',
    create_time    datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by      bigint                             null comment '更新人用户 ID（逻辑关联 sys_user）',
    update_time    datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted        tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除',
    unique key uk_sha256_size (sha256, size_bytes),
    key idx_group (group_id),
    key idx_upload_user (upload_user_id)
) comment '文件元数据（sha256 物理去重 + 引用计数）' collate = utf8mb4_unicode_ci;

-- 分片上传任务表：一次上传任务的进度 / 状态与已传分片索引持久化
--   状态机：0 排队 → 1 传输中 ⇄ 2 已暂停；1 → 6 合并中 → 3 已完成；
--           0/1/2/6 → 4 失败（可重试回 0）/ 5 已取消；迁移一律 CAS
create table if not exists sys_upload_task
(
    id                bigint                             not null comment '雪花 ID（兼作上传票据 uploadId）' primary key,
    task_no           varchar(32)                        not null comment '任务单号（对用户可读，如 AT20260906001）',
    user_id           bigint                             not null comment '上传发起人用户 ID（逻辑关联 sys_user）',
    file_id           bigint                             null comment '合并落库后回填的 sys_file.id',
    file_name         varchar(255)                       not null comment '文件名（冗余展示，便于列表免查文件表）',
    sha256            varchar(64)                        null comment '整件 SHA-256（预检上报，合并后服务端整件重算比对）',
    file_size         bigint                             not null default 0 comment '文件总大小（字节）',
    chunk_size        int                                not null default 8388608 comment '分片大小（字节，默认 8 MiB，可配置）',
    chunk_count       int                                not null default 0 comment '分片总数',
    uploaded_indexes  varchar(8192)                      null comment '已上传分片索引持久化（JSON 数组，如 [1,2,3]，供断点续传跳过已收片；超大分片数场景后续可拆独立子表）',
    transferred_size  bigint                             not null default 0 comment '已传字节数（进度 = transferred_size / file_size；断点续传据此推进）',
    status            tinyint                            not null default 0 comment '任务状态：0-排队 1-传输中 2-已暂停 3-已完成 4-失败 5-已取消 6-合并中',
    error_msg         varchar(500)                       null comment '失败原因（status=4 时有值，前端展示重试建议）',
    tenant_id         bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by         bigint                             null comment '创建人用户 ID（逻辑关联 sys_user）',
    create_time       datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by         bigint                             null comment '更新人用户 ID（逻辑关联 sys_user）',
    update_time       datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted           tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除',
    unique key uk_task_no (task_no),
    key idx_user_status (user_id, status),
    key idx_status_time (status, update_time),
    key idx_file_id (file_id)
) comment '分片上传任务（含已传分片索引持久化）' collate = utf8mb4_unicode_ci;

-- 外发链接表：面向无账号外部协作者的限时 / 限次 / 限提取码下载通道
--   下载三校验（未撤销 + 未过期 + 提取码对）与次数原子扣减语义：UPDATE ... SET
--   downloaded_count=downloaded_count+1 WHERE id=? AND downloaded_count<download_limit
--   （影响行数=1 才放行，防超卖）。提取码错误 5 次锁 30 min 的计数用 Redis，不落库。
create table if not exists sys_share_link
(
    id                bigint                             not null comment '雪花 ID' primary key,
    token             varchar(64)                        not null comment '外发链接不透明令牌（高熵随机，对外唯一标识，不可猜测）',
    file_id           bigint                             not null comment '被分享文件 ID（逻辑关联 sys_file）',
    owner_user_id     bigint                             not null comment '创建者用户 ID（逻辑关联 sys_user；撤销 / 审计归属）',
    extract_code_hash varchar(100)                       not null comment '提取码散列（BCrypt，提取码 ≥ 6 位字母数字，不落明文）',
    expire_at         datetime                           not null comment '链接到期时间（默认创建后 7 天，上限受管理员配置约束）',
    download_limit    int                                not null default 10 comment '下载次数上限（默认 10 次）',
    downloaded_count  int                                not null default 0 comment '已下载次数（并发原子扣减）',
    status            tinyint                            not null default 0 comment '状态：0-生效 1-已撤销 2-已失效（过期 / 达上限）',
    revoke_at         datetime                           null comment '撤销 / 失效时间',
    tenant_id         bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by         bigint                             null comment '创建人用户 ID（逻辑关联 sys_user）',
    create_time       datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by         bigint                             null comment '更新人用户 ID（逻辑关联 sys_user）',
    update_time       datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted           tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除',
    unique key uk_token (token),
    key idx_file_id (file_id),
    key idx_owner (owner_user_id),
    key idx_status_expire (status, expire_at)
) comment '外发链接' collate = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 四、协作与审计族（at-collaboration 通知域 / at-common 审计）
-- ---------------------------------------------------------------------

-- 站内消息表：审批待办 / 结果、安全事件等统一汇集；离线指未读消息在
-- 用户上线（轮询 / 长连接重连）后补拉，消息本身落库留存于本表
create table if not exists sys_notify_message
(
    id                bigint                             not null comment '雪花 ID' primary key,
    recipient_user_id bigint                             not null comment '接收人用户 ID（逻辑关联 sys_user）',
    notify_type       tinyint                            not null comment '通知类型：1-审批待办 2-审批结果 3-外发链接锁定 4-链接到期提醒 5-异常登录告警',
    title             varchar(128)                       not null comment '通知标题',
    content           varchar(1000)                      null comment '通知内容（纯文本，可含业务摘要）',
    biz_type          varchar(32)                        null comment '关联业务类型：APPLICATION / SHARE / SECURITY',
    biz_id            bigint                             null comment '关联业务 ID（申请单 / 链接等）',
    read_status       tinyint                            not null default 0 comment '阅读状态：0-未读 1-已读',
    read_time         datetime                           null comment '阅读时间',
    tenant_id         bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by         bigint                             null comment '创建人用户 ID（逻辑关联 sys_user）',
    create_time       datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by         bigint                             null comment '更新人用户 ID（逻辑关联 sys_user）',
    update_time       datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted           tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除',
    key idx_user_read (recipient_user_id, read_status, id),
    key idx_biz (biz_type, biz_id)
) comment '站内 / 离线消息' collate = utf8mb4_unicode_ci;

-- 操作审计日志表（append-only）：审计记录不可被任何角色修改 / 删除，仅可归档导出；
--   留存策略 ≥ 6 个月，由归档清理任务按 log_time 定期整表导出清理（周期化，见
--   sys_operation_log 索引 idx_log_time）；本表 update_by/update_time/deleted 恒不启用
create table if not exists sys_operation_log
(
    id          bigint                             not null comment '雪花 ID' primary key,
    user_id     bigint                             null comment '操作人用户 ID（匿名 / 系统任务为 null，逻辑关联 sys_user）',
    action      varchar(64)                        not null comment '动作编码：LOGIN/APPLY/APPROVE/GRANT/REVOKE/SHARE_CREATE/SHARE_REVOKE/FILE_UPLOAD/FILE_DOWNLOAD/FILE_DELETE/LEVEL_CHANGE 等',
    module      varchar(32)                        not null comment '所属域：AUTH/PERMISSION/TRANSFER/FILE/COLLABORATION/COMMON',
    target_type varchar(32)                        null comment '操作对象类型：USER/ROLE/SPACE/FILE/SHARE/APPLICATION/GRANT/SYSTEM',
    target_id   bigint                             null comment '操作对象 ID',
    trace_id    varchar(64)                        null comment '链路追踪 ID（一次请求内唯一，排障凭证）',
    ip          varchar(64)                        null comment '来源 IP',
    result      tinyint                            not null default 0 comment '结果：0-成功 1-失败',
    detail      varchar(2000)                      null comment '审计详情（JSON / 可读上下文，脱敏后落库）',
    log_time    datetime                           not null comment '审计事件时间（业务时间，非落库时间）',
    tenant_id   bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by   bigint                             null comment '创建人用户 ID',
    create_time datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by   bigint                             null comment '更新人用户 ID（append-only，恒不启用）',
    update_time datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间（append-only，恒不启用）',
    deleted     tinyint  default 0                 not null comment '逻辑删除（append-only，恒为 0，禁止置 1）',
    key idx_log_time (log_time),
    key idx_user_time (user_id, log_time),
    key idx_target (target_type, target_id, log_time),
    key idx_module_action (module, action, log_time)
) comment '操作审计日志（append-only，留存 ≥ 6 个月）' collate = utf8mb4_unicode_ci;

-- 登录日志表：登录成功 / 失败留痕，防爆破与异常登录告警数据源（append-only）
create table if not exists sys_login_log
(
    id          bigint                             not null comment '雪花 ID' primary key,
    account     varchar(64)                        not null comment '尝试登录的账号（对应用户 username）',
    user_id     bigint                             null comment '识别出的用户 ID（匿名失败为 null，逻辑关联 sys_user）',
    login_type  tinyint                            not null default 1 comment '登录类型：1-本地账号密码 2-refresh 换发令牌',
    ip          varchar(64)                        null comment '来源 IP',
    user_agent  varchar(512)                       null comment 'User-Agent',
    result      tinyint                            not null default 1 comment '结果：1-成功 0-失败',
    fail_reason varchar(255)                       null comment '失败原因：BAD_CREDENTIALS/ACCOUNT_LOCKED/ACCOUNT_DISABLED/TOKEN_INVALID 等',
    log_time    datetime                           not null comment '登录时间（业务时间）',
    tenant_id   bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by   bigint                             null comment '创建人用户 ID',
    create_time datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by   bigint                             null comment '更新人用户 ID（append-only，恒不启用）',
    update_time datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间（append-only，恒不启用）',
    deleted     tinyint  default 0                 not null comment '逻辑删除（append-only，恒为 0，禁止置 1）',
    key idx_log_time (log_time),
    key idx_user_log (user_id, log_time),
    key idx_account_log (account, log_time)
) comment '登录日志（append-only）' collate = utf8mb4_unicode_ci;
