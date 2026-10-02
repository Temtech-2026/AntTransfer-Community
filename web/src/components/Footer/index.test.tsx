/**
 * 页脚 · 仓库链接与版本元信息。
 *
 * <p>钉住三条口径：</p>
 * <ol>
 *   <li><b>主仓库 + 镜像并列</b>：Gitee（主，取自 `package.json.repository`）与 GitHub
 *       （镜像，组件内声明）都指向本项目。仓库地址迁移过一次，页脚漏改会把访问者引到 404，
 *       因此这里断言的是**真实地址**而非「有没有链接」；</li>
 *   <li><b>旧组织名不得回归</b>：`Temtech-close_source` 已退役，任何一处残留都算失败；</li>
 *   <li><b>版本号指向主仓库</b>：镜像可能滞后，版本信息应以权威源为准。</li>
 * </ol>
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Footer from './index';

// Umi 的 define 在 Vitest 下不存在，补上即可（组件只在渲染时读取这几个全局量）
vi.stubGlobal('__APP_VERSION__', '0.1.0');
vi.stubGlobal('__UMI_VERSION__', '4.0.0');
vi.stubGlobal('__UTOO_VERSION__', '1.0.0');

const MAIN_REPO_URL = 'https://gitee.com/temtech/AntTransfer-Community';
const MIRROR_REPO_URL = 'https://github.com/Temtech-2026/AntTransfer-Community';

/** 取承载该文案的链接（文案是链接的直接文本子节点，图标不参与匹配）。 */
const linkOf = (text: string) => screen.getByText(text).closest('a');

describe('Footer', () => {
  it('并列展示主仓库与 GitHub 镜像，且都指向真实地址', () => {
    render(<Footer />);

    expect(linkOf('gitee.com')).toHaveAttribute('href', MAIN_REPO_URL);
    expect(linkOf('github.com')).toHaveAttribute('href', MIRROR_REPO_URL);
  });

  it('已退役的旧 Gitee 组织名不再出现', () => {
    const { container } = render(<Footer />);

    expect(container.innerHTML).not.toContain('Temtech-close_source');
  });

  it('版本号链接指向主仓库（权威源），不指向镜像', () => {
    render(<Footer />);

    expect(linkOf('0.1.0')).toHaveAttribute('href', MAIN_REPO_URL);
  });
});
