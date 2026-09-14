/**
 * 时间入参规范化。
 *
 * <p>后端查询参数用的是 Java {@code LocalDateTime} + {@code @DateTimeFormat(iso = ISO.DATE_TIME)}，
 * 期望 <b>不带时区</b> 的 {@code yyyy-MM-dd'T'HH:mm:ss}。而 Ant Design 的日期组件交出的是
 * {@code Date} 对象，ProTable 在 {@code dateFormatter} 之后又可能交回
 * {@code 'yyyy-MM-dd HH:mm:ss'} 字符串——两者直接丢给后端都会 400。</p>
 *
 * <p>本函数把上述三种形态统一收敛，且对已是合法 ISO 的字符串<b>原样透传</b>，
 * 因此无论 ProTable 内部先 format 还是先 transform，结果都一致。</p>
 */

/** 本地时区的 {@code yyyy-MM-dd'T'HH:mm:ss}（刻意不带 {@code Z} / 偏移量）。 */
export function formatLocalDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * 把 {@code Date} / 松散字符串收敛为后端可解析的 ISO 本地时间。
 *
 * @returns 空值返回 {@code undefined}（用于「不传该过滤条件」）；无法识别时原样返回，
 *          交由后端返回明确的 400，而不是前端悄悄吞掉用户的筛选意图
 */
export function toBackendDateTime(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : formatLocalDateTime(value);
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const raw = value.trim().replace(' ', 'T');
  if (raw === '') {
    return undefined;
  }
  // 仅日期 → 补零点
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw}T00:00:00`;
  }
  // 到分钟 → 补秒
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    return `${raw}:00`;
  }
  return raw;
}
