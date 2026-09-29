/** 审批中心（待办 / 已办 / 详情 / 决策）文案。 */
export default {
  // 页面
  'approval.title': '审批中心',
  'approval.subtitle': '待我审批与我发起的权限申请',
  'approval.tab.pending': '待我审批',
  'approval.tab.mine': '我发起',
  'approval.slaNotice':
    'SLA 按密级推算（公开 24h / 内部 12h / 机密 4h），超时仅作提醒，不会自动通过或放行权限。',
  'approval.decisionSubmitted': '审批结果已提交',
  'approval.longTerm': '长期有效',

  // 列表列
  'approval.column.applicationNo': '申请单号',
  'approval.column.applyAction': '申请动作',
  'approval.column.level': '敏感等级',
  'approval.column.resource': '资源',
  'approval.column.applicant': '申请人',
  'approval.column.purpose': '使用用途',
  'approval.column.desiredExpireAt': '期望到期',
  'approval.column.sla': 'SLA',
  'approval.column.status': '状态',
  'approval.column.opinion': '审批意见',
  'approval.column.createdAt': '申请时间',
  'approval.column.actions': '操作',

  // 行内操作
  'approval.rowAction.detail': '详情',
  'approval.rowAction.approve': '通过',
  'approval.rowAction.reject': '驳回',

  // 审批单状态
  'approval.status.pending': '待审批',
  'approval.status.approved': '已通过',
  'approval.status.rejected': '已驳回',
  'approval.status.transferred': '已转审',
  'approval.status.cancelled': '已撤销',
  'approval.status.unknown': '未知',

  // 授权动作
  'approval.grantAction.access': '访问（预览）',
  'approval.grantAction.download': '下载',
  'approval.grantAction.edit': '编辑',
  'approval.grantAction.share': '外发分享',
  'approval.grantAction.unknown': '未知动作',

  // SLA（倒计时与截止时刻）
  'approval.sla.noDeadline': '--',
  'approval.sla.overdue.days': '已超时 {days}天{hours}小时',
  'approval.sla.overdue.hours': '已超时 {hours}小时{minutes}分',
  'approval.sla.overdue.minutes': '已超时 {minutes}分',
  'approval.sla.tooltip': '应于 {deadline} 前处理（超时仅提醒，不自动放行）',

  // 详情抽屉
  'approval.detail.title': '审批单详情',
  'approval.detail.slaDeadline': '截止 {deadline}',
  'approval.detail.timeline': '流转记录',
  'approval.timeline.submit': '提交申请',
  'approval.timeline.purpose': '用途：{purpose}',
  'approval.timeline.approved': '审批通过',
  'approval.timeline.rejected': '审批驳回',
  'approval.timeline.transferred': '转审他人',
  'approval.timeline.cancelled': '申请人撤销',
  'approval.timeline.pending': '等待审批',

  // 决策弹窗
  'approval.modal.approveTitle': '审批通过',
  'approval.modal.rejectTitle': '驳回申请',
  'approval.modal.approveOk': '确认通过',
  'approval.modal.rejectOk': '确认驳回',
  'approval.modal.applicationNo': '申请单号：{no}',
  'approval.modal.applyScope': '申请：{action}',
  'approval.modal.desiredExpireAt': '期望到期：{at}',
  'approval.modal.grantScope': '授权范围（只能收紧，不能超过申请范围）',
  'approval.modal.grantScopeDownscoped':
    '低于申请动作「{action}」——将按更小范围授权',
  'approval.modal.grantScopeSame': '与申请范围一致',
  'approval.modal.grantScopePlaceholder': '选择授权动作',
  'approval.modal.expireAt': '授权有效期（只能缩短，不能超过申请值）',
  'approval.modal.expireCapped': '所选时间晚于申请人期望，将收敛为 {expireAt}',
  'approval.modal.expireKeep': '留空表示长期有效',
  'approval.modal.expirePlaceholder': '留空 = 长期有效',
  'approval.modal.opinionApprove': '审批意见（可选）',
  'approval.modal.opinionReject': '驳回原因（必填）',
  'approval.modal.opinionMax': '不超过 {max} 字',
  'approval.modal.opinionRequired': '请填写驳回原因',
  'approval.modal.opinionPlaceholderApprove': '可补充说明授权条件',
  'approval.modal.opinionPlaceholderReject': '说明驳回理由，将同步给申请人',
  'approval.modal.notice':
    '通过后立即生效：授权范围与有效期均不可放宽，如需放宽须由申请人重新提交。',
  'approval.modal.approved': '已通过该申请',
  'approval.modal.rejected': '已驳回该申请',
  'approval.modal.approveFailed': '审批通过失败',
  'approval.modal.rejectFailed': '驳回失败',
} as const;
