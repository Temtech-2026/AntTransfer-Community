/**
 * 界面语言 → 请求头。
 *
 * <p>后端按 `Accept-Language` 决定返回的**文案语种**（错误消息、通知标题、字典 label）。
 * 这里只负责如实上报「当前界面语言」这一个事实，不做任何翻译——前端的界面文案仍以
 * `src/locales/*` 为准，两者必须同源，否则会出现「界面英文、报错中文」的割裂感。
 *
 * <p>只上报 `SUPPORTED` 里列出的语言：`src/locales` 下没有的语言即使被浏览器声明，后端也翻不出来，
 * 上报了反而让后端选到一个前端渲染不了的语言。
 */

import { getLocale } from '@umijs/max';

/**
 * 与 `src/locales/*` 目录一一对应（新增语言包时必须同步登记，否则切不过去）。
 *
 * <p>**顺序即语言开关的展示顺序**：默认语言中文置顶，英文作为事实通用语与
 * `resolveUiLocale` 的兜底语言紧随其后，其余语言按加入顺序排列。
 */
const SUPPORTED = [
  'zh-CN',
  'en-US',
  'ko-KR',
  'ja-JP',
  'fr-FR',
  'ru-RU',
  'es-ES',
] as const;

export type AppLocale = (typeof SUPPORTED)[number];

/** 受支持的界面语言清单（顺序即语言开关的展示顺序）。 */
export const SUPPORTED_LOCALES: readonly AppLocale[] = SUPPORTED;

export const DEFAULT_LOCALE: AppLocale = 'zh-CN';

/**
 * 归一化到受支持语言。
 *
 * <p>浏览器/系统可能给出 `en`、`en-GB`、`ko`、`ja`、`fr-CA`、`es-419`、`zh-Hans-CN` 这类
 * 带地区或脚本的标签，按「精确匹配 → 主语言前缀匹配 → 默认」三级回落。
 */
export function normalizeLocale(locale?: string | null): AppLocale {
  if (!locale) {
    return DEFAULT_LOCALE;
  }
  const lower = locale.toLowerCase();
  const exact = SUPPORTED.find((item) => item.toLowerCase() === lower);
  if (exact) {
    return exact;
  }
  const prefix = lower.split('-')[0];
  return (
    SUPPORTED.find((item) => item.toLowerCase().startsWith(prefix)) ??
    DEFAULT_LOCALE
  );
}

/**
 * 把任意语言标签收敛到「界面语言」受支持集合。
 *
 * <p>与 `normalizeLocale` 的差别在兜底策略：`normalizeLocale` 服务于后端 `Accept-Language`，
 * 兜底取默认语言（zh-CN）；界面语言则按「中文语系 → zh-CN，其余 → en-US」回落——
 * 多语言产品里，未支持语种的用户读英文比读中文更合理。
 *
 * <p>存在的意义：浏览器 / 系统语言可能是 `zh-TW` / `pt-BR` / `fa-IR` 这类
 * **`src/locales` 下没有对应语言包**的值。若原样交给 Umi，`getLocale()` 会返回该值，
 * 页面文案随之回退成 `defaultMessage`（中文）甚至原始 key，表现为「切了语言但界面没变」。
 */
export function resolveUiLocale(locale?: string | null): AppLocale {
  if (!locale) {
    return DEFAULT_LOCALE;
  }
  const lower = locale.toLowerCase();
  const exact = SUPPORTED.find((item) => item.toLowerCase() === lower);
  if (exact) {
    return exact;
  }
  // 主语言已被支持、只是地区不同（`ko-KP` / `ko` / `ja` / `fr-CA` / `es-419` / `en-GB`）时，
  // 收敛到该语言已支持的那一个变体，比直接回落英文更贴近用户预期；
  // 否则这些用户在界面上会被「降级」成英文。
  const prefix = lower.split('-')[0];
  const sameLanguage = SUPPORTED.find(
    (item) => item.toLowerCase().split('-')[0] === prefix,
  );
  if (sameLanguage) {
    return sameLanguage;
  }
  return lower.startsWith('zh') ? DEFAULT_LOCALE : 'en-US';
}

/**
 * 当前语言的 `Accept-Language` 值。
 *
 * <p>`getLocale` 来自 Umi 的 locale 插件；在单测或非 React 环境下可能不可用，
 * 因此吞掉异常回落默认语言——多语言是增强，不能因为取不到语言就让请求发不出去。
 */
export function currentAcceptLanguage(): string {
  try {
    return normalizeLocale(getLocale());
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * 给任意「类 axios 配置」写入 `Accept-Language`。
 *
 * <p>兼容 `AxiosHeaders`（有 `set()`）与普通对象两种形态，与
 * `withAuthHeader` 的处理方式保持一致。
 */
export function withAcceptLanguageHeader<T extends { headers?: any }>(
  config: T,
): T {
  const value = currentAcceptLanguage();
  if (config.headers && typeof config.headers.set === 'function') {
    config.headers.set('Accept-Language', value);
  } else {
    config.headers = { ...(config.headers ?? {}), 'Accept-Language': value };
  }
  return config;
}
