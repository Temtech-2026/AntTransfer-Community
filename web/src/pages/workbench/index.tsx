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
import { history, useIntl } from '@umijs/max';
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

/** 快捷入口：纯导航，不承载任何数据，因此不受接口降级影响。文案走 i18n id。 */
const QUICK_LINKS = [
  {
    key: 'upload',
    path: '/upload',
    titleId: 'workbench.quick.upload.title',
    descId: 'workbench.quick.upload.desc',
    icon: <CloudUploadOutlined />,
  },
  {
    key: 'file',
    path: '/file',
    titleId: 'workbench.quick.file.title',
    descId: 'workbench.quick.file.desc',
    icon: <FolderOpenOutlined />,
  },
  {
    key: 'shares',
    path: '/shares',
    titleId: 'workbench.quick.shares.title',
    descId: 'workbench.quick.shares.desc',
    icon: <ShareAltOutlined />,
  },
  {
    key: 'approval',
    path: '/approval',
    titleId: 'workbench.quick.approval.title',
    descId: 'workbench.quick.approval.desc',
    icon: <AuditOutlined />,
  },
  {
    key: 'messages',
    path: '/messages',
    titleId: 'workbench.quick.messages.title',
    descId: 'workbench.quick.messages.desc',
    icon: <BellOutlined />,
  },
] as const;

const WorkbenchPage = () => {
  const intl = useIntl();
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
        title: intl.formatMessage({ id: 'workbench.title' }),
        subTitle: intl.formatMessage({ id: 'workbench.subtitle' }),
      }}
      extra={[
        <Button
          key="refresh"
          type="text"
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => void load()}
        >
          {intl.formatMessage({ id: 'workbench.action.refresh' })}
        </Button>,
      ]}
    >
      {transfer === null && !loading ? (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          message={intl.formatMessage({ id: 'workbench.degraded.title' })}
          description={intl.formatMessage({ id: 'workbench.degraded.desc' })}
        />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={loading}
            title={intl.formatMessage({ id: 'workbench.stat.transfer' })}
            icon={<CloudUploadOutlined />}
            value={
              transferReady
                ? formatBytes(totalTransferBytes(stats))
                : PLACEHOLDER
            }
            footer={
              <>
                <Text type="secondary">
                  {intl.formatMessage({ id: 'workbench.stat.upload' })}{' '}
                  {transferReady
                    ? formatBytes(stats?.uploadBytes ?? 0)
                    : PLACEHOLDER}
                </Text>
                <Text type="secondary">
                  {intl.formatMessage({ id: 'workbench.stat.download' })}{' '}
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
            title={intl.formatMessage({ id: 'workbench.stat.successRate' })}
            tone="cyan"
            icon={<ThunderboltOutlined />}
            value={rate === null ? PLACEHOLDER : rate}
            suffix={rate === null ? undefined : '%'}
            footer={
              <Tooltip
                title={intl.formatMessage({
                  id: 'workbench.stat.successRate.tip',
                })}
              >
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
            title={intl.formatMessage({ id: 'workbench.stat.pending' })}
            tone="orange"
            icon={<AuditOutlined />}
            value={pendingCount === null ? PLACEHOLDER : pendingCount}
            suffix={intl.formatMessage({ id: 'workbench.stat.pending.unit' })}
            onClick={() => history.push('/approval')}
            footer={
              <Text type="secondary">
                {intl.formatMessage({ id: 'workbench.stat.pending.footer' })}
              </Text>
            }
          />
        </Col>

        <Col xs={24} sm={12} xl={6}>
          <StatCard
            loading={loading}
            title={intl.formatMessage({ id: 'workbench.stat.todo' })}
            tone="blue"
            icon={<BellOutlined />}
            value={unread.todo}
            suffix={intl.formatMessage({ id: 'workbench.stat.todo.unit' })}
            footer={
              <Text type="secondary">
                {intl.formatMessage({ id: 'workbench.stat.todo.footer' })}
              </Text>
            }
          />
        </Col>
      </Row>

      <SectionCard
        style={{ marginTop: 16 }}
        title={intl.formatMessage({ id: 'workbench.quick.title' })}
        subTitle={intl.formatMessage({ id: 'workbench.quick.subtitle' })}
        extra={
          <Text type="secondary">
            {intl.formatMessage({ id: 'workbench.quick.extra' })}
          </Text>
        }
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
                <span className={styles.quickTitle}>
                  {intl.formatMessage({ id: link.titleId })}
                </span>
                <span className={styles.quickDesc}>
                  {intl.formatMessage({ id: link.descId })}
                </span>
              </span>
            </button>
          ))}
        </div>
      </SectionCard>
    </PageContainer>
  );
};

export default WorkbenchPage;
