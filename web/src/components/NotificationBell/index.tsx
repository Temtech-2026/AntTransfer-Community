/**
 * 顶栏通知铃铛：`useWebSocket` 的落地示例（未读三口径 + 一键已读 + 连接状态）。
 *
 * <p>放在顶栏而不是各业务页：连接是应用级单例（services/ws/store.ts），
 * 只要布局挂载就维护未读，业务页无需各自订阅。
 */

import { BellOutlined } from '@ant-design/icons';
import { Badge, Button, Popover, Space, Tooltip, Typography, message } from 'antd';
import type { FC } from 'react';

import { useWebSocket } from '@/hooks/useWebSocket';
import type { WsStatus } from '@/services/ws';

/** 连接状态 → 人话（排障时用户能直接反馈这一行）。 */
const STATUS_TEXT: Record<WsStatus, string> = {
  idle: '实时通道未启动',
  connecting: '连接中…',
  open: '实时通知已连接',
  reconnecting: '连接断开，重连中…',
  closed: '实时通道已断开',
};

const NotificationBell: FC = () => {
  const { unread, total, status, markAllRead } = useWebSocket();

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
      message.success('已全部标记为已读');
    } catch (error) {
      // 失败提示由全局错误链路负责，这里仅留痕
      console.warn('[anttransfer] 一键已读失败', error);
    }
  };

  const content = (
    <Space orientation="vertical" size={4} style={{ width: 200 }}>
      <Typography.Text>通知 {unread.inbox}</Typography.Text>
      <Typography.Text>待办 {unread.todo}</Typography.Text>
      <Typography.Text>私信 {unread.chat}</Typography.Text>
      <Typography.Text type="secondary">{STATUS_TEXT[status]}</Typography.Text>
      <Button size="small" block disabled={total === 0} onClick={handleMarkAllRead}>
        全部标记已读
      </Button>
    </Space>
  );

  return (
    <Popover content={content} placement="bottomRight" trigger="click">
      <Tooltip title="通知">
        <Badge count={total} size="small" overflowCount={99}>
          <Button type="text" icon={<BellOutlined />} />
        </Badge>
      </Tooltip>
    </Popover>
  );
};

export default NotificationBell;
