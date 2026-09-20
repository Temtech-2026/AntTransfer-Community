/**
 * 安全状态徽标组。
 *
 * <p>列表与网格两种视图共用同一份渲染，避免「同一份文件在两种视图里安全状态不一致」——
 * 那会直接摧毁用户对安全标识的信任。</p>
 *
 * <p>判定口径全部在 {@link securityMarks}（纯函数、有单测）：本组件只负责把语义翻成颜色与图标，
 * **不做任何判定**。服务端未下发的字段（水印 / 失效时间）不会显示对应徽标——宁可少显示，
 * 也不能让用户误以为文件受着其实并不存在的保护。</p>
 */

import {
  ClockCircleOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Tag, Tooltip } from 'antd';
import type { ReactNode } from 'react';

import {
  type FileNode,
  type FileNodeSecurityExt,
  type SecurityMarkKind,
  securityMarks,
} from '@/services/file';

/** 每种徽标的图标与配色；键与 `SecurityMarkKind` 一一对应，新增 kind 时 TS 会提示补全。 */
const MARK_STYLE: Record<SecurityMarkKind, { icon: ReactNode; color: string }> = {
  classified: { icon: <LockOutlined />, color: 'error' },
  watermark: { icon: <SafetyCertificateOutlined />, color: 'geekblue' },
  expiring: { icon: <ClockCircleOutlined />, color: 'gold' },
};

export interface SecurityBadgesProps {
  node: FileNode & FileNodeSecurityExt;
  /** 网格视图用紧凑形态（更小的字号 / 无边框），列表用默认 Tag。 */
  compact?: boolean;
  /** 当前时刻（可注入，便于单测断言「N 天后失效」） */
  nowMs?: number;
}

export default function SecurityBadges({
  node,
  compact = false,
  nowMs,
}: SecurityBadgesProps) {
  const intl = useIntl();
  const marks = securityMarks(node, nowMs);
  if (marks.length === 0) {
    return null;
  }
  return (
    <>
      {marks.map((mark) => (
        <Tooltip
          key={mark.kind}
          title={intl.formatMessage({ id: mark.hintId }, mark.values)}
        >
          <Tag
            color={MARK_STYLE[mark.kind].color}
            icon={MARK_STYLE[mark.kind].icon}
            bordered={!compact}
            style={{ marginInlineEnd: 4, fontSize: compact ? 11 : undefined }}
          >
            {intl.formatMessage({ id: mark.labelId }, mark.values)}
          </Tag>
        </Tooltip>
      ))}
    </>
  );
}
