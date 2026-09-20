/**
 * 拖拽 / 多选上传弹窗。
 *
 * <p>刻意不复用 `components/ChunkUpload`：那个组件是「页面级卡片」（含卡头、调参、折叠），
 * 弹窗里需要的是紧凑行 + 弹窗底部批量操作，两套布局诉求不同。但上传引擎完全一致——
 * 队列由页面通过 `useChunkUpload` 持有后作为 `uploader` 传入，因此：</p>
 *
 * <ul>
 *   <li>关闭弹窗不会中断传输（控制器注册在模块级注册表，组件卸载不销毁队列）；</li>
 *   <li>页面工具栏与弹窗看到的是同一份队列快照（同 id 共享控制器）。</li>
 * </ul>
 */

import { useIntl } from '@umijs/max';
import {
  Alert,
  Button,
  Modal,
  Progress,
  Space,
  Tag,
  Tooltip,
  Typography,
  theme,
  Upload,
} from 'antd';
import { useCallback, useRef } from 'react';

import { formatBytes } from '@/components/ChunkUpload';
import type { UseChunkUploadResult } from '@/hooks/useChunkUpload';
import type { UploadTaskStatus, UploadTaskView } from '@/services/upload';

const { Text } = Typography;

export interface UploadModalProps {
  open: boolean;
  /** 上传目标目录（透传到预检的 parentId / folderId） */
  folderId?: number;
  /** 页面持有的上传队列（关闭弹窗后仍继续传输） */
  uploader: UseChunkUploadResult;
  onClose: () => void;
}

/** 状态标签口径。 */
const STATUS_META: Record<UploadTaskStatus, { textId: string; color: string }> = {
  pending: { textId: 'upload.status.pending', color: 'default' },
  hashing: { textId: 'upload.status.hashing', color: 'processing' },
  prechecking: { textId: 'upload.status.prechecking', color: 'processing' },
  querying: { textId: 'upload.status.querying', color: 'processing' },
  uploading: { textId: 'upload.status.uploading', color: 'processing' },
  paused: { textId: 'upload.status.paused', color: 'warning' },
  merging: { textId: 'upload.status.merging', color: 'processing' },
  success: { textId: 'upload.status.success', color: 'success' },
  error: { textId: 'upload.status.error', color: 'error' },
  canceled: { textId: 'upload.status.canceled', color: 'default' },
};

/** 进行中的状态：这些状态下「暂停」有意义。 */
const RUNNING_STATUSES: UploadTaskStatus[] = [
  'pending',
  'hashing',
  'prechecking',
  'querying',
  'uploading',
  'merging',
];

/** 分片方块条最多渲染多少格（再多的文件画出来也看不清，反而卡渲染）。 */
const MAX_CHUNK_STRIP = 60;

function chunkStripColor(status: UploadTaskStatus, done: boolean): string {
  if (done) {
    return '#52c41a';
  }
  return status === 'error' ? '#ff4d4f' : '#f0f0f0';
}

