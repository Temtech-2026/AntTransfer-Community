import routes from '@root/config/routes';
import bnBDMenu from './bn-BD/menu';
import enUSMenu from './en-US/menu';
import esESMenu from './es-ES/menu';
import faIRMenu from './fa-IR/menu';
import frFRMenu from './fr-FR/menu';
import idIDMenu from './id-ID/menu';
import jaJPMenu from './ja-JP/menu';
import koKRMenu from './ko-KR/menu';
import ptBRMenu from './pt-BR/menu';
import ruRUMenu from './ru-RU/menu';
import zhCNMenu from './zh-CN/menu';
import zhTWMenu from './zh-TW/menu';

/**
 * 侧栏菜单国际化回归护栏。
 *
 * <p>背景：ProLayout 的菜单名来自 `@umijs/route-utils` 的 `transformRoute`，它按
 * `getItemLocaleName` 规则把路由 `name` 拼成 locale id（顶层前缀 `menu`，子菜单前缀是父菜单的
 * locale id），再交给 `formatMessage({ id, defaultMessage: name })`。**一旦语言包缺少该 id，
 * react-intl 会回退到 `defaultMessage`，也就是把路由名（`workbench` / `upload`）原样显示出来**，
 * 表现为「切换语言时只有个别菜单项变化、其余菜单名看似没翻译」。
 *
 * <p>Ant Design Pro 脚手架自带的 8 个语言包只翻译了示例页菜单，项目自建菜单键（工作台 / 分片上传 /
 * 文件工作台 / …）最初只补在 zh-CN、en-US 上，其余语言因此整体回退成原始路由名。本用例把
 * 「必需键」直接由 `config/routes.ts` 派生，新增菜单时若漏翻译会立即失败。
 */

type RouteLike = {
  name?: string;
  layout?: boolean;
  routes?: RouteLike[];
};

/** 与 `@umijs/route-utils` 的 `getItemLocaleName(item, parentName || 'menu')` 同口径。 */
function collectProjectMenuKeys(
  items: RouteLike[],
  parentKey = 'menu',
  acc = new Map<string, string>(),
): Map<string, string> {
  for (const item of items) {
    // `layout: false` 的路由不进入 ProLayout 菜单（登录页 / 404 例外页）
    if (item.layout === false) continue;
    // 侧栏只渲染带 `name` 的路由
    if (!item.name) continue;
    const key = `${parentKey}.${item.name}`;
    acc.set(key, item.name);
    if (item.routes?.length) {
      collectProjectMenuKeys(item.routes, key, acc);
    }
  }
  return acc;
}

const projectMenuKeys = collectProjectMenuKeys(routes as RouteLike[]);

const MENU_MESSAGES: Record<string, Record<string, string>> = {
  'zh-CN': zhCNMenu,
  'zh-TW': zhTWMenu,
  'en-US': enUSMenu,
  'ja-JP': jaJPMenu,
  'ko-KR': koKRMenu,
  'fr-FR': frFRMenu,
  'ru-RU': ruRUMenu,
  'es-ES': esESMenu,
  'pt-BR': ptBRMenu,
  'id-ID': idIDMenu,
  'fa-IR': faIRMenu,
  'bn-BD': bnBDMenu,
};

describe('侧栏菜单国际化', () => {
  it('必需键能由 config/routes.ts 派生出来（避免用例空转）', () => {
    const keys = [...projectMenuKeys.keys()];
    expect(keys).toContain('menu.workbench');
    expect(keys).toContain('menu.upload');
    expect(keys).toContain('menu.system');
    expect(keys).toContain('menu.system.users');
    expect(keys).toContain('menu.permissionMap');
  });

  for (const [locale, messages] of Object.entries(MENU_MESSAGES)) {
    it(`${locale} 语言包覆盖全部项目菜单键`, () => {
      const missing = [...projectMenuKeys.keys()].filter(
        (key) => !(key in messages),
      );
      expect(missing).toEqual([]);
    });

    it(`${locale} 的菜单文案不是路由名（无原始 key 泄漏）`, () => {
      const leaked = [...projectMenuKeys.entries()]
        .filter(([key, routeName]) => {
          const text = messages[key];
          return !text || text === key || text === routeName;
        })
        .map(([key]) => key);
      expect(leaked).toEqual([]);
    });
  }
});
