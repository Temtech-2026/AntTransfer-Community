/**
 * 系统管理域出口（services/system）。
 *
 * <p>对外只需从这里取：数据访问（pageUsers / pageRoles / pageAuditLogs …）、
 * 权限点常量（SYSTEM_PERM）、类型与展示映射（UserVO / RoleVO / userStatusTextId …）。</p>
 *
 * <p>注意：本域类型名（UserVO / RoleVO / PermissionPointVO）与权限域的 MenuNode 等无重名，
 * 但为避免「同名不同义」的隐性耦合，页面统一从 {@code @/services/system} 引入本域类型。</p>
 */

export * from './api';
export * from './endpoints';
export * from './perm';
export * from './types';
