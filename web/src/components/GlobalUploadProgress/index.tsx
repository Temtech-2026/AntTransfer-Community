/**
 * 顶栏「全局上传进度」指示器。
 *
 * <p>解决的是体验断点：分片上传是**跨页面长任务**（离开上传页/文件工作台后引擎继续跑），
 * 但用户在别的页面既看不到它在跑，也发现不了失败。这里订阅
 * {@link uploadQueueHub} 的**全队列聚合快照**——不是某一条队列——因此无论任务从哪个
 * 页面发起，顶栏都能看到。
 *
 * <p>展示口径：
 * <ul>
 *   <li>没有任何任务 / 全部成功 → 不渲染（不占位、不打扰）；</li>
 *   <li>有任务在跑 **或** 有失败任务 → 渲染；失败态刻意保留，否则用户会「默默丢了几个文件」；</li>
 *   <li>进度是**字节加权**的总进度（排除已取消），与单文件进度不是简单平均；</li>
 *   <li>失败 / 暂停时**不做二次确认**——「取消」才需要确认（见 {@link useDangerConfirm}），
 *       而恢复与重试是可逆动作。</li>
 * </ul>
 */

import { CloudUploadOutlined } from '@ant-design/icons';
import { history, useIntl } from '@umijs/max';
import { Badge, Button, Popover, Progress, Space, Tag, Tooltip, Typography, theme } from 'antd';
import { useSyncExternalStore } from 'react';

import { formatBytes } from '@/components/ChunkUpload';
import {
  uploadQueueHub,
  type GlobalUploadSnapshot,
  type GlobalUploadTask,
} from '@/services/upload/queueHub';
import type { UploadTaskStatus } from '@/services/upload/types';

const { Text } = Typography;

/**
 * 队列 → 承载页面。
 *
 * <p>刻意用白名单而不是「拼一个通用路径」：跳到不相干的页面比不给跳更糟。
 * 未知队列不渲染「去查看」，用户仍能在指示器里看到它。
 */
const QUEUE_PAGE: Record<string, string> = {
  default: '/upload',
  'file-workbench': '/file',
};

const STATUS_LOCALE: Record<UploadTaskStatus, string> = {
  pending: 'common.upload.status.working',
  hashing: 'common.upload.status.working',
  prechecking: 'common.upload.status.working',
  querying: 'common.upload.status.working',
  uploading: 'common.upload.status.working',
  merging: 'common.upload.status.working',
  paused: 'common.upload.status.paused',
  success: 'common.upload.status.instant',
  error: 'common.upload.status.error',
  canceled: 'common.upload.status.canceled',
};

function progressStatus(
  task: GlobalUploadTask,
): 'success' | 'exception' | 'active' | 'normal' {
  if (task.status === 'success') {
    return 'success';
  }
  if (task.status === 'error') {
    return 'exception';
  }
  if (task.status === 'canceled' || task.status === 'paused') {
    return 'normal';
  }
  return 'active';
}

/** 状态文案：秒传命中用更准确的说法，避免「已完成」看不出没走流量 */
function statusLabel(task: GlobalUploadTask): string {
  if (task.status === 'success' && task.instant) {
    return 'common.upload.status.instant';
  }
  return STATUS_LOCALE[task.status];
}

function groupByQueue(tasks: GlobalUploadTask[]): Array<{
  queueId: string;
  tasks: GlobalUploadTask[];
}> {
  const groups: Array<{ queueId: string; tasks: GlobalUploadTask[] }> = [];
  for (const task of tasks) {
    const last = groups[groups.length - 1];
    if (last && last.queueId === task.queueId) {
      last.tasks.push(task);
    } else {
      groups.push({ queueId: task.queueId, tasks: [task] });
    }
  }
  return groups;
}

export interface GlobalUploadProgressProps {
  /** 最多列出几个任务（超出只显示计数，避免弹层无限长） */
  maxRows?: number;
}

