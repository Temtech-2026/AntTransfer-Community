import { createStyles } from 'antd-style';

/**
 * 欢迎页样式：品牌 Hero + 能力网格 + 快速开始。
 *
 * <p>全部取 antd 语义 token，暗色模式下自动跟随，不写死色值。
 */
const useStyles = createStyles(({ token }) => {
  return {
    hero: {
      position: 'relative',
      overflow: 'hidden',
      padding: '32px',
      marginBottom: '16px',
      border: `1px solid ${token.colorBorderSecondary}`,
      borderRadius: token.borderRadiusLG,
      background: `linear-gradient(135deg, ${token.colorPrimaryBg} 0%, ${token.colorBgContainer} 62%)`,
    },
    heroTitle: {
      marginTop: 0,
      marginBottom: '10px',
    },
    heroDesc: {
      maxWidth: '760px',
      marginBottom: '18px',
      fontSize: token.fontSizeLG,
    },
    heroTags: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(248px, 1fr))',
      gap: '16px',
      marginBottom: '16px',
    },
    feature: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      padding: '22px 24px',
      border: `1px solid ${token.colorBorderSecondary}`,
      borderRadius: token.borderRadiusLG,
      background: token.colorBgContainer,
      transition: 'border-color 0.25s, box-shadow 0.25s, transform 0.25s',
      '&:hover': {
        borderColor: token.colorPrimary,
        boxShadow: token.boxShadowTertiary,
        transform: 'translateY(-2px)',
      },
    },
    featureIcon: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '40px',
      height: '40px',
      marginBottom: '6px',
      borderRadius: token.borderRadius,
      background: token.colorPrimaryBg,
      color: token.colorPrimary,
      fontSize: token.fontSizeHeading4,
    },
    featureTitle: {
      color: token.colorTextHeading,
      fontSize: token.fontSizeLG,
      fontWeight: 600,
      lineHeight: '24px',
    },
    featureDesc: {
      color: token.colorTextTertiary,
      fontSize: token.fontSizeSM,
      lineHeight: '22px',
    },
    startList: {
      display: 'grid',
      gap: '10px',
    },
  };
});

export default useStyles;
