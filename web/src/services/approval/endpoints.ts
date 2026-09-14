/**
 * 审批域端点。
 *
 * <p>审批与「权限申请」是同一个后端控制器（at-permission `PermissionApplicationController`，
 * 类级路径 `/v1/permission`），路径常量已在 `services/file/endpoints.ts` 的
 * `PERMISSION_APP_ENDPOINTS` 集中定义——此处直接复用而非重抄一遍：
 * 两条链路（申请人视角 / 审批人视角）必须永远指向同一组 URL，重抄就会漏改。
 */

import { PERMISSION_APP_ENDPOINTS } from '@/services/file';

export const APPROVAL_ENDPOINTS = {
  /** 待我审批（后端按审批人身份过滤） */
  pending: PERMISSION_APP_ENDPOINTS.pending,
  /** 我发起的申请 */
  mine: PERMISSION_APP_ENDPOINTS.mine,
  /** 审批通过（可缩范围 / 缩效期） */
  approve: PERMISSION_APP_ENDPOINTS.approve,
  /** 审批驳回（理由必填） */
  reject: PERMISSION_APP_ENDPOINTS.reject,
  /** 转审 */
  transfer: PERMISSION_APP_ENDPOINTS.transfer,
} as const;
