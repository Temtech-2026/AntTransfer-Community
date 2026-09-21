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
 *
 * <p><b>页面上的可视化全部由已有字段推导</b>，没有为了「好看」引入任何新契约：
 * 四态占比条（`expireAt` 现算）、权限域分布条（按权限点 `:` 前缀前端分组）、
 * 表格里的剩余天数条（30 天封顶的视觉刻度）、时间轴色点。凡是刻度带主观设定的地方，
 * 都写成常量 + 注释并在文案里交代，不让读者误以为它来自后端。
 */

import {
  ClockCircleOutlined,
  PieChartOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';
import {
  PageContainer,
  type ProColumns,
  ProTable,
} from '@ant-design/pro-components';
import { useIntl } from '@umijs/max';
import {
  Alert,
  Button,
  Col,
  Descriptions,
  Empty,
  Progress,
  Row,
  Space,
  Spin,
  Tag,
  theme,
  Timeline,
  Tooltip,
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
import { actionLabelId } from '@/services/approval';

import {
  buildGrantTimeline,
  type GrantState,
  type GrantStateSlice,
  type GrantTimelineEntry,
  grantStateColor,
  grantStateTextId,
  remainDaysTextId,
  summarizeGrants,
  summarizeGrantStates,
  VALIDITY_BAR_HORIZON_DAYS,
  validityBarPercent,
} from './grant-timeline';
import useStyles from './index.style';
import { groupPermCodesByDomain } from './perm-domains';

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

/** 状态 → 色块样式名：占比条与图例色点共用一份映射，颜色不会在两处各自漂移。 */
const TONE_KEY = {
  active: 'toneActive',
  expiring: 'toneExpiring',
  expired: 'toneExpired',
  permanent: 'tonePermanent',
} as const satisfies Record<GrantState, string>;

/**
 * 授权状态占比条（纯展示）。
 *
 * <p>每一段的宽度按**条数**现算，不用切片里的 `percent`：四段各自四舍五入后加起来
 * 未必是 100，拼起来会出现缝隙或溢出。</p>
 *
 * <p>整条标 `aria-hidden`：四态的名称、条数与占比已由图例文字完整给出，
 * 让读屏软件再念一串没有语义的色块只会更差。</p>
 */
const GrantStateBar = ({ slices }: { slices: GrantStateSlice[] }) => {
  const { styles } = useStyles();
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  if (!total) {
    return null;
  }
  return (
    <div className={styles.bar} aria-hidden="true">
      {slices
        .filter((slice) => slice.count > 0)
        .map((slice) => (
          <span
            key={slice.state}
            className={`${styles.barSegment} ${styles[TONE_KEY[slice.state]]}`}
            style={{ width: `${(slice.count / total) * 100}%` }}
          />
        ))}
    </div>
  );
};

const PermissionMapPage = () => {
  const intl = useIntl();
  const { styles } = useStyles();
  const { token } = theme.useToken();
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
      setError((err as Error)?.message || intl.formatMessage({ id: 'permissionMap.loadFailed' }));
    } finally {
      setLoading(false);
    }
  }, [intl]);

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
    const map = new Map<string, GrantTimelineEntry>();
    for (const entry of timeline) {
      map.set(entry.grant.grantId, entry);
    }
    return map;
  }, [timeline]);
  /** 四态分布切片：顺序固定、含条数为 0 的状态，图例位置不会随数据抖动。 */
  const stateSlices = useMemo(() => summarizeGrantStates(timeline), [timeline]);
  /** 权限域分组（前端按 `:` 前缀切分）。 */
  const domainGroups = useMemo(
    () => groupPermCodesByDomain(data?.permCodes),
    [data],
  );
  /** 域分布条的相对刻度：条数最多的一组满格（下限取 1，不让 0 当除数）。 */
  const domainMax = useMemo(
    () => domainGroups.reduce((max, group) => Math.max(max, group.codes.length), 1),
    [domainGroups],
  );
  /**
   * 剩余天数条的描边色（语义 token，暗色主题自动跟随）。
   * `permanent` 这一项实际画不到（见 `validityBarPercent` 的 null 口径），留着只为映射完整。
   */
  const barStroke: Record<GrantState, string> = {
    active: token.colorSuccess,
    expiring: token.colorWarning,
    expired: token.colorError,
    permanent: token.colorTextQuaternary,
  };

  /** 概览里的「共 N 条 · M 条即将到期 · K 条已过期」。 */
  const grantsSummaryText = [
    intl.formatMessage({ id: 'permissionMap.grant.total' }, { total: summary.total }),
    summary.expiring > 0
      ? intl.formatMessage(
          { id: 'permissionMap.grant.expiringSuffix' },
          { count: summary.expiring },
        )
      : '',
    summary.expired > 0
      ? intl.formatMessage(
          { id: 'permissionMap.grant.expiredSuffix' },
          { count: summary.expired },
        )
      : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const columns: ProColumns<ApprovalGrant>[] = [
    {
      title: intl.formatMessage({ id: 'permissionMap.column.source' }),
      width: 160,
      render: (_, grant) => (
        <Space size={4}>
          <Tag color="blue">
            {intl.formatMessage({ id: 'permissionMap.source.approval' })}
          </Tag>
          <Text type="secondary">#{grant.grantId}</Text>
        </Space>
      ),
    },
    {
      title: intl.formatMessage({ id: 'permissionMap.column.grantType' }),
      width: 120,
      render: (_, grant) => intl.formatMessage({ id: actionLabelId(grant.grantType) }),
    },
    {
      title: intl.formatMessage({ id: 'permissionMap.column.resource' }),
      ellipsis: true,
      render: (_, grant) => resourceText(grant),
    },
    {
      title: intl.formatMessage({ id: 'permissionMap.column.application' }),
      width: 120,
      render: (_, grant) =>
        grant.applicationId ? `#${grant.applicationId}` : '—',
    },
    {
      title: intl.formatMessage({ id: 'permissionMap.column.expireAt' }),
      width: 170,
      render: (_, grant) =>
        grant.expireAt ||
        intl.formatMessage({ id: 'permissionMap.grantState.permanent' }),
    },
    {
      title: intl.formatMessage({ id: 'permissionMap.column.validity' }),
      width: 150,
      render: (_, grant) => {
        const entry = entryByGrantId.get(grant.grantId);
        const state = entry?.state ?? 'active';
        const remainDays = entry?.remainDays ?? null;
        const barPercent = validityBarPercent(remainDays);
        return (
          <Space orientation="vertical" size={2} style={{ width: '100%' }}>
            <Space size={6}>
              <Tag color={grantStateColor(state)}>
                {intl.formatMessage({ id: grantStateTextId(state) })}
              </Tag>
              <Text type="secondary">
                {intl.formatMessage(remainDaysTextId(remainDays))}
              </Text>
            </Space>
            {barPercent === null ? null : (
              // 条长口径见 validityBarPercent：30 天封顶的剩余刻度，不是「已用比例」
              <Tooltip
                title={intl.formatMessage(
                  { id: 'permissionMap.validity.barTip' },
                  { days: remainDays ?? 0, horizon: VALIDITY_BAR_HORIZON_DAYS },
                )}
              >
                <Progress
                  percent={barPercent}
                  showInfo={false}
                  size="small"
                  strokeColor={barStroke[state]}
                  style={{ margin: 0, width: 96 }}
                />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <PageContainer
      header={{
        title: intl.formatMessage({ id: 'permissionMap.page.title' }),
        subTitle: intl.formatMessage({ id: 'permissionMap.page.subTitle' }),
      }}
      extra={[
        <Button key="reload" onClick={() => void load()} loading={loading}>
          {intl.formatMessage({ id: 'common.action.refresh' })}
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
                title={intl.formatMessage({ id: 'permissionMap.stat.perm.title' })}
                value={data?.permCodes?.length ?? 0}
                icon={<SafetyCertificateOutlined />}
                footer={intl.formatMessage({ id: 'permissionMap.stat.perm.footer' })}
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <StatCard
                title={intl.formatMessage({ id: 'permissionMap.stat.role.title' })}
                value={data?.roleCodes?.length ?? 0}
                tone="blue"
                icon={<TeamOutlined />}
                footer={intl.formatMessage({ id: 'permissionMap.stat.role.footer' })}
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <StatCard
                title={intl.formatMessage({ id: 'permissionMap.stat.grant.title' })}
                value={summary.total}
                tone="purple"
                icon={<UserSwitchOutlined />}
                footer={intl.formatMessage(
                  { id: 'permissionMap.stat.grant.footer' },
                  { expired: summary.expired },
                )}
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <StatCard
                title={intl.formatMessage({ id: 'permissionMap.grantState.expiring' })}
                value={summary.expiring}
                tone="orange"
                icon={<ClockCircleOutlined />}
                footer={intl.formatMessage({ id: 'permissionMap.stat.expiring.footer' })}
              />
            </Col>
          </Row>

          <SectionCard
            title={intl.formatMessage({ id: 'permissionMap.distribution.title' })}
            subTitle={intl.formatMessage(
              { id: 'permissionMap.distribution.subTitle' },
              { count: summary.total },
            )}
            icon={<PieChartOutlined />}
          >
            {summary.total ? (
              <>
                <GrantStateBar slices={stateSlices} />
                <div className={styles.legend}>
                  {stateSlices.map((slice) => (
                    <div key={slice.state} className={styles.legendItem}>
                      <span
                        className={`${styles.dot} ${styles[TONE_KEY[slice.state]]}`}
                      />
                      <span className={styles.legendLabel}>
                        {intl.formatMessage({ id: grantStateTextId(slice.state) })}
                      </span>
                      <span className={styles.legendValue}>{slice.count}</span>
                      <span className={styles.legendLabel}>
                        {intl.formatMessage(
                          { id: 'permissionMap.distribution.percent' },
                          { percent: slice.percent },
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={intl.formatMessage({
                  id: 'permissionMap.distribution.empty',
                })}
              />
            )}
          </SectionCard>

          <SectionCard
            title={intl.formatMessage({ id: 'permissionMap.overview.title' })}
            subTitle={intl.formatMessage({ id: 'permissionMap.overview.subTitle' })}
            icon={<SafetyCertificateOutlined />}
          >
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item
                label={intl.formatMessage({ id: 'permissionMap.overview.userId' })}
              >
                {data?.userId ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item
                label={intl.formatMessage({ id: 'permissionMap.overview.dataScope' })}
              >
                {data?.dataScope || '—'}
              </Descriptions.Item>
              <Descriptions.Item
                label={intl.formatMessage({ id: 'permissionMap.overview.roles' })}
                span={2}
              >
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
              <Descriptions.Item
                label={intl.formatMessage({ id: 'permissionMap.overview.grants' })}
                span={2}
              >
                {grantsSummaryText}
              </Descriptions.Item>
            </Descriptions>

            {domainGroups.length ? (
              <div style={{ marginTop: 16 }}>
                <Text strong>
                  {intl.formatMessage({ id: 'permissionMap.permCodes.domainTitle' })}
                </Text>
                <Paragraph
                  type="secondary"
                  style={{ marginTop: 4, marginBottom: 8 }}
                >
                  {intl.formatMessage({ id: 'permissionMap.permCodes.domainDesc' })}
                </Paragraph>
                <div className={styles.domainList}>
                  {domainGroups.map((group) => (
                    <div
                      key={group.domain || 'other'}
                      className={styles.domainRow}
                    >
                      <span className={styles.domainName}>
                        {group.domain ||
                          intl.formatMessage({
                            id: 'permissionMap.permCodes.domainOther',
                          })}
                      </span>
                      <span className={styles.domainTrack}>
                        <span
                          className={styles.domainFill}
                          style={{
                            width: `${(group.codes.length / domainMax) * 100}%`,
                          }}
                        />
                      </span>
                      <span className={styles.domainCount}>
                        {intl.formatMessage(
                          { id: 'permissionMap.permCodes.domainCount' },
                          { count: group.codes.length },
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={{ marginTop: 16 }}>
              <Text strong>
                {intl.formatMessage(
                  { id: 'permissionMap.permCodes.title' },
                  { count: data?.permCodes?.length ?? 0 },
                )}
              </Text>
              <Paragraph
                type="secondary"
                style={{ marginTop: 4, marginBottom: 8 }}
              >
                {intl.formatMessage({ id: 'permissionMap.permCodes.desc' })}
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
                  description={intl.formatMessage({ id: 'permissionMap.permCodes.empty' })}
                />
              )}
            </div>
          </SectionCard>

          <SectionCard
            title={intl.formatMessage({ id: 'permissionMap.grants.title' })}
            subTitle={intl.formatMessage(
              { id: 'permissionMap.grants.subTitle' },
              { count: grants.length },
            )}
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
              locale={{
                emptyText: (
                  <Empty
                    description={intl.formatMessage({ id: 'permissionMap.grants.empty' })}
                  />
                ),
              }}
            />
          </SectionCard>

          <SectionCard
            title={intl.formatMessage({ id: 'permissionMap.timeline.title' })}
            subTitle={intl.formatMessage({ id: 'permissionMap.timeline.subTitle' })}
          >
            {timeline.length ? (
              <Timeline
                items={timeline.map((entry) => ({
                  color: timelineColorOf(entry.state),
                  children: (
                    <Space orientation="vertical" size={2}>
                      <Space size={6}>
                        <Text strong>
                          {intl.formatMessage({
                            id: actionLabelId(entry.grant.grantType),
                          })}
                        </Text>
                        <Tag color={grantStateColor(entry.state)}>
                          {intl.formatMessage({ id: grantStateTextId(entry.state) })}
                        </Tag>
                      </Space>
                      <Text type="secondary">
                        {resourceText(entry.grant)} ·{' '}
                        {intl.formatMessage({ id: 'permissionMap.timeline.expirePrefix' })}{' '}
                        {entry.grant.expireAt ||
                          intl.formatMessage({ id: 'permissionMap.grantState.permanent' })}{' '}
                        ·{' '}
                        {intl.formatMessage(remainDaysTextId(entry.remainDays))}
                      </Text>
                      {entry.grant.applicationId ? (
                        <Text type="secondary">
                          {intl.formatMessage(
                            { id: 'permissionMap.timeline.fromApplication' },
                            { id: entry.grant.applicationId },
                          )}
                        </Text>
                      ) : null}
                    </Space>
                  ),
                }))}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={intl.formatMessage({ id: 'permissionMap.timeline.empty' })}
              />
            )}
          </SectionCard>
        </Space>
      </Spin>
    </PageContainer>
  );
};

export default PermissionMapPage;
