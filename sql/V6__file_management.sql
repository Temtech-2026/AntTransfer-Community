-- =====================================================================
-- V6 文件管理：目录树 / 文件引用层 / 历史版本 / 标签 / 打包任务
--
-- 【为什么必须新增引用层 sys_file_node】
--   sys_file 的既有口径是「一行 = 一份物理文件」（uk_sha256_size 去重 + ref_count 计数），
--   同一份内容被 N 个用户上传只有一行。但文件管理需要每个用户各自可见的条目：各自的名字、
--   目录归属、敏感级别、回收站状态、标签、版本 —— 压在物理行上会退化成「A 改名，B 也跟着改」。
--     sys_file       物理层：sha256 去重唯一，ref_count = 仍持有它的引用条目数
--     sys_file_node  引用层：一行 = 用户目录里的一个条目，owner_user_id 是防水平越权的唯一依据
--
-- 【ref_count 与回收站口径（关键，勿串抄）】
--   · 上传入库（内容首次出现）  ref_count = 1
--   · 秒传命中（内容已存在）    ref_count + 1，复用同一 file_id，不产生新物理副本
--   · 移入回收站                ref_count 不变 —— node 仍持有引用，物理文件必须留着，否则
--                               「还原」会指向一份已被物理删除的内容，PRD US-09 的保留期内
--                               可恢复原路径直接失效
--   · 回收站到期物理清理        ref_count - 1，归 0 才真正删除物理文件与 sys_file 行
--   · 彻底销毁 file:destroy     ref_count - 1（绕过回收站），归 0 同样清理物理文件
--   即「引用归零才清理物理文件」只有两个触发点：回收站到期清理、彻底销毁。
--   V1 中 ref_count 注释写的「引用删除 / 回收 -1」，「回收」指回收站到期后的物理回收，
--   不是「移入回收站」那一刻。
--
-- 【不建唯一索引的原因】
--   sys_folder / sys_file_node / sys_file_tag 均为逻辑删除，而 MySQL 唯一索引无法排除已删除行：
--   「删除 → 重建同名 → 再删除」会让两条 deleted=1 的同名行撞键，把正常操作判成数据库异常。
--   故重名校验落在服务层（同事务内先查后写）；代价是并发极限下可能重名，但不损坏数据完整性。
--
-- @see docs/prd/README.md US-09 回收站 / US-10 标签搜索 / US-12 打包限速 / US-13 历史版本
-- =====================================================================

-- 目录树：path 为物化路径（形如 /1/8/23/），用于 ① 查子树 path like '/8/%'（免递归 CTE）
--   ② 防成环（目标 path 以自身 path 开头即「移到自身或子孙下」）③ 移动时一条 REPLACE 整树搬迁
create table if not exists sys_folder
(
    id            bigint                             not null comment '雪花 ID' primary key,
    parent_id     bigint                             not null default 0 comment '父目录 ID（0=根目录）',
    owner_user_id bigint                             not null comment '归属用户 ID（防水平越权的唯一依据）',
    name          varchar(255)                       not null comment '目录名（同一父级下由服务层保证不重名）',
    path          varchar(1024)                      not null default '/' comment '物化路径（/祖先/…/自身/，根为 /）',
    depth         int                                not null default 1 comment '层级深度（根下第一级=1，用于限制最大嵌套）',
    level         tinyint                            not null default 1 comment '敏感级别：1-低 2-中 3-高（新建继承父目录，可单独调级）',
    group_id      bigint                             null comment '归属项目 / 群组 ID（null=个人目录）',
    space_id      bigint                             null comment '归属协作空间 ID（预留，null=个人目录）',
    tenant_id     bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by     bigint                             null comment '创建人用户 ID',
    create_time   datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by     bigint                             null comment '更新人用户 ID',
    update_time   datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted       tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除',
    key idx_owner_parent (owner_user_id, parent_id),
    key idx_owner_path (owner_user_id, path(255))
) comment '文件目录树（物化路径 + 逻辑删除）' collate = utf8mb4_unicode_ci;

