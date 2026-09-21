/**
 * 免登录公开页的暗色主题（登录页 `/user/login`、访客取件页 `/share/:token`）。
 *
 * <p>这两页是「站外视角」的入口：都<b>不</b>走管理端布局（`layout: false`），都压在
 * `FlyingFilesBackground` 的深空背景上，因此共用同一份暗色 token，保证同屏视觉一致。</p>
 *
 * <p><b>为什么必须是独立常量而不是各页各写一份</b>：两边若各自维护，改一处配色就会漂移，
 * 而这两页恰恰是访客唯一见过的界面——不一致比丑更伤信任。集中一份后，
 * 「深色背景 + 青绿强调色」这套口径只有一个来源。</p>
 *
 * <p>实现上只覆盖 token，不逐条覆盖 `.ant-*` 内部类名：后者一旦 antd 调整 DOM 结构就会静默失效。</p>
 */

import type { ThemeConfig } from 'antd';
import { theme } from 'antd';

import { BRAND_ON_PRIMARY, BRAND_PRIMARY } from '@/theme/tokens';

/** 公开页暗色主题（与深空背景同色系）。 */
export const PUBLIC_DARK_THEME: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    // 控件底色比卡片更暗，压出内凹层次，也让磨砂卡片透出背景流光
    colorBgContainer: 'rgba(0, 0, 0, 0.25)',
    colorBorder: 'rgba(0, 212, 255, 0.15)',
    // 品牌色一律取自 src/theme/tokens：原先这里散写了三次 `#00d68f`，
    // 换主色时必然漏改这两页（登录页 / 访客取件页正是访客唯一见过的界面）
    colorPrimary: BRAND_PRIMARY,
    colorPrimaryHover: BRAND_PRIMARY,
    colorLink: BRAND_PRIMARY,
    colorIcon: '#80c8a0',
    colorText: '#e0e8f5',
    colorTextHeading: '#ffffff',
    colorTextSecondary: '#b8c8e0',
    colorTextPlaceholder: '#8899bb',
    // 实心主按钮：品牌绿底配白字对比度只有约 2.7:1，远低于 WCAG AA 的 4.5:1；
    // 换成深墨绿字后可达 6.1:1。若想还原白字，删掉这一行即可。
    colorTextLightSolid: BRAND_ON_PRIMARY,
  },
};
