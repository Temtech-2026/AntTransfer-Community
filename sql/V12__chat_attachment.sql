-- =====================================================================
-- V12 会话文件附件：聊天消息携带附件 + 发送方用途限制
--
-- 【为什么必须新增 sys_chat_attachment，而不是复用 sys_share_link】
--   sys_share_link 的语义是「对**站外匿名访客**外发」：提取码 + 锁定 + 一次性票据，
--   面向「我不知道对方是谁」。会话附件的语义是「对**已知的某个同事**授权取件」：
--   接收方身份由会话关系确定（本期单聊，receiver_user_id 即单聊对端），无提取码、
--   无匿名入口，取件者恒为登录态且必须是发送方指定的那个人。
--   两者共享「有效期 + 次数上限 + 撤销」的形状，但访问主体、凭据形态与审计口径都不同，
--   合并会让「匿名访客」与「登录同事」两条风控线互相污染。
--
-- 【模块归属：为什么落 at-file 而不是 at-collaboration】
--   与 AT-DIFF-06（外发分享落 at-file）同一裁决路径：本表每次判定都强依赖
--   ① 文件是否存在/可读（sys_file_node + sys_file）② 条目归属（FileOwnershipGuard）
--   ③ 存储抽象取流 ④ 审计。落 at-file 可让「授权校验 + 用途档位 + 次数扣减 + 取流 + 审计」
--   在同一模块内闭环；落在 at-collaboration 则每一环都要跨模块读。
--   按 architecture.md §1.2「业务模块互不依赖，只能经 SPI 依赖倒置」，这是唯一不引入
--   新跨模块契约的落点。会话侧只带一个附件 ID（正文尾注 #att:{id}），零反向依赖。
--
-- 【用途限制三轴（正交，累进）】
--   usage_mode     用途档位：1 仅预览 < 2 可下载 < 3 可转发转存（累进单选，缺省 2）
--   expire_at      有效期：null=不限期；否则到点即失效（判定优先级最高）
--   download_limit 下载次数上限：0=不限；>0 时按 DB 原子 UPDATE 扣减，防超卖
--   撤销（status=1）是发送方的绝对否决，高于以上三者；已失效（status=2）是终态。
--
--   档位语义边界：
--     1 仅预览   取件端点只发 inline（且仅限可安全内联的类型），拒绝 attachment 下载，不计次
--     2 可下载   允许 inline + attachment，attachment 计入 download_count
--     3 可转发转存 同 2，且额外允许接收方把该文件「保存到我的文件」（转存为一个自己的新条目）
--   注意：档位是**发送方**对附件用途的约束，不是**接收方**的 RBAC 替代品。
--   接收方在自己空间里创建数据的能力（转存）仍受限于其自身权限点，两把锁是「与」关系。
--
-- 【downloaded_count 的并发口径（勿串抄外发分享）】
--   放行唯一裁决是 DB 原子 UPDATE（download_count < download_limit 时 +1 并返回影响行数），
--   与 sys_share_link 同口径（见 V1 注释与 RedisKeyConstants 的 at:share:count 说明）。
--   禁止「先查后写」：并发请求会同时读到未超限的旧值，把「限 1 次」卖成 N 次。
--
-- 【不做逻辑删除，因此保留唯一键】
--   V6 文件域为避免「删除 → 重建 → 再删除」让两条 deleted=1 的行撞键，统一不建唯一索引。
--   本表**从不置 deleted=1**：撤销是 status=1 的状态位（需要留痕且可被接收方看到「已撤销」），
--   到期是按 expire_at 判定。既然不存在已删除行占位，唯一键就是纯粹的幂等护栏：
--   uk_sender_client_msg 保证发送方重发（网络重试 / 用户连点）不会重复建授权，
--   client_msg_key 为 null 时不参与唯一判定（MySQL 唯一索引不对含 NULL 的行做重复判定）。
--
-- @see server/at-file/.../service/ChatAttachmentService.java
-- @see docs/development/AT-DIFF-todos.md（群聊附件免申请取件的延期登记）
-- =====================================================================

create table if not exists sys_chat_attachment
(
    id               bigint                             not null comment '雪花 ID' primary key,
    node_id          bigint                             not null comment '文件条目 ID（逻辑关联 sys_file_node.id）',
    file_id          bigint                             not null comment '物理文件 ID（逻辑关联 sys_file.id，冗余自条目以省一次联表）',
    sender_user_id   bigint                             not null comment '发送方（授权人）用户 ID',
    receiver_user_id bigint                             not null comment '接收方用户 ID（本期仅单聊：即单聊对端；群聊待 SPI 落地）',
    file_name        varchar(255)                       not null comment '发送时文件名快照（源文件改名不影响已发出的卡片）',
    size_bytes       bigint                             not null comment '发送时文件大小快照（字节）',
    usage_mode       tinyint                            not null default 2 comment '用途档位：1-仅预览 2-可下载 3-可转发转存（累进单选）',
    expire_at        datetime                           null comment '授权过期时间（null=不限期）',
    download_limit   int                                not null default 0 comment '下载次数上限（0=不限）',
    download_count   int                                not null default 0 comment '已下载次数（DB 原子累加，防超卖）',
    status           tinyint                            not null default 0 comment '状态：0-生效 1-已撤销（发送方的绝对否决）2-已失效（过期/达上限，终态）',
    client_msg_key   varchar(64)                        null comment '发送方消息幂等键（重发不重复建授权；null 不参与唯一判定）',
    tenant_id        bigint                             not null default 0 comment '租户 ID（预留，CE 恒为 0）',
    create_by        bigint                             null comment '创建人用户 ID',
    create_time      datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_by        bigint                             null comment '更新人用户 ID',
    update_time      datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间',
    deleted          tinyint  default 0                 not null comment '逻辑删除：0-未删除 1-已删除（本表恒为 0，撤销走 status=2）',
    unique key uk_sender_client_msg (sender_user_id, client_msg_key),
    key idx_sender (sender_user_id, status, create_time),
    key idx_receiver (receiver_user_id, status, create_time),
    key idx_node (node_id),
    key idx_file (file_id)
) comment '会话文件附件授权（发送方设定用途档位 / 有效期 / 次数，接收方免申请取件）' collate = utf8mb4_unicode_ci;
