/** Approval center (to-decide / submitted / detail / decision) copy. */
export default {
  // Page
  'approval.title': 'Approval Center',
  'approval.subtitle': 'Requests awaiting my decision and requests I submitted',
  'approval.tab.pending': 'Awaiting my decision',
  'approval.tab.mine': 'Submitted by me',
  'approval.slaNotice':
    'SLA is derived from the sensitivity level (Public 24h / Internal 12h / Classified 4h). Overtime is only a reminder — it never auto-approves or grants access.',
  'approval.decisionSubmitted': 'Decision submitted',
  'approval.longTerm': 'No expiry',

  // Table columns
  'approval.column.applicationNo': 'Request no.',
  'approval.column.applyAction': 'Requested action',
  'approval.column.level': 'Sensitivity',
  'approval.column.resource': 'Resource',
  'approval.column.applicant': 'Applicant',
  'approval.column.purpose': 'Purpose',
  'approval.column.desiredExpireAt': 'Requested expiry',
  'approval.column.sla': 'SLA',
  'approval.column.status': 'Status',
  'approval.column.opinion': 'Approval note',
  'approval.column.createdAt': 'Submitted at',
  'approval.column.actions': 'Actions',

  // Row actions
  'approval.rowAction.detail': 'Details',
  'approval.rowAction.approve': 'Approve',
  'approval.rowAction.reject': 'Reject',

  // Request status
  'approval.status.pending': 'Pending',
  'approval.status.approved': 'Approved',
  'approval.status.rejected': 'Rejected',
  'approval.status.transferred': 'Transferred',
  'approval.status.cancelled': 'Withdrawn',
  'approval.status.unknown': 'Unknown',

  // Grant actions
  'approval.grantAction.access': 'Access (preview)',
  'approval.grantAction.download': 'Download',
  'approval.grantAction.edit': 'Edit',
  'approval.grantAction.share': 'External share',
  'approval.grantAction.unknown': 'Unknown action',

  // SLA (countdown and deadline)
  'approval.sla.noDeadline': '--',
  'approval.sla.overdue.days': 'Overdue by {days}d {hours}h',
  'approval.sla.overdue.hours': 'Overdue by {hours}h {minutes}m',
  'approval.sla.overdue.minutes': 'Overdue by {minutes}m',
  'approval.sla.tooltip':
    'Handle before {deadline} (overtime is a reminder only, never auto-granted)',

  // Detail drawer
  'approval.detail.title': 'Request detail',
  'approval.detail.slaDeadline': 'Due {deadline}',
  'approval.detail.timeline': 'Activity',
  'approval.timeline.submit': 'Request submitted',
  'approval.timeline.purpose': 'Purpose: {purpose}',
  'approval.timeline.approved': 'Approved',
  'approval.timeline.rejected': 'Rejected',
  'approval.timeline.transferred': 'Transferred to another approver',
  'approval.timeline.cancelled': 'Withdrawn by applicant',
  'approval.timeline.pending': 'Awaiting decision',

  // Decision modal
  'approval.modal.approveTitle': 'Approve request',
  'approval.modal.rejectTitle': 'Reject request',
  'approval.modal.approveOk': 'Approve',
  'approval.modal.rejectOk': 'Reject',
  'approval.modal.applicationNo': 'Request no.: {no}',
  'approval.modal.applyScope': 'Requested: {action}',
  'approval.modal.desiredExpireAt': 'Requested expiry: {at}',
  'approval.modal.grantScope':
    'Grant scope (can only be narrowed, never widened)',
  'approval.modal.grantScopeDownscoped':
    'Lower than the requested action "{action}" — a narrower scope will be granted',
  'approval.modal.grantScopeSame': 'Same as the requested scope',
  'approval.modal.grantScopePlaceholder': 'Select the action to grant',
  'approval.modal.expireAt':
    'Grant expiry (can only be shortened, never extended)',
  'approval.modal.expireCapped':
    'Later than requested — it will be capped to {expireAt}',
  'approval.modal.expireKeep': 'Leave empty for no expiry',
  'approval.modal.expirePlaceholder': 'Empty = no expiry',
  'approval.modal.opinionApprove': 'Approval note (optional)',
  'approval.modal.opinionReject': 'Rejection reason (required)',
  'approval.modal.opinionMax': 'Up to {max} characters',
  'approval.modal.opinionRequired': 'Please provide a rejection reason',
  'approval.modal.opinionPlaceholderApprove':
    'Add any conditions for the grant',
  'approval.modal.opinionPlaceholderReject':
    'Explain the reason; it will be shared with the applicant',
  'approval.modal.notice':
    'Takes effect immediately: the granted scope and expiry cannot be widened later — the applicant must submit a new request.',
  'approval.modal.approved': 'Request approved',
  'approval.modal.rejected': 'Request rejected',
  'approval.modal.approveFailed': 'Failed to approve',
  'approval.modal.rejectFailed': 'Failed to reject',
} as const;
