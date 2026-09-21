/**
 * 系统管理域数据访问（services/system 的唯一出口实现）。
 *
 * <p>统一走 {@link import('@/services/request')} 的 {@code get/post/put/patch/del/requestPage}：
 * 解包 {@code Result.data}、失败抛 {@code BizError}、分页自动兜底空页。
 * 全局 {@code requestErrorConfig} 已经负责「弹提示 / 1002 静默刷新 / 1001 跳登录」，
 * 因此本文件<b>不重复</b>这些横切逻辑，只在需要按 code 分支时让调用方 catch {@code BizError}。</p>
 *
 * <p><b>白名单原则</b>：本文件只封装 {@code SYSTEM_ENDPOINTS} 中登记过的、后端已实现的端点。
 * CE 版没有部门 / 群组 / 菜单的增删改控制器，故此处不提供对应写操作。</p>
 */

import {
  del,
  downloadBinary,
  get,
  patch,
  post,
  put,
  requestPage,
  saveBlob,
} from '@/services/request';

import { SYSTEM_ENDPOINTS } from './endpoints';
import type {
  AuditLogQuery,
  AuditLogVO,
  DeptOptionVO,
  PermissionPointVO,
  RoleCreatePayload,
  RolePageQuery,
  RolePermissionAssignPayload,
  RoleUpdatePayload,
  RoleVO,
  UserCreatePayload,
  UserPageQuery,
  UserResetPasswordPayload,
  UserRoleAssignPayload,
  UserUpdatePayload,
  UserVO,
  WritableUserStatus,
} from './types';

/* ============================ 内部工具 ============================ */

/**
 * 去除空值查询参数。
 *
 * <p>不发送 {@code keyword=} 这类空串：后端 {@code @RequestParam(required=false)} 收到空串会
 * 进入「模糊匹配 %%」分支，语义上等价于不过滤，但会白白多走一次索引扫描。</p>
 */
function compact(params: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    result[key] = value;
  }
  return result;
}

/** 把无 children 的权限点补齐为 {@code children: []}，避免渲染层到处判空。 */
export function normalizePermissionPointTree(
  nodes?: readonly PermissionPointVO[] | null,
): PermissionPointVO[] {
  if (!Array.isArray(nodes)) {
    return [];
  }
  return nodes.map((node) => ({
    ...node,
    children: normalizePermissionPointTree(node.children),
  }));
}

/* ============================ 用户 ============================ */

/** 用户分页（需 {@code system:user:list}）。 */
export function pageUsers(query: UserPageQuery = {}) {
  return requestPage<UserVO>(SYSTEM_ENDPOINTS.users, { params: compact({ ...query }) });
}

/** 用户详情（需 {@code system:user:list}）。 */
export function getUser(id: string) {
  return get<UserVO>(SYSTEM_ENDPOINTS.userDetail(id));
}

/** 部门选项（打平列表；需 user:list / create / update 任一）。 */
export function fetchDeptOptions() {
  return get<DeptOptionVO[]>(SYSTEM_ENDPOINTS.userDeptOptions);
}

/** 可分配角色下拉（需 {@code system:user:assign-role}）。 */
export function fetchUserRoleOptions() {
  return get<RoleVO[]>(SYSTEM_ENDPOINTS.userRoleOptions);
}

/** 创建用户（需 {@code system:user:create}）。 */
export function createUser(payload: UserCreatePayload) {
  return post<UserVO>(SYSTEM_ENDPOINTS.users, payload);
}

/** 编辑用户资料 / 调岗（需 {@code system:user:update}）。 */
export function updateUser(id: string, payload: UserUpdatePayload) {
  return put<UserVO>(SYSTEM_ENDPOINTS.userDetail(id), payload);
}

/** 启用 / 停用（需 {@code system:user:status}；停用会使在途会话立即失效）。 */
export function changeUserStatus(id: string, status: WritableUserStatus) {
  return patch<void>(SYSTEM_ENDPOINTS.userStatus(id), { status });
}

/** 管理员重置口令（需 {@code system:user:reset-password}；禁止对自己调用）。 */
export function resetUserPassword(id: string, newPassword: string) {
  const payload: UserResetPasswordPayload = { newPassword };
  return post<void>(SYSTEM_ENDPOINTS.userResetPassword(id), payload);
}

/** 分配角色（需 {@code system:user:assign-role}；整集替换，且禁止对自己调用）。 */
export function assignUserRoles(id: string, roleIds: string[]) {
  const payload: UserRoleAssignPayload = { roleIds };
  return put<void>(SYSTEM_ENDPOINTS.userRoles(id), payload);
}

/** 删除用户（需 {@code system:user:delete}）。 */
export function deleteUser(id: string) {
  return del<void>(SYSTEM_ENDPOINTS.userDetail(id));
}

