/**
 * 审批单详情抽屉。
 *
 * <p>后端没有「审批详情」单独接口（`/applications/pending|mine` 返回的就是完整 VO），
 * 因此详情直接用列表行数据渲染，不额外发请求——也就不会出现「列表已刷新、详情还是旧值」
 * 的双份状态。
 */

import { Descriptions, Drawer, Space, Tag, Timeline, Typography } from 'antd';

import {
  approvalStatusColor,
  approvalStatusText,
  actionLabel,
  formatCountdown,
  formatDeadline,
  slaDeadlineMs,
  slaRemainingMs,
  slaStage,
  slaStageColor,
} from '@/services/approval';
import type { ApprovalApplication } from '@/services/approval';
import { levelColor, levelText } from '@/services/file';

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
  const timeline = buildApprovalTimeline(application);
  const remaining = application ? slaRemainingMs(application, Date.now()) : null;
  const stage = slaStage(remaining, application?.level);
  const deadline = application ? slaDeadlineMs(application.createdAt, application.level) : null;

  return (
    <Drawer open={open} title="审批单详情" width={560} onClose={onClose}>
      {application ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="申请单号">
              {text(application.applicationNo || `#${application.id}`)}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={approvalStatusColor(application.status)}>
                {approvalStatusText(application.status)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="申请动作">
              {actionLabel(application.applyType)}
            </Descriptions.Item>
            <Descriptions.Item label="敏感等级">
              <Tag color={levelColor(application.level)}>{levelText(application.level)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="资源">
              {text(application.resourceType)} / {text(application.resourceId)}
            </Descriptions.Item>
            <Descriptions.Item label="申请人">
              {text(application.applicantId)}
            </Descriptions.Item>
            <Descriptions.Item label="期望到期">
              {text(application.desiredExpireAt || '长期有效')}
            </Descriptions.Item>
            <Descriptions.Item label="SLA">
              <Space size={6}>
                <Tag color={slaStageColor(stage)}>{formatCountdown(remaining)}</Tag>
                <Text type="secondary">截止 {formatDeadline(deadline)}</Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="使用用途">
              {text(application.purpose)}
            </Descriptions.Item>
            <Descriptions.Item label="审批意见">
              {text(application.opinion)}
            </Descriptions.Item>
          </Descriptions>

          <div>
            <Text strong>流转记录</Text>
            <Timeline
              style={{ marginTop: 12 }}
              items={timeline.map((entry) => ({
                key: entry.key,
                color: timelineColor(entry.state),
                children: (
                  <Space direction="vertical" size={2}>
                    <Text strong={entry.state === 'active'}>{entry.label}</Text>
                    <Text type="secondary">{text(entry.at)}</Text>
                    {entry.detail ? <Text>{entry.detail}</Text> : null}
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
