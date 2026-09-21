/**
 * 系统管理域类型定义（前端镜像后端契约，字段逐字符对齐，禁止另起一套命名）。
 *
 * <p>契约来源（全部为 <b>已实现</b> 的接口，不含预置占位）：
 * <ul>
 *   <li>{@code /api/v1/system/users/**} → {@link UserVO} / {@link DeptOptionVO}
 *       （{@code UserVO} / {@code DeptOptionVO} record）。</li>
 *   <li>{@code /api/v1/roles/**} → {@link RoleVO}（{@code RoleVO} record）。</li>
 *   <li>{@code /api/v1/permission-points} → {@link PermissionPointVO}
 *       （{@code PermissionPointVO} record，children 已组装成树）。</li>
 *   <li>{@code /api/v1/audit/logs} → {@link AuditLogVO}（{@code AuditLogVO} record）。</li>
 * </ul>
 *
 * <p>请求体字段名同样逐字符对齐后端 DTO（{@code UserCreateDTO} / {@code RoleCreateDTO}
 * / {@code UserRoleAssignDTO} / {@code RolePermissionAssignDTO} …）——后端用 record 反序列化，
 * 字段名写错会静默变成 null 而不是报错。</p>
 */

// 从具体模块而非 '@/services/access' 桶文件引入：桶文件会连带 api.ts → @/services/request → @umijs/max，
// 使本文件（纯类型 + 纯函数）在单测环境里无法被直接 import。
import { DataScope } from '@/services/access/types';

/* ============================ 用户 ============================ */

/** 用户状态（与后端 {@code UserAdminPort.STATUS_*} 对齐）：0-正常 1-禁用 2-锁定。 */
export const UserStatus = {
  NORMAL: 0,
  DISABLED: 1,
  LOCKED: 2,
} as const;

/** 可由 {@code PATCH /status} 写入的状态子集（后端校验 {@code @Min(0) @Max(1)}，锁定态不可人工写入）。 */
export type WritableUserStatus = 0 | 1;

/** 用户视图：{@code UserVO}（不含口令 / 盐 / token，管理面列表连散列都不该外泄）。 */
export interface UserVO {
  /** 用户主键：19 位雪花 ID，服务端以字符串下发（禁止 `Number()` 归一）。 */
  id: string;
  /** 登录账号。 */
  username: string;
  /** 昵称 / 姓名。 */
  nickname: string;
  email?: string | null;
  mobile?: string | null;
  /** 所属部门 ID（可空 = 未分配）；19 位雪花 ID，字符串下发。 */
  deptId?: string | null;
  /** 部门名称（可空；由部门选项表回填）。 */
  deptName?: string | null;
  /** 0-正常 1-禁用 2-锁定。 */
  status: number;
  /** 受保护账号（禁止停用 / 删除 / 摘除 SUPER_ADMIN）。 */
  protectedUser: boolean;
  lastLoginTime?: string | null;
  createTime?: string | null;
  /** 角色 ID 列表（字符串，与后端 `contentUsing = ToStringSerializer.class` 对齐）。 */
  roleIds?: string[] | null;
  /** 角色编码列表（用于 Tag 呈现，不用于权限判定）。 */
  roleCodes?: string[] | null;
}

/** 部门选项：{@code DeptOptionVO}（打平列表，parentId=0 为根）。 */
export interface DeptOptionVO {
  id: string;
  /** 父部门 ID，0 表示根（字符串 '0'）。 */
  parentId: string;
  name: string;
}

/* ============================ 角色 ============================ */

/** 角色视图：{@code RoleVO}。 */
export interface RoleVO {
  /** 角色主键：19 位雪花 ID，字符串下发。 */
  id: string;
  code: string;
  name: string;
  /** 数据范围：1-本人 2-本部门及以下 3-全部。 */
  dataScope: number;
  /** 是否内置（1-是，禁止删除）。 */
  builtIn: number;
  /** 权限集是否锁定只读（AUDITOR 为 true）。服务端下发，前端不得硬编码角色码判定。 */
  auditorLocked: boolean;
  remark?: string | null;
  createTime?: string | null;
}

/* ============================ 权限点 ============================ */

/** 权限点树节点：{@code PermissionPointVO}。 */
export interface PermissionPointVO {
  id: string;
  permCode: string;
  permName: string;
  /** 维度：1-菜单 2-操作 3-数据范围。 */
  type: number;
  /** 父权限点 ID，0 表示根（字符串 '0'）。 */
  parentId: string;
  sortNo: number;
  children: PermissionPointVO[];
}

/* ============================ 审计 ============================ */

