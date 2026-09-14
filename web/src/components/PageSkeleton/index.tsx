/**
 * 列表骨架屏（首屏 loading 占位）。
 *
 * <p>与 antd `Spin` 的区别：骨架屏提前把「最终版式」画出来（几列、多高、卡片还是表格），
 * 数据到位后视觉跳动更小。因此这里按**容器形态**给预设，而不是给一个通用转圈：
 * `table` / `list` / `card` / `detail` 四种，各自对应 ProTable、消息流、卡片墙、详情页。
 *
 * <p>用法上只在「首次加载」时替换内容（`initialLoading`），翻页与刷新继续用组件的
 * `loading`，否则每次翻页都把表格抽走再塞回来，反而更晃。
 */

import { Skeleton, theme } from 'antd';
import { createStyles } from 'antd-style';
import type { CSSProperties } from 'react';

/** 骨架屏形态。 */
export type PageSkeletonVariant = 'table' | 'list' | 'card' | 'detail';

export interface PageSkeletonProps {
  variant?: PageSkeletonVariant;
  /** 行数 / 卡片数 / 段落数。 */
  rows?: number;
  /** 表格形态的列数。 */
  columns?: number;
  style?: CSSProperties;
  className?: string;
}

const useStyles = createStyles(({ css, token }) => ({
  root: css`
    width: 100%;
  `,
  tableHead: css`
    display: grid;
    gap: 16px;
    padding: 12px 16px;
    background: ${token.colorFillQuaternary};
    border-radius: ${token.borderRadius}px;
  `,
  tableRow: css`
    display: grid;
    gap: 16px;
    align-items: center;
    padding: 14px 16px;
    border-bottom: 1px solid ${token.colorSplit};
  `,
  listItem: css`
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 12px 0;
    border-bottom: 1px solid ${token.colorSplit};
  `,
  // auto-fill + minmax：1366 宽自动排 4 列，1920 宽自动排 6 列，不需要手写断点
  cardGrid: css`
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  `,
  card: css`
    padding: 16px;
    border: 1px solid ${token.colorSplit};
    border-radius: ${token.borderRadiusLG}px;
  `,
}));

function repeat(count: number): number[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => index);
}

export function PageSkeleton({
  variant = 'table',
  rows = 6,
  columns = 4,
  style,
  className,
}: PageSkeletonProps) {
  const { styles } = useStyles();
  const { token } = theme.useToken();
  const gridTemplate = { gridTemplateColumns: `repeat(${Math.max(1, columns)}, minmax(0, 1fr))` };

  return (
    <div className={className} style={{ width: '100%', ...style }}>
      {variant === 'table' ? (
        <div>
          <div className={styles.tableHead} style={gridTemplate}>
            {repeat(columns).map((index) => (
              <Skeleton.Input key={index} active size="small" block />
            ))}
          </div>
          {repeat(rows).map((rowIndex) => (
            <div key={rowIndex} className={styles.tableRow} style={gridTemplate}>
              {repeat(columns).map((colIndex) => (
                <Skeleton.Button
                  key={colIndex}
                  active
                  size="small"
                  block
                  // 末列（通常是操作列）短一些，更像真实表格
                  style={{ width: colIndex === columns - 1 ? '60%' : '100%' }}
                />
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {variant === 'list' ? (
        <div>
          {repeat(rows).map((index) => (
            <div key={index} className={styles.listItem}>
              <Skeleton.Avatar active size={40} shape="circle" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Skeleton.Input active size="small" style={{ width: '30%', minWidth: 120 }} />
                <Skeleton
                  active
                  title={false}
                  paragraph={{ rows: 2, width: ['100%', '72%'] }}
                  style={{ marginTop: 8 }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {variant === 'card' ? (
        <div className={styles.cardGrid}>
          {repeat(rows).map((index) => (
            <div key={index} className={styles.card}>
              <Skeleton active title={{ width: '56%' }} paragraph={{ rows: 2, width: ['100%', '80%'] }} />
            </div>
          ))}
        </div>
      ) : null}

      {variant === 'detail' ? (
        <div style={{ padding: 4 }}>
          <Skeleton active title={{ width: '36%' }} paragraph={{ rows: Math.max(2, rows) }} />
          <div
            style={{
              height: 120,
              marginTop: token.margin,
              borderRadius: token.borderRadiusLG,
              background: token.colorFillQuaternary,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export default PageSkeleton;
