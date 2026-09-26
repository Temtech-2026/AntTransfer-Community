/**
 * 会话对端状态（在线三态圆点 + 「对方正在输入…」）。
 *
 * <p><b>颜色不单独承载语义</b>：绿 / 灰 / 红三态始终配文字（在线 / 离线 / 网络状态不佳）。
 * 色盲用户（红绿色盲占比不低）与高对比度模式下，只靠圆点等于没有信息；
 * 而这三态恰好是「能不能期待对方马上回」的判断依据。</p>
 *
 * <p><b>「正在输入」用同一行文字替换状态文案</b>，而不是另起一行：微信里这两个信息
 * 也共用会话标题下方那一行——它们是同一时刻的互斥事实（对方正在打字时，
 * 「在线」这条信息已经被更强的那条覆盖）。圆点保持真实三态不跟着变，
 * 否则网络不佳时一打字就变绿，等于谎报连接质量。</p>
 *
 * <p>两个聊天入口（`/chat` 页与即时通讯抽屉）共用本组件，避免同一件事两处实现漂移。</p>
 */

import { useIntl } from '@umijs/max';
import { createStyles } from 'antd-style';

import { presenceLabelId } from '@/services/chat/presence';
import type { ChatPresenceStatus } from '@/services/ws/protocol';

const useStyles = createStyles(({ token }) => ({
  root: {
    display: 'inline-flex',
    maxWidth: '100%',
    alignItems: 'center',
    gap: 6,
    fontSize: token.fontSizeSM,
    lineHeight: 1.4,
    color: token.colorTextSecondary,
  },

  /** 窄容器（抽屉头部）用更小的字号与间距。 */
  compact: {
    gap: 4,
    fontSize: token.fontSizeSM,
  },

  dot: {
    display: 'inline-block',
    flex: 'none',
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
  dotCompact: {
    width: 6,
    height: 6,
  },
  /** 绿点：活跃时刻在健康窗口内。 */
  dotOnline: {
    background: token.colorSuccess,
  },
  /**
   * 灰点：无活跃记录。
   *
   * <p>用 `colorTextQuaternary` 这类「弱文字色」而不是 `colorTextDisabled`：
   * 离线是常态而非禁用态，太浅会让它在深色主题里彻底看不见。</p>
   */
  dotOffline: {
    background: token.colorTextQuaternary,
  },
  /** 红点：连接还在但心跳迟到，即「网络状态不佳」。 */
  dotUnstable: {
    background: token.colorError,
  },

  label: {
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },

  /** 「正在输入…」用主品牌色：它是动态事件，比静态状态更值得一眼看到。 */
  typing: {
    color: token.colorPrimary,
  },
}));

export interface ChatPeerStatusProps {
  /** 对端三态；为 null（加载中 / 非单聊 / 取不到）时整个组件不渲染。 */
  status: ChatPresenceStatus | null;
  /** 对端是否正在输入。 */
  typing?: boolean;
  /** 紧凑模式（即时通讯抽屉头部）。 */
  compact?: boolean;
}

const ChatPeerStatus = ({
  status,
  typing = false,
  compact = false,
}: ChatPeerStatusProps) => {
  const intl = useIntl();
  const { styles } = useStyles();

  // 状态未知时不占位：宁可不显示，也不要一个含义不明的灰点让人猜
  if (!status) {
    return null;
  }

  const statusText = intl.formatMessage({ id: presenceLabelId(status) });
  const dotClass =
    status === 'ONLINE'
      ? styles.dotOnline
      : status === 'UNSTABLE'
        ? styles.dotUnstable
        : styles.dotOffline;

  return (
    // aria-live：从「在线」跳到「正在输入…」是异步发生的，读屏用户需要被告知
    <span
      className={[styles.root, compact ? styles.compact : '']
        .filter(Boolean)
        .join(' ')}
      role="status"
      aria-live="polite"
    >
      <span
        className={[styles.dot, dotClass, compact ? styles.dotCompact : '']
          .filter(Boolean)
          .join(' ')}
        aria-hidden="true"
      />
      <span
        className={[
          styles.label,
          typing ? styles.typing : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {typing
          ? intl.formatMessage({ id: 'chat.typing' })
          : statusText}
      </span>
    </span>
  );
};

export default ChatPeerStatus;