/** 审计日志视图：{@code AuditLogVO}（跨域投影，只读快照）。 */
export interface AuditLogVO {
  id: string;
  /** 操作人用户 ID（匿名 / 系统任务为 null）。 */
  userId?: string | null;
  /** 操作人展示名（反查不到或系统任务为 null）。 */
  operatorName?: string | null;
  /** 动作编码，如 USER_CREATE / APPROVE / FILE_DOWNLOAD。 */
  action: string;
  /** 所属域：AUTH / PERMISSION / TRANSFER / FILE / COLLABORATION / COMMON。 */
  module: string;
  /** 操作对象类型：USER / ROLE / FILE / SHARE / APPLICATION / GRANT / SYSTEM…。 */
  targetType?: string | null;
  targetId?: string | null;
  /** 链路追踪 ID（排障凭证）。 */
  traceId?: string | null;
  ip?: string | null;
  /** 结果：0-成功 1-失败。 */
  result: number;
  /** 审计详情（写入侧已脱敏）。 */
  detail?: string | null;
  /** 审计事件时间（业务时间）。 */
  logTime: string;
}

/* ============================ 查询条件 ============================ */

/** 用户分页查询条件（与 {@code SystemUserController#page} 的查询参数同名）。 */
export interface UserPageQuery {
  /** 账号 / 昵称模糊。 */
  keyword?: string;
  status?: number;
  deptId?: string;
  current?: number;
  pageSize?: number;
}

/** 角色分页查询条件（与 {@code RoleAdminController#page} 的查询参数同名）。 */
export interface RolePageQuery {
  /** 编码 / 名称模糊。 */
  keyword?: string;
  current?: number;
  pageSize?: number;
}

/**
 * 审计检索条件（与 {@code AuditLogQueryDTO} 字段同名）。
 *
 * <p>{@code current} / {@code pageSize} 仅列表接口使用；导出接口忽略二者（服务层固定上限）。</p>
 */
export interface AuditLogQuery {
  /** 操作人用户 ID（后端只提供 ID 精确过滤，不提供按展示名模糊）。 */
  userId?: string;
  /** 动作编码（精确匹配）。 */
  action?: string;
  /** 所属域（精确匹配）。 */
  module?: string;
  targetType?: string;
  targetId?: string;
  /** 结果：0-成功 1-失败。 */
  result?: number;
  /** 事件时间下界（含）。 */
  startTime?: string;
  /** 事件时间上界（含）。 */
  endTime?: string;
  current?: number;
  pageSize?: number;
}

/* ============================ 请求体 ============================ */

/** 创建用户（{@code UserCreateDTO}）。 */
export interface UserCreatePayload {
  /** 3~64 位字母 / 数字 / 下划线 / 点 / 横线。 */
  username: string;
  /** 初始口令（明文，8~64 位）。 */
  password: string;
  nickname: string;
  email?: string;
  mobile?: string;
  /** 所属部门 ID（字符串；后端 Jackson 反序列化为 Long）。 */
  deptId?: string;
  remark?: string;
  /** 初始角色 ID 集合（可空 = 不分配角色）。 */
  roleIds?: string[];
}

/**
 * 编辑用户（{@code UserUpdateDTO}，不含账号名 / 口令 / 状态 / 角色）。
 *
 * <p><b>空值语义（易踩坑）</b>：表主 {@code updateProfile} 用 MyBatis-Plus
 * {@code updateById}，<b>只更新非 null 字段</b>，且入参先过 {@code emptyToNull}。
 * 因此：{@code email}/{@code mobile} 传 {@code undefined} 或 {@code ''} 都等于「不修改」
 * （邮箱无法被清空，这是表主刻意的保守取舍）；而 {@code deptId} 必须<b>显式提交</b>，
 * 传 {@code null} 表示解除部门分配。</p>
 */
export interface UserUpdatePayload {
  nickname: string;
  email?: string;
  mobile?: string;
  /** 与原值不同即视为调岗（服务端会挂权限重评估副作用）；{@code null} = 解除部门分配。 */
  deptId?: string | null;
}

/** 启停用户（{@code UserStatusDTO}）。 */
export interface UserStatusPayload {
  status: WritableUserStatus;
}

/** 重置口令（{@code UserResetPasswordDTO}）。 */
export interface UserResetPasswordPayload {
  newPassword: string;
}

/** 分配角色（{@code UserRoleAssignDTO}，整集替换；后端 {@code @NotEmpty} 要求至少一个）。 */
export interface UserRoleAssignPayload {
  roleIds: string[];
}

/** 创建角色（{@code RoleCreateDTO}）。 */
export interface RoleCreatePayload {
  /** 以大写字母开头，仅含大写字母 / 数字 / 下划线。 */
  code: string;
  name: string;
  dataScope: number;
  remark?: string;
}

/** 编辑角色（{@code RoleUpdateDTO}，刻意不含 code）。 */
export interface RoleUpdatePayload {
  name: string;
  dataScope: number;
  remark?: string;
}

