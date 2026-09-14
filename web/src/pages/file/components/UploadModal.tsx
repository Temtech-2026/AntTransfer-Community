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

import {
  Alert,
  Button,
  Modal,
  Progress,
  Space,
  Tag,
  Tooltip,
  Typography,
  Upload,
  theme,
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
const STATUS_META: Record<UploadTaskStatus, { text: string; color: string }> = {
  pending: { text: '排队中', color: 'default' },
  hashing: { text: '计算摘要', color: 'processing' },
  prechecking: { text: '秒传预检', color: 'processing' },
  querying: { text: '查询分片', color: 'processing' },
  uploading: { text: '上传中', color: 'processing' },
  paused: { text: '已暂停', color: 'warning' },
  merging: { text: '合并中', color: 'processing' },
  success: { text: '已完成', color: 'success' },
  error: { text: '失败', color: 'error' },
  canceled: { text: '已取消', color: 'default' },
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
      <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
        <Space size={4} wrap>
          <Text ellipsis style={{ maxWidth: 260 }}>
            {task.fileName}
          </Text>
          {/* 秒传命中：没传一个字节，必须让用户看到「为什么这么快」 */}
          {task.instant ? <Tag color="green">秒传</Tag> : null}
          <Tag color={meta.color}>{meta.text}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {formatBytes(task.size)}
            {task.chunkCount > 0 ? ` · ${received}/${task.chunkCount} 片` : ''}
            {task.status === 'uploading' ? ` · ${formatBytes(task.speed)}/s` : ''}
          </Text>
        </Space>

        <Space size={4}>
          {running ? (
            <Button size="small" type="link" onClick={() => uploader.pause(task.id)}>
              暂停
            </Button>
          ) : null}
          {task.status === 'paused' ? (
            <Button size="small" type="link" onClick={() => uploader.resume(task.id)}>
              继续
            </Button>
          ) : null}
          {task.status === 'error' ? (
            <>
              <Button size="small" type="link" onClick={() => uploader.retry(task.id)}>
                重试
              </Button>
              <Button size="small" type="link" danger onClick={() => uploader.remove(task.id)}>
                移除
              </Button>
            </>
          ) : null}
          {running || task.status === 'paused' ? (
            <Button size="small" type="link" danger onClick={() => uploader.cancel(task.id)}>
              取消
            </Button>
          ) : null}
          {finished || task.status === 'canceled' ? (
            <Button size="small" type="link" onClick={() => uploader.remove(task.id)}>
              移除
            </Button>
          ) : null}
        </Space>
      </Space>

      <Progress
        percent={task.progress}
        size="small"
        status={
          task.status === 'error' ? 'exception' : finished ? 'success' : 'active'
        }
        // 哈希 / 预检阶段进度条不动，用 status 文案说明，避免进度条来回抖动
        format={(percent) => (task.status === 'hashing' ? '校验中' : `${percent}%`)}
      />

      {showStrip ? (
        <Space size={2} wrap={false} style={{ marginBottom: 4 }}>
          {Array.from({ length: task.chunkCount }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 分片条由 chunkCount 生成、分片无独立实体，序号即稳定身份
            <Tooltip key={`chunk-${index}`} title={`分片 ${index + 1}`}>
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: 1,
                  background: chunkStripColor(task.status, receivedSet.has(index)),
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
          已自动重试 {task.retryCount} 次
        </Text>
      ) : null}
    </div>
  );
}

export default function UploadModal({ open, folderId, uploader, onClose }: UploadModalProps) {
  const reselectRef = useRef<HTMLInputElement | null>(null);

  const { tasks, resumable } = uploader;
  const uploading = tasks.filter((task) => RUNNING_STATUSES.includes(task.status)).length;
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
      title={`上传文件${folderId ? `（目录 #${folderId}）` : ''}`}
      width={760}
      onCancel={onClose}
      maskClosable={false}
      footer={[
        <Text key="summary" type="secondary" style={{ float: 'left', lineHeight: '32px' }}>
          进行中 {uploading} · 已完成 {finished} · 共 {tasks.length}
        </Text>,
        <Button key="pauseAll" onClick={uploader.pauseAll} disabled={uploading === 0}>
          全部暂停
        </Button>,
        <Button key="resumeAll" onClick={uploader.resumeAll}>
          全部继续
        </Button>,
        <Button key="clear" onClick={uploader.clearFinished}>
          清除已结束
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          关闭
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
        <p className="ant-upload-text">点击或拖拽文件到此处</p>
        <p className="ant-upload-hint">
          支持多选；大文件自动分片（默认 4 MiB）并计算摘要，命中秒传时无需传输
        </p>
      </Upload.Dragger>

      {resumable.length > 0 ? (
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          title="检测到上次未完成的上传"
          description={
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              {/* 关键口径：本地缓存只用于提示，真正从第几片开始传由服务端分片清单决定 */}
              <Text type="secondary" style={{ fontSize: 12 }}>
                下面进度来自本地缓存，仅供参考；实际续传位置以服务端分片清单为准。
              </Text>
              {resumable.map((record) => (
                <Space key={record.key} size={4}>
                  <Text>
                    {record.fileName}（{formatBytes(record.size)}，已完成{' '}
                    {record.receivedCount}/{record.chunkCount} 片）
                  </Text>
                  <Button size="small" type="link" onClick={() => uploader.discardRecord(record.key)}>
                    忽略
                  </Button>
                </Space>
              ))}
              <Space>
                <Button size="small" type="primary" onClick={() => reselectRef.current?.click()}>
                  选择文件续传
                </Button>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  需选择与上次同名的同一文件（同名但内容已变会被识别并重新上传）
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
          <Text type="secondary">暂无上传任务</Text>
        ) : (
          tasks.map((task) => <TaskRow key={task.id} task={task} uploader={uploader} />)
        )}
      </div>
    </Modal>
  );
}
