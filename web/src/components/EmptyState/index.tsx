/**
 * 统一空状态。
 *
 * <p>为什么要有这个组件：antd 的 `Empty` 只有「暂无数据」一个默认图案，业务里真实的空
 * 有四种语义，混在一起会误导用户——
 * <ul>
 *   <li>`data`：确实还没有数据（该引导用户去创建）；</li>
 *   <li>`search`：有数据但筛选没命中（该引导用户改条件，**不能**提示「去创建」）；</li>
 *   <li>`error`：加载失败（该给重试按钮，不能显示成空数据）；</li>
 *   <li>`denied`：无权限（该引导找管理员，不能显示成空数据）。</li>
 * </ul>
 * 四种语义的图标、文案与动作都不同，故在此收口，各页面只传 variant + 自定义动作。
 */

import { LockOutlined, WarningOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { Empty, theme } from 'antd';
import type { CSSProperties, ReactNode } from 'react';

/** 空状态语义。 */
export type EmptyVariant = 'data' | 'search' | 'error' | 'denied';

export interface EmptyStateProps {
  /** 语义预设（决定图案与兜底文案）。 */
  variant?: EmptyVariant;
  /** 主文案，缺省取 variant 的预设文案。 */
  title?: ReactNode;
  /** 补充说明。 */
  description?: ReactNode;
  /** 引导动作（按钮 / 链接），渲染在图案下方。 */
  action?: ReactNode;
  /** 紧凑模式（用于卡片内、下拉面板内等小容器）。 */
  size?: 'default' | 'small';
  style?: CSSProperties;
  className?: string;
}

export function EmptyState({
  variant = 'data',
  title,
  description,
  action,
  size = 'default',
  style,
  className,
}: EmptyStateProps) {
  const intl = useIntl();
  const { token } = theme.useToken();

  const fallbackTitle = intl.formatMessage({
    id: variant === 'data' ? 'common.empty.noData' : `common.empty.${variant}.title`,
    defaultMessage:
      variant === 'data'
        ? '暂无数据'
        : variant === 'search'
          ? '没有匹配的结果'
          : variant === 'error'
            ? '加载失败'
            : '无访问权限',
  });

  const fallbackDesc = intl.formatMessage({
    id:
      variant === 'search'
        ? 'common.empty.noResult.desc'
        : variant === 'error'
          ? 'common.empty.error.desc'
          : 'common.empty.denied.desc',
    defaultMessage:
      variant === 'search'
        ? '试试调整筛选条件，或清空关键词后重新查询'
        : variant === 'error'
          ? '网络或服务异常，请稍后重试'
          : '当前账号没有该项权限，如有需要请联系管理员',
  });

  /**
   * `data` 用默认插画，其余三种用图标区分语义：
   * 插画适合「首次进入」的温和场景，失败/越权则要用高对比图标让用户立刻看到。
   */
  const image = (() => {
    if (variant === 'data') {
      return Empty.PRESENTED_IMAGE_DEFAULT;
    }
    if (variant === 'search') {
      return Empty.PRESENTED_IMAGE_SIMPLE;
    }
    const Icon = variant === 'error' ? WarningOutlined : LockOutlined;
    return (
      <Icon
        style={{
          fontSize: size === 'small' ? 32 : 44,
          color: variant === 'error' ? token.colorWarning : token.colorTextQuaternary,
        }}
      />
    );
  })();

  return (
    <Empty
      className={className}
      image={image}
      imageStyle={{ height: size === 'small' ? 40 : 60, marginBottom: size === 'small' ? 8 : 16 }}
      style={{ padding: size === 'small' ? '12px 8px' : '24px 16px', ...style }}
      description={
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <div style={{ color: token.colorText, fontSize: size === 'small' ? 13 : 14 }}>
            {title ?? fallbackTitle}
          </div>
          {variant !== 'data' || description ? (
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                lineHeight: 1.6,
                color: token.colorTextTertiary,
              }}
            >
              {description ?? fallbackDesc}
            </div>
          ) : null}
        </div>
      }
    >
      {action ? <div style={{ marginTop: 4 }}>{action}</div> : null}
    </Empty>
  );
}

export default EmptyState;
