-- =====================================================================
-- V5__collaboration_im_notify.sql — 协作 IM / 通知增量（Flyway 版本化脚本 V5）
--
-- 目标：让 sys_notify_message 从「只能承载系统通知」扩展为「系统通知 + 会话消息」双语义，
--       并补上会话消息的幂等约束与按会话查询的索引。
--
-- 背景：V1 建表时按「站内 / 离线消息」定位，只有 recipient_user_id 一个归属维度，
--   notify_type 注释也仅列 1~5（系统通知）。US-08 的待办中心与 IM 需求落地后需要：
--     1. 记录「谁发的」（sender_user_id）与「消息体类型」（message_type），
--        否则前端无法区分消息方向与渲染方式（文本气泡 / 文件卡片 / 审批结果卡片）；
--     2. 记录会话定位维度（chat_scope / chat_target_id），否则「按会话拉历史」必须回表
--        JOIN 会话表——而写扩散（fan-out on write，一条消息按参与人各落一行）后，
--        会话查询本就可以退化为单表等值查询；
--     3. 幂等键（client_msg_id），否则移动端弱网重发 / HTTP 重试会导致重复消息，
--        且在弱网下极难复现定位。
--
-- 设计口径：
--   a) 全部为**可空新增列**，存量系统通知数据天然满足
--      （sender/chat_*/client_msg_id 全为 NULL，message_type 随默认值 0=非会话）；
--   b) message_type 取值：0-非会话（系统通知） 1-文本 2-文件传输 3-审批结果；
--   c) 会话消息采用**写扩散**：单聊落 2 行（双方各一行、chat_target_id 互指对端），
--      群聊落 N 行（每成员一行、chat_target_id 均为 group_id）。
--      代价是群成员越多写放大越大；CE 群规模有限，属可接受权衡
--      （EE 若引入万人群应改「读扩散 + 会话已读游标」，届时本表结构无需再改）。
--      → 因此 **chat_scope + chat_target_id 不是「会话 ID」，而是「接收人视角的会话定位」**，
--        单聊的同一个会话在双方各自的 2 行里 target 值互为对端，这是有意为之：
--        只有这样才能用 (recipient, scope, target) 一次等值查询取到某人的完整双向记录。
--
-- ⚠️ 与 V1 的关系：V1 为已发布脚本，按 sql/README.md「已执行脚本禁止修改（Flyway checksum）」
--   **不做回改**；本脚本通过 MODIFY COLUMN 更新 notify_type 的注释口径，
--   使 DB 内注释与 NotifyType 编码表一致（注释即该字段的权威口径说明）。
--
-- ⚠️ 本脚本只改表结构，不消费数据；实体 / Mapper 由 at-collaboration 接管
--   （四层归位见 architecture.md §1.4）。
--
-- PostgreSQL 差异：本文件为 MySQL 8 方言。`ADD COLUMN ... AFTER` / `MODIFY COLUMN` 均为
--   MySQL 专有；PG 需改为逐条 `ALTER TABLE ... ADD COLUMN`（可省略列序）+
--   `COMMENT ON COLUMN ...`（PG 无列注释内联语法）。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. sys_notify_message：补会话消息维度（全部可空，存量数据行为不变）
-- ---------------------------------------------------------------------
alter table sys_notify_message
    add column sender_user_id bigint      null comment '发送人用户 ID（系统通知为 null；会话消息为真实发送人，用于前端区分消息方向）' after recipient_user_id,
    add column message_type   tinyint     not null default 0 comment '消息体类型：0-非会话（系统通知） 1-文本 2-文件传输 3-审批结果' after notify_type,
    add column chat_scope     tinyint     null comment '会话范围：1-单聊 2-群聊（系统通知为 null）' after message_type,
    add column chat_target_id bigint      null comment '会话目标（接收人视角）：单聊=对端用户 ID；群聊=群组 ID（系统通知为 null）' after chat_scope,
    add column client_msg_id  varchar(64) null comment '客户端消息 ID（会话消息幂等键，重发须沿用同一值；系统通知为 null）' after chat_target_id;

-- ---------------------------------------------------------------------
-- 2. notify_type 注释口径更新：纳入 6~8
--    1~5 为 US-08 白名单（系统通知，进导航栏红点）；
--    6~7 为会话消息（单聊 / 群聊，进会话角标，**不计入**导航栏纯提醒红点）；
--    8 为传输完成提醒（P1，进待办中心）。
--    注：本列语义以 at-common NotifyType 编码表为准，此处同步注释以便 DBA / 排障直接看表。
-- ---------------------------------------------------------------------
alter table sys_notify_message
    modify column notify_type tinyint not null comment '通知类型：1-审批待办 2-审批结果 3-外发链接锁定 4-链接到期提醒 5-异常登录告警 6-单聊消息 7-群聊消息 8-传输完成提醒（编码表见 at-common NotifyType）';

-- ---------------------------------------------------------------------
-- 3. 索引
--    idx_session：会话历史 / 会话角标的查询维度 (recipient, scope, target) + id 游标，
--                 支持「按会话倒序翻页」走索引且避免回表排序。
--                 为什么不复用 V1 的 idx_user_read：那是以 read_status 为第二列的
--                 未读扫描索引，按 (scope, target) 过滤时无法连续定位，翻页会退化为全扫。
--    uk_sender_recipient_client：会话消息幂等键。
--                 必须带 recipient_user_id：群聊一条消息按成员各落一行、共享同一
--                 client_msg_id，若只按 (sender, client_msg_id) 唯一，群聊第 2 个成员就写不进去。
--                 系统通知三列均为 NULL，MySQL 唯一索引对含 NULL 的行不做重复判定，故互不影响。
-- ---------------------------------------------------------------------
alter table sys_notify_message
    add key idx_session (recipient_user_id, chat_scope, chat_target_id, id),
    add unique key uk_sender_recipient_client (sender_user_id, recipient_user_id, client_msg_id);
