-- =====================================================================
-- AntTransfer CE — V11：sys_notify_message.title 放宽为可空
--
-- 背景：V5 已把 sys_notify_message 由「系统通知专用」扩展为「系统通知 + 会话
--   消息（IM）」双语义，补的 5 列全部可空，但**漏掉了 V1 遗留的 title**——
--   它仍是 not null 且无默认值。会话消息侧根本没有标题：投递入口
--   ChatSendDTO（POST /v1/chat/messages）没有 title 入参，ChatService 落行时
--   也不写该列；MyBatis-Plus 默认跳过 null 字段，INSERT 语句里**不出现** title，
--   MySQL 严格模式随即报
--   `Field 'title' doesn't have a default value` → 发送单聊/群聊 HTTP 500。
--
--   注：该缺陷此前被「ID 过线为数字被 JS 舍入」掩盖——会话 targetId 先被判为
--   「目标用户不存在或不可用」(1013)，请求根本走不到落库这一步。
--
-- 口径：
--   1. 只放宽 nullable，不动类型与长度（varchar(128)），存量行不受影响；
--   2. 系统通知侧行为不变：NotificationDispatcher 一律显式写入标题，
--      与 V5「新增列全可空、存量系统通知行为完全不变」的既有口径一致；
--   3. 不改写 V1 原文（Flyway checksum），仅追加结构变更。
--
-- 基线：依赖 V1（建表）与 V5（双语义扩展）。
-- ---------------------------------------------------------------------

alter table sys_notify_message
    modify column title varchar(128) null comment '通知标题（系统通知必填；会话消息为 null，正文见 content）';