-- 文件引用条目（用户可见的「一个文件」）
--   name / level / folder_id / status 按引用独立，这正是它不能与 sys_file 合并的原因。
--   冗余 size_bytes / sha256 / content_type / ext：列表与搜索免联表，且版本回滚后无需回写物理行。
create table if not exists sys_file_node
(
    id             bigint                             not null comment '雪花 ID' primary key,
    file_id        bigint                             not null comment '物理文件 ID（逻辑关联 sys_file.id）',
    owner_user_id  bigint                             not null comment '归属用户 ID（防水平越权的唯一依据）',
    folder_id      bigint                             not null default 0 comment '所在目录 ID（0=根目录）',
    name           varchar(255)                       not null comment '文件显示名（重命名只影响本引用）',
    ext            varchar(32)                        null comment '扩展名（小写无点；用于类型筛选与预览/缩略图判定）',
    content_type   varchar(128)                       null comment 'MIME 类型（冗余自 sys_file）',
    size_bytes     bigint                             not null comment '文件大小（字节，冗余自 sys_file）',
    sha256         varchar(64)                        not null comment '内容 SHA-256（冗余自 sys_file）',
    level          tinyint                            not null default 1 comment '敏感级别：1-低 2-中 3-高（按引用独立，可高于物理默认）',
    version_no     int                                not null default 1 comment '当前版本号（回滚生成新版本号而非覆盖）',
    status         tinyint                            not null default 0 comment '条目状态：0-正常 1-回收站',
    recycle_time   datetime                           null comment '移入回收站时间（30 天保留期计时起点）',
    recycle_by     bigint                             null comment '执行删除的用户 ID（回收站回显）',
    upload_user_id bigint                             not null comment '上传人用户 ID（搜索「上传者」依据，可与 owner 不同）',
    group_id       bigint                             null comment '归属项目 / 群组 ID（null=个人文件）',
    space_id       bigint                             null comment '归属协作空间 ID（预留，null=个人文件）',
    tenant_id      bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by      bigint                             null comment '创建人用户 ID',
    create_time    datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by      bigint                             null comment '更新人用户 ID',
    update_time    datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted        tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除（与 status=1 回收站是两回事：本列只在彻底销毁/到期清理时置 1）',
    key idx_owner_folder (owner_user_id, folder_id, status),
    key idx_owner_recycle (owner_user_id, status, recycle_time),
    key idx_file (file_id),
    key idx_owner_name (owner_user_id, name),
    key idx_owner_sha (owner_user_id, sha256),
    key idx_upload_user (upload_user_id)
) comment '文件引用条目（用户可见文件；归属与回收站状态按引用独立）' collate = utf8mb4_unicode_ci;

-- 历史版本：只追加。回滚不删旧版本，而是把目标版本的 file_id 复制为更高的 version_no，
--   与 PRD US-13「回滚生成新版本」一致，保证「谁在何时把文件回滚到哪一版」可追溯。
create table if not exists sys_file_version
(
    id             bigint                             not null comment '雪花 ID' primary key,
    node_id        bigint                             not null comment '引用条目 ID（逻辑关联 sys_file_node.id）',
    file_id        bigint                             not null comment '该版本的物理文件 ID（逻辑关联 sys_file.id）',
    version_no     int                                not null comment '版本号（同一 node 内递增，从 1 开始）',
    name           varchar(255)                       not null comment '该版本的文件名（重命名前留痕）',
    size_bytes     bigint                             not null comment '文件大小（字节，快照）',
    sha256         varchar(64)                        not null comment '内容 SHA-256（快照，用于版本比对）',
    remark         varchar(255)                       null comment '版本备注（如「回滚到初版」）',
    upload_user_id bigint                             not null comment '该版本上传/产生人（回滚场景为操作人）',
    tenant_id      bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by      bigint                             null comment '创建人用户 ID',
    create_time    datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by      bigint                             null comment '更新人用户 ID',
    update_time    datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted        tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除（超保留版数置 1，不物理删除以便审计）',
    key idx_node_version (node_id, version_no),
    key idx_file (file_id)
) comment '文件历史版本（只追加，回滚生成新版本）' collate = utf8mb4_unicode_ci;

