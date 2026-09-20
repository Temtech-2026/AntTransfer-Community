/** 审计日志文案。 */
export default {
  /* ============================ 页面骨架 ============================ */
  'audit.page.title': 'Audit Log',
  'audit.page.subTitle': 'Read-only search (write side is masked)',

  /* ============================ 无权限 ============================ */
  'audit.denied.title': 'Auditors only',
  'audit.denied.subTitle':
    'This page requires the audit:log:read permission, which is granted only to the auditor role.',

  /* ============================ 检索口径提示 ============================ */
  'audit.criteria.title': 'Search scope',
  'audit.criteria.operatorPrefix': 'Operators can only be matched by ',
  'audit.criteria.operatorStrong': 'exact user ID',
  'audit.criteria.operatorSuffix':
    ' (the backend does not support fuzzy matching by display name); ',
  'audit.criteria.timePrefix':
    'The time range is inclusive and filtered by event time (',
  'audit.criteria.timeSuffix': '); ',
  'audit.criteria.export':
    'Export reuses the current filters; the upper limit is enforced by the server.',

  /* ============================ 工具栏与提示 ============================ */
  'audit.toolbar.export': 'Export CSV',
  'audit.export.success': 'Export download started',

  /* ============================ 筛选器 ============================ */
  'audit.filter.all': 'All',
  'audit.filter.allActions': 'All actions',

  /* ============================ 列 ============================ */
  'audit.column.logTime': 'Time',
  'audit.column.timeRange': 'Time range',
  'audit.column.timeRangeStart': 'From (inclusive)',
  'audit.column.endTime': 'End time',
  'audit.column.timeRangeEnd': 'To (inclusive)',
  'audit.column.operator': 'Operator',
  'audit.column.operatorIdPlaceholder': 'User ID (exact match)',
  'audit.column.action': 'Action type',
  'audit.column.module': 'Module',
  'audit.column.targetType': 'Target type',
  'audit.column.target': 'Target',
  'audit.column.result': 'Result',
  'audit.column.ip': 'IP',
  'audit.column.traceId': 'Trace ID',
  'audit.column.detail': 'Detail',

  /* ============================ 结果 ============================ */
  'audit.result.success': 'Success',
  'audit.result.failed': 'Failed',
  'audit.result.unknown': 'Unknown',

  /* ============================ 操作人兜底 ============================ */
  'audit.operator.deletedUser': 'Deleted user #{userId}',
  'audit.operator.system': 'System / anonymous',

  /* ============================ 动作分组 ============================ */
  'audit.actionGroup.file': 'Files and folders',
  'audit.actionGroup.share': 'External share',
  'audit.actionGroup.userRole': 'Users and roles',
  'audit.actionGroup.approval': 'Approval and grants',

  /* ============================ 动作名（镜像后端常量） ============================ */
  'audit.action.FILE_UPLOAD': 'Upload file',
  'audit.action.FILE_DOWNLOAD': 'Download file',
  'audit.action.FILE_PREVIEW': 'Preview file',
  'audit.action.FILE_RENAME': 'Rename file',
  'audit.action.FILE_MOVE': 'Move file',
  'audit.action.FILE_COPY': 'Copy file',
  'audit.action.FILE_DELETE': 'Move to recycle bin',
  'audit.action.FILE_RESTORE': 'Restore from recycle bin',
  'audit.action.FILE_DESTROY': 'Destroy permanently',
  'audit.action.RECYCLE_PURGE': 'Recycle bin expiry purge',
  'audit.action.FILE_TICKET_ISSUE': 'Issue download ticket',
  'audit.action.FOLDER_CREATE': 'Create folder',
  'audit.action.FOLDER_RENAME': 'Rename folder',
  'audit.action.FOLDER_MOVE': 'Move folder',
  'audit.action.FOLDER_DELETE': 'Delete folder',
  'audit.action.FILE_TAG': 'Add / remove tag',
  'audit.action.VERSION_ROLLBACK': 'Roll back version',
  'audit.action.VERSION_CREATE': 'Upload new version',
  'audit.action.VERSION_PRUNE': 'Prune versions',
  'audit.action.PACK_CREATE': 'Start batch packaging',
  'audit.action.PACK_DOWNLOAD': 'Download package',
  'audit.action.SHARE_CREATE': 'Create share',
  'audit.action.SHARE_REVOKE': 'Revoke share',
  'audit.action.SHARE_DOWNLOAD': 'Visitor download',
  'audit.action.SHARE_PREVIEW': 'Visitor preview',
  'audit.action.SHARE_BLOCKED': 'External share blocked',
  'audit.action.SHARE_CODE_LOCKED': 'Extract code locked',
  'audit.action.USER_CREATE': 'Create user',
  'audit.action.USER_UPDATE': 'Update user',
  'audit.action.USER_DELETE': 'Delete user',
  'audit.action.USER_STATUS': 'Enable / disable user',
  'audit.action.USER_PASSWORD_RESET': 'Reset password',
  'audit.action.USER_ROLE_ASSIGN': 'Change user roles',
  'audit.action.ROLE_CREATE': 'Create role',
  'audit.action.ROLE_UPDATE': 'Update role',
  'audit.action.ROLE_DELETE': 'Delete role',
  'audit.action.ROLE_PERM_ASSIGN': 'Adjust role permissions',
  'audit.action.APPLY': 'Submit application',
  'audit.action.APPROVE': 'Approve',
  'audit.action.REJECT': 'Reject',
  'audit.action.TRANSFER': 'Transfer approval',
  'audit.action.GRANT': 'Grant',
  'audit.action.REVOKE': 'Revoke grant',
  'audit.action.GRANT_EXPIRE': 'Grant expiry revocation',

  /* ============================ 所属域 ============================ */
  'audit.module.AUTH': 'Authentication',
  'audit.module.PERMISSION': 'Permissions and system',
  'audit.module.TRANSFER': 'Transfer',
  'audit.module.FILE': 'Files',
  'audit.module.COLLABORATION': 'Collaboration',
  'audit.module.COMMON': 'Common',

  /* ============================ 操作对象类型 ============================ */
  'audit.target.SHARE': 'External link',
  'audit.target.FILE': 'File entry',
  'audit.target.FOLDER': 'Folder',
  'audit.target.TAG': 'Tag',
  'audit.target.PACK_TASK': 'Packaging task',
  'audit.target.USER': 'User account',
  'audit.target.ROLE': 'Role',
  'audit.target.PERMISSION': 'Permission point',
  'audit.target.APPLICATION': 'Permission application',
  'audit.target.GRANT': 'Grant record',
  'audit.target.SYSTEM': 'System task',
} as const;
