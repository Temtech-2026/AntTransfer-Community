/**
 * 顶栏通知铃铛：`useWebSocket` 的落地示例（未读三口径 + 一键已读 + 连接状态）。
 *
 * <p>放在顶栏而不是各业务页：连接是应用级单例（services/ws/store.ts），
 * 只要布局挂载就维护未读，业务页无需各自订阅。
 */

import { BellOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Badge, Button, Popover, Space, Tooltip, Typography, message } from 'antd';
import type { FC } from 'react';

import { useWebSocket } from '@/hooks/useWebSocket';
import type { WsStatus } from '@/services/ws';

/** 连接状态 → i18n id（排障时用户能直接反馈这一行）。 */
const STATUS_ID: Record<WsStatus, string> = {
  idle: 'component.notify.status.idle',
  connecting: 'component.notify.status.connecting',
  open: 'component.notify.status.open',
  reconnecting: 'component.notify.status.reconnecting',
  closed: 'component.notify.status.closed',
};

const NotificationBell: FC = () => {
  const intl = useIntl();
  const { unread, total, status, markAllRead } = useWebSocket();

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      message.success(intl.formatMessage({ id: 'component.notify.markedAllRead' }));
    } catch (error) {
      // 失败提示由全局错误链路负责，这里仅留痕
      console.warn('[anttransfer] 一键已读失败', error);
    }
  };

  const content = (
    <Space orientation="vertical" size={4} style={{ width: 200 }}>
      <Typography.Text>
        {intl.formatMessage({ id: 'component.notify.count.inbox' }, { count: unread.inbox })}
      </Typography.Text>
      <Typography.Text>
        {intl.formatMessage({ id: 'component.notify.count.todo' }, { count: unread.todo })}
      </Typography.Text>
      <Typography.Text>
        {intl.formatMessage({ id: 'component.notify.count.chat' }, { count: unread.chat })}
      </Typography.Text>
      <Typography.Text type="secondary">
        {intl.formatMessage({ id: STATUS_ID[status] })}
      </Typography.Text>
      <Button size="small" block disabled={total === 0} onClick={handleMarkAllRead}>
        {intl.formatMessage({ id: 'component.notify.markAllRead' })}
      </Button>
    </Space>
  );

  return (
    <Popover content={content} placement="bottomRight" trigger="click">
      <Tooltip title={intl.formatMessage({ id: 'component.notify.title' })}>
        <Badge count={total} size="small" overflowCount={99}>
          <Button type="text" icon={<BellOutlined />} />
        </Badge>
      </Tooltip>
    </Popover>
  );
};

export default NotificationBell;
