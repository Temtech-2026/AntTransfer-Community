/**
 * 审批单详情抽屉。
 *
 * <p>后端没有「审批详情」单独接口（`/applications/pending|mine` 返回的就是完整 VO），
 * 因此详情直接用列表行数据渲染，不额外发请求——也就不会出现「列表已刷新、详情还是旧值」
 * 的双份状态。
 */

import { useIntl } from '@umijs/max';
import { Descriptions, Drawer, Space, Tag, Timeline, Typography } from 'antd';
import { useMemo } from 'react';

import {
  approvalStatusColor,
  approvalStatusTextId,
  actionLabelId,
  formatCountdown,
  formatDeadline,
  slaDeadlineMs,
  slaRemainingMs,
  slaStage,
  slaStageColor,
} from '@/services/approval';
import type { ApprovalApplication, Translate } from '@/services/approval';
import { levelColor, levelTextId } from '@/services/file';

import { buildApprovalTimeline, timelineColor } from '../timeline';

const { Text } = Typography;

export interface ApprovalDetailDrawerProps {
  open: boolean;
  application: ApprovalApplication | null;
  onClose: () => void;
}

/** 空值统一渲染为「—」，避免出现空白单元格让人误以为数据没加载出来。 */
function text(value?: string | number | null): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return String(value);
}

export const ApprovalDetailDrawer = ({
  open,
  application,
  onClose,
}: ApprovalDetailDrawerProps) => {
  const intl = useIntl();
  const timeline = buildApprovalTimeline(application);
  const remaining = application ? slaRemainingMs(application, Date.now()) : null;
  const stage = slaStage(remaining, application?.level);
  const deadline = application ? slaDeadlineMs(application.createdAt, application.level) : null;

  const t: Translate = useMemo(() => (id, values) => intl.formatMessage({ id }, values), [intl]);

  return (
    <Drawer
      open={open}
      title={intl.formatMessage({ id: 'approval.detail.title' })}
      width={560}
      onClose={onClose}
    >
      {application ? (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label={intl.formatMessage({ id: 'approval.column.applicationNo' })}>
              {text(application.applicationNo || `#${application.id}`)}
            </Descriptions.Item>
            <Descriptions.Item label={intl.formatMessage({ id: 'approval.column.status' })}>
              <Tag color={approvalStatusColor(application.status)}>
                {intl.formatMessage({ id: approvalStatusTextId(application.status) })}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={intl.formatMessage({ id: 'approval.column.applyAction' })}>
              {intl.formatMessage({ id: actionLabelId(application.applyType) })}
            </Descriptions.Item>
            <Descriptions.Item label={intl.formatMessage({ id: 'approval.column.level' })}>
              <Tag color={levelColor(application.level)}>
                {intl.formatMessage({ id: levelTextId(application.level) })}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={intl.formatMessage({ id: 'approval.column.resource' })}>
              {text(application.resourceType)} / {text(application.resourceId)}
            </Descriptions.Item>
            <Descriptions.Item label={intl.formatMessage({ id: 'approval.column.applicant' })}>
              {text(application.applicantId)}
            </Descriptions.Item>
            <Descriptions.Item
              label={intl.formatMessage({ id: 'approval.column.desiredExpireAt' })}
            >
              {text(
                application.desiredExpireAt ||
                  intl.formatMessage({ id: 'approval.longTerm' }),
              )}
            </Descriptions.Item>
            <Descriptions.Item label={intl.formatMessage({ id: 'approval.column.sla' })}>
              <Space size={6}>
                <Tag color={slaStageColor(stage)}>{formatCountdown(t, remaining)}</Tag>
                <Text type="secondary">
                  {intl.formatMessage(
                    { id: 'approval.detail.slaDeadline' },
                    { deadline: formatDeadline(deadline) },
                  )}
                </Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label={intl.formatMessage({ id: 'approval.column.purpose' })}>
              {text(application.purpose)}
            </Descriptions.Item>
            <Descriptions.Item label={intl.formatMessage({ id: 'approval.column.opinion' })}>
              {text(application.opinion)}
            </Descriptions.Item>
          </Descriptions>

          <div>
            <Text strong>{intl.formatMessage({ id: 'approval.detail.timeline' })}</Text>
            <Timeline
              style={{ marginTop: 12 }}
              items={timeline.map((entry) => ({
                key: entry.key,
                color: timelineColor(entry.state),
                children: (
                  <Space orientation="vertical" size={2}>
                    <Text strong={entry.state === 'active'}>
                      {intl.formatMessage({ id: entry.labelId })}
                    </Text>
                    <Text type="secondary">{text(entry.at)}</Text>
                    {entry.detailId ? (
                      <Text>
                        {intl.formatMessage({ id: entry.detailId }, entry.detailValues)}
                      </Text>
                    ) : entry.detail ? (
                      <Text>{entry.detail}</Text>
                    ) : null}
                  </Space>
                ),
              }))}
            />
          </div>
        </Space>
      ) : null}
    </Drawer>
  );
};

export default ApprovalDetailDrawer;
