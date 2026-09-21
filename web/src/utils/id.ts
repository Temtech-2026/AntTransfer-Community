/**
 * 雪花 ID（字符串形态）工具。
 *
 * <p>后端主键是 19 位雪花 ID，超出 JS {@code Number.MAX_SAFE_INTEGER}（2^53-1）。为避免
 * {@code JSON.parse} 静默取整末位，服务端一律以 JSON 字符串下发、前端一律用 {@code string}
 * 承接；因此**任何地方都不得对 ID 做 {@code Number()} / {@code parseInt()} 归一**。</p>
 *
 * <p>需要比较先后（排序、取最新）时用 {@link compareSnowflakeId}：非负整数字符串
 * 「先比长度、再比字典序」与数值序等价，且不丢精度。</p>
 */

/**
 * 按数值序比较两个雪花 ID 字符串。
 *
 * @param a 左值；空串 / {@code null} / {@code undefined} 表示「尚未拿到服务端 ID」（乐观行）
 * @param b 右值
 * @returns 负数表示 a 在前，正数表示 b 在前，0 表示相等；空值视为最大（排在末尾）
 */
export function compareSnowflakeId(
  a?: string | null,
  b?: string | null,
): number {
  const leftEmpty = a == null || a === '';
  const rightEmpty = b == null || b === '';
  if (leftEmpty || rightEmpty) {
    if (leftEmpty && rightEmpty) {
      return 0;
    }
    return leftEmpty ? 1 : -1;
  }
  const left = a as string;
  const right = b as string;
  if (left.length !== right.length) {
    return left.length - right.length;
  }
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * 判断是否为合法的正整数 ID 字符串（替代 `Number.isInteger` 做入参校验，避免丢精度）。
 *
 * <p>拒绝前导零 / 负号 / 科学计数法 / 空白：这些都不是服务端下发的 ID 形态。</p>
 */
export function isPositiveIdString(value?: string | null): boolean {
  return typeof value === 'string' && /^[1-9]\d*$/.test(value);
}
