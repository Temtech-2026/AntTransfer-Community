-- =====================================================================
-- V19 会话对端备注：单方面私有的「我给这个人起的名字」
--
-- 【为什么需要这张表】
--   会话列表与聊天标题里对方的名字，现在唯一来源是 sys_user 的昵称（经 UserLookupPort
--   下发）。但「我怎么称呼某个人」是**私有**的：「张伟（财务）」在别人眼里仍然是「张伟」，
--   而且我改了这个名字不该让所有看到的人都跟着变——昵称是账号的全局事实，不该由个人偏好去改。
--   本表把「我给某个人起的名字」与「这个人的真实昵称」分开存：只影响设备注的人自己，
--   对方无感知、也无从查询（表里只存在 owner 视角的行，没有「谁备注了我」这种读法）。
--
-- 【为什么不落在 sys_user 上】
--   昵称是账号属性，备注是 (我, 他) 这条关系的属性。落在账号上就变成「我改备注 →
--   所有人的界面都变」——那是在改别人的数据；且一人对多人的备注本就是多值关系，
--   塞不进账号表的单列。
--
-- 【为什么不复用联系人 / 好友表】
--   CE 没有好友关系：私聊是「按账号搜索 → 直接发起」，任何人可对任何人发消息，
--   不存在「先加好友」这道门（见 ChatService.resolvePrivateTarget）。当前也没有任何
--   联系人表。为这个不成立的前提建一张关系表，等于把「必须有好友关系」这个假约束
--   写进后续所有代码。
--
-- 【唯一键为什么不带 deleted；「取消备注」为什么是复活而不是新增】
--   uk_owner_peer 保证 (我, 他) 只有一行。取消备注置 deleted=1（与公共字段口径一致，
--   不物理删除）；再次设置备注时**复活那一行**（自定义 UPDATE 显式置 deleted=0），
--   因此永远不会出现第二行，「删除 → 重建 → 再删除」循环里唯一键始终成立。
--   这与 V6/V12 文件域「不建唯一索引」的裁决并不冲突：那两张表的重建会产生**新行**，
--   于是两行 deleted=1 会撞键；本表的重建是复用同一行。
--   由此唯一键成为纯幂等护栏：连点保存 / 网络重发不会插出重复备注。
--
-- @see server/at-collaboration/.../service/ChatService.java（setPeerAlias / clearPeerAlias）
-- =====================================================================

create table if not exists sys_chat_peer_alias
(
    id            bigint                             not null comment '雪花 ID' primary key,
    owner_user_id bigint                             not null comment '备注归属者用户 ID（备注只对他自己可见）',
    peer_user_id  bigint                             not null comment '被备注的用户 ID（单聊对端）',
    alias         varchar(64)                        not null comment '备注名（展示优先级：备注 > 昵称 > 账号）',
    tenant_id     bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by     bigint                             null comment '创建人用户 ID（逻辑关联 sys_user）',
    create_time   datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by     bigint                             null comment '更新人用户 ID（逻辑关联 sys_user）',
    update_time   datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted       tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除（取消备注；再次设置会复活本行）',
    unique key uk_owner_peer (owner_user_id, peer_user_id)
) comment '会话对端备注（单方面私有：我给他起的名字，对方不可见）' collate = utf8mb4_unicode_ci;
