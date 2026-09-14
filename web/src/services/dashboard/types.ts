/**
 * 工作台仪表盘口径。
 *
 * <p><b>四个卡片的取值来源：</b>
 * <ul>
 *   <li>「待审批数」「待办数」—— 对接**已实现**接口（审批 `pending` 分页 total、通知未读快照 `todo`）；</li>
 *   <li>「传输量」「成功率」—— 对接 at-transfer 的统计聚合接口
 *       `GET /api/v1/transfers/statistics`，字段名与后端 `TransferStatisticsVO` 逐一对齐。
 *       接口不可用时页面一律渲染「--」占位并显式提示（属降级，非「后端没做」），
 *       **不显示任何模拟数据**——假的传输量比没有传输量更糟。</li>
 * </ul>
 */

/** 传输统计（`GET /api/v1/transfers/statistics`，字段与后端 `TransferStatisticsVO` 对齐）。 */
export interface TransferStats {
  uploadCount?: number | null;
  uploadBytes?: number | null;
  downloadCount?: number | null;
  downloadBytes?: number | null;
  successCount?: number | null;
  failCount?: number | null;
  /** 成功率百分比（0-100）；后端不下发时可由 {@link successRateOf} 推算 */
  successRate?: number | null;
}

/** 非负数值归一化（负数 / NaN / 缺失 → 0），避免卡片上出现 "-1 次"。 */
export function nonNegative(value?: number | null): number {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

/** 总传输字节数（上传 + 下载）。 */
export function totalTransferBytes(stats?: TransferStats | null): number {
  if (!stats) {
    return 0;
  }
  return nonNegative(stats.uploadBytes) + nonNegative(stats.downloadBytes);
}

/**
 * 成功率（0-100，一位小数）。
 *
 * <p>优先用后端下发的 `successRate`；缺失时由 `successCount / (successCount + failCount)` 推算。
 * 分母为 0 时返回 **null 而不是 0**——「没有任务」与「全部失败」是两回事，
 * 渲染成 0% 会造成误判。
 */
export function successRateOf(stats?: TransferStats | null): number | null {
  if (!stats) {
    return null;
  }
  if (typeof stats.successRate === 'number' && Number.isFinite(stats.successRate)) {
    return Math.min(100, Math.max(0, Math.round(stats.successRate * 10) / 10));
  }
  const success = nonNegative(stats.successCount);
  const fail = nonNegative(stats.failCount);
  const total = success + fail;
  if (total === 0) {
    return null;
  }
  return Math.round((success / total) * 1000) / 10;
}
