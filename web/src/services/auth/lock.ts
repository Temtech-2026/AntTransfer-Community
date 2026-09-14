/**
 * 登录失败锁定（1004 账号锁定）的展示口径。
 *
 * <p>后端锁定策略是「连续失败 N 次后锁定一段时间」，但响应里<b>只给文案不给剩余秒数</b>
 * （如「账号已锁定，请 15 分钟后重试」）。前端因此<b>不硬编码 15 分钟常量</b>——一旦后端
 * 调整策略，硬编码会先给出错误的倒计时；改为从文案里解析分钟数，解析不到就只展示原文案。</p>
 *
 * <p>本文件是纯函数，便于单测覆盖边界（文案变体、异常值、跨 0 边界）。</p>
 */

/** 锁定文案里的分钟数（「15 分钟」「15分钟」都要能命中）。 */
const LOCK_MINUTES_PATTERN = /(\d+)\s*分钟/;

/**
 * 从后端锁定提示中解析剩余锁定分钟数。
 *
 * @returns 解析成功返回正数分钟；文案里没有可识别的分钟数时返回 null（表示只能展示原文案）
 */
export function parseLockMinutes(message?: string | null): number | null {
  const text = message?.trim();
  if (!text) {
    return null;
  }
  const matched = LOCK_MINUTES_PATTERN.exec(text);
  if (!matched?.[1]) {
    return null;
  }
  const minutes = Number(matched[1]);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

/** 由锁定分钟数推算解锁时刻（毫秒时间戳）。 */
export function lockDeadline(minutes: number, now: number = Date.now()): number {
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
  return now + safeMinutes * 60_000;
}

/**
 * 剩余秒数（向上取整）。
 *
 * <p>向上取整是为了「显示 00:01 时确实还剩不到 1 秒」而不是提前归零；
 * 已过期一律返回 0，避免出现负数倒计时。</p>
 */
export function remainingSeconds(deadline: number, now: number = Date.now()): number {
  if (!Number.isFinite(deadline)) {
    return 0;
  }
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** 秒数 → `mm:ss`（超过 60 分钟按实际分钟数展示，不截断）。 */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}
