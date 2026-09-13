-- =====================================================================
-- V4__menu_route_user_type_and_collaboration.sql — AntTransfer CE 增量迁移
--
-- 基线：依赖 V3（sys_user.token_epoch）。本脚本为**纯增量**：只新增列 / 新增表，
--       不改写既有列语义、不删除任何对象、不改动既有数据。
--
-- ⚠️ 版本号说明：方案口述中的「V3 增列」在本仓库**不可用**——V3 已被
--   `V3__add_user_token_epoch.sql`（sys_user 会话吊销纪元）占用（见 sql/README.md
--   「已执行脚本禁止修改、版本号只增不减」）。故本批变更顺延为 **V4**。
--
-- 本脚本落地四组结构（对应 architecture.md §4 延期登记 D-9 / D-11 / D-12）：
--
--   1. sys_permission 补「菜单路由元数据」四列（route_path / component / icon / visible）
--      —— 支撑动态菜单接口（D-9，挂 Phase 5 路由守卫阶段）。
--      只加列，**不回填**具体路由值：CE 当前前端为 Ant Design Pro 模板，
--      `/api/v1/**` 服务层尚未接入，路由路径应由前端确定后再回填，避免臆造路径污染数据。
--
--   2. sys_user 补「身份类型」列（user_type）—— 为「外部协作者」受限身份留承载位
--      （D-12）。CE 行为不变：默认 1（内部用户），存量行随默认值，与改造前完全一致；
--      ✅ **CE 口径已定（2026-09-13）：维持 PRD** —— PRD §2.1 P6 定义「外部协作者 =
--      **无平台账号**、只走外发链接通道」，故 CE **不创建外部协作者账号**，本列仅作
--      **EE / 受限账号预留**（CE 恒为 1、不启用）。将来若启用受限账号，属需求变更，
--      须先经 D-6 范围评审（同步改写 PRD P6 与 US-03「无需登录」验收标准）。
--      详见 architecture.md §4 D-12。
--
--   3. 新增 sys_group_member（项目 / 群组成员关系）—— D-11。
--   4. 新增 sys_space（协作空间）—— D-11；与骨架实体
--      at-collaboration `CollaborationSpace` 字段对齐（member_limit / expire_time 等）。
--
-- ⚠️ 与 V1「避免空表占位」收敛口径的关系：V1 头部曾声明「群组成员关系不在 CE 落子表，
--   成员/文件挂靠随 at-collaboration 演进版本（V3+）扩展」（见 V1 第 15~17 行）。
--   本次按协作路线（保留群组空间 / 成员模型）推进，将该收敛**提前落地为 V4**；
--   V1 为已发布脚本，按 sql/README.md「已执行脚本禁止修改（Flyway checksum）」**不做回改**，
--   口径演进的说明以此处为准。
--
-- ⚠️ 本脚本同样不消费 sys_space / sys_group_member：表由 at-collaboration 在
--   Phase 3 落地实体与 Mapper 时接管（Mapper 扫描与四层归位见 architecture.md §1.4）。
--
-- PostgreSQL 差异：本文件为 MySQL 8 方言。`ADD COLUMN ... AFTER` 为 MySQL 专有，
--   PG 需改为逐列 `ALTER TABLE ... ADD COLUMN`（PG 无列序概念，可省略 AFTER）。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. sys_permission：菜单路由元数据（仅 type=1 菜单使用；type=2 操作点留空）
--    这些列只影响**菜单渲染**，不参与权限判定（判定恒以 perm_code 为准，见 at-permission）
-- ---------------------------------------------------------------------
alter table sys_permission
    add column route_path varchar(255) null comment '前端路由路径（type=1 菜单用，如 /file；操作点为空）' after sort_no,
    add column component  varchar(255) null comment '前端组件路径（type=1 菜单用；操作点为空）' after route_path,
    add column icon       varchar(64)  null comment '菜单图标标识（前端图标库 key，操作点为空）' after component,
    add column visible    tinyint      not null default 1 comment '菜单可见性：1-显示 0-隐藏（仅影响菜单渲染，不影响权限判定）' after icon;

-- ---------------------------------------------------------------------
-- 2. sys_user：身份类型（内部用户 / 外部协作者受限身份）
--    默认 1（内部用户），存量行随默认值，行为与改造前完全一致
--    CE 口径已定（2026-09-13）：维持 PRD，不创建外部协作者账号，本列仅作 EE 预留
-- ---------------------------------------------------------------------
alter table sys_user
    add column user_type tinyint not null default 1 comment '身份类型：1-内部用户 2-外部协作者（受限身份，EE 预留；CE 已裁定维持 PRD 不启用，见 architecture.md §4 D-12）' after status;

-- ---------------------------------------------------------------------
-- 3. sys_group_member：项目 / 群组成员关系
--    供群组空间、群聊与低敏感审批人解析使用（对应 D-11）
-- ---------------------------------------------------------------------
create table if not exists sys_group_member
(
    id          bigint                             not null comment '雪花 ID' primary key,
    group_id    bigint                             not null comment '项目 / 群组 ID（逻辑关联 sys_group）',
    user_id     bigint                             not null comment '成员用户 ID（逻辑关联 sys_user）',
    member_role tinyint                            not null default 1 comment '成员角色：1-成员 2-管理员 3-只读',
    join_time   datetime default CURRENT_TIMESTAMP not null comment '加入时间',
    tenant_id   bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by   bigint                             null comment '创建人用户 ID（逻辑关联 sys_user）',
    create_time datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by   bigint                             null comment '更新人用户 ID（逻辑关联 sys_user）',
    update_time datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted     tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除',
    unique key uk_group_user (group_id, user_id),
    key idx_user_id (user_id)
) comment '项目 / 群组成员关系' collate = utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 4. sys_space：协作空间（多人协作的逻辑容器）
--    字段与 at-collaboration `CollaborationSpace` 骨架实体对齐
--    （name / owner_user_id / description / member_limit / status / expire_time）
--    sys_file.space_id 自本脚本起为**已落地**的逻辑关联（原注释「空间表随
--    at-collaboration 版本落地」所指即本表；V1 不回改，见文件头说明）
-- ---------------------------------------------------------------------
create table if not exists sys_space
(
    id            bigint                             not null comment '雪花 ID' primary key,
    name          varchar(64)                        not null comment '空间名称',
    owner_user_id bigint                             not null comment '空间所有者用户 ID（逻辑关联 sys_user）',
    group_id      bigint                             null comment '归属项目 / 群组 ID（逻辑关联 sys_group，null=独立空间）',
    description   varchar(255)                       null comment '空间描述',
    member_limit  int                                not null default 0 comment '成员数量上限（0=不限制）',
    status        tinyint                            not null default 1 comment '空间状态：0-草稿 1-进行中 2-已归档 3-已解散',
    expire_time   datetime                           null comment '空间过期时间（null=永久有效）',
    tenant_id     bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by     bigint                             null comment '创建人用户 ID（逻辑关联 sys_user）',
    create_time   datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by     bigint                             null comment '更新人用户 ID（逻辑关联 sys_user）',
    update_time   datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted       tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除',
    key idx_owner (owner_user_id),
    key idx_group (group_id)
) comment '协作空间' collate = utf8mb4_unicode_ci;
