/**
 * 分片上传组件（Ant Design）。
 *
 * 交互约定：
 * - 拖拽/选择文件后立即入队：先算校验值 → 秒传检测 → 查询服务端已传分片 → 只补缺失片 → 合并；
 * - 顶部是**整体进度**（所有任务字节加权），每行是**单文件进度**，并给出实时速率、重试次数；
 * - 暂停后进度保留；刷新页面后顶部会提示「检测到未完成的上传」，重新选择同一文件即从服务端
 *   已收分片处继续（浏览器不允许持久化 File 对象，所以必须由用户再选一次）。
 */

import { UploadOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Progress,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  theme,
  Upload,
} from 'antd';
import { useMemo, useRef, useState } from 'react';

import {
  type UseChunkUploadResult,
  useChunkUpload,
} from '@/hooks/useChunkUpload';
import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CONCURRENCY,
  MAX_CHUNK_SIZE,
} from '@/services/upload/constants';
import type { UploadTaskStatus, UploadTaskView } from '@/services/upload/types';

const { Text } = Typography;

export interface ChunkUploadProps {
  /** 上传实例 id：同 id 的多个组件共享同一队列 */
  id?: string;
  /** 分片大小（默认 4 MiB；上限 8 MiB） */
  chunkSize?: number;
  /** 单文件并发分片数（默认 3；上限 5） */
  concurrency?: number;
  /** 失败自动重试次数（默认 3） */
  maxRetries?: number;
  /** 预检附加业务字段（如 spaceId / parentId） */
  extra?: Record<string, unknown>;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** 是否展示分片大小 / 并发数调节项 */
  showTuning?: boolean;
  title?: React.ReactNode;
  onTaskSuccess?: (task: UploadTaskView) => void;
  onTaskError?: (task: UploadTaskView) => void;
  onAllFinished?: (tasks: UploadTaskView[]) => void;
  /** 外部复用同一队列时可直接注入 */
  uploader?: UseChunkUploadResult;
}

const STATUS_TEXT: Record<UploadTaskStatus, string> = {
  pending: '待上传',
  hashing: '计算校验值',
  prechecking: '秒传检测',
  querying: '查询已传分片',
  uploading: '上传中',
  paused: '已暂停',
  merging: '合并中',
  success: '已完成',
  error: '失败',
  canceled: '已取消',
};

const STATUS_COLOR: Record<UploadTaskStatus, string> = {
  pending: 'default',
  hashing: 'processing',
  prechecking: 'processing',
  querying: 'processing',
  uploading: 'processing',
  paused: 'warning',
  merging: 'processing',
  success: 'success',
  error: 'error',
  canceled: 'default',
};

