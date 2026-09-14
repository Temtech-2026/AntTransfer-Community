/**
 * 审批单时间轴（纯函数，便于单测）。
 *
 * <p>「我发起」与「待我审批」共用同一份时间轴：差别只在末节点是「已决策」还是「等待审批」。
 * 后端没有单独的事件流接口，时间轴只能由审批单自身的 `createdAt / decidedAt / status / opinion`
 * 组合出来——这三者就是后端 `ApprovalRequestVO` 提供的全部生命周期信息，
 * 因此这里**不构造任何后端未下发的节点**（如「转审给谁」的中间态）。
 */

import { APPROVAL_STATUS } from '@/services/approval';
import type { ApprovalApplication } from '@/services/approval';

/** 时间轴节点状态：已完成 / 进行中 / 失败（驳回）。 */
export type ApprovalTimelineState = 'done' | 'active' | 'error';

/** 时间轴节点。 */
export interface ApprovalTimelineEntry {
  key: string;
  label: string;
  at?: string | null;
  detail?: string;
  state: ApprovalTimelineState;
}

/** 节点状态 → antd Timeline 色标。 */
export function timelineColor(state: ApprovalTimelineState): string {
  switch (state) {
    case 'error':
      return 'red';
    case 'active':
      return 'gray';
    default:
      return 'green';
  }
}

/** 由审批单推导生命周期时间轴；空单返回空数组（调用方渲染空态）。 */
export function buildApprovalTimeline(
  application?: ApprovalApplication | null,
): ApprovalTimelineEntry[] {
  if (!application) {
    return [];
  }
  const entries: ApprovalTimelineEntry[] = [
    {
      key: 'submit',
      label: '提交申请',
      at: application.createdAt,
      detail: application.purpose ? `用途：${application.purpose}` : undefined,
      state: 'done',
    },
  ];

  switch (application.status) {
    case APPROVAL_STATUS.approved:
      entries.push({
        key: 'decide',
        label: '审批通过',
        at: application.decidedAt,
        detail: application.opinion || undefined,
        state: 'done',
      });
      break;
    case APPROVAL_STATUS.rejected:
      entries.push({
        key: 'decide',
        label: '审批驳回',
        at: application.decidedAt,
        detail: application.opinion || undefined,
        state: 'error',
      });
      break;
    case APPROVAL_STATUS.transferred:
      entries.push({
        key: 'decide',
        label: '转审他人',
        at: application.decidedAt,
        detail: application.opinion || undefined,
        state: 'done',
      });
      break;
    case APPROVAL_STATUS.cancelled:
      entries.push({
        key: 'decide',
        label: '申请人撤销',
        at: application.decidedAt,
        state: 'done',
      });
      break;
    default:
      entries.push({ key: 'decide', label: '等待审批', state: 'active' });
  }
  return entries;
}
