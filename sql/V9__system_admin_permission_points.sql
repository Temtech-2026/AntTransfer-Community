-- =====================================================================
-- V9__system_admin_permission_points.sql — 系统管理面（用户 / 角色）权限点
--
-- 背景：at-permission 承接「系统管理面」——用户 CRUD / 重置密码 / 启停 /
--   分配角色 / 调岗 / 离职，以及角色 CRUD / 分配权限点（不新建 at-system 模块）。
--   功能权限在本项目一律以权限点承载，故新增一组 system:* 原子权限点。
--
-- 基线：依赖 V1（sys_role / sys_permission / sys_role_permission）与 V2（内置角色）。
--   本脚本只增不改：不触碰 V2 已写入的任何行（Flyway 已执行脚本禁止回改）。
--
-- 编码规范：沿用 file:<action> → system:<domain>:<action>；
--   菜单树沿用 type=1 根节点 + type=2 操作点挂菜单之下（parent_id=菜单 id）。
--
-- ---------------------------------------------------------------------
-- 授权口径（本脚本三条红线，回改前请先读这里）
-- ---------------------------------------------------------------------
--   ① 只授予 SUPER_ADMIN。系统管理面是「管理权限的权限」：把 system:user:assign-role
--      或 system:role:assign-perm 授给 DEPT_ADMIN，等于允许其给自己或下属分配任意
--      角色/权限点，即自我提权。若某环境确需下放，必须同时复核服务层的两条防提权
--      红线（见 RoleAdminService / UserAdminService：只能授予自己持有的角色与权限点）。
--   ② AUDITOR 一个 system:* 都不授予。审计员「权限锁定只读」由两处共同保证：
--      本脚本不授 + 服务层拒绝对 AUDITOR 的权限集做任何变更（1021 AUDITOR_PERM_LOCKED）。
--      数据层与服务层双保险，任一层被绕过仍不越权。
--   ③ 用户管理点与角色管理点分离。可以只让人管用户、不让人动角色矩阵（最小权限）：
--      system:user:status（启停/离职）与 system:role:assign-perm（角色授权）是两个点，
--      后者能改变「谁能做什么」，危险性高一档。
--
-- 固定主键：id 为脚本固定小整数（沿用 V2 的 100/101/110..120 段，本脚本取 102/130..144），
--   仅用于脚本间逻辑关联；运行期新行由雪花算法分配大整数主键，不冲突。
--
-- PostgreSQL 差异：本文件为 MySQL 8 方言；末段 `insert ... select` 两库通用。
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 菜单根节点：系统管理（type=1，parent_id=0）
-- ---------------------------------------------------------------------
insert into sys_permission (id, perm_code, perm_name, type, parent_id, sort_no)
values (102, 'system', '系统管理', 1, 0, 3);

-- ---------------------------------------------------------------------
-- 2. 用户管理操作点（type=2，挂 102 之下）
--    与需求一一对应：列表 / 创建 / 编辑（含调岗）/ 重置密码 /
--    启停（含离职）/ 分配角色 / 删除 —— 七个原子点，粒度到「能单独关掉某一类动作」。
--    调岗并入 system:user:update、离职并入 system:user:status：
--    调岗改的是用户资料字段（dept_id），离职的账号侧效果就是停用；
--    两者都不会放大授权（离职只会回收审批类授权），另立权限点只会增加配置负担。
-- ---------------------------------------------------------------------
insert into sys_permission (id, perm_code, perm_name, type, parent_id, sort_no)
values (130, 'system:user:list', '用户查看', 2, 102, 1),
       (131, 'system:user:create', '用户创建', 2, 102, 2),
       (132, 'system:user:update', '用户编辑/调岗', 2, 102, 3),
       (133, 'system:user:reset-password', '重置密码', 2, 102, 4),
       (134, 'system:user:status', '启停/离职', 2, 102, 5),
       (135, 'system:user:assign-role', '分配角色', 2, 102, 6),
       (136, 'system:user:delete', '用户删除', 2, 102, 7);

-- ---------------------------------------------------------------------
-- 3. 角色管理操作点（type=2，挂 102 之下）
-- ---------------------------------------------------------------------
insert into sys_permission (id, perm_code, perm_name, type, parent_id, sort_no)
values (140, 'system:role:list', '角色查看', 2, 102, 11),
       (141, 'system:role:create', '角色创建', 2, 102, 12),
       (142, 'system:role:update', '角色编辑', 2, 102, 13),
       (143, 'system:role:delete', '角色删除', 2, 102, 14),
       (144, 'system:role:assign-perm', '角色授权', 2, 102, 15);

-- ---------------------------------------------------------------------
-- 4. 授权：仅 SUPER_ADMIN 获得全部 system:* 权限点
--    按 perm_code 定位而非硬编码 id，避免与后续脚本的 id 安排强耦合；
--    id 取 100 + permission_id 生成（102→202 … 144→244），
--    与 V2 已占用的 1..27 不重叠。
-- ---------------------------------------------------------------------
insert into sys_role_permission (id, role_id, permission_id)
select 100 + p.id, r.id, p.id
from sys_role r
         join sys_permission p
              on p.perm_code = 'system' or p.perm_code like 'system:%'
where r.code = 'SUPER_ADMIN';
