/**
 * 审批域类型与口径常量（services/approval）。
 *
 * <p>契约来源：at-permission `PermissionApplicationController`（`/v1/permission/applications/**`）
 * 与 `ApprovalRequest` / `ApprovalEnums` / `ApplicationDecisionDTO`。
 *
 * <p><b>为什么不重复定义 VO：</b>审批单 VO（`ApprovalRequest`）与申请动作枚举（`ApplyType`）
 * 在 services/file 已定义、且被申请弹窗提交链路使用——**同一份后端 VO 定义两遍一定会漂移**，
 * 故此处只做别名导出。本文件只补「审批中心独有」的口径：状态文案、决策入参、
 * 缩范围 / 缩效期的约束算法。
 */

import type { ApplyType, ApprovalRequest } from '@/services/file';

/** 审批单视图（待我审批 / 我发起 / 决策返回共用）。 */
export type ApprovalApplication = ApprovalRequest;

/** 申请动作 / 授权动作：后端同域（`apply_type` 与 `grant_type` 取值一致）。 */
export type ApplyAction = ApplyType;

/* ============================ 状态 ============================ */

/** 审批单状态（逐值对齐 `ApprovalRequest.STATUS_*`）。 */
export const APPROVAL_STATUS = {
  pending: 0,
  approved: 1,
  rejected: 2,
  transferred: 3,
  cancelled: 4,
} as const;

/**
 * 状态文案 id。
 *
 * <p>未知状态返回「未知」而不是兜底成「待审批」：把状态不明的单子渲染成可审批，
 * 会让审批人对一张已终态的单子重复决策。
 *
 * <p>只返回 i18n id，文案由调用方 `intl.formatMessage` 渲染（服务层不内嵌文案）。
 */
export function approvalStatusTextId(status?: number | null): string {
  switch (status) {
    case APPROVAL_STATUS.pending:
      return 'approval.status.pending';
    case APPROVAL_STATUS.approved:
      return 'approval.status.approved';
    case APPROVAL_STATUS.rejected:
      return 'approval.status.rejected';
    case APPROVAL_STATUS.transferred:
      return 'approval.status.transferred';
    case APPROVAL_STATUS.cancelled:
      return 'approval.status.cancelled';
    default:
      return 'approval.status.unknown';
  }
}

/** 状态色标（antd Tag/ Badge 语义色）。 */
export function approvalStatusColor(status?: number | null): string {
  switch (status) {
    case APPROVAL_STATUS.pending:
      return 'processing';
    case APPROVAL_STATUS.approved:
      return 'success';
    case APPROVAL_STATUS.rejected:
      return 'error';
    case APPROVAL_STATUS.transferred:
      return 'warning';
    default:
      return 'default';
  }
}

/** 是否为待审（唯一可决策的状态）。 */
export function isPending(status?: number | null): boolean {
  return status === APPROVAL_STATUS.pending;
}

/** 审批中心的两个视角：待我审批 / 我发起。 */
export type ApprovalView = 'pending' | 'mine';

/**
 * 当前视角下该单是否可行使审批动作（通过 / 驳回）。
 *
 * <p><b>为什么不用 perm_code：</b>后端审批端点**没有** `@RequiresPerm`——审批资格由
 * 「是否为该单审批人 + 单子处于待审态」在服务层判定，并不存在 `approval:decide` 这类权限点。
 * 前端若臆造一个权限点，会与后端授权矩阵对不上（红线：前端不得另起一套 perm_code）。
 *
 * <p><b>为什么不比对 currentUser.id：</b>`/applications/pending` 已由后端按审批人过滤，
 * 列表里的待审单本就等于「我的待办」；而模板的 `API.CurrentUser` 并未携带后端 `userId`
 * （只有模板自造的 `userid`），拿它去比 `approverId` 只会假阴性地把按钮全禁掉。
 * 于是判定收敛为「视角 + 终态」两个纯业务量，真正的资格校验始终在后端。
 */
export function canDecide(
  application: Pick<ApprovalApplication, 'status'>,
  view: ApprovalView,
): boolean {
  return view === 'pending' && isPending(application.status);
}

