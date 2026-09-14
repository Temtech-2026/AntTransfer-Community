/**
 * 审批域出口（services/approval）。
 *
 * <p>对外只需从这里取：数据访问（pagePendingApprovals / pageMyApprovals / approve / reject / transfer）、
 * 状态与动作口径（approvalStatusText / canDecide / downscopeOptionsOf / capExpireAt）、
 * SLA 纯函数（slaRemainingMs / formatCountdown / slaStage）。
 */

export * from './api';
export * from './endpoints';
export * from './sla';
export * from './types';
