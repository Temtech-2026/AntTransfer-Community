/**
 * SLA 倒计时标签（行内组件）。
 *
 * <p>为什么做成**逐行**的组件而不是页面级 tick：页面级 `now` 会让 ProTable 的 columns
 * 每秒重建一次，整表重渲染；把 tick 关进行内组件后，只有标签自己重渲染。
 * 行数受分页上限约束（后端 pageSize ≤ 100），每秒 1 次 setState 的开销可忽略。
 *
 * <p>倒计时**只作提醒**：超时不会自动通过/驳回，也不会放行任何权限。
 */

import { useIntl } from '@umijs/max';
import { Tag, Tooltip } from 'antd';
import { useEffect, useMemo, useState } from 'react';

import {
  SLA_TICK_MS,
  formatCountdown,
  formatDeadline,
  slaDeadlineMs,
  slaRemainingMs,
  slaStage,
  slaStageColor,
} from '@/services/approval';
import type { ApprovalApplication, Translate } from '@/services/approval';

export interface SlaCountdownProps {
  application: ApprovalApplication;
}

export const SlaCountdown = ({ application }: SlaCountdownProps) => {
  const intl = useIntl();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), SLA_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const remaining = slaRemainingMs(application, now);
  const stage = slaStage(remaining, application.level);
  const deadline = slaDeadlineMs(application.createdAt, application.level);

  const t: Translate = useMemo(
    () => (id, values) => intl.formatMessage({ id }, values),
    [intl],
  );

  return (
    <Tooltip
      title={intl.formatMessage(
        { id: 'approval.sla.tooltip' },
        { deadline: formatDeadline(deadline) },
      )}
    >
      <Tag color={slaStageColor(stage)} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatCountdown(t, remaining)}
      </Tag>
    </Tooltip>
  );
};

export default SlaCountdown;