create table if not exists sys_tag
(
    id            bigint                             not null comment '雪花 ID' primary key,
    owner_user_id bigint                             not null comment '标签归属用户 ID（按人隔离，不跨用户共享）',
    name          varchar(64)                        not null comment '标签名（同一用户下服务层保证不重名）',
    color         varchar(16)                        null comment '标签颜色（如 #1677ff）',
    tenant_id     bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by     bigint                             null comment '创建人用户 ID',
    create_time   datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by     bigint                             null comment '更新人用户 ID',
    update_time   datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted       tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除',
    key idx_owner_name (owner_user_id, name)
) comment '文件标签（按用户隔离）' collate = utf8mb4_unicode_ci;

-- 文件-标签关联：owner_user_id 冗余一份，便于「按标签筛选 + 归属过滤」走单索引
create table if not exists sys_file_tag
(
    id            bigint                             not null comment '雪花 ID' primary key,
    node_id       bigint                             not null comment '引用条目 ID（逻辑关联 sys_file_node.id）',
    tag_id        bigint                             not null comment '标签 ID（逻辑关联 sys_tag.id）',
    owner_user_id bigint                             not null comment '归属用户 ID（冗余自 node，用于越权过滤）',
    tenant_id     bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by     bigint                             null comment '创建人用户 ID',
    create_time   datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by     bigint                             null comment '更新人用户 ID',
    update_time   datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted       tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除（取消打标置 1）',
    key idx_node (node_id),
    key idx_tag (tag_id),
    key idx_owner_node (owner_user_id, node_id)
) comment '文件标签关联' collate = utf8mb4_unicode_ci;

-- 批量打包任务：0 排队 → 1 打包中 → 2 已完成；0/1 → 3 失败；2 → 4 已过期
--   超限（文件数 / 总量 / 并发）在创建入口即拒绝，不「先接任务再失败」（PRD US-12）
create table if not exists sys_pack_task
(
    id           bigint                             not null comment '雪花 ID（兼作任务 ID）' primary key,
    task_no      varchar(32)                        not null comment '任务单号（对用户可读，如 PK20260914001）',
    user_id      bigint                             not null comment '发起用户 ID（产物仅本人可下载）',
    status       tinyint                            not null default 0 comment '任务状态：0-排队 1-打包中 2-已完成 3-失败 4-已过期',
    file_count   int                                not null default 0 comment '打包文件数（创建时确定）',
    total_bytes  bigint                             not null default 0 comment '打包原始总字节数',
    speed_limit  bigint                             not null default 0 comment '任务级速率上限（字节/秒，0=不限；PRD US-12）',
    product_name varchar(255)                       null comment '产物文件名（如 pack_20260914.zip）',
    product_path varchar(512)                       null comment '产物存储相对路径（完成前为空）',
    product_size bigint                             not null default 0 comment '产物字节数（完成前为 0）',
    expire_time  datetime                           null comment '产物过期时间（到期定时清理并置 4，默认 24h）',
    finish_time  datetime                           null comment '完成 / 失败时间',
    error_msg    varchar(512)                       null comment '失败原因（status=3 时填写）',
    tenant_id    bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by    bigint                             null comment '创建人用户 ID',
    create_time  datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by    bigint                             null comment '更新人用户 ID',
    update_time  datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted      tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除',
    key idx_user_status (user_id, status),
    key idx_status_expire (status, expire_time)
) comment '批量打包下载任务（异步 zip，产物过期清理）' collate = utf8mb4_unicode_ci;