/** 角色授权（{@code RolePermissionAssignDTO}，整集替换；空数组 = 清空）。 */
export interface RolePermissionAssignPayload {
  permissionIds: string[];
}

/* ============================ 纯函数 / 展示映射 ============================ */

/** 用户状态展示文案的 i18n id。 */
export function userStatusTextId(status?: number | null): string {
  switch (status) {
    case UserStatus.NORMAL:
      return 'system.userStatus.normal';
    case UserStatus.DISABLED:
      return 'system.userStatus.disabled';
    case UserStatus.LOCKED:
      return 'system.userStatus.locked';
    default:
      return 'system.userStatus.unknown';
  }
}

/** 用户状态色标（Ant Design Tag color）。 */
export function userStatusColor(status?: number | null): string {
  switch (status) {
    case UserStatus.NORMAL:
      return 'success';
    case UserStatus.DISABLED:
      return 'default';
    case UserStatus.LOCKED:
      return 'warning';
    default:
      return 'default';
  }
}

/** 是否内置角色（1=是）。前端据此禁用「删除」按钮，服务端仍会兜底返回 1020。 */
export function isBuiltInRole(role?: Pick<RoleVO, 'builtIn'> | null): boolean {
  return role?.builtIn === 1;
}

/** 数据范围下拉选项（labelId 为 i18n id；取值来自 {@link DataScope}，与后端 {@code sys_role.data_scope} 一致）。 */
export const DATA_SCOPE_OPTIONS: readonly { labelId: string; value: number }[] = [
  { labelId: 'system.dataScope.self', value: DataScope.SELF },
  { labelId: 'system.dataScope.deptAndSub', value: DataScope.DEPT_AND_SUB },
  { labelId: 'system.dataScope.all', value: DataScope.ALL },
] as const;

/** 数据范围展示文案的 i18n id（未知取值不猜测，渲染侧配 {@code values.scope} 回落为「未知(n)」）。 */
export function dataScopeTextId(scope?: number | null): string {
  const hit = DATA_SCOPE_OPTIONS.find((item) => item.value === scope);
  return hit ? hit.labelId : 'system.dataScope.unknown';
}

/** 权限点维度展示映射：textId 为 i18n id，color 为 Ant Design Tag color。 */
export const PERM_TYPE_META: Readonly<Record<number, { textId: string; color: string }>> = {
  1: { textId: 'system.permType.menu', color: 'blue' },
  2: { textId: 'system.permType.action', color: 'geekblue' },
  3: { textId: 'system.permType.dataScope', color: 'purple' },
};

/** 权限点维度展示文案的 i18n id（未知维度回落为「未知(n)」，渲染侧配 {@code values.type}）。 */
export function permTypeTextId(type?: number | null): string {
  return PERM_TYPE_META[type ?? -1]?.textId ?? 'system.permType.unknown';
}

/** 数据范围色标：全部=red（影响面最大），本部门及以下=orange，本人=blue。 */
export function dataScopeColor(scope?: number | null): string {
  switch (scope) {
    case DataScope.ALL:
      return 'red';
    case DataScope.DEPT_AND_SUB:
      return 'orange';
    case DataScope.SELF:
      return 'blue';
    default:
      return 'default';
  }
}

/** 审计结果展示文案的 i18n id（0-成功 1-失败，其余未知）。 */
export function auditResultTextId(result?: number | null): string {
  if (result === 0) {
    return 'audit.result.success';
  }
  if (result === 1) {
    return 'audit.result.failed';
  }
  return 'audit.result.unknown';
}

/** 审计结果色标。 */
export function auditResultColor(result?: number | null): string {
  if (result === 0) {
    return 'success';
  }
  if (result === 1) {
    return 'error';
  }
  return 'default';
}

/**
 * 操作人兜底展示的 i18n id（{@code operatorName} 非空时无需 id，渲染侧直接用展示名）。
 *
 * <p>后端 {@code operatorName} 为 null 有两种语义：①用户已被注销，反查不到；
 * ②本身就是匿名 / 系统任务（如到期回收、回收站清理）。两者都<b>不是</b>数据缺失，
 * 因此分别展示而不是一律显示「未知」。</p>
 *
 * <p>返回 {@code null} 表示展示名可用，渲染侧直接用 {@code operatorName}；
 * 否则用返回的 id 渲染，其中 {@code audit.operator.deletedUser} 需传 {@code values.userId}。</p>
 */
export function operatorTextId(
  row: Pick<AuditLogVO, 'userId' | 'operatorName'>,
): string | null {
  if (row.operatorName) {
    return null;
  }
  return row.userId ? 'audit.operator.deletedUser' : 'audit.operator.system';
}
