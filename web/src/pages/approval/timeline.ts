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
  /** 节点标题 i18n id（本文件为纯函数，不内嵌任何语言文案） */
  labelId: string;
  at?: string | null;
  /** 后端下发的自由文本（审批意见），原样展示，无需翻译 */
  detail?: string;
  /** 需要插值的节点说明（如「用途：{purpose}」），由调用方取值渲染 */
  detailId?: string;
  detailValues?: Record<string, string | number>;
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
      labelId: 'approval.timeline.submit',
      at: application.createdAt,
      detailId: application.purpose ? 'approval.timeline.purpose' : undefined,
      detailValues: application.purpose ? { purpose: application.purpose } : undefined,
      state: 'done',
    },
  ];

  switch (application.status) {
    case APPROVAL_STATUS.approved:
      entries.push({
        key: 'decide',
        labelId: 'approval.timeline.approved',
        at: application.decidedAt,
        detail: application.opinion || undefined,
        state: 'done',
      });
      break;
    case APPROVAL_STATUS.rejected:
      entries.push({
        key: 'decide',
        labelId: 'approval.timeline.rejected',
        at: application.decidedAt,
        detail: application.opinion || undefined,
        state: 'error',
      });
      break;
    case APPROVAL_STATUS.transferred:
      entries.push({
        key: 'decide',
        labelId: 'approval.timeline.transferred',
        at: application.decidedAt,
        detail: application.opinion || undefined,
        state: 'done',
      });
      break;
    case APPROVAL_STATUS.cancelled:
      entries.push({
        key: 'decide',
        labelId: 'approval.timeline.cancelled',
        at: application.decidedAt,
        state: 'done',
      });
      break;
    default:
      entries.push({ key: 'decide', labelId: 'approval.timeline.pending', state: 'active' });
  }
  return entries;
}
