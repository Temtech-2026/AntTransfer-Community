-- =====================================================================
-- AntTransfer CE — V3：sys_user 增列 token_epoch（会话吊销纪元）
--
-- 背景：at-auth 双令牌会话（system-design §2.1~2.3）采用
-- 「DB 权威纪元 + Redis 缓存/白名单 + JWT 无状态验签」混合模型：
--   - 登录签发 access token 时把当前 token_epoch 写入 JWT `ver` claim；
--   - 全端吊销（改密 / 登出 / 停用禁用 / refresh 重放打击）在同一事务内
--     token_epoch = token_epoch + 1，使全部已签发 access/refresh 即刻失效；
--   - Redis 侧（at:token:access:{userId} / at:token:refresh:{userId}）仅作
--     缓存与白名单加速，丢失可回源 DB 自愈（P-8），吊销正确性不依赖 Redis。
--
-- 注意：本脚本只增列，不改写既有行为；已执行过旧版 V1~V2 的库可增量执行。
-- =====================================================================

alter table sys_user
    add column token_epoch bigint not null default 0 comment '会话吊销纪元：全端吊销 +1，access token 携带 ver claim 与之比对（见 system-design §2.3）'
    after remark;
