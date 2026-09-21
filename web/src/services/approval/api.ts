/**
 * 审批域数据访问。
 *
 * <p>两个列表端点都**不带 perm_code**（后端无 `@RequiresPerm`，靠审批人身份 + 数据收敛），
 * 因此不做 `<Access>` 包裹，页面直接把入口给所有登录用户。
 */

import { post, requestPage } from '@/services/request';

import { APPROVAL_ENDPOINTS } from './endpoints';
import type {
  ApprovalApplication,
  ApprovalDecisionPayload,
  ApprovalRejectPayload,
  ApprovalTransferPayload,
} from './types';

/** 分页入参（后端上限 100，默认 20）。 */
export interface ApprovalPageParams {
  current?: number;
  pageSize?: number;
}

/** 待我审批。 */
export function pagePendingApprovals(params: ApprovalPageParams = {}) {
  return requestPage<ApprovalApplication>(APPROVAL_ENDPOINTS.pending, {
    method: 'GET',
    params: { current: params.current ?? 1, pageSize: params.pageSize ?? 20 },
  });
}

/** 我发起的申请。 */
export function pageMyApprovals(params: ApprovalPageParams = {}) {
  return requestPage<ApprovalApplication>(APPROVAL_ENDPOINTS.mine, {
    method: 'GET',
    params: { current: params.current ?? 1, pageSize: params.pageSize ?? 20 },
  });
}

/** 审批通过：可传更弱的 `grantType` 与更早的 `expireAt`（后端对放大行为返回参数越界）。 */
export function approveApplication(id: string, payload: ApprovalDecisionPayload) {
  return post<ApprovalApplication>(APPROVAL_ENDPOINTS.approve(id), payload);
}

/** 审批驳回：`opinion` 必填（后端 `@NotBlank`）。 */
export function rejectApplication(id: string, payload: ApprovalRejectPayload) {
  return post<ApprovalApplication>(APPROVAL_ENDPOINTS.reject(id), payload);
}

/** 转审给其他可审批人。 */
export function transferApplication(id: string, payload: ApprovalTransferPayload) {
  return post<ApprovalApplication>(APPROVAL_ENDPOINTS.transfer(id), payload);
}