export default function GlobalUploadProgress({
  maxRows = 5,
}: GlobalUploadProgressProps) {
  const intl = useIntl();
  const { token } = theme.useToken();
  const snapshot: GlobalUploadSnapshot = useSyncExternalStore(
    uploadQueueHub.subscribe,
    uploadQueueHub.getSnapshot,
    uploadQueueHub.getSnapshot,
  );

  // 全成功（或没有任务）时不占顶栏位置；失败态保留，否则失败会被彻底忽略
  if (snapshot.tasks.length === 0) {
    return null;
  }
  if (!snapshot.uploading && snapshot.failedCount === 0) {
    return null;
  }

  const title = intl.formatMessage({ id: 'common.upload.title' });
  const groups = groupByQueue(snapshot.tasks.slice(0, maxRows));
  const overflow = snapshot.tasks.length - snapshot.tasks.slice(0, maxRows).length;

  const content = (
    <div style={{ minWidth: 288, maxWidth: 360 }}>
      {groups.map((group) => {
        const page = QUEUE_PAGE[group.queueId];
        return (
          <div
            key={group.queueId}
            style={{ marginBottom: token.marginSM }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: token.marginXS,
              }}
            >
              <Text strong style={{ fontSize: token.fontSizeSM }}>
                {intl.formatMessage({
                  id: `common.upload.queue.${group.queueId}`,
                  defaultMessage: group.queueId,
                })}
              </Text>
              {page ? (
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0 }}
                  onClick={() => {
                    history.push(page);
                  }}
                >
                  {intl.formatMessage({ id: 'common.upload.viewQueue' })}
                </Button>
              ) : null}
            </div>
            {group.tasks.map((task) => (
              <div key={task.key} style={{ marginTop: token.marginXS }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: token.marginXS,
                  }}
                >
                  <Tooltip title={task.fileName}>
                    <Text
                      style={{ fontSize: token.fontSizeSM, maxWidth: 190 }}
                      ellipsis
                    >
                      {task.fileName}
                    </Text>
                  </Tooltip>
                  <Tag
                    color={
                      task.status === 'error'
                        ? 'error'
                        : task.status === 'success'
                          ? 'success'
                          : 'processing'
                    }
                    style={{ marginInlineEnd: 0 }}
                  >
                    {intl.formatMessage({ id: statusLabel(task) })}
                  </Tag>
                </div>
                <Progress
                  percent={Math.min(100, Math.max(0, task.progress))}
                  size="small"
                  status={progressStatus(task)}
                  format={() =>
                    task.size > 0
                      ? `${formatBytes(task.uploadedBytes)} / ${formatBytes(task.size)}`
                      : ''
                  }
                />
                {task.errorMessage ? (
                  <Text type="danger" style={{ fontSize: token.fontSizeSM }}>
                    {task.errorMessage}
                  </Text>
                ) : null}
              </div>
            ))}
          </div>
        );
      })}
      {overflow > 0 ? (
        <Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {intl.formatMessage(
            { id: 'common.upload.summary' },
            { active: snapshot.activeCount, total: snapshot.tasks.length },
          )}
        </Text>
      ) : null}
    </div>
  );

  const summary = intl.formatMessage(
    { id: 'common.upload.summary' },
    { active: snapshot.activeCount, total: snapshot.countedTasks },
  );

  return (
    <Popover
      title={
        <Space size={token.marginXS}>
          <span>{title}</span>
          <Text type="secondary" style={{ fontWeight: 'normal', fontSize: token.fontSizeSM }}>
            {intl.formatMessage(
              { id: 'common.upload.percent' },
              { percent: snapshot.percent },
            )}
          </Text>
        </Space>
      }
      content={content}
      trigger="click"
      placement="bottomRight"
      arrow={false}
    >
      <Button type="text" aria-label={title} style={{ paddingInline: token.paddingXS }}>
        <Space size={token.marginXS} align="center">
          <CloudUploadOutlined
            style={{ fontSize: token.fontSizeLG, color: token.colorPrimary }}
          />
          <Tooltip title={summary}>
            <Progress
              percent={snapshot.percent}
              size="small"
              showInfo={false}
              status={snapshot.failedCount > 0 ? 'exception' : 'active'}
              style={{ width: 56, marginBottom: 0 }}
            />
          </Tooltip>
          {snapshot.failedCount > 0 ? (
            <Badge count={snapshot.failedCount} size="small" />
          ) : null}
        </Space>
      </Button>
    </Popover>
  );
}
