/** 결재 센터(대기 / 완료 / 상세 / 결정) 문구. */
export default {
  // 页面
  'approval.title': '결재 센터',
  'approval.subtitle': '내가 결재할 건과 내가 신청한 권한 요청',
  'approval.tab.pending': '내가 결재할',
  'approval.tab.mine': '내가 신청',
  'approval.slaNotice':
    'SLA는 기밀 등급에 따라 산정됩니다(공개 24시간 / 내부 12시간 / 기밀 4시간). 초과 시 알림만 하며 자동 승인이나 권한 부여는 하지 않습니다.',
  'approval.decisionSubmitted': '결재 결과가 제출되었습니다',
  'approval.longTerm': '기간 제한 없음',

  // 列表列
  'approval.column.applicationNo': '신청 번호',
  'approval.column.applyAction': '신청 동작',
  'approval.column.level': '민감 등급',
  'approval.column.resource': '리소스',
  'approval.column.applicant': '신청자',
  'approval.column.purpose': '사용 목적',
  'approval.column.desiredExpireAt': '희망 만료일',
  'approval.column.sla': 'SLA',
  'approval.column.status': '상태',
  'approval.column.opinion': '결재 의견',
  'approval.column.createdAt': '신청 시간',
  'approval.column.actions': '작업',

  // 行内操作
  'approval.rowAction.detail': '상세',
  'approval.rowAction.approve': '승인',
  'approval.rowAction.reject': '반려',

  // 审批单状态
  'approval.status.pending': '결재 대기',
  'approval.status.approved': '승인됨',
  'approval.status.rejected': '반려됨',
  'approval.status.transferred': '전결됨',
  'approval.status.cancelled': '철회됨',
  'approval.status.unknown': '알 수 없음',

  // 授权动作
  'approval.grantAction.access': '접근(미리보기)',
  'approval.grantAction.download': '다운로드',
  'approval.grantAction.edit': '편집',
  'approval.grantAction.share': '외부 공유',
  'approval.grantAction.unknown': '알 수 없는 동작',

  // SLA（倒计时与截止时刻）
  'approval.sla.noDeadline': '--',
  'approval.sla.overdue.days': '{days}일 {hours}시간 초과',
  'approval.sla.overdue.hours': '{hours}시간 {minutes}분 초과',
  'approval.sla.overdue.minutes': '{minutes}분 초과',
  'approval.sla.tooltip':
    '{deadline} 전에 처리해야 합니다(초과 시 알림만 하고 자동 승인하지 않습니다)',

  // 详情抽屉
  'approval.detail.title': '결재 상세',
  'approval.detail.slaDeadline': '마감 {deadline}',
  'approval.detail.timeline': '처리 이력',
  'approval.timeline.submit': '신청 제출',
  'approval.timeline.purpose': '목적: {purpose}',
  'approval.timeline.approved': '결재 승인',
  'approval.timeline.rejected': '결재 반려',
  'approval.timeline.transferred': '다른 사람에게 전결',
  'approval.timeline.cancelled': '신청자 철회',
  'approval.timeline.pending': '결재 대기 중',

  // 决策弹窗
  'approval.modal.approveTitle': '결재 승인',
  'approval.modal.rejectTitle': '신청 반려',
  'approval.modal.approveOk': '승인 확인',
  'approval.modal.rejectOk': '반려 확인',
  'approval.modal.applicationNo': '신청 번호: {no}',
  'approval.modal.applyScope': '신청: {action}',
  'approval.modal.desiredExpireAt': '희망 만료: {at}',
  'approval.modal.grantScope':
    '권한 범위(신청 범위보다 좁게만 지정할 수 있습니다)',
  'approval.modal.grantScopeDownscoped':
    '신청 동작 “{action}”보다 낮은 범위입니다. 더 좁은 범위로 부여됩니다',
  'approval.modal.grantScopeSame': '신청 범위와 동일',
  'approval.modal.grantScopePlaceholder': '권한 동작 선택',
  'approval.modal.expireAt':
    '권한 유효 기간(신청 값보다 짧게만 지정할 수 있습니다)',
  'approval.modal.expireCapped':
    '선택한 시간이 신청자의 희망보다 늦어 {expireAt}로 조정됩니다',
  'approval.modal.expireKeep': '비워 두면 기간 제한 없음',
  'approval.modal.expirePlaceholder': '비워 두면 기간 제한 없음',
  'approval.modal.opinionApprove': '결재 의견(선택)',
  'approval.modal.opinionReject': '반려 사유(필수)',
  'approval.modal.opinionMax': '{max}자 이내',
  'approval.modal.opinionRequired': '반려 사유를 입력하세요',
  'approval.modal.opinionPlaceholderApprove':
    '권한 조건을 추가로 설명할 수 있습니다',
  'approval.modal.opinionPlaceholderReject':
    '반려 이유를 설명하면 신청자에게 함께 전달됩니다',
  'approval.modal.notice':
    '승인하면 즉시 적용됩니다. 권한 범위와 유효 기간은 넓힐 수 없으며, 넓히려면 신청자가 다시 제출해야 합니다.',
  'approval.modal.approved': '해당 신청을 승인했습니다',
  'approval.modal.rejected': '해당 신청을 반려했습니다',
  'approval.modal.approveFailed': '승인에 실패했습니다',
  'approval.modal.rejectFailed': '반려에 실패했습니다',
} as const;
