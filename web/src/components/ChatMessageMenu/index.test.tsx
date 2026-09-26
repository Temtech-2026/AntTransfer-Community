/**
 * 消息气泡右键菜单 · 「引用 / 撤回」的显隐与顺序。
 *
 * <p>钉住三条容易被「顺手优化」掉的口径：</p>
 * <ol>
 *   <li><b>不可用项直接不出现，而不是置灰</b>：撤回只在「自己发的 + 2 分钟内 + 未撤回」时存在。
 *       置灰会留下一个没人能回答的问题（用户看不到 2 分钟这条规则），
 *       而且会让人以为「再等等就能撤」——实际超窗是终态（服务端回 `1034`）；</li>
 *   <li><b>两项都不可用时不包 `Dropdown`</b>：右键弹出一个空菜单，比右键没有任何反应更让人困惑
 *       （用户会以为是界面卡住了）；</li>
 *   <li><b>不套壳、直接克隆气泡</b>：多包一层 `div` 会让百分比宽度被二次计算
 *       （气泡在抽屉里是 `max-width: 78%`），右键范围也会与气泡视觉范围不一致——
 *       这条回归在用例里表现为「可右键的元素就是气泡本体」。</li>
 * </ol>
 *
 * <p>菜单的显隐<b>不是安全边界</b>：归属与时间窗由服务端判定（`1034/1035`），
 * 引用目标由服务端校验（`1036`）。</p>
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { testFormatMessage } from '@/locales/testTranslate';

import ChatMessageMenu from './index';

vi.mock('@umijs/max', async () => {
  const { testFormatMessage: translate } = await import(
    '@/locales/testTranslate'
  );
  return {
    useIntl: () => ({
      formatMessage: (
        descriptor: { id: string; values?: Record<string, unknown> },
        values?: Record<string, unknown>,
      ) => translate({ id: descriptor.id, values: values ?? descriptor.values }),
    }),
  };
});

const t = (id: string) => testFormatMessage({ id });

/**
 * 菜单项的可访问名里会带上图标的 `aria-label`（antd 图标是 `role="img"`，
 * 如「message 引用」），故按文案做子串匹配。
 */
const QUOTE_ITEM = /引用/;
const RECALL_ITEM = /撤回/;

const renderMenu = (over: {
  canRecall?: boolean;
  canQuote?: boolean;
  onRecall?: () => void;
  onQuote?: () => void;
} = {}) =>
  render(
    <ChatMessageMenu
      canRecall={over.canRecall ?? true}
      canQuote={over.canQuote ?? true}
      onRecall={over.onRecall ?? vi.fn()}
      onQuote={over.onQuote ?? vi.fn()}
    >
      <div>方案已发</div>
    </ChatMessageMenu>,
  );

/** 右键气泡本体（菜单挂在它身上，故右键目标就是它）。 */
const rightClick = () => fireEvent.contextMenu(screen.getByText('方案已发'));

describe('ChatMessageMenu', () => {
  it('两项都可用时：引用在前、撤回在后（引用是常规操作，撤回是破坏性操作）', async () => {
    renderMenu();

    rightClick();

    const items = await screen.findAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual([
      t('chat.message.action.quote'),
      t('chat.message.action.recall'),
    ]);
  });

  it('撤回项带 danger 标记：破坏性操作不能与引用长得一样', async () => {
    renderMenu();

    rightClick();

    const recall = await screen.findByRole('menuitem', {
      name: RECALL_ITEM,
    });
    expect(recall.className).toContain('danger');
  });

  it('超出时间窗（canRecall=false）只给「引用」：摆一个必然被拒的入口等于功能坏了', async () => {
    renderMenu({ canRecall: false });

    rightClick();

    expect(
      await screen.findByRole('menuitem', { name: QUOTE_ITEM }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: RECALL_ITEM })).toBeNull();
  });

  it('已撤回的消息（canQuote=false）只剩「撤回」：引用一条已撤回的消息只会渲染出空引用块', async () => {
    renderMenu({ canQuote: false });

    rightClick();

    expect(
      await screen.findByRole('menuitem', { name: RECALL_ITEM }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: QUOTE_ITEM })).toBeNull();
  });

  it('两项都不可用：不包 Dropdown，右键不弹空菜单，气泡照常渲染', () => {
    const onQuote = vi.fn();
    renderMenu({ canRecall: false, canQuote: false, onQuote });

    rightClick();

    expect(screen.getByText('方案已发')).toBeInTheDocument();
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
    expect(onQuote).not.toHaveBeenCalled();
  });

  it('点「引用」/「撤回」各自只触发对应回调（两个入口不能串台）', async () => {
    const onRecall = vi.fn();
    const onQuote = vi.fn();
    renderMenu({ onRecall, onQuote });

    rightClick();
    fireEvent.click(await screen.findByRole('menuitem', { name: QUOTE_ITEM }));
    expect(onQuote).toHaveBeenCalledTimes(1);
    expect(onRecall).not.toHaveBeenCalled();

    rightClick();
    fireEvent.click(await screen.findByRole('menuitem', { name: RECALL_ITEM }));
    expect(onRecall).toHaveBeenCalledTimes(1);
    expect(onQuote).toHaveBeenCalledTimes(1);
  });
});
