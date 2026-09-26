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
import { useIntl } from '@umijs/max';
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
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  type UseChunkUploadResult,
  useChunkUpload,
} from '@/hooks/useChunkUpload';
import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CONCURRENCY,
  MAX_CHUNK_SIZE,
} from '@/services/upload/constants';
import type { PartPayloadMode } from '@/services/upload/endpoints';
import type { UploadTaskStatus, UploadTaskView } from '@/services/upload/types';

const { Text } = Typography;

export interface ChunkUploadProps {
  /** 上传实例 id：同 id 的多个组件共享同一队列 */
  id?: string;
  /** 分片大小（默认 4 MiB；上限 8 MiB） */
  chunkSize?: number;
  /** 单文件并发分片数（默认 3；上限 5） */
  concurrency?: number;
  /**
   * 分片请求体形态（默认 `multipart`）。
   *
   * <p>对**之后加入的任务**生效：任务入队时快照一次，中途切换不会让同一次上传
   * 混用两种请求体（见 `ChunkUploadController`）。</p>
   */
  partPayloadMode?: PartPayloadMode;
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

/** 任务状态 → i18n id（与上传页共用 `upload.status.*`，避免两处口径漂移）。 */
const STATUS_ID: Record<UploadTaskStatus, string> = {
  pending: 'upload.status.pending',
  hashing: 'upload.status.hashing',
  prechecking: 'upload.status.prechecking',
  querying: 'upload.status.querying',
  uploading: 'upload.status.uploading',
  paused: 'upload.status.paused',
  merging: 'upload.status.merging',
  success: 'upload.status.success',
  error: 'upload.status.error',
  canceled: 'upload.status.canceled',
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

/** 分片请求体形态 → 称呼 / `Content-Type` 的 i18n id（与 /upload 页的卡片共用一套文案） */
const MODE_TITLE_ID: Record<PartPayloadMode, string> = {
  multipart: 'upload.mode.multipart.title',
  'octet-stream': 'upload.mode.octetStream.title',
};

const MODE_TAG_ID: Record<PartPayloadMode, string> = {
  multipart: 'upload.mode.multipart.tag',
  'octet-stream': 'upload.mode.octetStream.tag',
};

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

/** 文案函数签名：把 id + 参数翻成当前语言文本（由调用方注入，保持本函数纯净可测） */
type Translate = (id: string, values?: Record<string, string | number>) => string;

/** 进度文案：哈希阶段不占用进度条，改由文案提示，避免进度条来回抖动 */
export function progressLabel(t: Translate, task: UploadTaskView): string {
  if (task.instant) {
    return t('component.chunkUpload.instantDone');
  }
  if (task.status === 'hashing') {
    return t('component.chunkUpload.progress.hashing');
  }
  if (task.status === 'prechecking') {
    return t('component.chunkUpload.progress.prechecking');
  }
  if (task.status === 'querying') {
    return t('component.chunkUpload.progress.querying');
  }
  if (task.status === 'merging') {
    return t('component.chunkUpload.progress.merging');
  }
  if (task.status === 'paused') {
    return t('component.chunkUpload.progress.paused', {
      received: task.received.length,
      total: task.chunkCount,
    });
  }
  if (task.status === 'error') {
    return task.errorMessage ?? t('component.chunkUpload.progress.failed');
  }
  if (task.status === 'uploading') {
    return `${t('component.chunkUpload.progress.uploading', {
      received: task.received.length,
      total: task.chunkCount,
      speed: formatSpeed(task.speed),
    })}${task.retryCount > 0 ? t('component.chunkUpload.progress.retried', { count: task.retryCount }) : ''}`;
  }
  return t('component.chunkUpload.progress.chunks', { count: task.chunkCount });
}

export function ChunkUpload(props: ChunkUploadProps) {
  const {
    id = 'default',
    chunkSize: chunkSizeProp,
    concurrency: concurrencyProp,
    partPayloadMode = 'multipart',
    maxRetries,
    extra,
    accept,
    multiple = true,
    disabled,
    showTuning = true,
    title,
    onTaskSuccess,
    onTaskError,
    onAllFinished,
    uploader,
  } = props;

  const intl = useIntl();
  const t: Translate = (id, values) => intl.formatMessage({ id }, values);
  const displayTitle = title ?? intl.formatMessage({ id: 'component.chunkUpload.title' });

  const { token } = theme.useToken();
  const [chunkSize, setChunkSize] = useState(
    chunkSizeProp ?? DEFAULT_CHUNK_SIZE,
  );
  const [concurrency, setConcurrency] = useState(
    concurrencyProp ?? DEFAULT_CONCURRENCY,
  );

  // 受控同步：调用方若把「分片大小 / 并发数」做成可切换的预设（见 /upload 页的
  // 「上传方式」卡片），切预设后内部状态必须跟着走。仅在显式传入时同步，
  // 未传时仍由组件自管这两个参数，原用法不受影响。
  useEffect(() => {
    if (chunkSizeProp !== undefined) {
      setChunkSize(chunkSizeProp);
    }
  }, [chunkSizeProp]);
  useEffect(() => {
    if (concurrencyProp !== undefined) {
      setConcurrency(concurrencyProp);
    }
  }, [concurrencyProp]);

  const hookResult = useChunkUpload({
    id,
    chunkSize,
    concurrency,
    partPayloadMode,
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
          <span>{displayTitle}</span>
          {/* 当前方式就地可见：上传中也能一眼看出这批任务是按哪种请求体发的 */}
          <Tooltip title={intl.formatMessage({ id: MODE_TAG_ID[partPayloadMode] })}>
            <Tag color={partPayloadMode === 'octet-stream' ? 'geekblue' : 'blue'}>
              {intl.formatMessage({ id: MODE_TITLE_ID[partPayloadMode] })}
            </Tag>
          </Tooltip>
          {summary.uploading > 0 ? (
            <Text type="secondary">
              {intl.formatMessage({ id: 'component.chunkUpload.busy' }, { count: summary.uploading })}
            </Text>
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
            {intl.formatMessage({ id: 'upload.action.pauseAll' })}
          </Button>
          <Button size="small" onClick={clearFinished}>
            {intl.formatMessage({ id: 'upload.action.clearFinished' })}
          </Button>
        </Space>
      }
    >
      {resumable.length > 0 ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: token.marginMD }}
          title={intl.formatMessage(
            { id: 'component.chunkUpload.resumableCount' },
            { count: resumable.length },
          )}
          description={
            <Space orientation="vertical" size={4} style={{ width: '100%' }}>
              <Text type="secondary">
                {intl.formatMessage({ id: 'component.chunkUpload.resumableNote' })}
              </Text>
              {resumable.slice(0, 5).map((record) => (
                <Text key={record.key} ellipsis>
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
              ))}
              <Space>
                <Button
                  size="small"
                  type="primary"
                  onClick={() => reselectRef.current?.click()}
                >
                  {intl.formatMessage({ id: 'component.chunkUpload.resumableSelect' })}
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
        <p className="ant-upload-text">
          {intl.formatMessage({ id: 'component.chunkUpload.draggerText' })}
        </p>
        <p className="ant-upload-hint">
          {intl.formatMessage(
            { id: 'component.chunkUpload.draggerHint' },
            { count: maxRetries ?? 3 },
          )}
        </p>
      </Upload.Dragger>

      {showTuning ? (
        <Space
          size={16}
          wrap
          style={{ marginTop: token.marginMD, alignItems: 'center' }}
        >
          <Space size={6}>
            <Text type="secondary">
              {intl.formatMessage({ id: 'component.chunkUpload.chunkSize' })}
            </Text>
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
            <Text type="secondary">
              {intl.formatMessage({ id: 'component.chunkUpload.concurrency' })}
            </Text>
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
            {intl.formatMessage({ id: 'component.chunkUpload.tuningNote' })}
          </Text>
        </Space>
      ) : null}

      {tasks.length > 0 ? (
        <div style={{ marginTop: token.marginLG }}>
          <Space
            style={{ width: '100%', justifyContent: 'space-between' }}
            align="center"
          >
            <Text strong>
              {intl.formatMessage({ id: 'component.chunkUpload.overallProgress' })}
            </Text>
            <Text type="secondary">
              {intl.formatMessage(
                { id: 'component.chunkUpload.overallSummary' },
                {
                  finished: summary.finished,
                  total: tasks.length,
                  uploaded: formatBytes(summary.uploadedBytes),
                  totalSize: formatBytes(summary.totalBytes),
                },
              )}
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
        orientation="vertical"
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
              <Space orientation="vertical" size={2} style={{ minWidth: 0 }}>
                <Space size={8}>
                  <Text strong ellipsis style={{ maxWidth: 360 }}>
                    {task.fileName}
                  </Text>
                  <Tag color={STATUS_COLOR[task.status]}>
                    {task.instant && task.status === 'success'
                      ? intl.formatMessage({ id: 'component.chunkUpload.instantSuccess' })
                      : intl.formatMessage({ id: STATUS_ID[task.status] })}
                  </Tag>
                  {task.retryCount > 0 && task.status === 'uploading' ? (
                    <Tooltip title={intl.formatMessage({ id: 'component.chunkUpload.retryTooltip' })}>
                      <Tag color="orange">
                        {intl.formatMessage(
                          { id: 'component.chunkUpload.retryTag' },
                          { count: task.retryCount },
                        )}
                      </Tag>
                    </Tooltip>
                  ) : null}
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {formatBytes(task.size)} · {progressLabel(t, task)}
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
                    {intl.formatMessage({ id: 'upload.action.pause' })}
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
                    {task.status === 'error'
                      ? intl.formatMessage({ id: 'common.action.retry' })
                      : intl.formatMessage({ id: 'upload.action.resume' })}
                  </Button>
                ) : null}
                {!['success', 'canceled', 'error'].includes(task.status) ? (
                  <Button size="small" danger onClick={() => cancel(task.id)}>
                    {intl.formatMessage({ id: 'common.action.cancel' })}
                  </Button>
                ) : (
                  <Button size="small" onClick={() => remove(task.id)}>
                    {intl.formatMessage({ id: 'upload.action.remove' })}
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
          {intl.formatMessage({ id: 'upload.empty' })}
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
