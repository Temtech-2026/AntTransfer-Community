/**
 * 审计检索用的枚举字典（镜像后端常量，不新增取值）。
 *
 * <p><b>来源</b>：{@code at-common/.../audit/OperationLog.java} 的 {@code ACTION_*} /
 * {@code MODULE_*} / {@code TARGET_*} 常量，以及 {@code AuditLogVO#result} 的
 * 「0-成功 1-失败」。{@code sys_operation_log.action} 在 DDL 里是 {@code varchar(64)}
 * <b>无枚举约束</b>，所以这里只作为「检索下拉的候选集」：命中字典就显示对应文案，
 * 命中不了就原样显示编码（见 {@link actionTextId}），绝不因字典缺项而把数据藏起来。</p>
 *
 * <p><b>为什么只存 i18n id</b>：本文件是纯常量表，不能内嵌语言文案，否则英文界面会漏出中文。
 * 真正的文案在 `locales/{zh-CN,en-US}/audit.ts`，由页面用 {@code useIntl()} 渲染。</p>
 */

/** 审计动作选项（label 只存 i18n id，文案由页面渲染）。 */
export interface AuditActionOption {
  labelId: string;
  value: string;
}

/** 审计动作分组选项（供带搜索的分组下拉使用）。 */
export interface AuditActionGroup {
  labelId: string;
  options: readonly AuditActionOption[];
}

/** 审计动作分组选项（供带搜索的分组下拉使用）。 */
export const AUDIT_ACTION_GROUPS: readonly AuditActionGroup[] = [
  {
    labelId: 'audit.actionGroup.file',
    options: [
      { labelId: 'audit.action.FILE_UPLOAD', value: 'FILE_UPLOAD' },
      { labelId: 'audit.action.FILE_DOWNLOAD', value: 'FILE_DOWNLOAD' },
      { labelId: 'audit.action.FILE_PREVIEW', value: 'FILE_PREVIEW' },
      { labelId: 'audit.action.FILE_RENAME', value: 'FILE_RENAME' },
      { labelId: 'audit.action.FILE_MOVE', value: 'FILE_MOVE' },
      { labelId: 'audit.action.FILE_COPY', value: 'FILE_COPY' },
      { labelId: 'audit.action.FILE_DELETE', value: 'FILE_DELETE' },
      { labelId: 'audit.action.FILE_RESTORE', value: 'FILE_RESTORE' },
      { labelId: 'audit.action.FILE_DESTROY', value: 'FILE_DESTROY' },
      { labelId: 'audit.action.RECYCLE_PURGE', value: 'RECYCLE_PURGE' },
      { labelId: 'audit.action.FILE_TICKET_ISSUE', value: 'FILE_TICKET_ISSUE' },
      { labelId: 'audit.action.FOLDER_CREATE', value: 'FOLDER_CREATE' },
      { labelId: 'audit.action.FOLDER_RENAME', value: 'FOLDER_RENAME' },
      { labelId: 'audit.action.FOLDER_MOVE', value: 'FOLDER_MOVE' },
      { labelId: 'audit.action.FOLDER_DELETE', value: 'FOLDER_DELETE' },
      { labelId: 'audit.action.FILE_TAG', value: 'FILE_TAG' },
      { labelId: 'audit.action.VERSION_ROLLBACK', value: 'VERSION_ROLLBACK' },
      { labelId: 'audit.action.VERSION_CREATE', value: 'VERSION_CREATE' },
      { labelId: 'audit.action.VERSION_PRUNE', value: 'VERSION_PRUNE' },
      { labelId: 'audit.action.PACK_CREATE', value: 'PACK_CREATE' },
      { labelId: 'audit.action.PACK_DOWNLOAD', value: 'PACK_DOWNLOAD' },
    ],
  },
  {
    labelId: 'audit.actionGroup.share',
    options: [
      { labelId: 'audit.action.SHARE_CREATE', value: 'SHARE_CREATE' },
      { labelId: 'audit.action.SHARE_REVOKE', value: 'SHARE_REVOKE' },
      { labelId: 'audit.action.SHARE_DOWNLOAD', value: 'SHARE_DOWNLOAD' },
      { labelId: 'audit.action.SHARE_PREVIEW', value: 'SHARE_PREVIEW' },
      { labelId: 'audit.action.SHARE_BLOCKED', value: 'SHARE_BLOCKED' },
      { labelId: 'audit.action.SHARE_CODE_LOCKED', value: 'SHARE_CODE_LOCKED' },
    ],
  },
  {
    labelId: 'audit.actionGroup.userRole',
    options: [
      { labelId: 'audit.action.USER_CREATE', value: 'USER_CREATE' },
      { labelId: 'audit.action.USER_UPDATE', value: 'USER_UPDATE' },
      { labelId: 'audit.action.USER_DELETE', value: 'USER_DELETE' },
      { labelId: 'audit.action.USER_STATUS', value: 'USER_STATUS' },
      { labelId: 'audit.action.USER_PASSWORD_RESET', value: 'USER_PASSWORD_RESET' },
      { labelId: 'audit.action.USER_ROLE_ASSIGN', value: 'USER_ROLE_ASSIGN' },
      { labelId: 'audit.action.ROLE_CREATE', value: 'ROLE_CREATE' },
      { labelId: 'audit.action.ROLE_UPDATE', value: 'ROLE_UPDATE' },
      { labelId: 'audit.action.ROLE_DELETE', value: 'ROLE_DELETE' },
      { labelId: 'audit.action.ROLE_PERM_ASSIGN', value: 'ROLE_PERM_ASSIGN' },
    ],
  },
  {
    labelId: 'audit.actionGroup.approval',
    options: [
      { labelId: 'audit.action.APPLY', value: 'APPLY' },
      { labelId: 'audit.action.APPROVE', value: 'APPROVE' },
      { labelId: 'audit.action.REJECT', value: 'REJECT' },
      { labelId: 'audit.action.TRANSFER', value: 'TRANSFER' },
      { labelId: 'audit.action.GRANT', value: 'GRANT' },
      { labelId: 'audit.action.REVOKE', value: 'REVOKE' },
      { labelId: 'audit.action.GRANT_EXPIRE', value: 'GRANT_EXPIRE' },
    ],
  },
];

