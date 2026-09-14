/**
 * 权限地图数据访问（当前用户的**授权来源 + 有效期**）。
 *
 * <p>契约来源：at-permission `PermissionController#myPermissionMap`，
 * 返回 {@code Result<PermissionMapView>}：
 * <pre>{@code
 * {
 *   userId, roleCodes: string[], permCodes: string[], dataScope: string,
 *   approvalGrants: [{ grantId, grantType, resourceType, resourceId, expireAt, applicationId }]
 * }
 * }</pre>
 *
 * <p><b>一个必须说清的口径：</b>`permCodes` 只说「我有哪些权限点」，
 * **不区分来源**——是角色带的还是审批单批的，后端没有逐点来源映射。
 * 因此页面把来源拆成两条独立线索呈现（角色码 / 审批授权条目），
 * 而不是给每个权限点硬安一个来源（那会是编的）。
 */

import { requestData } from '@/services/request';

import { ACCESS_ENDPOINTS } from './endpoints';

/** 审批授权条目（后端 `GrantItem`）。 */
export interface ApprovalGrant {
  grantId: number;
  /** 授权动作：ACCESS / DOWNLOAD / EDIT / SHARE */
  grantType?: string | null;
  resourceType?: string | null;
  resourceId?: number | null;
  /** 到期时刻；为空表示长期有效 */
  expireAt?: string | null;
  /** 来源申请单 id */
  applicationId?: number | null;
}

/** 权限地图视图（后端 `PermissionMapView`）。 */
export interface PermissionMapView {
  userId?: number | null;
  roleCodes?: string[] | null;
  permCodes?: string[] | null;
  /** 数据范围字符串枚举；前端**原样展示**，不做文案映射（取值以服务端为准） */
  dataScope?: string | null;
  approvalGrants?: ApprovalGrant[] | null;
}

/** 归一化：数组字段缺失/为 null 时归零，避免页面到处写 `?? []`。 */
export function normalizePermissionMap(raw?: PermissionMapView | null): PermissionMapView {
  return {
    userId: raw?.userId ?? null,
    dataScope: raw?.dataScope ?? null,
    roleCodes: Array.isArray(raw?.roleCodes) ? raw.roleCodes : [],
    permCodes: Array.isArray(raw?.permCodes) ? raw.permCodes : [],
    approvalGrants: Array.isArray(raw?.approvalGrants) ? raw.approvalGrants : [],
  };
}

/**
 * 拉取当前用户权限地图。
 *
 * <p>不做静默降级：本页唯一的数据源，失败就该让用户看到失败（而不是渲染成
 * 「你没有权限」这种会误导人的空态）。
 */
export async function fetchPermissionMap(): Promise<PermissionMapView> {
  const raw = await requestData<PermissionMapView>(ACCESS_ENDPOINTS.permissionMap, {
    method: 'GET',
  });
  return normalizePermissionMap(raw);
}
