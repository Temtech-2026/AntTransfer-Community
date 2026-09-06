-- =====================================================================
-- V2__init_data.sql — AntTransfer CE 初始化数据（Flyway 版本化脚本 V2）
--
-- 基线：依赖 V1（2026-09-06 二次重置，sys_ 前缀 16 表完整表族）。
-- 本脚本写入「只应出现一次」的枚举型主数据：
--   1. 内置角色 SUPER_ADMIN / AUDITOR / DEPT_ADMIN / USER（sys_role 表）；
--   2. 权限点全量枚举：文件域菜单树 + 七个原子文件权限点 + 审计只读点
--      （sys_permission 表，含菜单父级树形结构）；
--   3. 角色-权限点静态授权（sys_role_permission 表）；
--   4. 初始化管理员账号 admin + 绑定 SUPER_ADMIN（sys_user / sys_user_role 表）。
--
-- 设计口径（与 at-common / V1 / system-design §3.2 对齐）：
--   1. 固定主键说明：角色 / 权限点 / 管理员的 id 为脚本固定小整数，仅用于初始化
--      数据间的逻辑关联；业务运行期新插入行由 MyBatis-Plus 雪花算法（ASSIGN_ID）
--      分配大整数主键，与固定 id 不冲突；
--   2. 内置角色禁止删除（built_in=1），后续如需调整角色-权限点关系，追加新版本
--      脚本（如 V3__permission_tuning.sql），禁止回改本脚本；
--   3. admin 为「初始化账号」：默认口令与改密红线见下方「初始账号」约定，admin 不可删除；
--   4. PostgreSQL 差异：本文件为 MySQL 8 方言；INSERT/多值语法两库通用。sys_ 前缀
--      表名已避开 user/role/share 等两库保留字，无转义写法差异。
--
-- 初始账号（安全红线，对应 docs/SECURITY.md / PRD §认证与 system-design 审计基线）：
--   - 默认口令 Admin@123，password_hash 为 BCrypt cost=10 真实密文（INSERT 时已自校验
--     与明文等价；框架侧用 BCryptPasswordEncoder 直接可登录）；
--   - 首次登录务必修改口令（改密后旧密文立即失效、refresh 令牌全端吊销）；
--     生产部署前必须改密——禁止以默认口令发布（复制配置即上线场景，见 red-team [D-04]）；
--   - 手工改密（新 BCrypt cost=10）参考命令：
--       a) htpasswd -bnBC 10 "" '<新口令>' | tr -d ':\n'
--       b) python -c "import bcrypt;print(bcrypt.hashpw(b'<新口令>',bcrypt.gensalt(10)).decode())"
--     落地：UPDATE sys_user SET password_hash='<上一步输出>' WHERE username='admin';
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 内置角色（sys_role）
--    data_scope：1-本人 2-本部门及以下 3-全部（对应 PRD US-04 数据范围三维度）
-- ---------------------------------------------------------------------
insert into sys_role (id, code, name, data_scope, built_in, remark)
values (1, 'SUPER_ADMIN', '超级管理员', 3, 1, '内置：全部管理域 + 文件域全权限；不可删除'),
       (2, 'AUDITOR', '审计员', 3, 1, '内置：仅审计日志只读权限点 audit:log:read；任何写操作被权限点拒绝'),
       (3, 'DEPT_ADMIN', '部门管理员', 2, 1, '内置：本部门及以下数据范围的文件域管理；不可删除'),
       (4, 'USER', '普通用户', 1, 1, '内置默认业务角色：本人数据范围内常规文件操作（不含 file:destroy）');

-- ---------------------------------------------------------------------
-- 2. 权限点与菜单树（sys_permission）
--    type：1-菜单 2-操作/按钮 3-数据范围（预留）
--    parent_id：0=根；菜单（type=1）成树，操作点挂所属菜单之下（parent_id=菜单 id）
-- ---------------------------------------------------------------------

