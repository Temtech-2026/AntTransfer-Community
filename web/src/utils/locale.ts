/**
 * 界面语言 → 请求头。
 *
 * <p>后端按 `Accept-Language` 决定返回的**文案语种**（错误消息、通知标题、字典 label）。
 * 这里只负责如实上报「当前界面语言」这一个事实，不做任何翻译——前端的界面文案仍以
 * `src/locales/*` 为准，两者必须同源，否则会出现「界面英文、报错中文」的割裂感。
 *
 * <p>只上报 `zh-CN` / `en-US`：`src/locales` 下没有的语言即使被浏览器声明，后端也翻不出来，
 * 上报了反而让后端选到一个前端渲染不了的语言。
 */

import { getLocale } from '@umijs/max';

/** 与 `src/locales/*` 目录一一对应 */
const SUPPORTED = ['zh-CN', 'en-US'] as const;

export type AppLocale = (typeof SUPPORTED)[number];

export const DEFAULT_LOCALE: AppLocale = 'zh-CN';

/**
 * 归一化到受支持语言。
 *
 * <p>浏览器/系统可能给出 `en`、`en-GB`、`zh-Hans-CN` 这类带地区或脚本的标签，
 * 按「精确匹配 → 主语言前缀匹配 → 默认」三级回落。
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
