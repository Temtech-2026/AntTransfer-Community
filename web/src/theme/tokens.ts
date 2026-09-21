/**
 * AntTransfer CE 设计 token —— 品牌色「柔和绿」，色相沿用 `0719-AntTransfer` 的绿色体系。
 *
 * <p>本文件是**唯一的品牌色 / 圆角 / 主题偏好权威源**，页面与组件一律从这里取色，
 * 不要在业务代码里散写十六进制色值，否则暗色模式与后续换肤会漏改。
 *
 * <p><b>2026-09-21：主色 `#00d68f` → `#2fb188`（仅降饱和 / 降亮度，色相 161° 不动）。</b>
 * 原值 `hsl(161, 100%, 50%)` 是**满饱和**的青绿，在白顶栏和实心按钮上偏刺眼；刺眼来自饱和度
 * 而不是色相，所以色相保持 161°，只把饱和度降到 58%、亮度降到 44%（`hsl(161, 58%, 44%)`），
 * 观感柔和但不改品牌识别。下面几个色阶（hover / active / 浅底 / 绿底文字）随之在同一色相上重算，
 * 并把原先散在两处业务代码里的菜单 hover 浅底收成 `BRAND_PRIMARY_BG_HOVER`。
 *
 * <p>最初的色阶取自源项目 `page_template/page_style_template.html` 的 CSS 变量
 * （`--primary-green: #00c16a` / `--primary-hover: #00a35a`）与
 * `at-admin/config/defaultSettings.ts` 的 `colorPrimary: #00d68f`；本次调整后与这两处的字面值不再相同，
 * **以本文件为准**（那份源项目是历史参照，不是运行时依赖）。
 *
 * <p>本文件必须保持**零依赖**：`config/defaultSettings.ts` 会在 Node 侧直接 import 它，
 * 引入 antd / react 等运行时依赖会导致 umi 配置加载失败。
 */

/**
 * 品牌主色：antd `colorPrimary`，也是选中态、进度条、强调文字用色。
 * `hsl(161, 58%, 44%)`。
 */
export const BRAND_PRIMARY = '#2fb188';

/** 主色 hover：同色相压暗一档 `hsl(161, 58%, 38%)`。 */
export const BRAND_PRIMARY_HOVER = '#299976';

/**
 * 主色 active / 深绿 `hsl(161, 58%, 30%)`：用于**浅底之上的文字**（侧栏选中项、强调文字）。
 * 在 `BRAND_PRIMARY_BG` 上的对比度约 4.9:1，达到 WCAG AA 的 4.5:1。
 */
export const BRAND_PRIMARY_ACTIVE = '#20795d';

/** 主色浅底：侧栏选中项背景、Tag 背景、拖拽区高亮。`hsl(161, 50%, 95%)` */
export const BRAND_PRIMARY_BG = '#ecf9f5';

/**
 * 浅底再浅一档：菜单 / 列表项 hover 背景。
 *
 * <p>必须比 `BRAND_PRIMARY_BG` 淡，否则 hover 与「已选中」在侧栏里分不出来。
 */
export const BRAND_PRIMARY_BG_HOVER = '#f4faf8';

/**
 * 绿底之上的文字色。
 *
 * <p>白字在 `#2fb188` 上对比度约 2.7:1，远低于 WCAG AA 的 4.5:1（小字要求），
 * 故实心绿按钮统一用墨绿字（对比度约 6.1:1）。若哪天主色压到足够深
 * （白字 ≥ 4.5:1，约 `L ≤ 18%`），才可以把它换成白字。
 */
export const BRAND_ON_PRIMARY = '#04241a';

/** 卡片 / 表格容器圆角（源模板 `.task-panel` 为 8px）。 */
export const RADIUS_CARD = 8;

/** 大面板圆角（源模板 `.upload-zone` 为 12px）。 */
export const RADIUS_PANEL = 12;

/** 主题偏好 localStorage key，与源项目 `at-admin-theme` 同构。 */
export const THEME_STORAGE_KEY = 'anttransfer-theme';

/** 主题切换广播事件名：SettingDrawer 改主题后通知 rootContainer 重算算法。 */
export const THEME_CHANGE_EVENT = 'anttransfer-theme-change';

/** 主题偏好：明亮 / 暗色 / 跟随系统。 */
export type ThemePreference = 'light' | 'realDark' | 'auto';

/**
 * 暗色模式下的 token 覆盖。
 *
 * <p>与 `theme.darkAlgorithm` 叠加使用：算法负责整体换算，这里只钉死品牌色与
 * 少量对比度敏感项，避免算法把 `#2fb188` 派生得偏灰。
 */
export const DARK_TOKENS = {
  colorPrimary: BRAND_PRIMARY,
  colorBgLayout: '#0d0d0d',
  colorBgContainer: '#141414',
  colorBgElevated: '#1a1a1a',
  colorText: '#e0e8f0',
  colorTextSecondary: '#8899bb',
  colorBorder: '#262626',
  colorSuccess: BRAND_PRIMARY,
  colorInfo: BRAND_PRIMARY,
  colorLink: BRAND_PRIMARY,
  colorIcon: '#8899bb',
  colorIconHover: BRAND_PRIMARY,
  colorTextPlaceholder: '#555577',
} as const;

/** ProLayout 在暗色下的结构色：顶栏、侧栏背景与选中项。 */
export const DARK_LAYOUT_COLORS = {
  headerBg: '#141414',
  siderMenuBg: '#0d0d0d',
  siderSelectedBg: BRAND_PRIMARY,
  siderElevatedBg: '#141414',
} as const;

/**
 * 读取持久化的主题偏好。
 *
 * <p>localStorage 不可用（SSR / 隐私模式 / 单测）时回退 `light`，不抛错。
 */
export function readThemePreference(): ThemePreference {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 'light';
    }
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'realDark' || saved === 'auto') {
      return saved;
    }
  } catch (_error) {
    // 忽略：拿不到偏好就按明亮处理，不影响渲染
  }
  return 'light';
}

/**
 * 把主题偏好解析为「是否暗色」。
 *
 * <p>`auto` 依赖 `matchMedia`，jsdom 等环境可能未实现，故整体 try/catch 兜底为明亮。
 */
export function resolveIsDark(
  preference: ThemePreference = readThemePreference(),
): boolean {
  if (preference === 'realDark') {
    return true;
  }
  if (preference === 'light') {
    return false;
  }
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  } catch (_error) {
    return false;
  }
}

/**
 * 三栏式外壳的尺寸口径。
 *
 * <p>「顶栏 / 左侧功能栏 / 主内容区」三块的宽高在这里统一声明：
 * ProLayout 配置、抽屉与悬浮窗都从这里取，避免同一个尺寸在多处各写一份而失去一致性。
 */
export const SHELL = {
  /** 顶栏高度：低于 56 会放不下「组织切换器 + 搜索框 + 三枚动作图标」 */
  headerHeight: 56,
  /** 左侧功能栏宽度：能完整显示「共享空间」这类四字菜单外加图标 */
  siderWidth: 208,
  /** 即时通讯抽屉宽度（方案口径 350~400px） */
  chatDrawerWidth: 380,
  /** 传输监控悬浮窗宽度 */
  transferPanelWidth: 320,
} as const;

/** 写入主题偏好并广播事件，供 rootContainer 与 ProLayout 同步换肤。 */
export function persistThemePreference(navTheme: string | undefined): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    const preference: ThemePreference =
      navTheme === 'realDark' ? 'realDark' : 'light';
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  } catch (_error) {
    // 忽略：持久化失败不应阻断主题切换本身
  }
}
