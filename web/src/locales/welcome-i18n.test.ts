import bnBDPages from './bn-BD/pages';
import enUSPages from './en-US/pages';
import faIRPages from './fa-IR/pages';
import idIDPages from './id-ID/pages';
import jaJPPages from './ja-JP/pages';
import ptBRPages from './pt-BR/pages';
import zhCNPages from './zh-CN/pages';
import zhTWPages from './zh-TW/pages';

/**
 * 欢迎页（`pages/Welcome.tsx`）文案键回归护栏。
 *
 * <p>背景：欢迎页是登录后的默认落点（`utils/redirect.ts` 的 `DEFAULT_REDIRECT_PATH`），
 * 它的文案 id 最初只补在 zh-CN / en-US，其余 6 种语言整体缺失——react-intl 找不到 id 时会
 * 把 `pages.welcome.hero.title` 这样的原始 key 直接渲染到页面上，表现为「切到某语言后
 * 欢迎页满是英文 id」。
 *
 * <p>`i18n-parity.test.ts` 只比对 zh-CN ↔ en-US 的键集合，覆盖不到这 6 种语言；本用例按
 * {@link REQUIRED_KEYS} 逐语言核对，新增欢迎页文案时若漏翻译会立即失败。
 *
 * <p>维护方式：`REQUIRED_KEYS` 与 `pages/Welcome.tsx` 中引用的 id 一一对应，改动页面时同步。
 */

/** `pages/Welcome.tsx` 引用的全部文案 id。 */
const REQUIRED_KEYS = [
  'pages.welcome.header.title',
  'pages.welcome.header.subTitle',
  'pages.welcome.hero.title',
  'pages.welcome.hero.desc',
  'pages.welcome.feature.transfer.title',
  'pages.welcome.feature.transfer.desc',
  'pages.welcome.feature.collaboration.title',
  'pages.welcome.feature.collaboration.desc',
  'pages.welcome.feature.permission.title',
  'pages.welcome.feature.permission.desc',
  'pages.welcome.quickStart.title',
  'pages.welcome.quickStart.subTitle',
  'pages.welcome.quickStart.proxyPrefix',
  'pages.welcome.quickStart.proxyMiddle',
  'pages.welcome.quickStart.proxySuffix',
  'pages.welcome.quickStart.domainHint',
];

const MESSAGES: Record<string, Record<string, string>> = {
  'zh-CN': zhCNPages,
  'zh-TW': zhTWPages,
  'en-US': enUSPages,
  'ja-JP': jaJPPages,
  'pt-BR': ptBRPages,
  'id-ID': idIDPages,
  'fa-IR': faIRPages,
  'bn-BD': bnBDPages,
};

describe('欢迎页文案国际化', () => {
  it('必需键清单非空且覆盖页面的三段式拼接键（避免用例空转）', () => {
    expect(REQUIRED_KEYS.length).toBeGreaterThan(0);
    expect(REQUIRED_KEYS).toContain('pages.welcome.hero.title');
    expect(REQUIRED_KEYS).toContain('pages.welcome.quickStart.proxyPrefix');
    expect(REQUIRED_KEYS).toContain('pages.welcome.quickStart.proxySuffix');
  });

  for (const [locale, messages] of Object.entries(MESSAGES)) {
    it(`${locale} 语言包覆盖欢迎页全部文案键`, () => {
      const missing = REQUIRED_KEYS.filter((key) => !(key in messages));
      expect(missing).toEqual([]);
    });

    it(`${locale} 的欢迎页文案非空且未泄漏原始 key`, () => {
      const leaked = REQUIRED_KEYS.filter((key) => {
        const text = messages[key];
        return !text || text.trim() === '' || text === key;
      });
      expect(leaked).toEqual([]);
    });
  }
});
