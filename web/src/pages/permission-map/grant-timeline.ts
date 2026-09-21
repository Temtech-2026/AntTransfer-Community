/**
 * 授权有效期时间轴（纯函数，便于单测）。
 *
 * <p>「有效期时间轴」的数据只有 `approvalGrants[].expireAt` 一个时间点——后端**不下发**
 * 授权的生效时间（grant 落库即生效），所以这是一条「到期轴」，不是「起止区间轴」。
 * 这里刻意不给它编一个假的 startTime。
 */

import type { ApprovalGrant } from '@/services/access';
import { compareSnowflakeId } from '@/utils/id';

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

/** i18n 消息描述符（id + 插值），可直接交给 {@code intl.formatMessage} 渲染。 */
export interface GrantMessage {
  id: string;
  values?: Record<string, number>;
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

/** 状态文案 id（文案在 locale 包里，页面用 intl.formatMessage 渲染）。 */
export function grantStateTextId(state: GrantState): string {
  switch (state) {
    case 'expired':
      return 'permissionMap.grantState.expired';
    case 'expiring':
      return 'permissionMap.grantState.expiring';
    case 'permanent':
      return 'permissionMap.grantState.permanent';
    default:
      return 'permissionMap.grantState.active';
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

/** 剩余天数文案描述符（长期有效 / 已过期 / 剩 N 天，由页面格式化）。 */
export function remainDaysTextId(remainDays: number | null): GrantMessage {
  if (remainDays === null) {
    return { id: 'permissionMap.grantState.permanent' };
  }
  if (remainDays <= 0) {
    return { id: 'permissionMap.grantState.expired' };
  }
  return { id: 'permissionMap.remainDays', values: { days: remainDays } };
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
        return compareSnowflakeId(left.grant.grantId, right.grant.grantId);
      }
      if (leftMs === null) {
        return 1;
      }
      if (rightMs === null) {
        return -1;
      }
      return leftMs - rightMs || compareSnowflakeId(left.grant.grantId, right.grant.grantId);
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

/** 四态展示顺序：固定不随条数重排——同一份数据两次渲染的顺序必须一模一样。 */
export const GRANT_STATE_ORDER: readonly GrantState[] = [
  'active',
  'expiring',
  'expired',
  'permanent',
];

/** 状态分布切片（可视化用）。 */
export interface GrantStateSlice {
  state: GrantState;
  count: number;
  /** 占比百分比（0–100，保留 1 位小数）；总数为 0 时为 0 */
  percent: number;
}

/**
 * 按状态汇总为分布切片（四态齐全、顺序固定）。
 *
 * <p><b>条的宽度请用 `count / 总数` 现算，别拿 `percent` 当宽度</b>：四段各自四舍五入后
 * 加起来未必是 100，拼起来会出现缝隙或溢出。`percent` 只用于图例上的读数。</p>
 */
export function summarizeGrantStates(
  entries: GrantTimelineEntry[],
): GrantStateSlice[] {
  const counts = new Map<GrantState, number>();
  for (const entry of entries) {
    counts.set(entry.state, (counts.get(entry.state) ?? 0) + 1);
  }
  return GRANT_STATE_ORDER.map((state) => {
    const count = counts.get(state) ?? 0;
    return {
      state,
      count,
      percent: entries.length
        ? Math.round((count / entries.length) * 1000) / 10
        : 0,
    };
  });
}

/**
 * 剩余天数条的刻度上限（天）。
 *
 * <p>这是一个**纯视觉口径**：后端不下发生效时间，「已经用掉多少」算不出来，所以条长只能
 * 表达「还剩多少」——剩余天数按 30 天封顶映射到 0–100，30 天以上一律满格。
 * 它**不是**「授权有效期进度」。</p>
 */
export const VALIDITY_BAR_HORIZON_DAYS = 30;

/**
 * 剩余天数 → 条百分比。
 *
 * <p>返回 null 表示**不该画条**：长期有效（没有到期时间，条长无意义）与已过期
 * （剩余为 0，画出来只剩一条灰底，信息量为零——红色 Tag 已经把话说完了）。</p>
 */
export function validityBarPercent(remainDays: number | null): number | null {
  if (remainDays === null || remainDays <= 0) {
    return null;
  }
  return Math.min(
    100,
    Math.round((remainDays / VALIDITY_BAR_HORIZON_DAYS) * 100),
  );
}