/** 单个任务行。 */
function TaskRow({
  task,
  uploader,
}: {
  task: UploadTaskView;
  uploader: UseChunkUploadResult;
}) {
  const { token } = theme.useToken();
  const intl = useIntl();
  const meta = STATUS_META[task.status];
  const running = RUNNING_STATUSES.includes(task.status);
  const finished = task.status === 'success';
  const received = task.received.length;
  const showStrip = task.chunkCount > 0 && task.chunkCount <= MAX_CHUNK_STRIP;
  const receivedSet = new Set(task.received);

  return (
    <div
      style={{
        padding: `${token.paddingXS}px 0`,
        borderBottom: `1px solid ${token.colorSplit}`,
      }}
    >
      <Space
        style={{ width: '100%', justifyContent: 'space-between' }}
        align="start"
      >
        <Space size={4} wrap>
          <Text ellipsis style={{ maxWidth: 260 }}>
            {task.fileName}
          </Text>
          {/* 秒传命中：没传一个字节，必须让用户看到「为什么这么快」 */}
          {task.instant ? (
            <Tag color="green">
              {intl.formatMessage({ id: 'upload.instant' })}
            </Tag>
          ) : null}
          <Tag color={meta.color}>
            {intl.formatMessage({ id: meta.textId })}
          </Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {formatBytes(task.size)}
            {task.chunkCount > 0
              ? intl.formatMessage(
                  { id: 'upload.chunkProgress' },
                  { received, total: task.chunkCount },
                )
              : ''}
            {task.status === 'uploading'
              ? ` · ${formatBytes(task.speed)}/s`
              : ''}
          </Text>
        </Space>

        <Space size={4}>
          {running ? (
            <Button
              size="small"
              type="link"
              onClick={() => uploader.pause(task.id)}
            >
              {intl.formatMessage({ id: 'upload.action.pause' })}
            </Button>
          ) : null}
          {task.status === 'paused' ? (
            <Button
              size="small"
              type="link"
              onClick={() => uploader.resume(task.id)}
            >
              {intl.formatMessage({ id: 'upload.action.resume' })}
            </Button>
          ) : null}
          {task.status === 'error' ? (
            <>
              <Button
                size="small"
                type="link"
                onClick={() => uploader.retry(task.id)}
              >
                {intl.formatMessage({ id: 'common.action.retry' })}
              </Button>
              <Button
                size="small"
                type="link"
                danger
                onClick={() => uploader.remove(task.id)}
              >
                {intl.formatMessage({ id: 'upload.action.remove' })}
              </Button>
            </>
          ) : null}
          {running || task.status === 'paused' ? (
            <Button
              size="small"
              type="link"
              danger
              onClick={() => uploader.cancel(task.id)}
            >
              {intl.formatMessage({ id: 'common.action.cancel' })}
            </Button>
          ) : null}
          {finished || task.status === 'canceled' ? (
            <Button
              size="small"
              type="link"
              onClick={() => uploader.remove(task.id)}
            >
              {intl.formatMessage({ id: 'upload.action.remove' })}
            </Button>
          ) : null}
        </Space>
      </Space>

      <Progress
        percent={task.progress}
        size="small"
        status={
          task.status === 'error'
            ? 'exception'
            : finished
              ? 'success'
              : 'active'
        }
        // 哈希 / 预检阶段进度条不动，用 status 文案说明，避免进度条来回抖动
        format={(percent) =>
          task.status === 'hashing'
            ? intl.formatMessage({ id: 'upload.verifying' })
            : `${percent}%`
        }
      />

      {showStrip ? (
        <Space size={2} wrap={false} style={{ marginBottom: 4 }}>
          {Array.from({ length: task.chunkCount }, (_, index) => (
            <Tooltip
              // biome-ignore lint/suspicious/noArrayIndexKey: 分片条由 chunkCount 生成、分片无独立实体，序号即稳定身份
              key={`chunk-${index}`}
              title={intl.formatMessage(
                { id: 'upload.chunkTooltip' },
                { index: index + 1 },
              )}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: 1,
                  background: chunkStripColor(
                    task.status,
                    receivedSet.has(index),
                  ),
                }}
              />
            </Tooltip>
          ))}
        </Space>
      ) : null}

      {task.errorMessage ? (
        <div>
          <Text type="danger" style={{ fontSize: 12 }}>
            {task.errorMessage}
          </Text>
        </div>
      ) : null}
      {task.retryCount > 0 && task.status !== 'error' ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {intl.formatMessage(
            { id: 'upload.retried' },
            { count: task.retryCount },
          )}
        </Text>
      ) : null}
    </div>
  );
}

