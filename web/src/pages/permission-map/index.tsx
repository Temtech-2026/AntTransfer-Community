/**
 * 权限地图：我有哪些权限、从哪来、什么时候到期。
 *
 * <p><b>三条线索各自独立，不做交叉编造：</b>
 * ① 权限点集合（`permCodes`）——后端只给「有没有」，不给「从哪来」；
 * ② 角色（`roleCodes`）——角色是权限点的来源之一，但后端不下发「哪个点来自哪个角色」；
 * ③ 审批授权（`approvalGrants`）——带资源与到期时间，是唯一有有效期的来源。
 * 所以页面把 ②③ 分成两块呈现，逐点来源留给后端后续接口，不在前端拼接。
 *
 * <p>另外这是一条「到期轴」而非「起止区间轴」：授权落库即生效，后端不下发生效时间。
 */

import {
  ClockCircleOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import {
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import {
  Alert,
  Button,
  Col,
  Descriptions,
  Empty,
  Row,
  Space,
  Spin,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import SectionCard from '@/components/SectionCard';
import StatCard from '@/components/StatCard';
import {
  type ApprovalGrant,
  fetchPermissionMap,
  type PermissionMapView,
} from '@/services/access';
import { actionLabel } from '@/services/approval';

import {
  buildGrantTimeline,
  type GrantState,
  type GrantTimelineEntry,
  grantStateColor,
  grantStateText,
  remainDaysText,
  summarizeGrants,
} from './grant-timeline';

const { Text, Paragraph } = Typography;

/** 授权状态 → Timeline 色名（antd Timeline 只认预设色名，不认 Tag 的 success/error 语义色）。 */
function timelineColorOf(state: GrantState): string {
  switch (state) {
    case 'expired':
      return 'red';
    case 'expiring':
      return 'orange';
    case 'permanent':
      return 'gray';
    default:
      return 'green';
  }
}

/** 资源文案（审批授权挂在具体资源上）。 */
function resourceText(grant: ApprovalGrant): string {
  if (!grant.resourceType) {
    return '—';
  }
  return `${grant.resourceType} / ${grant.resourceId ?? '-'}`;
}

const PermissionMapPage = () => {
  const [data, setData] = useState<PermissionMapView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 固定时间基准：避免每次重渲染都重算剩余天数导致文案抖动
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const map = await fetchPermissionMap();
      setData(map);
      setError(null);
    } catch (err) {
      setError((err as Error)?.message || '权限地图加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grants = useMemo(() => data?.approvalGrants ?? [], [data]);
  const timeline = useMemo(
    () => buildGrantTimeline(grants, now),
    [grants, now],
  );
  const summary = useMemo(() => summarizeGrants(timeline), [timeline]);
  // 预建索引：列渲染不重复 find，避免 O(行数 × 授权数)
  const entryByGrantId = useMemo(() => {
    const map = new Map<number, GrantTimelineEntry>();
    for (const entry of timeline) {
      map.set(entry.grant.grantId, entry);
    }
    return map;
  }, [timeline]);

  const columns: ProColumns<ApprovalGrant>[] = [
    {
      title: '来源',
      width: 160,
      render: (_, grant) => (
        <Space size={4}>
          <Tag color="blue">审批授权</Tag>
          <Text type="secondary">#{grant.grantId}</Text>
        </Space>
      ),
    },
    {
      title: '授权动作',
      width: 120,
      render: (_, grant) => actionLabel(grant.grantType),
    },
    {
      title: '资源',
      ellipsis: true,
      render: (_, grant) => resourceText(grant),
    },
    {
      title: '来源申请单',
      width: 120,
      render: (_, grant) =>
        grant.applicationId ? `#${grant.applicationId}` : '—',
    },
    {
      title: '到期时间',
      width: 170,
      render: (_, grant) => grant.expireAt || '长期有效',
    },
    {
      title: '有效期状态',
      width: 130,
      render: (_, grant) => {
        const entry = entryByGrantId.get(grant.grantId);
        return (
          <Space size={6}>
            <Tag color={grantStateColor(entry?.state ?? 'active')}>
              {grantStateText(entry?.state ?? 'active')}
            </Tag>
            <Text type="secondary">
              {remainDaysText(entry?.remainDays ?? null)}
            </Text>
          </Space>
        );
      },
    },
  ];

  return (
    <PageContainer
      header={{ title: '权限地图', subTitle: '我持有的权限点、来源与有效期' }}
      extra={[
        <Button key="reload" onClick={() => void load()} loading={loading}>
          刷新
        </Button>,
      ]}
    >
      {error ? (
        <Alert
          style={{ marginBottom: 16 }}
          type="error"
          showIcon
          title={error}
        />
      ) : null}

      <Spin spinning={loading}>
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} xl={6}>
              <StatCard
                title="权限点"
                value={data?.permCodes?.length ?? 0}
                icon={<SafetyCertificateOutlined />}
                footer="后端只提供「是否持有」"
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <StatCard
                title="角色"
                value={data?.roleCodes?.length ?? 0}
                tone="blue"
                icon={<TeamOutlined />}
                footer="权限点的已知来源之一"
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <StatCard
                title="审批授权"
                value={summary.total}
                tone="purple"
                icon={<UserSwitchOutlined />}
                footer={`其中 ${summary.expired} 条已过期`}
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <StatCard
                title="即将到期"
                value={summary.expiring}
                tone="orange"
                icon={<ClockCircleOutlined />}
                footer="7 天内到期"
              />
            </Col>
          </Row>

          <SectionCard
            title="权限概览"
            subTitle="用户、数据范围与权限点"
            icon={<SafetyCertificateOutlined />}
          >
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="用户 ID">
                {data?.userId ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="数据范围">
                {data?.dataScope || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="角色" span={2}>
                {data?.roleCodes?.length ? (
                  <Space size={4} wrap>
                    {data.roleCodes.map((code) => (
                      <Tag key={code} color="geekblue">
                        {code}
                      </Tag>
                    ))}
                  </Space>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="审批授权" span={2}>
                共 {summary.total} 条
                {summary.expiring > 0
                  ? ` · ${summary.expiring} 条即将到期`
                  : ''}
                {summary.expired > 0 ? ` · ${summary.expired} 条已过期` : ''}
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 16 }}>
              <Text strong>权限点（{data?.permCodes?.length ?? 0}）</Text>
              <Paragraph
                type="secondary"
                style={{ marginTop: 4, marginBottom: 8 }}
              >
                后端只提供「是否持有」，逐点来源需等后续接口；下方角色与审批授权是两条已知来源。
              </Paragraph>
              {data?.permCodes?.length ? (
                <Space size={4} wrap>
                  {data.permCodes.map((code) => (
                    <Tag key={code}>{code}</Tag>
                  ))}
                </Space>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无权限点"
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="授权来源"
            subTitle={`共 ${grants.length} 条审批授权`}
            bodyPadding={false}
          >
            <ProTable<ApprovalGrant>
              rowKey="grantId"
              columns={columns}
              dataSource={grants}
              search={false}
              options={false}
              pagination={false}
              size="small"
              locale={{ emptyText: <Empty description="暂无审批授权" /> }}
            />
          </SectionCard>

          <SectionCard title="有效期时间轴" subTitle="到期轴：授权落库即生效">
            {timeline.length ? (
              <Timeline
                items={timeline.map((entry) => ({
                  color: timelineColorOf(entry.state),
                  children: (
                    <Space orientation="vertical" size={2}>
                      <Space size={6}>
                        <Text strong>{actionLabel(entry.grant.grantType)}</Text>
                        <Tag color={grantStateColor(entry.state)}>
                          {grantStateText(entry.state)}
                        </Tag>
                      </Space>
                      <Text type="secondary">
                        {resourceText(entry.grant)} · 到期{' '}
                        {entry.grant.expireAt || '长期有效'} ·{' '}
                        {remainDaysText(entry.remainDays)}
                      </Text>
                      {entry.grant.applicationId ? (
                        <Text type="secondary">
                          来源申请单 #{entry.grant.applicationId}
                        </Text>
                      ) : null}
                    </Space>
                  ),
                }))}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无带有效期的授权"
              />
            )}
          </SectionCard>
        </Space>
      </Spin>
    </PageContainer>
  );
};

export default PermissionMapPage;