-- 2.1 菜单根节点（type=1；操作点挂菜单之下，树形结构）
insert into sys_permission (id, perm_code, perm_name, type, parent_id, sort_no)
values -- 文件域菜单根：文件上传/下载/分享等操作入口
       (100, 'file', '文件', 1, 0, 1),
       -- 日志审计菜单：仅内置审计/超管角色可见（挂 audit:log:read）
       (101, 'audit', '审计日志', 1, 0, 2);

-- 2.2 七个原子文件权限点（type=2，挂 file 菜单 100 下；编码规范 file:<action>）
insert into sys_permission (id, perm_code, perm_name, type, parent_id, sort_no)
values -- 在线预览（图片/PDF/文本等渲染）
       (110, 'file:preview', '文件预览', 2, 100, 1),
       -- 下载文件内容
       (111, 'file:download', '下载', 2, 100, 2),
       -- 上传新文件 / sha256 秒传命中
       (112, 'file:upload', '上传/秒传', 2, 100, 3),
       -- 在线编辑 / 重命名 / 移动（协作场景）
       (113, 'file:edit', '编辑/重命名', 2, 100, 4),
       -- 创建外发链接（sys_share_link 表通道）
       (114, 'file:share', '外发分享', 2, 100, 5),
       -- 查看/回滚历史版本
       (115, 'file:version', '版本管理', 2, 100, 6),
       -- 高危操作：删除并销毁物理文件（回收站之上的最终删除）；仅内置管理角色分配
       (116, 'file:destroy', '删除/销毁', 2, 100, 7);

-- 2.3 审计只读权限点（type=2，挂 audit 菜单 101 下；只读查询审计/登录日志，AUDITOR 唯一权限点）
insert into sys_permission (id, perm_code, perm_name, type, parent_id, sort_no)
values (120, 'audit:log:read', '审计日志只读', 2, 101, 1);

-- ---------------------------------------------------------------------
-- 3. 角色-权限点静态授权（sys_role_permission）
-- ---------------------------------------------------------------------
insert into sys_role_permission (id, role_id, permission_id)
values -- SUPER_ADMIN（1）：全部菜单 + 七个文件操作 + 审计只读
       (1, 1, 100), (2, 1, 101), (3, 1, 110), (4, 1, 111), (5, 1, 112),
       (6, 1, 113), (7, 1, 114), (8, 1, 115), (9, 1, 116), (10, 1, 120),
       -- AUDITOR（2）：仅审计菜单 + audit:log:read（审计员只有日志只读权限点）
       (11, 2, 101), (12, 2, 120),
       -- DEPT_ADMIN（3）：文件菜单 + 七个文件操作（数据范围本部门及以下，不含审计）
       (13, 3, 100), (14, 3, 110), (15, 3, 111), (16, 3, 112), (17, 3, 113),
       (18, 3, 114), (19, 3, 115), (20, 3, 116),
       -- USER（4）：文件菜单 + 常规操作（不含高危 file:destroy）
       (21, 4, 100), (22, 4, 110), (23, 4, 111), (24, 4, 112), (25, 4, 113),
       (26, 4, 114), (27, 4, 115);

-- ---------------------------------------------------------------------
-- 4. 初始化管理员 admin（sys_user / sys_user_role）
-- ---------------------------------------------------------------------
insert into sys_user
    (id, username, password_hash, nickname, remark, tenant_id, status)
values (1, 'admin', '$2a$10$0jf1qJCfrCZjCiFLVCa47euNdiww0bEWmXuza5h9kLM9quTU8zXqu',
        '系统管理员',
        '初始化账号：默认口令 Admin@123（BCrypt cost=10，见文件头「初始账号」），首次登录务必改密；生产部署前必须改密，禁止以默认口令运行',
        0, 0);

insert into sys_user_role (id, user_id, role_id)
values (1, 1, 1);
