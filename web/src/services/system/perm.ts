/**
 * 系统管理 / 审计权限点常量（编译期别名，逐字符对齐后端 {@code SystemAdminConstants}）。
 *
 * <p><b>唯一事实源是 SQL 脚本</b>（{@code sql/V2__init_data.sql}、
 * {@code sql/V9__system_admin_permission_points.sql}）——后端那个常量类也只是脚本的编译期别名。
 * 这里再镜像一层，是为了让页面里的按钮显隐写成 {@code can(SYSTEM_PERM.USER_UPDATE)} 而不是
 * 裸字符串，避免某处把 {@code system:user:update} 敲成 {@code sys:user:update} 后
 * 「按钮消失但没人发现」——权限点拼错不会报错，只会静默判定失败。</p>
 *
 * <p>⚠️ 前端显隐只影响体验，<b>不构成安全边界</b>；强制校验在后端 {@code @RequiresPerm}。</p>
 */

/** 系统管理面 / 审计权限点编码。 */
export const SYSTEM_PERM = {
  /**
   * 系统管理菜单根节点（{@code type=1}，{@code id=102}）。
   *
   * <p>V9 的授权语句把它与全部 {@code system:*} 一起只授给 SUPER_ADMIN，
   * 因此它是「能进系统管理面」的最小充分条件。CE 版没有部门 / 群组管理的
   * 原子权限点，那两个只读页就用它做守卫（详见 route-perm.ts 的 note）。</p>
   */
  MENU_ROOT: 'system',

  /** 用户分页 / 详情 / 部门下拉。 */
  USER_LIST: 'system:user:list',
  USER_CREATE: 'system:user:create',
  USER_UPDATE: 'system:user:update',
  USER_STATUS: 'system:user:status',
  USER_RESET_PASSWORD: 'system:user:reset-password',
  USER_ASSIGN_ROLE: 'system:user:assign-role',
  USER_DELETE: 'system:user:delete',

  ROLE_LIST: 'system:role:list',
  ROLE_CREATE: 'system:role:create',
  ROLE_UPDATE: 'system:role:update',
  ROLE_DELETE: 'system:role:delete',
  ROLE_ASSIGN_PERM: 'system:role:assign-perm',

  /** 审计日志只读（查询 + 导出共用；AUDITOR 唯一持有的权限点）。 */
  AUDIT_LOG_READ: 'audit:log:read',
} as const;

/**
 * 防自锁必须保留的最小「管理能力」权限点集合。
 *
 * <p>镜像后端 {@code SystemAdminConstants.SUPER_ADMIN_REQUIRED_PERMS}。
 * 服务层 {@code assertSuperAdminKeepsControl} 会拒绝对 SUPER_ADMIN 角色
 * 移除这三点（1022 ADMIN_SELF_LOCKOUT）；前端在授权抽屉里把对应节点置灰，
 * 让管理员<b>提前看到</b>而不是提交后才吃错误码。</p>
 */
export const SUPER_ADMIN_REQUIRED_PERMS: readonly string[] = [
  SYSTEM_PERM.ROLE_ASSIGN_PERM,
  SYSTEM_PERM.USER_LIST,
  SYSTEM_PERM.USER_ASSIGN_ROLE,
] as const;

/**
 * 单页条数上界。
 *
 * <p>镜像后端 {@code SystemAdminConstants.MAX_PAGE_SIZE = 100}：后端会把超限的
 * {@code pageSize} 静默收敛到 100，若前端分页器仍按用户选的 500 计算总页数，
 * 就会出现「第 2 页空白」的假象，故前端自己也收敛。</p>
 */
export const SYSTEM_MAX_PAGE_SIZE = 100;
