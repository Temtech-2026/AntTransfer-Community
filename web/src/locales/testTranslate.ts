/**
 * 单测用文案解析器。
 *
 * <p>组件里的文案一律写成 `intl.formatMessage({ id: 'x.y' })`，不写 `defaultMessage`，
 * 以保证语言包是唯一事实源。单测若自己 mock 一份中文，就等于绕开了语言包，
 * 键写错也不会被发现。因此这里直接从 `zh-CN` 语言包取值，缺失时抛错，
 * 让「键不存在」在单测阶段就暴露（等价于一个便宜的守卫）。</p>
 */
import zhCN from './zh-CN';

const MESSAGES = zhCN as unknown as Record<string, string>;

/** 表单描述符的最小形状（只覆盖单测用得到的字段）。 */
export interface MessageDescriptorLike {
  id: string;
  values?: Record<string, unknown>;
}

/** ICU 占位符的极简替换：只处理 `{name}` / `{name, number, ...}` 这类常见写法。 */
export function formatTestMessage(
  template: string,
  values?: Record<string, unknown>,
): string {
  return template.replace(/\{(\w+)[^}]*\}/g, (whole, key: string) => {
    const value = values?.[key];
    return value === undefined ? whole : String(value);
  });
}

/** 供 `vi.mock('@umijs/max')` 里的 `useIntl` 使用。 */
export function testFormatMessage(descriptor: MessageDescriptorLike): string {
  const template = MESSAGES[descriptor.id];
  if (template === undefined) {
    // 抛错而不是回退 key：语言包缺键必须在单测里立刻失败
    throw new Error(`[i18n] missing zh-CN message for id: ${descriptor.id}`);
  }
  return formatTestMessage(template, descriptor.values);
}
