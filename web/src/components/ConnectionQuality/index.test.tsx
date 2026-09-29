/**
 * 本端连接质量指示 · 五态与「idle 不报故障」。
 *
 * <p>钉住三条容易被「优化」掉的口径：</p>
 * <ol>
 *   <li><b>颜色不单独表意</b>：五态都必须出文字，圆点只是加速扫视；</li>
 *   <li><b>`idle` 不是故障</b>：未开始 / 已停止用中性色，绝不能与 `closed` 的红色混用——
 *       页面挂载的第一帧必然经过 idle，画红就是一次假告警；</li>
 *   <li><b>异步状态变化要能被读屏感知</b>：`role="status"` + `aria-live="polite"`。</li>
 * </ol>
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { testFormatMessage } from '@/locales/testTranslate';
import type { WsStatus } from '@/services/ws';

import ConnectionQuality from './index';

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

/** 全部五态，顺序与 `WsStatus` 声明一致。 */
const ALL_STATUSES: WsStatus[] = [
  'idle',
  'connecting',
  'open',
  'reconnecting',
  'closed',
];

const LABEL_ID_BY_STATUS: Record<WsStatus, string> = {
  idle: 'chat.connection.idle',
  connecting: 'chat.connection.connecting',
  open: 'chat.connection.open',
  reconnecting: 'chat.connection.reconnecting',
  closed: 'chat.connection.closed',
};

/** 取圆点元素（唯一一个 aria-hidden 的 span：颜色信息必须另有文字等价物）。 */
const dotOf = (container: HTMLElement) =>
  container.querySelector('span[aria-hidden="true"]');

const renderQuality = (status: WsStatus) =>
  render(<ConnectionQuality status={status} />);

describe('ConnectionQuality', () => {
  it('五态各自出文案：颜色之外必须有文字等价物', () => {
    for (const status of ALL_STATUSES) {
      const { unmount } = renderQuality(status);

      expect(screen.getByText(t(LABEL_ID_BY_STATUS[status]))).toBeInTheDocument();
      unmount();
    }
  });

  it('五态用五个不同的圆点样式变体（防止复制粘贴时两个状态接到同一变体）', () => {
    const classes = ALL_STATUSES.map((status) => {
      const { container, unmount } = renderQuality(status);
      const className = dotOf(container)?.className;
      unmount();
      return className;
    });

    expect(classes.every(Boolean)).toBe(true);
    expect(new Set(classes).size).toBe(ALL_STATUSES.length);
  });

  it('idle 与 closed 不同色：还没开始连不等于连接出故障', () => {
    const idle = renderQuality('idle');

    // 文案先分开：把 idle 说成「连接已断开」同样是谎报
    expect(screen.getByText(t('chat.connection.idle'))).toBeInTheDocument();
    expect(
      screen.queryByText(t('chat.connection.closed')),
    ).not.toBeInTheDocument();
    const idleClass = dotOf(idle.container)?.className;
    idle.unmount();

    const closed = renderQuality('closed');

    expect(screen.getByText(t('chat.connection.closed'))).toBeInTheDocument();
    expect(idleClass).not.toBe(dotOf(closed.container)?.className);
  });

  it('role=status + aria-live：断线与恢复是异步发生的，读屏用户需要被告知', () => {
    renderQuality('closed');

    const root = screen.getByRole('status');

    expect(root).toHaveAttribute('aria-live', 'polite');
  });

  it('圆点对读屏隐藏：语义由文字承担，避免「圆点」被重复朗读', () => {
    const { container } = renderQuality('open');

    expect(dotOf(container)).toHaveAttribute('aria-hidden', 'true');
  });
});
