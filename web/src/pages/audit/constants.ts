/**
 * 审计检索用的枚举字典（镜像后端常量，不新增取值）。
 *
 * <p><b>来源</b>：{@code at-common/.../audit/OperationLog.java} 的 {@code ACTION_*} /
 * {@code MODULE_*} / {@code TARGET_*} 常量，以及 {@code AuditLogVO#result} 的
 * 「0-成功 1-失败」。{@code sys_operation_log.action} 在 DDL 里是 {@code varchar(64)}
 * <b>无枚举约束</b>，所以这里只作为「检索下拉的候选集」：命中字典就显示中文，
 * 命中不了就原样显示编码（见 {@link actionText}），绝不因字典缺项而把数据藏起来。</p>
 */

/** 审计动作分组选项（供带搜索的分组下拉使用）。 */
export const AUDIT_ACTION_GROUPS: readonly {
  label: string;
  options: readonly { label: string; value: string }[];
}[] = [
  {
    label: '文件与目录',
    options: [
      { label: '上传文件', value: 'FILE_UPLOAD' },
      { label: '下载文件', value: 'FILE_DOWNLOAD' },
      { label: '预览文件', value: 'FILE_PREVIEW' },
      { label: '重命名文件', value: 'FILE_RENAME' },
      { label: '移动文件', value: 'FILE_MOVE' },
      { label: '复制文件', value: 'FILE_COPY' },
      { label: '移入回收站', value: 'FILE_DELETE' },
      { label: '回收站还原', value: 'FILE_RESTORE' },
      { label: '彻底销毁', value: 'FILE_DESTROY' },
      { label: '回收站到期清理', value: 'RECYCLE_PURGE' },
      { label: '下载票据签发', value: 'FILE_TICKET_ISSUE' },
      { label: '新建目录', value: 'FOLDER_CREATE' },
      { label: '重命名目录', value: 'FOLDER_RENAME' },
      { label: '移动目录', value: 'FOLDER_MOVE' },
      { label: '删除目录', value: 'FOLDER_DELETE' },
      { label: '打 / 取消标签', value: 'FILE_TAG' },
      { label: '回滚历史版本', value: 'VERSION_ROLLBACK' },
      { label: '上传新版本', value: 'VERSION_CREATE' },
      { label: '版本裁剪', value: 'VERSION_PRUNE' },
      { label: '发起批量打包', value: 'PACK_CREATE' },
      { label: '下载打包产物', value: 'PACK_DOWNLOAD' },
    ],
  },
  {
    label: '外发分享',
    options: [
      { label: '创建分享', value: 'SHARE_CREATE' },
      { label: '撤销分享', value: 'SHARE_REVOKE' },
      { label: '访客下载', value: 'SHARE_DOWNLOAD' },
      { label: '访客预览', value: 'SHARE_PREVIEW' },
      { label: '外发拦截', value: 'SHARE_BLOCKED' },
      { label: '提取码锁定', value: 'SHARE_CODE_LOCKED' },
    ],
  },
  {
    label: '用户与角色',
    options: [
      { label: '创建用户', value: 'USER_CREATE' },
      { label: '修改用户', value: 'USER_UPDATE' },
      { label: '删除用户', value: 'USER_DELETE' },
      { label: '启停用户', value: 'USER_STATUS' },
      { label: '重置口令', value: 'USER_PASSWORD_RESET' },
      { label: '变更用户角色', value: 'USER_ROLE_ASSIGN' },
      { label: '创建角色', value: 'ROLE_CREATE' },
      { label: '修改角色', value: 'ROLE_UPDATE' },
      { label: '删除角色', value: 'ROLE_DELETE' },
      { label: '角色授权调整', value: 'ROLE_PERM_ASSIGN' },
    ],
  },
  {
    label: '审批与授权',
    options: [
      { label: '提交申请', value: 'APPLY' },
      { label: '审批通过', value: 'APPROVE' },
      { label: '审批驳回', value: 'REJECT' },
      { label: '审批转审', value: 'TRANSFER' },
      { label: '授权落地', value: 'GRANT' },
      { label: '授权回收', value: 'REVOKE' },
      { label: '授权到期回收', value: 'GRANT_EXPIRE' },
    ],
  },
];

/** 动作编码 → 中文（由 {@link AUDIT_ACTION_GROUPS} 展开，避免两处手写不同步）。 */
export const AUDIT_ACTION_LABELS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    AUDIT_ACTION_GROUPS.flatMap((group) =>
      group.options.map((option) => [option.value, option.label] as const),
    ),
  ),
);

/** 动作编码 → 展示文案：命中字典显示中文，未命中原样显示编码。 */
export function actionText(action?: string | null): string {
  if (!action) {
    return '--';
  }
  return AUDIT_ACTION_LABELS[action] ?? action;
}

/**
 * 所属域（{@code OperationLog.MODULE_*} + V1 约定的六域全集）。
 *
 * <p>模块常量里只定义了 FILE / PERMISSION / AUTH 三个，但 V1 表注释把域全集定为
 * AUTH / PERMISSION / TRANSFER / FILE / COLLABORATION / COMMON，故按<b>六域全集</b>给候选，
 * 否则审计员无法筛选传输 / 协作域的历史记录。</p>
 */
export const AUDIT_MODULE_ENUM: Readonly<
  Record<string, { text: string; status: 'Default' | 'Success' | 'Processing' | 'Error' | 'Warning' }>
> = {
  AUTH: { text: '认证', status: 'Processing' },
  PERMISSION: { text: '权限与系统管理', status: 'Warning' },
  TRANSFER: { text: '传输', status: 'Success' },
  FILE: { text: '文件', status: 'Default' },
  COLLABORATION: { text: '协作', status: 'Processing' },
  COMMON: { text: '公共', status: 'Default' },
};

/** 结果（{@code OperationLog.RESULT_*}）。 */
export const AUDIT_RESULT_ENUM: Readonly<
  Record<string, { text: string; status: 'Success' | 'Error' }>
> = {
  '0': { text: '成功', status: 'Success' },
  '1': { text: '失败', status: 'Error' },
};

/** 操作对象类型（{@code OperationLog.TARGET_*}）。 */
export const AUDIT_TARGET_TYPE_OPTIONS: readonly { label: string; value: string }[] = [
  { label: '外发链接', value: 'SHARE' },
  { label: '文件条目', value: 'FILE' },
  { label: '目录', value: 'FOLDER' },
  { label: '标签', value: 'TAG' },
  { label: '打包任务', value: 'PACK_TASK' },
  { label: '用户账号', value: 'USER' },
  { label: '角色', value: 'ROLE' },
  { label: '权限点', value: 'PERMISSION' },
  { label: '权限申请单', value: 'APPLICATION' },
  { label: '授权记录', value: 'GRANT' },
  { label: '系统任务', value: 'SYSTEM' },
];
