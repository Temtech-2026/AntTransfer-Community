/**
 * ProTable 搜索表单值 → 后端查询参数的收敛工具。
 *
 * <p>ProTable 搜索表单交回来的值类型是「松」的：{@code valueType:'select'} 一律给字符串
 * （连数值枚举也是 {@code '0' / '1'}），空输入给 {@code ''} 或 {@code undefined}。
 * 直接铺给后端会在 {@code Integer} 绑定处炸 400，而「空串」又会被
 * {@code @RequestParam} 当成有效值进入 {@code LIKE %%} 分支。
 * 这两个函数把「空 → undefined（进而被 compact 剔除）」与「有值 → 正确类型」收敛在一处。</p>
 */

/** 非空字符串参数（自动 trim；空白串视为未填）。 */
export function asStringParam(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** 非空数值参数（含数值字符串；{@code NaN} / 空值视为未填）。 */
export function asNumberParam(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