const BUSY_STATUSES: UploadTaskStatus[] = [
  'hashing',
  'prechecking',
  'querying',
  'uploading',
  'merging',
];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / 1024 ** index;
  return `${value >= 100 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

function formatSpeed(bytesPerSecond: number): string {
  return bytesPerSecond > 0 ? `${formatBytes(bytesPerSecond)}/s` : '--';
}

/** 进度文案：哈希阶段不占用进度条，改由文案提示，避免进度条来回抖动 */
function progressLabel(task: UploadTaskView): string {
  if (task.instant) {
    return '秒传完成';
  }
  if (task.status === 'hashing') {
    return '正在计算文件校验值…';
  }
  if (task.status === 'prechecking') {
    return '正在检测是否可秒传…';
  }
  if (task.status === 'querying') {
    return '正在获取已上传分片…';
  }
  if (task.status === 'merging') {
    return '正在合并分片…';
  }
  if (task.status === 'paused') {
    return `已暂停（已完成 ${task.received.length}/${task.chunkCount} 片）`;
  }
  if (task.status === 'error') {
    return task.errorMessage ?? '上传失败';
  }
  if (task.status === 'uploading') {
    return `${task.received.length}/${task.chunkCount} 片 · ${formatSpeed(task.speed)}${
      task.retryCount > 0 ? ` · 已重试 ${task.retryCount} 次` : ''
    }`;
  }
  return `${task.chunkCount} 片`;
}

export function ChunkUpload(props: ChunkUploadProps) {
  const {
    id = 'default',
    chunkSize: chunkSizeProp,
    concurrency: concurrencyProp,
    maxRetries,
    extra,
    accept,
    multiple = true,
    disabled,
    showTuning = true,
    title = '文件上传',
    onTaskSuccess,
    onTaskError,
    onAllFinished,
    uploader,
  } = props;

  const { token } = theme.useToken();
  const [chunkSize, setChunkSize] = useState(
    chunkSizeProp ?? DEFAULT_CHUNK_SIZE,
  );
  const [concurrency, setConcurrency] = useState(
    concurrencyProp ?? DEFAULT_CONCURRENCY,
  );

  const hookResult = useChunkUpload({
    id,
    chunkSize,
    concurrency,
    maxRetries,
    precheckExtra: extra,
    onTaskSuccess,
    onTaskError,
    onAllFinished,
  });
  const {
    tasks,
    resumable,
    start,
    pause,
    pauseAll,
    resume,
    retry,
    cancel,
    remove,
    clearFinished,
  } = uploader ?? hookResult;

  const reselectRef = useRef<HTMLInputElement>(null);

  const summary = useMemo(() => {
    const totalBytes = tasks.reduce((sum, task) => sum + task.size, 0);
    const uploadedBytes = tasks.reduce(
      (sum, task) => sum + (task.instant ? task.size : task.uploadedBytes),
      0,
    );
    const finished = tasks.filter(
      (task) => task.status === 'success' || task.status === 'canceled',
    ).length;
    return {
      totalBytes,
      uploadedBytes,
      finished,
      percent:
        totalBytes > 0 ? Math.floor((uploadedBytes / totalBytes) * 100) : 0,
      uploading: tasks.filter((task) => BUSY_STATUSES.includes(task.status))
        .length,
      hasFailed: tasks.some((task) => task.status === 'error'),
    };
  }, [tasks]);

  const handleSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      start(files);
    }
  };

  return (
    <Card
      title={
        <Space size={12}>
          <span>{title}</span>
          {summary.uploading > 0 ? (
            <Text type="secondary">{summary.uploading} 个任务进行中</Text>
          ) : null}
        </Space>
      }
      extra={
        <Space>
          <Button
            size="small"
            disabled={summary.uploading === 0}
            onClick={pauseAll}
          >
            全部暂停
          </Button>
          <Button size="small" onClick={clearFinished}>
            清除已结束
          </Button>
        </Space>
      }
    >
      {resumable.length > 0 ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: token.marginMD }}
          title={`检测到 ${resumable.length} 个未完成的上传`}
          description={
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Text type="secondary">
                为避免重复传输，请重新选择同一文件，系统将跳过服务端已收到的分片继续上传。
              </Text>
              {resumable.slice(0, 5).map((record) => (
                <Text key={record.key} ellipsis>
                  {record.fileName}（{formatBytes(record.size)}，已完成{' '}
                  {record.receivedCount}/{record.chunkCount} 片）
                </Text>
              ))}
              <Space>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => reselectRef.current?.click()}
                >
                  重新选择文件继续
                </Button>
              </Space>
            </Space>
          }
        />
      ) : null}

      <Upload.Dragger
        multiple={multiple}
        accept={accept}
        disabled={disabled}
        showUploadList={false}
        beforeUpload={(file) => {
          // 交给我们自己的队列：不走 antd 内置上传，也不进它的文件列表
          start([file as unknown as File]);
          return Upload.LIST_IGNORE;
        }}
      >
        <p className="ant-upload-drag-icon">
          <UploadOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此处上传</p>
        <p className="ant-upload-hint">
          支持大文件分片上传、秒传与断点续传；单文件失败会自动重试{' '}
          {maxRetries ?? 3} 次
        </p>
      </Upload.Dragger>

      {showTuning ? (
        <Space
          size={16}
          wrap
          style={{ marginTop: token.marginMD, alignItems: 'center' }}
        >
          <Space size={6}>
            <Text type="secondary">分片大小</Text>
            <Select
              size="small"
              value={chunkSize}
              style={{ width: 96 }}
              onChange={setChunkSize}
              options={[1, 2, 4, 8]
                .map((mb) => mb * 1024 * 1024)
                .filter((value) => value <= MAX_CHUNK_SIZE)
                .map((value) => ({
                  value,
                  label: `${value / 1024 / 1024} MB`,
                }))}
            />
          </Space>
          <Space size={6}>
            <Text type="secondary">并发数</Text>
            <Select
              size="small"
              value={concurrency}
              style={{ width: 72 }}
              onChange={setConcurrency}
              options={[1, 2, 3, 4, 5].map((value) => ({
                value,
                label: value,
              }))}
            />
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            变更对后续分片生效
          </Text>
        </Space>
      ) : null}

      {tasks.length > 0 ? (
        <div style={{ marginTop: token.marginLG }}>
          <Space
            style={{ width: '100%', justifyContent: 'space-between' }}
            align="center"
          >
            <Text strong>整体进度</Text>
            <Text type="secondary">
              {summary.finished}/{tasks.length} 个文件 ·{' '}
              {formatBytes(summary.uploadedBytes)} /{' '}
              {formatBytes(summary.totalBytes)}
            </Text>
          </Space>
          <Progress
            percent={summary.percent}
            status={summary.hasFailed ? 'exception' : 'active'}
            style={{ marginBottom: token.marginSM }}
          />
        </div>
      ) : null}

      <Space
        direction="vertical"
        size={token.marginSM}
        style={{ width: '100%' }}
      >
        {tasks.map((task) => (
          <div
            key={task.id}
            style={{
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: token.borderRadiusLG,
              padding: token.paddingSM,
            }}
          >
            <Space
              style={{ width: '100%', justifyContent: 'space-between' }}
              align="start"
            >
              <Space direction="vertical" size={2} style={{ minWidth: 0 }}>
                <Space size={8}>
                  <Text strong ellipsis style={{ maxWidth: 360 }}>
                    {task.fileName}
                  </Text>
                  <Tag color={STATUS_COLOR[task.status]}>
                    {task.instant && task.status === 'success'
                      ? '秒传成功'
                      : STATUS_TEXT[task.status]}
                  </Tag>
                  {task.retryCount > 0 && task.status === 'uploading' ? (
                    <Tooltip title="网络抖动时自动指数退避重试">
                      <Tag color="orange">重试 {task.retryCount}</Tag>
                    </Tooltip>
                  ) : null}
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {formatBytes(task.size)} · {progressLabel(task)}
                </Text>
                {task.status === 'error' && task.errorMessage ? (
                  <Text type="danger" style={{ fontSize: 12 }}>
                    {task.errorMessage}
                  </Text>
                ) : null}
              </Space>

              <Space size={4} wrap>
                {BUSY_STATUSES.includes(task.status) ? (
                  <Button size="small" onClick={() => pause(task.id)}>
                    暂停
                  </Button>
                ) : null}
                {task.status === 'paused' || task.status === 'error' ? (
                  <Button
                    size="small"
                    type="primary"
                    onClick={() =>
                      task.status === 'error' ? retry(task.id) : resume(task.id)
                    }
                  >
                    {task.status === 'error' ? '重试' : '继续'}
                  </Button>
                ) : null}
                {!['success', 'canceled', 'error'].includes(task.status) ? (
                  <Button size="small" danger onClick={() => cancel(task.id)}>
                    取消
                  </Button>
                ) : (
                  <Button size="small" onClick={() => remove(task.id)}>
                    移除
                  </Button>
                )}
              </Space>
            </Space>

            <Progress
              percent={task.progress}
              size="small"
              status={
                task.status === 'error'
                  ? 'exception'
                  : task.status === 'success'
                    ? 'success'
                    : 'active'
              }
              style={{ marginTop: token.marginXS, marginBottom: 0 }}
            />
          </div>
        ))}
      </Space>

      {tasks.length === 0 && resumable.length === 0 ? (
        <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>
          暂无上传任务
        </Text>
      ) : null}

      {/* 隐藏输入：刷新后重新绑定同一文件以续传 */}
      <input
        ref={reselectRef}
        type="file"
        multiple={multiple}
        accept={accept}
        style={{ display: 'none' }}
        onChange={(event) => {
          handleSelect(event.target.files);
          event.target.value = '';
        }}
      />
    </Card>
  );
}

export default ChunkUpload;
