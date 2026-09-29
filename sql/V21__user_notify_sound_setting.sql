-- =====================================================================
-- V21 用户消息提示音设置：提示音开关、音色、自定义音频
--
-- 【为什么需要这一版】
--   需求：收到新消息要有提示音，且用户可上传本地短音频作为自己的提示音。
--   提示音是「我自己的耳朵」的事——同一台设备上别人不该被我的偏好影响，
--   换设备 / 换浏览器又必须一致，所以它既不能只存在浏览器 localStorage，
--   也不能存在群 / 会话上。
--
-- 【为什么不落在 sys_user 上，而要单独一张表】
--   ① sys_user 是全站最热的账号表：鉴权、用户列表、会话标题、成员名单每次都要读它。
--      把「播放设置」塞进去，等于给每一次读取都多带一行与鉴权无关的偏好；
--   ② 自定义音频本身要记 4 个字段（key / 原名 / 字节数 / 时长），
--      其中 3 个在「未设置自定义音」时恒为 NULL——账号表不该为多数用户承担这些空列；
--   ③ 与 V19（对端备注不落 sys_user）同一取舍：**私有偏好不该污染共享的账号事实**。
--   收益是可分离读取：只有提示音设置页会读这张表，会话推送链路完全不涉及它。
--
-- 【为什么时长与大小由服务端定，而不是采信前端上报】
--   上限必须在服务端强制，前端校验只负责「即时反馈」（不等上传就能提示超限）。
--   若采信前端上报的时长，改一改请求体就能塞进一个几十分钟的音频——
--   本表存的是「这条设置对应的音频」这一事实，事实必须由服务端测量后落库：
--   custom_sound_size / custom_sound_duration_ms 都是**上传时服务端解析得到的快照**
--   （字节数取实际接收长度，时长由 at-common 的 AudioTypes 从容器头解析）。
--
-- 【custom_sound_key 是不透明标识，不是 URL】
--   与 sys_user.avatar_url 同一口径（见 sql/README.md 中 V1 遗留说明）：列里存的是
--   NotificationSoundStoragePort 的存储 key，对外地址由服务端拼装成
--   `GET /api/v1/users/me/notify-setting/sound/content`——
--   该端点**要求登录**且只回本人音频，不提供匿名直出（提示音是本人在已登录会话里播放的，
--   没有「把音频地址贴给别人看」的用例；头像需要匿名直出是因为要出现在他人名单里，此处不需要，
--   少一个匿名入口就少一处越权面）。
--
-- 【一人一行，且永不置 deleted=1】
--   唯一键 uk_user 保证 (user_id) 只有一行，连点保存只会覆盖同一行。
--   「清空自定义音频」不是删除设置行，而是把 custom_sound_name / custom_sound_key /
--   custom_sound_size / custom_sound_duration_ms 四列置 NULL 并把音色回退到内置值；
--   设置行本身始终存在（sound_enabled 仍是有效状态）。故本表不存在
--   「删除后重建撞唯一键」的问题（V6/V19 讨论过的那个坑），唯一键是纯幂等护栏。
--
-- 【无权限点】
--   归属者恒为登录人（user_id 只取自登录态，不存在「替别人设提示音」的入参面），
--   与 V19 对端备注同口径：这类**单方面私有设置**不挂 chat:* / system:* 权限点。
--
-- @see server/at-auth/.../service/SelfNotifySettingService.java（读写与音频校验）
-- @see server/at-auth/.../controller/UserSelfController.java（四个端点）
-- @see server/at-common/.../file/NotificationSoundStoragePort.java（落盘口径与上限常量）
-- @see server/at-common/.../file/AudioTypes.java（容器识别与时长解析）
--
-- 数据影响：仅新增空表，不触碰任何既有表与行。
-- PostgreSQL 差异：本文件为 MySQL 8 方言；`tinyint` / `datetime ... on update CURRENT_TIMESTAMP` /
--   `collate` 为 MySQL 写法。PG 需映射 tinyint → smallint、datetime → timestamp，
--   并把 `on update CURRENT_TIMESTAMP` 换成触发器或应用层赋值（项目已在应用层填 update_time，
--   该子句只是兜底）。EE 若需 PG 版本请另写 V21 的 PG 变体。
-- =====================================================================

create table if not exists sys_user_notify_setting
(
    id                       bigint                             not null comment '雪花 ID' primary key,
    user_id                  bigint                             not null comment '设置归属用户 ID（一人一行，唯一键 uk_user）',
    sound_enabled            tinyint  default 1                 not null comment '新消息提示音总开关：0-关闭 1-开启',
    sound_preset             varchar(32)                        not null default 'default' comment '提示音音色：default-默认 / chime-清脆 / bubble-低沉 / custom-自定义上传',
    custom_sound_name        varchar(128)                       null comment '自定义音频原始文件名（仅回显用；清空自定义音时置 NULL）',
    custom_sound_key         varchar(64)                        null comment '自定义音频存储 key（NotificationSoundStoragePort 的不透明标识，非对外 URL）',
    custom_sound_size        bigint                             null comment '自定义音频字节数（上传时服务端实测快照）',
    custom_sound_duration_ms int                                null comment '自定义音频时长毫秒（上传时服务端由容器头解析的快照）',
    tenant_id                bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by                bigint                             null comment '创建人用户 ID（逻辑关联 sys_user）',
    create_time              datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by                bigint                             null comment '更新人用户 ID（逻辑关联 sys_user）',
    update_time              datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted                  tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除（本表不产生删除行，仅保留公共字段口径）',
    unique key uk_user (user_id)
) comment '用户消息提示音设置（提示音开关 / 音色 / 自定义短音频）' collate = utf8mb4_unicode_ci;
