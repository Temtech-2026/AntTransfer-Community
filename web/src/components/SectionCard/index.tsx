import { Card } from 'antd';
import React from 'react';

import useStyles from './index.style';

export interface SectionCardProps {
  /** 区块标题。 */
  title?: React.ReactNode;
  /** 标题右侧的补充说明（灰色小字）。 */
  subTitle?: React.ReactNode;
  /** 标题左侧图标。 */
  icon?: React.ReactNode;
  /** 标题栏右侧动作区（按钮、筛选器等）。 */
  extra?: React.ReactNode;
  /**
   * 内容区内边距。
   *
   * <p>传 `false` 表示不设内边距 —— 内嵌 ProTable / Table 时应这样传，
   * 否则表格会和卡片边缘出现双份留白。
   */
  bodyPadding?: string | false;
  /** 是否渲染卡片外边框，默认 true（对齐源模板 `.task-panel`）。 */
  bordered?: boolean;
  loading?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * 区块卡：带通栏标题栏的卡片容器。
 *
 * <p>用于替代页面里裸写的 `<Card>`，保证标题栏 padding / 分隔线 / 圆角全站一致。
 */
const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subTitle,
  icon,
  extra,
  bodyPadding = '24px',
  bordered = true,
  loading = false,
  className,
  style,
  children,
}) => {
  const { styles } = useStyles();

  const hasHeader = Boolean(title || extra);

  return (
    <Card
      variant={bordered ? 'outlined' : 'borderless'}
      loading={loading}
      className={[styles.card, className].filter(Boolean).join(' ')}
      style={style}
      styles={{ body: { padding: 0 } }}
    >
      {hasHeader ? (
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            {icon ? <span className={styles.icon}>{icon}</span> : null}
            {title ? <span className={styles.title}>{title}</span> : null}
            {subTitle ? (
              <span className={styles.subTitle}>{subTitle}</span>
            ) : null}
          </div>
          {extra ? <div className={styles.extra}>{extra}</div> : null}
        </div>
      ) : null}
      <div
        className={bodyPadding === false ? styles.bodyFlush : styles.body}
        style={bodyPadding === false ? undefined : { padding: bodyPadding }}
      >
        {children}
      </div>
    </Card>
  );
};

export default SectionCard;
