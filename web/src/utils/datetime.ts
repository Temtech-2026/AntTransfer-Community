/**
 * 时间入参与展示格式化。
 *
 * <p>本模块同时负责两个方向，且刻意放在一起：<b>入参</b>要 ISO（`T` 分隔，后端
 * {@code LocalDateTime} 只认这个形态），<b>展示</b>要空格分隔（{@code YYYY-MM-DD HH:mm:ss}）。
 * 二者是同一枚硬币的两面，分开放很容易让某处把服务端的 ISO 串直接摆到界面上——
 * 用户看到的就是一个多余的 `T`。</p>
 *
 * <p>后端查询参数用的是 Java {@code LocalDateTime} + {@code @DateTimeFormat(iso = ISO.DATE_TIME)}，
 * 期望 <b>不带时区</b> 的 {@code yyyy-MM-dd'T'HH:mm:ss}。而 Ant Design 的日期组件交出的是
 * {@code Date} 对象，ProTable 在 {@code dateFormatter} 之后又可能交回
 * {@code 'yyyy-MM-dd HH:mm:ss'} 字符串——两者直接丢给后端都会 400。</p>
 *
 * <p>本函数把上述三种形态统一收敛，且对已是合法 ISO 的字符串<b>原样透传</b>，
 * 因此无论 ProTable 内部先 format 还是先 transform，结果都一致。</p>
 */

import dayjs from 'dayjs';

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

/** 展示层统一的日期时间格式（与 ProTable {@code valueType="dateTime"} 的默认输出一致）。 */
export const DISPLAY_DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

/**
 * 服务端时间串 → 界面展示文本。
 *
 * <p>服务端按 ISO-8601 契约下发（{@code 2026-09-26T14:30:00}），直接摆给用户会多一个
 * {@code T}。列表列由 ProTable 的 {@code valueType: 'dateTime'} 完成同样的格式化，
 * 本函数是给<b>表格之外的渲染位</b>（网格卡片 / 详情 / 抽屉）用的——两处必须同一种写法，
 * 否则切一次视图，同一个字段就换了副面孔。</p>
 *
 * <p>空值给 {@code -}（与 ProTable 的空值口径保持一致）；解析不了时<b>原样回显</b>：
 * 悄悄显示成 {@code -} 会让人以为这条记录压根没有时间，原值至少留着排查线索。</p>
 */
export function formatDisplayDateTime(value?: string | null): string {
  const raw = value?.trim();
  if (!raw) {
    return '-';
  }
  const parsed = dayjs(raw);
  return parsed.isValid() ? parsed.format(DISPLAY_DATE_TIME_FORMAT) : raw;
}
