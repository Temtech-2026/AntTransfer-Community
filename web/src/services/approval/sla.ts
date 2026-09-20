/**
 * 审批 SLA 倒计时口径（纯函数，便于单测）。
 *
 * <p><b>为什么前端要自己算：</b>后端 `ApprovalRequestVO` 只下发 `level` 与 `createdAt`，
 * **没有** SLA 截止时刻字段；等级 SLA（低 24h / 中 12h / 高 4h）是后端
 * `ApprovalProperties` 的配置默认值。前端按同一口径由 `createdAt + SLA` 推算，
 * 仅用于列表上的倒计时提示，**不参与任何放行判断**（超时后的升级提醒由后端扫描决定）。
 *
 * <p>若后端后续在 VO 上补 `slaDeadline`，应当优先取该字段，本文件的推算退化为兜底。
 */

/** 各等级 SLA 小时数（对齐 `ApprovalProperties`：slaLow/slaMedium/slaHigh）。 */
export const SLA_HOURS = {
  low: 24,
  medium: 12,
  high: 4,
} as const;

/** 倒计时刷新间隔（毫秒）。 */
export const SLA_TICK_MS = 1000;

/** SLA 状态：正常 / 临期（剩余不足 1/4）/ 超时。 */
export type SlaStage = 'ok' | 'warning' | 'overdue';

/** 归一化敏感等级（对齐 `ApprovalEnums.normalizeLevel`：越界按最低级）。 */
export function normalizeLevel(level?: number | null): number {
  if (level === 2 || level === 3) {
    return level;
  }
  return 1;
}

/** 取等级对应 SLA 小时数。 */
export function slaHoursOf(level?: number | null): number {
  switch (normalizeLevel(level)) {
    case 3:
      return SLA_HOURS.high;
    case 2:
      return SLA_HOURS.medium;
    default:
      return SLA_HOURS.low;
  }
}

/* 注：密级文案统一由 services/file 的 levelTextId 提供，此处不再重复一份口径。 */

/**
 * 解析后端下发的本地时间字符串（`2026-09-14T10:00:00`）。
 *
 * <p>后端 `LocalDateTime` 无时区，按浏览器本地时区解析即与写入方一致；
 * 若解析失败返回 null，由调用方降级为「--」而不是渲染 `Invalid Date`。
 */
export function parseDateTimeMs(value?: string | null): number | null {
  if (!value) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** SLA 截止时刻（毫秒）；缺 `createdAt` 时返回 null。 */
export function slaDeadlineMs(
  createdAt?: string | null,
  level?: number | null,
): number | null {
  const created = parseDateTimeMs(createdAt);
  if (created === null) {
    return null;
  }
  return created + slaHoursOf(level) * 60 * 60 * 1000;
}

/** 剩余毫秒（可为负 = 已超时）；无法推算时返回 null。 */
export function slaRemainingMs(
  application: { createdAt?: string | null; level?: number | null },
  now: number,
): number | null {
  const deadline = slaDeadlineMs(application.createdAt, application.level);
  return deadline === null ? null : deadline - now;
}

/** 由剩余时长与总时长判定阶段（剩余不足 1/4 记为临期）。 */
export function slaStage(remainingMs: number | null, level?: number | null): SlaStage {
  if (remainingMs === null) {
    return 'ok';
  }
  if (remainingMs <= 0) {
    return 'overdue';
  }
  const total = slaHoursOf(level) * 60 * 60 * 1000;
  return remainingMs <= total / 4 ? 'warning' : 'ok';
}

/** 阶段对应的色标（antd 语义色）。 */
export function slaStageColor(stage: SlaStage): string {
  switch (stage) {
    case 'overdue':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'success';
  }
}

/**
 * i18n 取值函数签名。
 *
 * <p>纯函数不直接依赖 react-intl：由调用方注入 `intl.formatMessage`，
 * 这样既能保持可单测（测试注入假实现），又不会在本文件里内嵌任何语言文案。
 */
export type Translate = (id: string, values?: Record<string, string | number>) => string;

/**
 * 倒计时文案：`2d 03:15:07` / `05:12:30` / `已超时 3小时20分` / `--`。
 *
 * <p>超时用「已超时 X」而非负数计数：负数倒计时会被误读成「还有时间」。
 * <p>正向倒计时是纯数字（与语言无关），只有超时分支与「--」占位需要取值。
 */
export function formatCountdown(t: Translate, remainingMs: number | null): string {
  if (remainingMs === null) {
    return t('approval.sla.noDeadline');
  }
  const abs = Math.abs(remainingMs);
  const totalSeconds = Math.floor(abs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');

  if (remainingMs <= 0) {
    if (days > 0) {
      return t('approval.sla.overdue.days', { days, hours });
    }
    if (hours > 0) {
      return t('approval.sla.overdue.hours', { hours, minutes });
    }
    return t('approval.sla.overdue.minutes', { minutes });
  }
  if (days > 0) {
    return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * 截止时刻文案（`MM-DD HH:mm`），供 Tooltip 展示「应于何时前处理」。
 *
 * <p>纯数字 + 分隔符，无语言文案；缺值时由调用方决定占位文案（见 `approval.sla.noDeadline`）。
 */
export function formatDeadline(deadlineMs: number | null): string {
  if (deadlineMs === null) {
    return '--';
  }
  const date = new Date(deadlineMs);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}
