/** 审计日志文案。 */
export default {
  /* ============================ 页面骨架 ============================ */
  'audit.page.title': '审计日志',
  'audit.page.subTitle': '只读检索（写入侧已脱敏）',

  /* ============================ 无权限 ============================ */
  'audit.denied.title': '仅审计员可访问',
  'audit.denied.subTitle':
    '本页需要 audit:log:read 权限点，该权限点只授予审计员角色。',

  /* ============================ 检索口径提示 ============================ */
  'audit.criteria.title': '检索口径',
  'audit.criteria.operatorPrefix': '操作人只支持按',
  'audit.criteria.operatorStrong': '用户 ID 精确匹配',
  'audit.criteria.operatorSuffix': '（后端不提供按展示名模糊）；',
  'audit.criteria.timePrefix': '时间区间为闭区间，按事件时间（',
  'audit.criteria.timeSuffix': '）过滤；',
  'audit.criteria.export': '导出沿用当前检索条件，上限由服务端控制。',

  /* ============================ 工具栏与提示 ============================ */
  'audit.toolbar.export': '导出 CSV',
  'audit.export.success': '导出已开始下载',

  /* ============================ 筛选器 ============================ */
  'audit.filter.all': '全部',
  'audit.filter.allActions': '全部动作',

  /* ============================ 列 ============================ */
  'audit.column.logTime': '时间',
  'audit.column.timeRange': '时间区间',
  'audit.column.timeRangeStart': '起（含）',
  'audit.column.endTime': '结束时间',
  'audit.column.timeRangeEnd': '止（含）',
  'audit.column.operator': '操作人',
  'audit.column.operatorIdPlaceholder': '用户 ID（精确匹配）',
  'audit.column.action': '操作类型',
  'audit.column.module': '所属域',
  'audit.column.targetType': '对象类型',
  'audit.column.target': '操作对象',
  'audit.column.result': '结果',
  'audit.column.ip': 'IP',
  'audit.column.traceId': '链路 ID',
  'audit.column.detail': '详情',

  /* ============================ 结果 ============================ */
  'audit.result.success': '成功',
  'audit.result.failed': '失败',
  'audit.result.unknown': '未知',

  /* ============================ 操作人兜底 ============================ */
  'audit.operator.deletedUser': '已注销用户 #{userId}',
  'audit.operator.system': '系统 / 匿名',

  /* ============================ 动作分组 ============================ */
  'audit.actionGroup.file': '文件与目录',
  'audit.actionGroup.share': '外发分享',
  'audit.actionGroup.userRole': '用户与角色',
  'audit.actionGroup.approval': '审批与授权',

  /* ============================ 动作名（镜像后端常量） ============================ */
  'audit.action.FILE_UPLOAD': '上传文件',
  'audit.action.FILE_DOWNLOAD': '下载文件',
  'audit.action.FILE_PREVIEW': '预览文件',
  'audit.action.FILE_RENAME': '重命名文件',
  'audit.action.FILE_MOVE': '移动文件',
  'audit.action.FILE_COPY': '复制文件',
  'audit.action.FILE_DELETE': '移入回收站',
  'audit.action.FILE_RESTORE': '回收站还原',
  'audit.action.FILE_DESTROY': '彻底销毁',
  'audit.action.RECYCLE_PURGE': '回收站到期清理',
  'audit.action.FILE_TICKET_ISSUE': '下载票据签发',
  'audit.action.FOLDER_CREATE': '新建目录',
  'audit.action.FOLDER_RENAME': '重命名目录',
  'audit.action.FOLDER_MOVE': '移动目录',
  'audit.action.FOLDER_DELETE': '删除目录',
  'audit.action.FILE_TAG': '打 / 取消标签',
  'audit.action.VERSION_ROLLBACK': '回滚历史版本',
  'audit.action.VERSION_CREATE': '上传新版本',
  'audit.action.VERSION_PRUNE': '版本裁剪',
  'audit.action.PACK_CREATE': '发起批量打包',
  'audit.action.PACK_DOWNLOAD': '下载打包产物',
  'audit.action.SHARE_CREATE': '创建分享',
  'audit.action.SHARE_REVOKE': '撤销分享',
  'audit.action.SHARE_DOWNLOAD': '访客下载',
  'audit.action.SHARE_PREVIEW': '访客预览',
  'audit.action.SHARE_BLOCKED': '外发拦截',
  'audit.action.SHARE_CODE_LOCKED': '提取码锁定',
  'audit.action.USER_CREATE': '创建用户',
  'audit.action.USER_UPDATE': '修改用户',
  'audit.action.USER_DELETE': '删除用户',
  'audit.action.USER_STATUS': '启停用户',
  'audit.action.USER_PASSWORD_RESET': '重置口令',
  'audit.action.USER_ROLE_ASSIGN': '变更用户角色',
  'audit.action.ROLE_CREATE': '创建角色',
  'audit.action.ROLE_UPDATE': '修改角色',
  'audit.action.ROLE_DELETE': '删除角色',
  'audit.action.ROLE_PERM_ASSIGN': '角色授权调整',
  'audit.action.APPLY': '提交申请',
  'audit.action.APPROVE': '审批通过',
  'audit.action.REJECT': '审批驳回',
  'audit.action.TRANSFER': '审批转审',
  'audit.action.GRANT': '授权落地',
  'audit.action.REVOKE': '授权回收',
  'audit.action.GRANT_EXPIRE': '授权到期回收',

  /* ============================ 所属域 ============================ */
  'audit.module.AUTH': '认证',
  'audit.module.PERMISSION': '权限与系统管理',
  'audit.module.TRANSFER': '传输',
  'audit.module.FILE': '文件',
  'audit.module.COLLABORATION': '协作',
  'audit.module.COMMON': '公共',

  /* ============================ 操作对象类型 ============================ */
  'audit.target.SHARE': '外发链接',
  'audit.target.FILE': '文件条目',
  'audit.target.FOLDER': '目录',
  'audit.target.TAG': '标签',
  'audit.target.PACK_TASK': '打包任务',
  'audit.target.USER': '用户账号',
  'audit.target.ROLE': '角色',
  'audit.target.PERMISSION': '权限点',
  'audit.target.APPLICATION': '权限申请单',
  'audit.target.GRANT': '授权记录',
  'audit.target.SYSTEM': '系统任务',
} as const;
