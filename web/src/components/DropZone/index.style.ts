import { createStyles } from 'antd-style';

/**
 * 拖拽上传区样式。
 *
 * <p>对齐源模板 `page_style_template.html` 的 `.upload-zone`：
 * 2px 虚线边框 + 12px 圆角 + 40px 内边距，hover / 拖拽悬停时边框转为品牌绿。
 * 背景色用 `colorFillQuaternary`（等效浅色下的 `#fafafa`），暗色模式自动跟随。
 */
const useStyles = createStyles(({ token }) => {
  return {
    zone: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      padding: '40px 24px',
      border: `2px dashed ${token.colorBorder}`,
      borderRadius: '12px',
      background: token.colorFillQuaternary,
      color: 'inherit',
      font: 'inherit',
      textAlign: 'center',
      cursor: 'pointer',
      outline: 'none',
      transition: 'border-color 0.3s, background 0.3s',
      '&:hover:not(:disabled)': {
        borderColor: token.colorPrimary,
        background: token.colorPrimaryBg,
      },
      '&:focus-visible': {
        borderColor: token.colorPrimary,
        boxShadow: `0 0 0 2px ${token.colorPrimaryBorder}`,
      },
      '&:disabled': {
        cursor: 'not-allowed',
        opacity: 0.55,
      },
    },
    zoneActive: {
      borderColor: token.colorPrimary,
      background: token.colorPrimaryBg,
    },
    icon: {
      marginBottom: '16px',
      color: token.colorPrimary,
      fontSize: '48px',
      lineHeight: 1,
    },
    title: {
      marginBottom: '8px',
      color: token.colorTextHeading,
      fontSize: token.fontSizeLG,
      fontWeight: 600,
    },
    description: {
      color: token.colorTextSecondary,
      fontSize: token.fontSize,
    },
    hint: {
      marginTop: '16px',
      color: token.colorTextTertiary,
      fontSize: token.fontSizeSM,
    },
    hiddenInput: {
      display: 'none',
    },
  };
});

export default useStyles;