/* ============================ 角色 ============================ */

/** 角色分页（需 {@code system:role:list}）。 */
export function pageRoles(query: RolePageQuery = {}) {
  return requestPage<RoleVO>(SYSTEM_ENDPOINTS.roles, { params: compact({ ...query }) });
}

/** 全部角色下拉（需 role:list 或 user:assign-role 任一）。 */
export function fetchRoleOptions() {
  return get<RoleVO[]>(SYSTEM_ENDPOINTS.roleOptions);
}

/** 角色详情（需 {@code system:role:list}）。 */
export function getRole(id: string) {
  return get<RoleVO>(SYSTEM_ENDPOINTS.roleDetail(id));
}

/** 创建角色（需 {@code system:role:create}）。 */
export function createRole(payload: RoleCreatePayload) {
  return post<RoleVO>(SYSTEM_ENDPOINTS.roles, payload);
}

/** 编辑角色（需 {@code system:role:update}；不含 code，内置角色改 dataScope 会被拒 1020）。 */
export function updateRole(id: string, payload: RoleUpdatePayload) {
  return put<RoleVO>(SYSTEM_ENDPOINTS.roleDetail(id), payload);
}

/** 删除角色（需 {@code system:role:delete}；内置角色 / 已分配用户会被拒）。 */
export function deleteRole(id: string) {
  return del<void>(SYSTEM_ENDPOINTS.roleDetail(id));
}

/** 角色已授权限点 ID 列表（需 {@code system:role:list}）。 */
export function fetchRolePermissionIds(id: string) {
  // 后端在该响应里同样把 ID 字符串化（裸 List<Long>，控制器边界转换），与权限点树节点 id 同一值空间。
  return get<string[]>(SYSTEM_ENDPOINTS.rolePermissions(id));
}

/** 角色授权（需 {@code system:role:assign-perm}；整集替换，空数组 = 清空）。 */
export function assignRolePermissions(id: string, permissionIds: string[]) {
  const payload: RolePermissionAssignPayload = { permissionIds };
  return put<void>(SYSTEM_ENDPOINTS.rolePermissions(id), payload);
}

/** 权限点树（需 role:list 或 role:assign-perm 任一；children 已组装）。 */
export async function fetchPermissionPointTree() {
  const tree = await get<PermissionPointVO[]>(SYSTEM_ENDPOINTS.permissionPoints);
  return normalizePermissionPointTree(tree);
}

/* ============================ 审计 ============================ */

/** 审计日志分页（需 {@code audit:log:read}；后端同时强制「仅审计员可见」）。 */
export function pageAuditLogs(query: AuditLogQuery = {}) {
  return requestPage<AuditLogVO>(SYSTEM_ENDPOINTS.auditLogs, { params: compact({ ...query }) });
}

/**
 * 审计导出允许透传的过滤键。
 *
 * <p>刻意用<b>白名单</b>而不是「把整个 query 铺开再删两字段」：
 * {@code current} / {@code pageSize} 对导出无意义（服务层用固定上限），
 * 白名单能保证以后往 {@link AuditLogQuery} 加分页无关字段时，不会误把分页参数带进导出。</p>
 */
const AUDIT_FILTER_KEYS = [
  'userId',
  'action',
  'module',
  'targetType',
  'targetId',
  'result',
  'startTime',
  'endTime',
] as const;

/**
 * 拼接审计导出 URL（与列表共用同一套过滤，避免「列表能筛、导出筛不了」）。
 */
export function buildAuditExportUrl(query: AuditLogQuery = {}): string {
  const search = new URLSearchParams();
  for (const key of AUDIT_FILTER_KEYS) {
    const value = query[key];
    if (value === undefined || value === null || value === '') {
      continue;
    }
    search.set(key, String(value));
  }
  const queryString = search.toString();
  return queryString
    ? `${SYSTEM_ENDPOINTS.auditLogsExport}?${queryString}`
    : SYSTEM_ENDPOINTS.auditLogsExport;
}

/** 本地时间戳（用于导出文件名；不含时区后缀，避免文件名里出现冒号）。 */
function timestampSuffix(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

/**
 * 导出审计日志 CSV 并触发浏览器保存。
 *
 * <p>下载失败时后端返回的是 JSON {@code Result}（Content-Type 为 json），
 * {@code downloadBinary} 已按 Content-Type 自动分支解析，不会把错误页当成文件保存。</p>
 *
 * @returns 是否真正触发了保存（非浏览器环境 / 单测下为 false）
 */
export async function exportAuditLogs(query: AuditLogQuery = {}): Promise<boolean> {
  const blob = await downloadBinary(buildAuditExportUrl(query));
  return saveBlob(blob, `audit-logs-${timestampSuffix()}.csv`);
}
