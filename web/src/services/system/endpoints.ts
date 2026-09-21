/**
 * 系统管理域端点表。
 *
 * <p><b>来源</b>：{@code at-permission} 模块的
 * {@code SystemUserController} / {@code RoleAdminController} /
 * {@code PermissionPointController} / {@code AuditLogController}
 * 四个控制器。此处<b>不新增、不改写</b>任何路径 —— 前缀与子路径逐字对齐后端
 * {@code @RequestMapping}。</p>
 *
 * <p><b>只读边界</b>：CE 版 {@code sys_dept} / {@code sys_group} / {@code sys_permission}
 * 没有对应的管理控制器（只有 {@code sys_permission} 的只读树查询），
 * 因此本域<b>不提供</b>部门 / 群组 / 菜单的增删改端点。相关页面只能读取现有只读接口，
 * 不得用模拟数据补齐（见 docs/architecture/architecture.md 冻结口径）。</p>
 */
export const SYSTEM_ENDPOINTS = {
  /** 用户分页（system:user:list）。 */
  users: '/api/v1/system/users',
  /** 用户详情（system:user:list）。 */
  userDetail: (id: string) => `/api/v1/system/users/${id}`,
  /** 调岗目标部门下拉：全部启用部门打平（system:user:list|create|update）。 */
  userDeptOptions: '/api/v1/system/users/dept-options',
  /** 可分配角色下拉（system:user:assign-role）。 */
  userRoleOptions: '/api/v1/system/users/role-options',
  /** 启停用户（system:user:update）。 */
  userStatus: (id: string) => `/api/v1/system/users/${id}/status`,
  /** 重置口令（system:user:reset-password）。 */
  userResetPassword: (id: string) => `/api/v1/system/users/${id}/reset-password`,
  /** 分配角色（system:user:assign-role）。 */
  userRoles: (id: string) => `/api/v1/system/users/${id}/roles`,

  /** 角色分页（system:role:list）。 */
  roles: '/api/v1/roles',
  /** 角色下拉（system:role:list）。 */
  roleOptions: '/api/v1/roles/options',
  /** 角色详情（system:role:list）。 */
  roleDetail: (id: string) => `/api/v1/roles/${id}`,
  /** 角色已授权限点 ID 列表（system:role:list）/ 授权（system:role:assign-perm）。 */
  rolePermissions: (id: string) => `/api/v1/roles/${id}/permissions`,
  /** 权限点树（持 system:role:list 或 system:role:assign-perm 任一）。 */
  permissionPoints: '/api/v1/permission-points',

  /** 审计日志分页（audit:log:read；「仅审计员可见」，后端强制锁定用户）。 */
  auditLogs: '/api/v1/audit/logs',
  /** 审计日志导出 CSV（audit:log:read，最多 10000 行）。 */
  auditLogsExport: '/api/v1/audit/logs/export',
} as const;