/* ============================ 动作强度与缩范围 ============================ */

/**
 * 动作强度序：ACCESS < DOWNLOAD < EDIT < SHARE。
 *
 * <p>与后端 `PermissionApplicationService#actionRank` 逐值对齐；审批只能**降低**强度
 * （后端对放大范围会抛 `PARAM_OUT_OF_RANGE`），前端据此把「缩范围」选项收敛到合法集合，
 * 让不可选项根本不出现，而不是等提交后报错。
 */
export function actionRank(action?: string | null): number {
  switch (action) {
    case 'EDIT':
      return 2;
    case 'SHARE':
      return 3;
    case 'DOWNLOAD':
      return 1;
    case 'ACCESS':
      return 0;
    default:
      return -1;
  }
}

/** 授权动作短标签 id（缩范围下拉用）。 */
const ACTION_LABEL_ID: Record<string, string> = {
  ACCESS: 'approval.grantAction.access',
  DOWNLOAD: 'approval.grantAction.download',
  EDIT: 'approval.grantAction.edit',
  SHARE: 'approval.grantAction.share',
};

/**
 * 授权动作短标签 id。
 *
 * <p>返回值**必须**是合法 i18n id：后端若新增动作而前端未跟进，统一兜底到
 * `approval.grantAction.unknown`，而不是把裸动作码当作 id 交给 `intl.formatMessage`。
 * 裸枚举直接透传会产生两个问题：中文界面回显 `DOWNLOAD_V2` 这类原始枚举影响可读性，
 * 且 react-intl 会因找不到该 id 触发 missing-message 告警。
 */
export function actionLabelId(action?: string | null): string {
  if (!action) {
    return 'approval.grantAction.unknown';
  }
  return ACTION_LABEL_ID[action] ?? 'approval.grantAction.unknown';
}

/**
 * 「缩范围」候选：不超过申请动作强度的全部动作（含原动作）。
 *
 * <p>原动作排在首位，便于默认选中「不缩范围」。
 */
export function downscopeOptionsOf(applyAction?: string | null): ApplyAction[] {
  const applied = actionRank(applyAction);
  const all: ApplyAction[] = ['ACCESS', 'DOWNLOAD', 'EDIT', 'SHARE'];
  if (applied < 0) {
    return all;
  }
  return all.filter((action) => actionRank(action) <= applied);
}

/** 是否为「缩范围」（比申请动作更弱）。 */
export function isDownscope(applyAction?: string | null, grantAction?: string | null): boolean {
  const applied = actionRank(applyAction);
  const granted = actionRank(grantAction);
  if (applied < 0 || granted < 0) {
    return false;
  }
  return granted < applied;
}

/* ============================ 缩效期 ============================ */

/**
 * 最终有效期：只可缩短。
 *
 * <p>与后端 `PermissionApplicationService#resolveExpireAt` 同口径：
 * 「长期有效」（null）不是上界，缺省取申请人期望值；两端都有值时取**较早**者。
 * 前端用它做提交前的即时回显，避免用户以为填了就能放宽。
 */
export function capExpireAt(
  approved?: string | null,
  desired?: string | null,
): string | null {
  if (!approved) {
    return desired ?? null;
  }
  if (!desired) {
    return approved;
  }
  return approved <= desired ? approved : desired;
}

/* ============================ 决策入参 ============================ */

/** 审批意见上限（对齐 DTO 的 `@Size(max = 500)`）。 */
export const OPINION_MAX_LENGTH = 500;

/** 「通过」入参（`ApplicationDecisionDTO`）。 */
export interface ApprovalDecisionPayload {
  /** 最终授权动作；缺省取申请动作 */
  grantType?: ApplyAction;
  /** 最终到期时刻（ISO-8601 本地时间）；缺省取申请人期望值 */
  expireAt?: string | null;
  opinion?: string;
}

/** 「驳回」入参（`ApplicationRejectDTO`，理由必填）。 */
export interface ApprovalRejectPayload {
  opinion: string;
}

/** 「转审」入参（`ApplicationTransferDTO`）。 */
export interface ApprovalTransferPayload {
  targetApproverId: number;
  opinion?: string;
}
