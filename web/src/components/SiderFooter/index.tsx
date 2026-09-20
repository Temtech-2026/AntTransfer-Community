/**
 * 侧栏底部入口条：即时通讯 + 传输中心。
 *
 * <p>两块能力都做成「从边缘滑出的浮层」（聊天是右侧抽屉、传输是右下角悬浮窗），
 * 侧栏底部只留入口，避免它们各自占掉一个主菜单位、把文件区挤窄。
 *
 * <p>角标口径：
 * <ul>
 *   <li>消息 = 未读三口径之和（复用 `useWebSocket` 的应用级单例快照，
 *       与顶栏通知铃铛同源，不会出现两个数字打架）；</li>
 *   <li>传输 = 推进中的任务数（读模块级队列登记处的聚合快照）。</li>
 * </ul>
 */

import { CloudUploadOutlined, MessageOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { createStyles } from 'antd-style';
import { Badge, Tooltip } from 'antd';
import React, { useSyncExternalStore } from 'react';

import { useWebSocket } from '@/hooks/useWebSocket';
import { toggleChat, toggleTransfer } from '@/services/ui/panelHub';
import { uploadQueueHub } from '@/services/upload/queueHub';

const useStyles = createStyles(({ token, css }) => ({
  footer: css`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid ${token.colorSplit};
  `,
  footerCollapsed: css`
    flex-direction: column;
    padding: 8px 0;
  `,
  item: css`
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 32px;
    /* 用原生 <button> 承载点击：键盘 Enter/Space 与焦点管理由浏览器负责，
       不必手写 onKeyDown，也不会被 lint 判为「用 span 冒充按钮」。
       代价是要显式清掉浏览器给 button 的默认外观。 */
    padding: 0;
    border: none;
    background: transparent;
    font-family: inherit;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      color 0.2s ease;

    &:hover {
      color: ${token.colorPrimary};
      background: ${token.colorFillQuaternary};
    }
  `,
  itemCollapsed: css`
    flex: none;
    width: 40px;
  `,
  icon: css`
    font-size: ${token.fontSizeLG}px;
  `,
}));

export interface SiderFooterProps {
  /** 侧栏是否折叠（折叠时只留图标） */
  collapsed?: boolean;
}

/**
 * 侧栏底部入口条。
 *
 * @param props 见 {@link SiderFooterProps}
 */
const SiderFooter: React.FC<SiderFooterProps> = ({ collapsed }) => {
  const intl = useIntl();
  const { styles } = useStyles();
  const upload = useSyncExternalStore(
    uploadQueueHub.subscribe,
    uploadQueueHub.getSnapshot,
    uploadQueueHub.getSnapshot,
  );
  const { total } = useWebSocket();

  const itemClass = collapsed
    ? `${styles.item} ${styles.itemCollapsed}`
    : styles.item;

  return (
    <div className={collapsed ? `${styles.footer} ${styles.footerCollapsed}` : styles.footer}>
      <Tooltip
        title={intl.formatMessage({ id: 'component.siderFooter.messages' })}
        placement={collapsed ? 'right' : 'top'}
      >
        <button
          type="button"
          className={itemClass}
          aria-label={intl.formatMessage({ id: 'component.siderFooter.openMessages' })}
          onClick={() => toggleChat()}
        >
          <Badge count={total} size="small" offset={[2, -2]}>
            <MessageOutlined className={styles.icon} />
          </Badge>
          {!collapsed && <span>{intl.formatMessage({ id: 'component.siderFooter.messages' })}</span>}
        </button>
      </Tooltip>
      <Tooltip
        title={intl.formatMessage({ id: 'component.siderFooter.openTransfer' })}
        placement={collapsed ? 'right' : 'top'}
      >
        <button
          type="button"
          className={itemClass}
          aria-label={intl.formatMessage({ id: 'component.siderFooter.openTransfer' })}
          onClick={() => toggleTransfer()}
        >
          <Badge count={upload.activeCount} size="small" offset={[2, -2]}>
            <CloudUploadOutlined className={styles.icon} />
          </Badge>
          {!collapsed && <span>{intl.formatMessage({ id: 'component.siderFooter.transfer' })}</span>}
        </button>
      </Tooltip>
    </div>
  );
};

export default SiderFooter;
