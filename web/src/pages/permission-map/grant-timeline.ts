/**
 * 授权有效期时间轴（纯函数，便于单测）。
 *
 * <p>「有效期时间轴」的数据只有 `approvalGrants[].expireAt` 一个时间点——后端**不下发**
 * 授权的生效时间（grant 落库即生效），所以这是一条「到期轴」，不是「起止区间轴」。
 * 这里刻意不给它编一个假的 startTime。
 */

import type { ApprovalGrant } from '@/services/access';

/** 即将到期阈值（天）。 */
export const EXPIRING_SOON_DAYS = 7;

/** 授权状态：生效中 / 即将到期 / 已过期 / 长期有效。 */
export type GrantState = 'active' | 'expiring' | 'expired' | 'permanent';

/** 时间轴条目。 */
export interface GrantTimelineEntry {
  grant: ApprovalGrant;
  state: GrantState;
  /** 剩余天数（向上取整）；长期有效为 null，已过期为负数或 0 */
  remainDays: number | null;
}

/** 解析到期时刻（毫秒）；无值或不可解析返回 null。 */
export function expireMsOf(expireAt?: string | null): number | null {
  if (!expireAt) {
    return null;
  }
  const ms = Date.parse(expireAt);
  return Number.isFinite(ms) ? ms : null;
}

/** 剩余天数（向上取整）；长期有效返回 null。 */
export function remainDaysOf(expireAt: string | null | undefined, now: number): number | null {
  const ms = expireMsOf(expireAt);
  if (ms === null) {
    return null;
  }
  return Math.ceil((ms - now) / 86_400_000);
}

/** 授权状态判定。 */
export function grantState(
  expireAt: string | null | undefined,
  now: number,
  warningDays = EXPIRING_SOON_DAYS,
): GrantState {
  const ms = expireMsOf(expireAt);
  if (ms === null) {
    return 'permanent';
  }
  if (ms <= now) {
    return 'expired';
  }
  const days = Math.ceil((ms - now) / 86_400_000);
  return days <= warningDays ? 'expiring' : 'active';
}

/** 状态文案。 */
export function grantStateText(state: GrantState): string {
  switch (state) {
    case 'expired':
      return '已过期';
    case 'expiring':
      return '即将到期';
    case 'permanent':
      return '长期有效';
    default:
      return '生效中';
  }
}

/** 状态色标（antd 语义色）。 */
export function grantStateColor(state: GrantState): string {
  switch (state) {
    case 'expired':
      return 'error';
    case 'expiring':
      return 'warning';
    case 'permanent':
      return 'default';
    default:
      return 'success';
  }
}

/** 剩余天数文案。 */
export function remainDaysText(remainDays: number | null): string {
  if (remainDays === null) {
    return '长期有效';
  }
  if (remainDays <= 0) {
    return '已过期';
  }
  return `剩 ${remainDays} 天`;
}

/**
 * 构造到期时间轴。
 *
 * <p>排序：有到期时间的按**由近及远**升序（最紧迫的排最前，符合「要注意什么」的阅读顺序），
 * 长期有效的排在最后。同刻到期按 grantId 稳定排序，避免列表顺序抖动。
 */
export function buildGrantTimeline(
  grants: ApprovalGrant[] | null | undefined,
  now: number,
): GrantTimelineEntry[] {
  const list = Array.isArray(grants) ? grants : [];
  return list
    .map((grant) => ({
      grant,
      state: grantState(grant.expireAt, now),
      remainDays: remainDaysOf(grant.expireAt, now),
    }))
    .sort((left, right) => {
      const leftMs = expireMsOf(left.grant.expireAt);
      const rightMs = expireMsOf(right.grant.expireAt);
      if (leftMs === null && rightMs === null) {
        return left.grant.grantId - right.grant.grantId;
      }
      if (leftMs === null) {
        return 1;
      }
      if (rightMs === null) {
        return -1;
      }
      return leftMs - rightMs || left.grant.grantId - right.grant.grantId;
    });
}

/** 按状态汇总（概览用）。 */
export function summarizeGrants(entries: GrantTimelineEntry[]): {
  total: number;
  expired: number;
  expiring: number;
} {
  return entries.reduce(
    (acc, entry) => {
      acc.total += 1;
      if (entry.state === 'expired') {
        acc.expired += 1;
      }
      if (entry.state === 'expiring') {
        acc.expiring += 1;
      }
      return acc;
    },
    { total: 0, expired: 0, expiring: 0 },
  );
}
