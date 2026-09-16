import { createStyles } from 'antd-style';

/**
 * 指标卡样式。
 *
 * <p>排版尺寸对齐源项目 `at-admin` 的 `ChartCard`（30px 主数字 / 22px 标题行 /
 * footer 上分隔线），底色与前景色走 antd 语义 token，暗色模式下由算法自动换算。
 */
const useStyles = createStyles(({ token }) => {
  return {
    card: {
      height: '100%',
      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: token.boxShadowSecondary,
      },
    },
    head: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '16px',
    },
    avatar: {
      display: 'flex',
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      width: '44px',
      height: '44px',
      borderRadius: token.borderRadiusLG,
      fontSize: '20px',
    },
    tonePrimary: {
      color: token.colorPrimary,
      background: token.colorPrimaryBg,
    },
    toneBlue: {
      color: token['blue-6'],
      background: token['blue-1'],
    },
    toneOrange: {
      color: token['orange-6'],
      background: token['orange-1'],
    },
    toneRed: {
      color: token['red-6'],
      background: token['red-1'],
    },
    tonePurple: {
      color: token['purple-6'],
      background: token['purple-1'],
    },
    toneCyan: {
      color: token['cyan-6'],
      background: token['cyan-1'],
    },
    metaWrap: {
      flex: 1,
      minWidth: 0,
    },
    meta: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
      height: '22px',
      color: token.colorTextSecondary,
      fontSize: token.fontSize,
      lineHeight: '22px',
    },
    action: {
      lineHeight: 1,
      cursor: 'pointer',
    },
    total: {
      marginTop: '4px',
      overflow: 'hidden',
      color: token.colorTextHeading,
      fontSize: '30px',
      fontWeight: 600,
      lineHeight: '38px',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
    },
    suffix: {
      marginLeft: '6px',
      color: token.colorTextSecondary,
      fontSize: token.fontSize,
      fontWeight: 400,
    },
    content: {
      marginTop: '12px',
    },
    footer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      marginTop: '12px',
      paddingTop: '9px',
      borderTop: `1px solid ${token.colorSplit}`,
      color: token.colorTextSecondary,
      fontSize: token.fontSizeSM,
    },
    trend: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '2px',
      fontSize: token.fontSizeSM,
      lineHeight: '22px',
    },
    trendUp: {
      color: token['red-6'],
    },
    trendDown: {
      color: token['green-6'],
    },
    /** `reverseColor` 用于「跌了反而是好事」的指标（如失败率） */
    trendReverseUp: {
      color: token['green-6'],
    },
    trendReverseDown: {
      color: token['red-6'],
    },
  };
});

export default useStyles;