/** 动作编码 → i18n id（由 {@link AUDIT_ACTION_GROUPS} 展开，避免两处手写不同步）。 */
export const AUDIT_ACTION_LABEL_IDS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    AUDIT_ACTION_GROUPS.flatMap((group) =>
      group.options.map((option) => [option.value, option.labelId] as const),
    ),
  ),
);

/**
 * 动作编码 → 文案 id：命中字典返回 i18n id，未命中返回 null（调用方原样显示编码）。
 *
 * <p>返回 null 而不是兜底成某个中文，是为了让「字典缺项」显式暴露在调用方，
 * 而不是悄悄显示一句错误的「未知」。</p>
 */
export function actionTextId(action?: string | null): string | null {
  if (!action) {
    return null;
  }
  return AUDIT_ACTION_LABEL_IDS[action] ?? null;
}

/**
 * 所属域（{@code OperationLog.MODULE_*} + V1 约定的六域全集）。
 *
 * <p>模块常量里只定义了 FILE / PERMISSION / AUTH 三个，但 V1 表注释把域全集定为
 * AUTH / PERMISSION / TRANSFER / FILE / COLLABORATION / COMMON，故按<b>六域全集</b>给候选，
 * 否则审计员无法筛选传输 / 协作域的历史记录。</p>
 */
export const AUDIT_MODULE_ENUM: Readonly<
  Record<string, { labelId: string; status: 'Default' | 'Success' | 'Processing' | 'Error' | 'Warning' }>
> = {
  AUTH: { labelId: 'audit.module.AUTH', status: 'Processing' },
  PERMISSION: { labelId: 'audit.module.PERMISSION', status: 'Warning' },
  TRANSFER: { labelId: 'audit.module.TRANSFER', status: 'Success' },
  FILE: { labelId: 'audit.module.FILE', status: 'Default' },
  COLLABORATION: { labelId: 'audit.module.COLLABORATION', status: 'Processing' },
  COMMON: { labelId: 'audit.module.COMMON', status: 'Default' },
};

/** 结果（{@code OperationLog.RESULT_*}）。 */
export const AUDIT_RESULT_ENUM: Readonly<
  Record<string, { labelId: string; status: 'Success' | 'Error' }>
> = {
  '0': { labelId: 'audit.result.success', status: 'Success' },
  '1': { labelId: 'audit.result.failed', status: 'Error' },
};

/** 操作对象类型（{@code OperationLog.TARGET_*}）。 */
export const AUDIT_TARGET_TYPE_OPTIONS: readonly AuditActionOption[] = [
  { labelId: 'audit.target.SHARE', value: 'SHARE' },
  { labelId: 'audit.target.FILE', value: 'FILE' },
  { labelId: 'audit.target.FOLDER', value: 'FOLDER' },
  { labelId: 'audit.target.TAG', value: 'TAG' },
  { labelId: 'audit.target.PACK_TASK', value: 'PACK_TASK' },
  { labelId: 'audit.target.USER', value: 'USER' },
  { labelId: 'audit.target.ROLE', value: 'ROLE' },
  { labelId: 'audit.target.PERMISSION', value: 'PERMISSION' },
  { labelId: 'audit.target.APPLICATION', value: 'APPLICATION' },
  { labelId: 'audit.target.GRANT', value: 'GRANT' },
  { labelId: 'audit.target.SYSTEM', value: 'SYSTEM' },
];
