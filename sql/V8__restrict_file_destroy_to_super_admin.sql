-- =====================================================================
-- AntTransfer CE — V8：收敛 file:destroy 至「仅超级管理员」
--
-- 背景：彻底销毁（不可逆、绕过回收站、物理删除）的对外口径是
--   「仅超级管理员可执行，且高敏感文件必须关联一张已通过的高敏感审批单」。
--   该口径由两段拼成：
--     ① 超管身份 —— RBAC 的 file:destroy 权限点（本脚本收敛）；
--     ② 审批单   —— at-file 经 at-common 的 SensitiveDestroyApprovalPort SPI 校验
--                   （仅 level>=3 的高敏感文件强制，见 FileNodeService#destroy）。
--
-- 【为什么要在数据层删授权，而不是只靠服务层判断角色】
--   V2 当初把 116(file:destroy) 同时授给了 SUPER_ADMIN 与 DEPT_ADMIN，V2 原文注释也写着
--   「仅内置管理角色分配」。若只依赖「服务层识别超管」，at-file 就必须跨模块读取角色数据，
--   直接违反模块边界铁律；而权限点本就是这个系统表达「谁能做什么」的正规载体。
--   故收敛动作落在数据层：DEPT_ADMIN 不再持有该点，@RequiresPerm("file:destroy") 即等价于「仅超管」。
--
-- 【影响面（破坏性授权变更）】
--   · 部门管理员将无法再执行彻底销毁，需要时只能由超管操作；
--   · 前端须同步隐藏/禁用销毁入口（见 docs/development/frontend-permission-map.md）；
--   · 审批单链路不变——审批单解决的是「同一动作在高敏感文件上需二次背书」，
--     与「谁有资格发起」是相互独立的与关系。
--
-- 注意：只删授权行，不动 sys_role / sys_permission 本身（超管仍持有）；
--       以 code 而非硬编码 ID 定位，避免与 V2 固定 ID 强耦合。
-- =====================================================================

delete
from sys_role_permission
where role_id = (select id from sys_role where code = 'DEPT_ADMIN')
  and permission_id = (select id from sys_permission where perm_code = 'file:destroy');
