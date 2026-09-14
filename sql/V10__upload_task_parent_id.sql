-- =====================================================================
-- AntTransfer CE — V10：sys_upload_task 补 parent_id（分片上传的目标目录）
--
-- 背景：预检（POST /v1/transfers/precheck）的请求体携带 parentId（前端字段名，
--   见 web/src/pages/file/index.tsx 的 precheckExtra），用于指定文件落库目录；
--   合并（POST /v1/transfers/{uploadId}/merge）时须把该目录透传给 at-file
--   （FileIngestPort → FileIngestCommand.folderId），否则从子目录发起的分片上传
--   会把文件落到根目录。V1 建 sys_upload_task 时未预留该列，故此处增列。
--
-- 口径：
--   1. 脚本只增不改：本脚本不修改 V1，历史库经 Flyway 增量补列；
--   2. parent_id = 0 表示根目录（与 sys_file_node.parent_id 语义一致）；
--   3. 进行中任务的复用判定（同用户 + 同 SHA-256 + 同大小 + 同目录）依赖本列，
--      否则「同一内容传到不同目录」会错误复用同一份暂存任务，最终只有一个目录拿到文件；
--   4. 列可空性：not null + default 0，存量行自动落为根目录，与旧行为（落根）一致。
-- =====================================================================

alter table sys_upload_task
    add column parent_id bigint not null default 0 comment '目标目录 ID（0=根目录；预检上报，合并落库时作为 folderId 透传 at-file）'
    after file_name;
