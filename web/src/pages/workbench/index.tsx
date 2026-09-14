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

import { PageContainer } from '@ant-design/pro-components';
import { Alert, Card, Col, Progress, Row, Space, Statistic, Tooltip, Typography } from 'antd';
import { history } from '@umijs/max';
import { useCallback, useEffect, useState } from 'react';

import { formatBytes } from '@/components/ChunkUpload';
import {
  fetchPendingApprovalCount,
  fetchTransferStats,
  successRateOf,
  type TransferStats,
  totalTransferBytes,
} from '@/services/dashboard';
import { EMPTY_UNREAD, fetchUnreadCount } from '@/services/notify';
import type { UnreadCount } from '@/services/notify';

const { Text } = Typography;

/** 未就绪统一占位符。 */
const PLACEHOLDER = '--';

const WorkbenchPage = () => {
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState<UnreadCount>({ ...EMPTY_UNREAD });
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  // undefined = 尚未加载完成（避免加载中就闪出「接口未就绪」提示）
  const [transfer, setTransfer] = useState<TransferStats | null | undefined>(undefined);

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
    <PageContainer header={{ title: '工作台', subTitle: '传输、审批与待办一屏总览' }}>
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
          <Card loading={loading} title="传输量" size="small">
            <Statistic
              value={transferReady ? formatBytes(totalTransferBytes(stats)) : PLACEHOLDER}
            />
            <Space size={16} style={{ marginTop: 8 }}>
              <Text type="secondary">
                上传 {transferReady ? formatBytes(stats?.uploadBytes ?? 0) : PLACEHOLDER}
              </Text>
              <Text type="secondary">
                下载 {transferReady ? formatBytes(stats?.downloadBytes ?? 0) : PLACEHOLDER}
              </Text>
            </Space>
          </Card>
        </Col>

        <Col xs={24} sm={12} xl={6}>
          <Card loading={loading} title="传输成功率" size="small">
            <Statistic
              value={rate === null ? PLACEHOLDER : rate}
              suffix={rate === null ? undefined : '%'}
            />
            <div style={{ marginTop: 12 }}>
              <Tooltip title="成功任务数 ÷（成功 + 失败）；无任务时不显示 0% 以免误判">
                <Progress
                  percent={rate ?? 0}
                  status={rate === null ? 'normal' : undefined}
                  showInfo={false}
                  size="small"
                />
              </Tooltip>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} xl={6}>
          <Card loading={loading} title="待我审批" size="small" hoverable onClick={() => history.push('/approval')}>
            <Statistic value={pendingCount === null ? PLACEHOLDER : pendingCount} suffix="单" />
            <Text type="secondary">点击进入审批中心</Text>
          </Card>
        </Col>

        <Col xs={24} sm={12} xl={6}>
          <Card loading={loading} title="待办数" size="small">
            <Statistic value={unread.todo} suffix="项" />
            <Text type="secondary">含审批待办、审批结果与传输完成</Text>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};

export default WorkbenchPage;
