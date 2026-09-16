import { createStyles } from 'antd-style';

/** 工作台首页样式：KPI 区 + 快捷入口。 */
const useStyles = createStyles(({ token }) => {
  return {
    quickGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))',
      gap: '12px',
    },
    quickItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      width: '100%',
      padding: '14px 16px',
      border: `1px solid ${token.colorBorderSecondary}`,
      borderRadius: token.borderRadiusLG,
      background: 'transparent',
      color: 'inherit',
      font: 'inherit',
      textAlign: 'left',
      cursor: 'pointer',
      transition: 'border-color 0.25s, background 0.25s, transform 0.25s',
      '&:hover': {
        borderColor: token.colorPrimary,
        background: token.colorPrimaryBg,
        transform: 'translateY(-1px)',
      },
    },
    quickIcon: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      width: '36px',
      height: '36px',
      borderRadius: token.borderRadius,
      background: token.colorPrimaryBg,
      color: token.colorPrimary,
      fontSize: token.fontSizeLG,
    },
    quickText: {
      display: 'block',
      minWidth: 0,
    },
    quickTitle: {
      display: 'block',
      color: token.colorTextHeading,
      fontSize: token.fontSize,
      fontWeight: 500,
      lineHeight: '20px',
    },
    quickDesc: {
      display: 'block',
      color: token.colorTextTertiary,
      fontSize: token.fontSizeSM,
      lineHeight: '18px',
    },
  };
});

export default useStyles;
