import { CaretDownOutlined, CaretUpOutlined } from '@ant-design/icons';
import type { CardProps } from 'antd';
import { Card } from 'antd';
import React from 'react';

import useStyles from './index.style';

/** 图标底色主题，取值均映射到 antd 语义 token，暗色模式自动适配。 */
export type StatTone =
  | 'primary'
  | 'blue'
  | 'orange'
  | 'red'
  | 'purple'
  | 'cyan';

export interface StatCardProps {
  /** 指标名称。 */
  title: React.ReactNode;
  /** 主数值。传函数可延迟计算（对齐源项目 ChartCard 的 `total` 用法）。 */
  value?: React.ReactNode | number | (() => React.ReactNode | number);
  /** 数值后缀，如「个」「GB」。 */
  suffix?: React.ReactNode;
  /** 左侧图标。 */
  icon?: React.ReactNode;
  /** 图标配色，默认品牌绿。 */
  tone?: StatTone;
  /** 标题行右侧的动作区（如提示 Tooltip）。 */
  action?: React.ReactNode;
  /** 底部补充信息，渲染在分隔线下方。 */
  footer?: React.ReactNode;
  /** 主数值与 footer 之间的自定义内容（如迷你图 / 进度条）。 */
  children?: React.ReactNode;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  /** 透传给 antd Card 的其余属性。 */
  cardProps?: Omit<CardProps, 'children' | 'loading'>;
}

/**
 * 渲染主数值。
 *
 * <p>`0` 是合法数值，不能按 falsy 直接丢弃 —— 源项目 ChartCard 在这一点上做了显式判断。
 */
function renderValue(
  value: StatCardProps['value'],
  suffix: React.ReactNode,
  totalClass: string,
  suffixClass: string,
): React.ReactNode {
  if (value === undefined || value === null) {
    return null;
  }
  const resolved = typeof value === 'function' ? value() : value;
  if (resolved === undefined || resolved === null) {
    return null;
  }
  return (
    <div className={totalClass}>
      {resolved}
      {suffix ? <span className={suffixClass}>{suffix}</span> : null}
    </div>
  );
}

/**
 * 指标卡。
 *
 * <p>视觉对齐源项目 `at-admin/src/pages/dashboard/analysis/components/Charts/ChartCard`：
 * 无边框卡片 + 标题行 + 30px 主数字 + 顶部细分隔线的 footer。
 * 相对源项目额外补了图标底色与 hover 抬升，用于工作台首页的 KPI 区。
 */
const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  suffix,
  icon,
  tone = 'primary',
  action,
  footer,
  children,
  loading = false,
  onClick,
  className,
  style,
  cardProps,
}) => {
  const { styles } = useStyles();

  const toneClass = {
    primary: styles.tonePrimary,
    blue: styles.toneBlue,
    orange: styles.toneOrange,
    red: styles.toneRed,
    purple: styles.tonePurple,
    cyan: styles.toneCyan,
  }[tone];

  return (
    <Card
      variant="borderless"
      loading={loading}
      className={[styles.card, className].filter(Boolean).join(' ')}
      style={{ cursor: onClick ? 'pointer' : undefined, ...style }}
      onClick={onClick}
      styles={{ body: { padding: '20px 24px 16px' } }}
      {...cardProps}
    >
      <div className={styles.head}>
        {icon ? (
          <div className={[styles.avatar, toneClass].join(' ')}>{icon}</div>
        ) : null}
        <div className={styles.metaWrap}>
          <div className={styles.meta}>
            <span>{title}</span>
            {action ? <span className={styles.action}>{action}</span> : null}
          </div>
          {renderValue(value, suffix, styles.total, styles.suffix)}
        </div>
      </div>
      {children ? <div className={styles.content}>{children}</div> : null}
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </Card>
  );
};

export interface TrendProps {
  /** 上升或下降。 */
  flag: 'up' | 'down';
  /** 是否用红涨绿跌着色，默认 true。 */
  colorful?: boolean;
  /** 反转语义色：用于「越低越好」的指标（如失败率）。 */
  reverseColor?: boolean;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/** 环比趋势标记，配合 StatCard 的 `footer` 使用。 */
export const Trend: React.FC<TrendProps> = ({
  flag,
  colorful = true,
  reverseColor = false,
  children,
  className,
  style,
}) => {
  const { styles } = useStyles();

  let flagClass = '';
  if (colorful) {
    if (reverseColor) {
      flagClass =
        flag === 'up' ? styles.trendReverseUp : styles.trendReverseDown;
    } else {
      flagClass = flag === 'up' ? styles.trendUp : styles.trendDown;
    }
  }

  return (
    <span
      className={[styles.trend, className].filter(Boolean).join(' ')}
      style={style}
    >
      {children}
      <span className={flagClass}>
        {flag === 'up' ? <CaretUpOutlined /> : <CaretDownOutlined />}
      </span>
    </span>
  );
};

export default StatCard;
