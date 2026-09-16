/**
 * 工作台仪表盘。
 *
 * <p><b>四个卡片全部接真实接口，页面须分清单卡片失败与整页失败：</b>
 * <ul>
 *   <li>待审批数（`/applications/pending` 的 total）、待办数（未读快照 `todo`）；</li>
 *   <li>传输量、成功率（at-transfer `GET /v1/transfers/statistics`）。</li>
 * </ul>
 * 任一数据源拉取失败只让对应卡片渲染「--」占位，**绝不填模拟数字**，整页照常可用。
 *
 * <p>降级口径（PRD US-11）：单卡片失败不阻塞整页。
 */

import {
  AuditOutlined,
  BellOutlined,
  CloudUploadOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  ShareAltOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { history } from '@umijs/max';
import { Alert, Button, Col, Progress, Row, Tooltip, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { formatBytes } from '@/components/ChunkUpload';
import SectionCard from '@/components/SectionCard';
import StatCard from '@/components/StatCard';
import {
  fetchPendingApprovalCount,
  fetchTransferStats,
  successRateOf,
  type TransferStats,
  totalTransferBytes,
} from '@/services/dashboard';
import type { UnreadCount } from '@/services/notify';
import { EMPTY_UNREAD, fetchUnreadCount } from '@/services/notify';
import useStyles from './index.style';

const { Text } = Typography;

/** 未就绪统一占位符。 */
const PLACEHOLDER = '--';

/** 快捷入口：纯导航，不承载任何数据，因此不受接口降级影响。 */
const QUICK_LINKS = [
  {
    key: 'upload',
    path: '/upload',
    title: '上传文件',
    desc: '拖拽或分片续传',
    icon: <CloudUploadOutlined />,
  },
  {
    key: 'file',
    path: '/file',
    title: '文件管理',
    desc: '浏览与整理目录',
    icon: <FolderOpenOutlined />,
  },
  {
    key: 'shares',
    path: '/shares',
    title: '我的分享',
    desc: '链接与提取码',
    icon: <ShareAltOutlined />,
  },
  {
    key: 'approval',
    path: '/approval',
    title: '审批中心',
    desc: '待办与已办',
    icon: <AuditOutlined />,
  },
  {
    key: 'messages',
    path: '/messages',
    title: '消息中心',
    desc: '系统与传输通知',
    icon: <BellOutlined />,
  },
] as const;

const WorkbenchPage = () => {
  const { styles } = useStyles();
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState<UnreadCount>({ ...EMPTY_UNREAD });
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  // undefined = 尚未加载完成（避免加载中就闪出「接口未就绪」提示）
  const [transfer, setTransfer] = useState<TransferStats | null | undefined>(
    undefined,
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [unreadCount, pending, stats] = await Promise.all([
      fetchUnreadCount(),
      fetchPendingApprovalCount(),
      fetchTransferStats(),
    ]);
    setUnread(unreadCount);
    setPendingCount(pending);
    setTransfer(stats);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = transfer ?? null;
  const rate = successRateOf(stats);
  // 三个态要分清：undefined = 加载中（先别提示降级）/ null = 拉取失败（降级占位）/ 对象 = 有数据
  const transferReady = transfer !== undefined && transfer !== null;

  return (
    <PageContainer
      header={{
        title: '工作台',
        subTitle: '传输、审批与待办一屏总览',
      }}
      extra={[
        <Button
          key="refresh"
          type="text"
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => void load()}
        >
          刷新
        </Button>,
      ]}
    >
      {transfer === null && !loading ? (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          message="传输量与成功率暂不可用"
          description="统计接口本次拉取失败，已降级为占位符（不会显示模拟数据）；其余卡片不受影响，可稍后刷新重试。"
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={loading}
            title="传输量"
            icon={<CloudUploadOutlined />}
            value={
              transferReady
                ? formatBytes(totalTransferBytes(stats))
                : PLACEHOLDER
            }
            footer={
              <>
                <Text type="secondary">
                  上传{' '}
                  {transferReady
                    ? formatBytes(stats?.uploadBytes ?? 0)
                    : PLACEHOLDER}
                </Text>
                <Text type="secondary">
                  下载{' '}
                  {transferReady
                    ? formatBytes(stats?.downloadBytes ?? 0)
                    : PLACEHOLDER}
                </Text>
              </>
            }
          />
        </Col>

        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={loading}
            title="传输成功率"
            tone="cyan"
            icon={<ThunderboltOutlined />}
            value={rate === null ? PLACEHOLDER : rate}
            suffix={rate === null ? undefined : '%'}
            footer={
              <Tooltip title="成功任务数 ÷（成功 + 失败）；无任务时不显示 0% 以免误判">
                <Progress
                  percent={rate ?? 0}
                  status={rate === null ? 'normal' : undefined}
                  showInfo={false}
                  size="small"
                  strokeColor={{ from: '#00d68f', to: '#00c16a' }}
                  style={{ margin: 0 }}
                />
              </Tooltip>
            }
          />
        </Col>

        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={loading}
            title="待我审批"
            tone="orange"
            icon={<AuditOutlined />}
            value={pendingCount === null ? PLACEHOLDER : pendingCount}
            suffix="单"
            onClick={() => history.push('/approval')}
            footer={<Text type="secondary">点击进入审批中心</Text>}
          />
        </Col>

        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={loading}
            title="待办数"
            tone="blue"
            icon={<BellOutlined />}
            value={unread.todo}
            suffix="项"
            footer={
              <Text type="secondary">含审批待办、审批结果与传输完成</Text>
            }
          />
        </Col>
      </Row>

      <SectionCard
        style={{ marginTop: 16 }}
        title="快捷入口"
        subTitle="常用操作直达"
        extra={<Text type="secondary">仅作导航，不加载数据</Text>}
      >
        <div className={styles.quickGrid}>
          {QUICK_LINKS.map((link) => (
            <button
              key={link.key}
              type="button"
              className={styles.quickItem}
              onClick={() => history.push(link.path)}
            >
              <span className={styles.quickIcon}>{link.icon}</span>
              <span className={styles.quickText}>
                <span className={styles.quickTitle}>{link.title}</span>
                <span className={styles.quickDesc}>{link.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </SectionCard>
    </PageContainer>
  );
};

export default WorkbenchPage;
