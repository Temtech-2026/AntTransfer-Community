-- =====================================================================
-- V15__chat_message_recall_quote.sql — 会话消息「撤回」与「引用回复」
--
-- 背景：会话消息此前是「发出去就改不了、也没法针对某条说话」：
--   发错人 / 发错内容只能补一句「上面那条作废」，别人问「你是说哪句」也无从指认。
--   本次为消息表补两组列：撤回状态（含撤回时间）与引用快照，
--   对应 POST /v1/chat/messages/recall 与 ChatSendDTO.quoteClientMsgId。
--
-- 基线：依赖 V1（sys_notify_message 建表）、V5（会话列 + uk_sender_recipient_client
--   + idx_session）、V13（idx_sender_session）。本脚本只增不改：
--   不触碰既有列、不改既有索引（Flyway 已执行脚本禁止回改）。
--
-- ---------------------------------------------------------------------
-- 设计口径（回改前请先读这里）
-- ---------------------------------------------------------------------
--   ① 撤回是「整条逻辑消息」的动作，不是「某一行」的动作。
--      写扩散下一条消息落 N 行（单聊 2 行、群聊 N 行），各行 id 不同、单聊的
--      chat_target_id 还互指对端。但同一逻辑消息的所有行共享同一个
--      (sender_user_id, client_msg_id)，故撤回按这两列批量置位——
--      按 id 撤只会撤掉自己那一行，对方那一行原样留着（表现为「我撤了，他还能看到」）。
--      本脚本据此新增 idx_sender_client 支撑该批量更新。
--
--   ② recall_status 必须独立成列，不能靠「content 清空」表达撤回。
--      空正文是合法状态（文件 / 审批类消息的展示文案可为空），若以空串判定撤回，
--      会把正常消息渲染成「已撤回」。content 仍然要清空（否则接口层仍能读到原文，
--      撤回就只剩前端不显示），两件事一起做、由两列各表其一。
--
--   ③ 引用存「快照」而不是「外键」。
--      quote_client_msg_id 指向被引用消息的幂等键（不是行 id——写扩散下接收方视角
--      的行 id 与发送方不同，拿行 id 在对方那里根本匹配不上），
--      并冗余 quote_sender_user_id / quote_content 两项展示所需的最小信息。
--      冗余的理由：被引用消息可能随后被撤回（content 被清空），若不冗余快照，
--      引用块会在几秒钟后集体变成空白，用户看到的是「引用了一条空消息」。
--
--   ④ 撤回窗口（2 分钟）不落库、不建列：它是服务端的判定规则，不是数据事实。
--      窗口值在 ChatService.RECALL_WINDOW 一处定义，这里不复制一份，
--      避免「改了代码忘了改注释」这类只在超时边界才暴露的偏差。
--
-- PostgreSQL 差异：本文件为 MySQL 8 方言；两库差异仅在 `comment` 与
--   `add column` 语法上，EE 若需 PG 版本请另写 V15 的 PG 变体。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 撤回状态列
--    recall_status：0-正常 1-已撤回（默认 0，历史行自动成为「正常」）
--    recall_time  ：撤回发生时刻；未撤回为 NULL
-- ---------------------------------------------------------------------
alter table sys_notify_message
    add column recall_status tinyint     not null default 0 comment '撤回状态：0-正常 1-已撤回',
    add column recall_time   datetime    null comment '撤回时间（未撤回为 NULL）';

-- ---------------------------------------------------------------------
-- 2. 引用快照列
--    quote_client_msg_id  ：被引用消息的幂等键（跨行、跨端唯一的逻辑消息标识）
--    quote_sender_user_id ：被引用消息的发送人（引用块里「谁说的」）
--    quote_content        ：被引用消息正文快照（列宽 200，服务端写入前按码点截断）
-- ---------------------------------------------------------------------
alter table sys_notify_message
    add column quote_client_msg_id  varchar(64)  null comment '引用的消息幂等键（客户端消息 ID）',
    add column quote_sender_user_id bigint       null comment '被引用消息的发送人用户 ID',
    add column quote_content        varchar(200) null comment '被引用消息内容快照（服务端截断）';

-- ---------------------------------------------------------------------
-- 3. 撤回定位索引
--    支撑 `where sender_user_id = ? and client_msg_id = ?` 的批量置位（口径 ①）。
--    与 V13 的 idx_sender_session 的区别：那条索引第四列才是 client_msg_id，
--    在 sender 消息量大的会话里只能吃到首列前缀；本索引两列等值直达。
--    索引偏窄（bigint + varchar(64)），对写扩散这张热表的写入开销影响可控。
-- ---------------------------------------------------------------------
create index idx_sender_client on sys_notify_message (sender_user_id, client_msg_id);
