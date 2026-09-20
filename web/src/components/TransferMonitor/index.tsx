/**
 * 传输监控悬浮窗（右下角，方案「D. 传输监控中心」）。
 *
 * <p>它取代了原先挂在顶栏的上传进度弹层：三栏布局里顶栏右侧要留给
 * 「通知 / 头像 / 设置」，而传输是**跨页面的长任务**，贴着屏幕右下角常驻更符合预期，
 * 且表格、工作台、聊天抽屉里都能看到同一个进度。
 *
 * <p>数据全部来自模块级队列登记处（{@code uploadQueueHub}），组件本身不持有任务状态，
 * 因此卸载重挂（切路由）后队列照常推进。
 *
 * <p><b>速度曲线</b>是本地采样（每秒读一次聚合速度，保留最近 60 点）：
 * 后端没有速度时序接口，用采样画曲线既不额外请求，也能如实反映「暂停后掉零」这类变化。
 */

import {
  CaretDownOutlined,
  CaretUpOutlined,
  ClearOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { createStyles } from 'antd-style';
import { Button, Empty, Progress, Switch, Tag, Tooltip } from 'antd';
import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { formatBytes } from '@/components/ChunkUpload';
import {
  setTransferOpen,
  shellPanelStore,
  toggleTransfer,
} from '@/services/ui/panelHub';
import { uploadQueueHub, type GlobalUploadTask } from '@/services/upload/queueHub';
import { SHELL } from '@/theme/tokens';

/** 速度曲线采样点数（1 点/秒 → 60 秒窗口） */
const SAMPLE_SIZE = 60;

const useStyles = createStyles(({ token, css }) => ({
  capsule: css`
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 40px;
    padding: 0 14px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 20px;
    background: ${token.colorBgElevated};
    box-shadow: ${token.boxShadowSecondary};
    color: ${token.colorText};
    /* button 不继承字体，必须显式声明，否则胶囊里会变成浏览器默认字体 */
    font-family: inherit;
    font-size: ${token.fontSizeSM}px;
    cursor: pointer;
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: ${token.boxShadow};
    }
  `,
  capsuleValue: css`
    font-variant-numeric: tabular-nums;
    color: ${token.colorTextSecondary};
  `,
  panel: css`
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    width: ${SHELL.transferPanelWidth}px;
    max-height: 460px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgElevated};
    box-shadow: ${token.boxShadowSecondary};
    overflow: hidden;
  `,
  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid ${token.colorSplit};
  `,
  title: css`
    font-weight: 600;
    color: ${token.colorText};
  `,
  summary: css`
    padding: 10px 12px 6px;
  `,
  summaryMeta: css`
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
    font-variant-numeric: tabular-nums;
  `,
  actions: css`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px 10px;
    border-bottom: 1px solid ${token.colorSplit};
  `,
  fastMode: css`
    display: flex;
    align-items: center;
    gap: 6px;
    margin-inline-start: auto;
    color: ${token.colorTextSecondary};
    font-size: ${token.fontSizeSM}px;
  `,
  chart: css`
    display: block;
    width: 100%;
    height: 44px;
    margin: 8px 0 4px;
  `,
  list: css`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 12px 12px;
  `,
  item: css`
    padding: 8px 0;
    border-bottom: 1px dashed ${token.colorSplit};

    &:last-child {
      border-bottom: none;
    }
  `,
  itemTitle: css`
    display: flex;
    align-items: center;
    gap: 6px;
  `,
  itemName: css`
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: ${token.colorText};
    font-size: ${token.fontSizeSM}px;
  `,
  itemMeta: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 2px;
    color: ${token.colorTextTertiary};
    font-size: ${token.fontSizeSM}px;
    font-variant-numeric: tabular-nums;
  `,
  itemActions: css`
    display: flex;
    gap: 2px;
  `,
  empty: css`
    padding: 16px 0;
  `,
}));

/** 活跃态（与控制器 ACTIVE_STATUS 同口径） */
const ACTIVE_STATUSES = ['queued', 'hashing', 'uploading', 'merging'];

function statusTag(task: GlobalUploadTask, intl: ReturnType<typeof useIntl>) {
  if (ACTIVE_STATUSES.includes(task.status)) {
    return (
      <Tag color="processing">
        {intl.formatMessage({ id: 'component.transfer.status.active' })}
      </Tag>
    );
  }
  switch (task.status) {
    case 'paused':
      return (
        <Tag color="warning">
          {intl.formatMessage({ id: 'component.transfer.status.paused' })}
        </Tag>
      );
    case 'error':
      return (
        <Tag color="error">
          {intl.formatMessage({ id: 'component.transfer.status.error' })}
        </Tag>
      );
    case 'success':
      return (
        <Tag color="success">
          {intl.formatMessage({ id: 'component.transfer.status.success' })}
        </Tag>
      );
    case 'canceled':
      return (
        <Tag>{intl.formatMessage({ id: 'component.transfer.status.canceled' })}</Tag>
      );
    default:
      return <Tag>{task.status}</Tag>;
  }
}

/** 任务进度（取消态按 0 计，避免出现「取消了却显示 80%」） */
function taskPercent(task: GlobalUploadTask): number {
  if (task.status === 'canceled' || task.size <= 0) {
    return 0;
  }
  return Math.min(100, Math.floor((task.uploadedBytes / task.size) * 100));
}

/** 速度曲线（纯 SVG，不引入图表库：一条折线足够表达趋势） */
const SpeedChart: React.FC<{
  samples: number[];
  color: string;
  className?: string;
}> = ({ samples, color, className }) => {
  const intl = useIntl();
  const width = 296;
  const height = 44;
  if (samples.length < 2) {
    // 不足两点画不出趋势：留出等高占位，避免面板高度跳动
    return <div className={className} style={{ height }} />;
  }
  const max = Math.max(1, ...samples);
  const step = width / (samples.length - 1);
  const points = samples
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={intl.formatMessage({ id: 'component.transfer.chartAria' })}
    >
      <polyline
        points={`0,${height} ${points} ${width},${height}`}
        fill={color}
        fillOpacity={0.12}
        stroke="none"
      />
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
};

/**
 * 传输监控悬浮窗。
 */
const TransferMonitor: React.FC = () => {
  const intl = useIntl();
  const { styles, theme } = useStyles();
  const panel = useSyncExternalStore(
    shellPanelStore.subscribe,
    shellPanelStore.getSnapshot,
    shellPanelStore.getSnapshot,
  );
  const upload = useSyncExternalStore(
    uploadQueueHub.subscribe,
    uploadQueueHub.getSnapshot,
    uploadQueueHub.getSnapshot,
  );
  const { transferOpen } = panel;

  // 每秒采样一次聚合速度：用 ref 转存，避免把 interval 绑在 speed 上反复重建
  const speedRef = useRef(upload.speed);
  speedRef.current = upload.speed;
  const [samples, setSamples] = useState<number[]>([]);

  useEffect(() => {
    if (!transferOpen) {
      return;
    }
    const timer = window.setInterval(() => {
      setSamples((prev) => [...prev, speedRef.current].slice(-SAMPLE_SIZE));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [transferOpen]);

  // 没有任务时不留悬浮胶囊：避免长期占着右下角
  if (!upload.uploading && upload.countedTasks === 0 && !transferOpen) {
    return null;
  }

  if (!transferOpen) {
    return (
      <button
        type="button"
        className={styles.capsule}
        aria-label={intl.formatMessage({ id: 'component.transfer.expand' })}
        onClick={() => setTransferOpen(true)}
      >
        <Progress
          type="circle"
          size={20}
          percent={upload.percent}
          strokeWidth={12}
          showInfo={false}
        />
        <span>
          {intl.formatMessage(
            { id: 'component.transfer.capsule' },
            { count: upload.activeCount },
          )}
        </span>
        <span className={styles.capsuleValue}>{upload.percent}%</span>
        <CaretUpOutlined />
      </button>
    );
  }

  return (
    <section
      className={styles.panel}
      aria-label={intl.formatMessage({ id: 'component.transfer.title' })}
    >
      <header className={styles.header}>
        <span className={styles.title}>
          {intl.formatMessage({ id: 'component.transfer.title' })}
        </span>
        <Button
          type="text"
          size="small"
          icon={<CaretDownOutlined />}
          aria-label={intl.formatMessage({ id: 'component.transfer.collapse' })}
          onClick={() => toggleTransfer()}
        />
      </header>

      <div className={styles.summary}>
        <Progress
          percent={upload.percent}
          size="small"
          status={upload.failedCount > 0 ? 'exception' : 'normal'}
        />
        <div className={styles.summaryMeta}>
          <span>
            {intl.formatMessage(
              { id: 'component.transfer.summary' },
              { active: upload.activeCount, success: upload.succeededCount },
            )}
            {upload.failedCount > 0
              ? intl.formatMessage(
                  { id: 'component.transfer.summaryFailed' },
                  { count: upload.failedCount },
                )
              : ''}
          </span>
          <span>{upload.speed > 0 ? `${formatBytes(upload.speed)}/s` : '--'}</span>
        </div>
      </div>

      <div className={styles.actions}>
        <Tooltip title={intl.formatMessage({ id: 'component.transfer.pauseAll' })}>
          <Button
            size="small"
            icon={<PauseCircleOutlined />}
            disabled={upload.activeCount === 0}
            onClick={() => uploadQueueHub.pauseAll()}
          />
        </Tooltip>
        <Tooltip title={intl.formatMessage({ id: 'component.transfer.resumeAll' })}>
          <Button
            size="small"
            icon={<PlayCircleOutlined />}
            disabled={
              upload.activeCount === 0 &&
              upload.failedCount === 0 &&
              upload.countedTasks === 0
            }
            onClick={() => uploadQueueHub.resumeAll()}
          />
        </Tooltip>
        <Tooltip title={intl.formatMessage({ id: 'component.transfer.clearFinished' })}>
          <Button
            size="small"
            icon={<ClearOutlined />}
            disabled={
              upload.countedTasks === 0 ||
              upload.activeCount + upload.failedCount === upload.countedTasks
            }
            onClick={() => uploadQueueHub.clearFinished()}
          />
        </Tooltip>
        <span className={styles.fastMode}>
          <ThunderboltOutlined />
          <Tooltip title={intl.formatMessage({ id: 'component.transfer.fastModeHint' })}>
            <span>{intl.formatMessage({ id: 'component.transfer.fastMode' })}</span>
          </Tooltip>
          <Switch
            size="small"
            checked={upload.fastMode}
            onChange={(checked) => uploadQueueHub.setFastMode(checked)}
          />
        </span>
      </div>

      <SpeedChart
        className={styles.chart}
        samples={samples}
        color={theme.colorPrimary}
      />

      <div className={styles.list}>
        {upload.tasks.length === 0 ? (
          <Empty
            className={styles.empty}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={intl.formatMessage({ id: 'component.transfer.empty' })}
          />
        ) : (
          upload.tasks.map((task) => (
            <div className={styles.item} key={task.key}>
              <div className={styles.itemTitle}>
                <span className={styles.itemName} title={task.fileName}>
                  {task.fileName}
                </span>
                {statusTag(task, intl)}
                <span className={styles.itemActions}>
                  {ACTIVE_STATUSES.includes(task.status) ? (
                    <Tooltip title={intl.formatMessage({ id: 'component.transfer.pause' })}>
                      <Button
                        type="text"
                        size="small"
                        icon={<PauseCircleOutlined />}
                        aria-label={intl.formatMessage(
                          { id: 'component.transfer.pauseNamed' },
                          { name: task.fileName },
                        )}
                        onClick={() =>
                          uploadQueueHub.pauseTask(task.queueId, task.id)
                        }
                      />
                    </Tooltip>
                  ) : (
                    (task.status === 'paused' || task.status === 'error') && (
                      <Tooltip
                        title={intl.formatMessage({ id: 'component.transfer.resumeRetry' })}
                      >
                        <Button
                          type="text"
                          size="small"
                          icon={<PlayCircleOutlined />}
                          aria-label={intl.formatMessage(
                            { id: 'component.transfer.resumeNamed' },
                            { name: task.fileName },
                          )}
                          onClick={() =>
                            uploadQueueHub.resumeTask(task.queueId, task.id)
                          }
                        />
                      </Tooltip>
                    )
                  )}
                </span>
              </div>
              <Progress
                percent={taskPercent(task)}
                size="small"
                showInfo={false}
                status={task.status === 'error' ? 'exception' : 'normal'}
              />
              <div className={styles.itemMeta}>
                <span>
                  {formatBytes(task.uploadedBytes)} / {formatBytes(task.size)}
                </span>
                <span>
                  {task.status === 'uploading' && task.speed > 0
                    ? `${formatBytes(task.speed)}/s`
                    : ''}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};

export default TransferMonitor;
