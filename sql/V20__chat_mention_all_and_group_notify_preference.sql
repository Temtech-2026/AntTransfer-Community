-- =====================================================================
-- V20 群聊提醒口径：@所有人 + 每人对每个群的提醒偏好
--
-- 【为什么需要这一版】
--   ① 群聊里「群主 @ 所有人」是**面向全群**的提及，与「有人 @ 我」的提醒强度不同，
--      用户要求两者可分别开关（口径对齐微信：免打扰开启后，仍可选「有人 @ 我时提醒」
--      「群主 @ 所有人时提醒」）；
--   ② 群聊设置里的「消息免打扰」必须按人存储——它是**我对我自己**的开关，
--      不是群主对全群的规定：群主无法、也不该替别人关掉手机上的提示音。
--
-- 【为什么偏好落在 sys_group_member 行上，而不是 sys_user 或 sys_group】
--   偏好的主体是 (我, 这个群) 这条**成员关系**：既不是账号属性（换个群就该换一套），
--   也不是群属性（群不能替成员决定要不要被提醒）。sys_group_member 正是这条关系的载体，
--   且发送 / 拉取前的成员资格校验本就按 (group_id, user_id) 取这一行
--   （见 ChatService#assertGroupMember），提醒偏好搭同一行读取：
--   一轮查询同时回答「我能不能在这个群发言」与「我要不要被这个群提醒」。
--   落在 sys_group 上会变成「群主替全群设免打扰」；落在 sys_user 上会变成「一个开关管所有群」。
--
-- 【mention_type 与既有 mentioned（V18）的关系】
--   V18 的 mentioned 是**行级布尔**，只回答「这条消息点名了本行接收人没有」。
--   本版新增 mention_type 把「被点名」分成两档：0-无 1-@我 2-@所有人。
--   mentioned **保留且继续维护**（mention_type > 0 时恒写 1），原因有二：
--   ① 会话列表的「提及未读」计数与 idx_session 已建在它上面（V18 口径 ①），
--      改判定条件要动写扩散热表的查询，收益为零；
--   ② 只认 mentioned 的既有消费方（老客户端）不因本版而失明。
--   一句话：mentioned 回答「有没有被点名」，mention_type 回答「被谁点的」——
--   前者是后者的布尔投影，两者在同一行、同一次写入中落库，不存在漂移。
--
-- 【@所有人 的资格：仅群主】
--   CE 只认一个资格（群主），管理员与普通成员都不行——与「移除成员 / 解散群只给群主」
--   同一取舍（见 ChatGroupAbilityVO 注释）：@所有人 会一次性给全体成员推提醒，
--   是**面向全群的打扰权**，比改群名更重。资格由服务端在已知群主的前提下裁决
--   （非群主以 1042 拒），前端只按服务端下发的 ability.canMentionAll 决定入口显隐。
--
-- 【默认值为什么是「免打扰关 + 两类提及提醒开」】
--   存量成员行（含所有已存在的群）取默认值时，行为必须与加这一版**之前完全一致**：
--   以前是「所有消息都提醒」，故 mute_status 默认 0；
--   notify_on_mention / notify_on_mention_all 只在免打扰开启时参与裁决，
--   默认 1 表示「用户主动打开免打扰后，@我的消息默认仍然提醒」——
--   这正是微信的行为：免打扰不是「屏蔽一切」，点名仍然找你。
--
-- 【未新增索引】
--   偏好的读取搭 selectMyGroups 既有的 (me.user_id = ?) 访问路径，不产生新的查询形态；
--   本表是成员关系表（写少读少），加索引只会给每次入群 / 退群增加写开销（同 V18 口径 ④ 的取舍）。
--
-- @see server/at-collaboration/.../service/ChatService.java（send / buildRows 写 mention_type）
-- @see server/at-collaboration/.../service/ChatGroupService.java（updateMyNotifyPreference）
-- @see server/at-collaboration/.../model/entity/GroupMember.java（三个偏好列的实体映射）
--
-- 数据影响：仅新增列，不触碰任何既有行；存量行取默认值（免打扰关、两类提及提醒开）。
-- PostgreSQL 差异：本文件为 MySQL 8 方言；`add column` 的 `comment` 与 `after` 为 MySQL 专有，
--   EE 若需 PG 版本请另写 V20 的 PG 变体（`COMMENT ON COLUMN` + 无 `after` 子句）。
-- =====================================================================

alter table sys_group_member
    add column mute_status tinyint not null default 0
        comment '消息免打扰：0-关闭 1-开启（行级私有，仅影响本行所属成员的提示音与角标口径）',
    add column notify_on_mention tinyint not null default 1
        comment '有人 @ 我时是否提醒：0-不提醒 1-提醒（仅在 mute_status=1 时参与裁决）',
    add column notify_on_mention_all tinyint not null default 1
        comment '群主 @ 所有人时是否提醒：0-不提醒 1-提醒（仅在 mute_status=1 时参与裁决）';

alter table sys_notify_message
    add column mention_type tinyint not null default 0
        comment '提及档位：0-未点名 1-@我 2-@所有人（行级属性；mentioned 为本列的布尔投影，见 V20 口径）'
        after mentioned;
