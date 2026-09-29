/**
 * 本端连接质量（聊天页页头的常驻弱提示）。
 *
 * <p><b>与 `ChatPeerStatus` 是两件事，因此不能并排：</b>那个说的是「对方在不在线」，
 * 这个说的是「我与服务器的实时通道好不好」。两者取值相互独立（我断网时对方仍可能在线），
 * 并排挂在会话标题旁时，用户会把「我的连接质量」读成「对方是否在线」——
 * 这正是它从会话列表标题旁搬到页头的原因。</p>
 *
 * <p><b>颜色不单独表意：</b>圆点始终配文字。只画点的话，红绿色盲用户与高对比度模式下
 * 等于没有信息（与 `ChatPeerStatus` 的文件头同一口径）。</p>
 *
 * <p><b>`idle` 不是故障：</b>它表示「还没开始连 / 已主动停止」，既不画错误色也不报错。
 * 用 `status !== 'open'` 一律画红，会在页面刚挂载、握手尚未开始的那一帧谎报断线；
 * 而顶部的 `connectionAlert` 恰恰把 `idle` 当正常态（不显示横幅），两处必须同口径。</p>
 *
 * <p>颜色取值与 `connectionAlert` 的 tone 一一对应（蓝 / 黄 / 红），
 * 避免同一时刻横幅说一种颜色、圆点说另一种。</p>
 */

import { useIntl } from '@umijs/max';
import { createStyles } from 'antd-style';

import type { WsStatus } from '@/services/ws';

const useStyles = createStyles(({ token }) => ({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: token.fontSizeSM,
    lineHeight: 1.4,
    color: token.colorTextSecondary,
  },

  dot: {
    display: 'inline-block',
    flex: 'none',
    width: 8,
    height: 8,
    borderRadius: '50%',
  },

  /** 通道健康。 */
  dotOpen: {
    background: token.colorSuccess,
  },
  /** 正在建连：与 `connectionAlert` 的 info 同色。 */
  dotConnecting: {
    background: token.colorInfo,
  },
  /** 断线自动重连：与 `connectionAlert` 的 warning 同色。 */
  dotReconnecting: {
    background: token.colorWarning,
  },
  /** 连接已关闭（新消息会延迟到达）：与 `connectionAlert` 的 error 同色。 */
  dotClosed: {
    background: token.colorError,
  },
  /**
   * 未连接（尚未开始 / 已主动停止）：中性灰。
   *
   * <p>不能与 {@link dotClosed} 共用红色：红是「出问题了」，而 idle 只是「没在用」，
   * 任何一次页面挂载都必然经过这一态。</p>
   */
  dotIdle: {
    background: token.colorTextQuaternary,
  },

  label: {
    whiteSpace: 'nowrap',
  },
}));

type Styles = ReturnType<typeof useStyles>['styles'];

/**
 * 状态 → 文案键。
 *
 * <p>用 `Record<WsStatus, …>` 而不是拼字符串：`WsStatus` 新增取值时这里会直接编译报错，
 * 强迫补齐文案（拼串会静默落到运行时缺键）。</p>
 */
const LABEL_ID_BY_STATUS: Record<WsStatus, string> = {
  open: 'chat.connection.open',
  connecting: 'chat.connection.connecting',
  reconnecting: 'chat.connection.reconnecting',
  closed: 'chat.connection.closed',
  idle: 'chat.connection.idle',
};

/** 状态 → 圆点样式变体（同上，穷尽性由类型保证）。 */
const DOT_CLASS_BY_STATUS: Record<WsStatus, (styles: Styles) => string> = {
  open: (styles) => styles.dotOpen,
  connecting: (styles) => styles.dotConnecting,
  reconnecting: (styles) => styles.dotReconnecting,
  closed: (styles) => styles.dotClosed,
  idle: (styles) => styles.dotIdle,
};

export interface ConnectionQualityProps {
  /** 实时连接状态（直接来自 `useWebSocket`，不要在这里换算成布尔值）。 */
  status: WsStatus;
}

const ConnectionQuality = ({ status }: ConnectionQualityProps) => {
  const intl = useIntl();
  const { styles } = useStyles();

  return (
    // aria-live：断线与恢复都是异步发生的，读屏用户需要被告知
    <span className={styles.root} role="status" aria-live="polite">
      <span
        className={[styles.dot, DOT_CLASS_BY_STATUS[status](styles)]
          .filter(Boolean)
          .join(' ')}
        aria-hidden="true"
      />
      <span className={styles.label}>
        {intl.formatMessage({ id: LABEL_ID_BY_STATUS[status] })}
      </span>
    </span>
  );
};

export default ConnectionQuality;
