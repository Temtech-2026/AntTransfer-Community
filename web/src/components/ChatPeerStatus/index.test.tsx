/**
 * 对端状态组件 · 三态圆点与「正在输入…」。
 *
 * <p>钉住三条容易被「优化」掉的口径：</p>
 * <ol>
 *   <li><b>颜色不单独表意</b>：绿 / 灰 / 红必须始终配文字。只画点的话，
 *       红绿色盲用户与高对比度模式下就完全没有信息——而这三态正是
 *       「能不能指望对方马上回」的判断依据；</li>
 *   <li><b>未知状态不占位</b>：宁可什么都不显示，也不要一个含义不明的灰点让人猜
 *       （离线是「确定不在」，加载中是「还不知道」）；</li>
 *   <li><b>「正在输入…」替换的是文案而不是圆点</b>：圆点仍报真实三态——
 *       否则网络不佳时对方一打字就变绿，等于谎报连接质量。</li>
 * </ol>
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { testFormatMessage } from '@/locales/testTranslate';
import type { ChatPresenceStatus } from '@/services/ws/protocol';

import ChatPeerStatus from './index';

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

/** 取圆点元素（唯一一个 aria-hidden 的 span：颜色信息必须另有文字等价物）。 */
const dotOf = (container: HTMLElement) =>
  container.querySelector('span[aria-hidden="true"]');

const renderStatus = (status: ChatPresenceStatus | null, typing = false) =>
  render(<ChatPeerStatus status={status} typing={typing} />);

describe('ChatPeerStatus', () => {
  it('状态未知（加载中 / 非单聊 / 取不到）时什么都不渲染', () => {
    const { container } = renderStatus(null);

    expect(container).toBeEmptyDOMElement();
  });

  it('三态各自出文案：颜色之外必须有文字等价物', () => {
    const online = renderStatus('ONLINE');
    expect(screen.getByText(t('chat.presence.online'))).toBeInTheDocument();
    online.unmount();

    const offline = renderStatus('OFFLINE');
    expect(screen.getByText(t('chat.presence.offline'))).toBeInTheDocument();
    offline.unmount();

    const unstable = renderStatus('UNSTABLE');
    expect(screen.getByText(t('chat.presence.unstable'))).toBeInTheDocument();
    expect(dotOf(unstable.container)).not.toBeNull();
  });

  it('三态用三个不同的圆点样式变体（防止复制粘贴时两个状态接到同一变体）', () => {
    const online = renderStatus('ONLINE');
    const offline = renderStatus('OFFLINE');
    const unstable = renderStatus('UNSTABLE');

    const classes = [
      dotOf(online.container)?.className,
      dotOf(offline.container)?.className,
      dotOf(unstable.container)?.className,
    ];

    expect(new Set(classes).size).toBe(3);
  });

  it('正在输入：文案换成「对方正在输入…」，圆点仍是真实三态', () => {
    const idle = renderStatus('UNSTABLE');
    const idleDotClass = dotOf(idle.container)?.className;
    idle.unmount();

    const typing = renderStatus('UNSTABLE', true);

    expect(screen.getByText(t('chat.typing'))).toBeInTheDocument();
    // 网络不佳时对方一打字就变绿等于谎报连接质量
    expect(screen.queryByText(t('chat.presence.unstable'))).toBeNull();
    expect(dotOf(typing.container)?.className).toBe(idleDotClass);
  });

  it('异步变化要能被读屏感知：role=status + aria-live=polite', () => {
    renderStatus('ONLINE');

    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    // 圆点本身不进无障碍树：语义由同一行的文字承担
    expect(dotOf(region as HTMLElement)).not.toBeNull();
  });
});