export default function UploadModal({
  open,
  folderId,
  uploader,
  onClose,
}: UploadModalProps) {
  const intl = useIntl();
  const reselectRef = useRef<HTMLInputElement | null>(null);

  const { tasks, resumable } = uploader;
  const uploading = tasks.filter((task) =>
    RUNNING_STATUSES.includes(task.status),
  ).length;
  const finished = tasks.filter((task) => task.status === 'success').length;

  /** 选中文件即入队：返回 false 阻止 antd 内置上传器（传输由控制器接管）。 */
  const handleBeforeUpload = useCallback(
    (file: File) => {
      uploader.start([file]);
      return false;
    },
    [uploader],
  );

  /** 续传入口：重新选择「同一个文件」后由控制器向服务端查分片清单续传。 */
  const handleReselect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const picked = Array.from(event.target.files ?? []);
      if (picked.length) {
        uploader.start(picked);
      }
      // 清空 value：否则再次选同一文件不会触发 change
      event.target.value = '';
    },
    [uploader],
  );

  return (
    <Modal
      open={open}
      title={intl.formatMessage(
        { id: folderId ? 'upload.titleWithFolder' : 'upload.title' },
        { folderId },
      )}
      width={760}
      onCancel={onClose}
      maskClosable={false}
      footer={[
        <Text
          key="summary"
          type="secondary"
          style={{ float: 'left', lineHeight: '32px' }}
        >
          {intl.formatMessage(
            { id: 'upload.summary' },
            { uploading, finished, total: tasks.length },
          )}
        </Text>,
        <Button
          key="pauseAll"
          onClick={uploader.pauseAll}
          disabled={uploading === 0}
        >
          {intl.formatMessage({ id: 'upload.action.pauseAll' })}
        </Button>,
        <Button key="resumeAll" onClick={uploader.resumeAll}>
          {intl.formatMessage({ id: 'upload.action.resumeAll' })}
        </Button>,
        <Button key="clear" onClick={uploader.clearFinished}>
          {intl.formatMessage({ id: 'upload.action.clearFinished' })}
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          {intl.formatMessage({ id: 'common.action.close' })}
        </Button>,
      ]}
    >
      <Upload.Dragger
        multiple
        showUploadList={false}
        beforeUpload={handleBeforeUpload}
        // 关掉 antd 自身的 action 上报：文件内容的发送全部由分片引擎负责
        action={undefined}
      >
        <p className="ant-upload-text">
          {intl.formatMessage({ id: 'upload.dropText' })}
        </p>
        <p className="ant-upload-hint">
          {intl.formatMessage({ id: 'upload.dropHint' })}
        </p>
      </Upload.Dragger>

      {resumable.length > 0 ? (
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          title={intl.formatMessage({ id: 'upload.resumable.title' })}
          description={
            <Space orientation="vertical" size={4} style={{ width: '100%' }}>
              {/* 关键口径：本地缓存只用于提示，真正从第几片开始传由服务端分片清单决定 */}
              <Text type="secondary" style={{ fontSize: 12 }}>
                {intl.formatMessage({ id: 'upload.resumable.note' })}
              </Text>
              {resumable.map((record) => (
                <Space key={record.key} size={4}>
                  <Text>
                    {intl.formatMessage(
                      { id: 'upload.resumable.record' },
                      {
                        name: record.fileName,
                        size: formatBytes(record.size),
                        received: record.receivedCount,
                        total: record.chunkCount,
                      },
                    )}
                  </Text>
                  <Button
                    size="small"
                    type="link"
                    onClick={() => uploader.discardRecord(record.key)}
                  >
                    {intl.formatMessage({ id: 'upload.resumable.ignore' })}
                  </Button>
                </Space>
              ))}
              <Space>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => reselectRef.current?.click()}
                >
                  {intl.formatMessage({ id: 'upload.resumable.select' })}
                </Button>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {intl.formatMessage({ id: 'upload.resumable.hint' })}
                </Text>
              </Space>
            </Space>
          }
        />
      ) : null}

      {/* 隐藏的原生选择器：隐藏拖拽区后仍需要「重新选中同一文件」的入口 */}
      <input
        ref={reselectRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleReselect}
      />

      <div style={{ marginTop: 12, maxHeight: 320, overflowY: 'auto' }}>
        {tasks.length === 0 ? (
          <Text type="secondary">
            {intl.formatMessage({ id: 'upload.empty' })}
          </Text>
        ) : (
          tasks.map((task) => (
            <TaskRow key={task.id} task={task} uploader={uploader} />
          ))
        )}
      </div>
    </Modal>
  );
}
