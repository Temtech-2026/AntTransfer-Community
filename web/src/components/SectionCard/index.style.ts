import { createStyles } from 'antd-style';

/**
 * 区块卡样式。
 *
 * <p>对齐源模板 `page_style_template.html` 的 `.task-panel` + `.panel-header`：
 * 卡片 body 不带内边距，标题栏与内容各自负责 padding，
 * 这样标题栏的下分隔线才能**通栏**贯穿（内嵌表格时尤其明显）。
 */
const useStyles = createStyles(({ token }) => {
  return {
    card: {
      overflow: 'hidden',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      padding: '16px 24px',
      borderBottom: `1px solid ${token.colorSplit}`,
    },
    titleWrap: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      minWidth: 0,
    },
    icon: {
      display: 'inline-flex',
      alignItems: 'center',
      color: token.colorPrimary,
      fontSize: token.fontSizeLG,
    },
    title: {
      overflow: 'hidden',
      color: token.colorTextHeading,
      fontSize: token.fontSizeLG,
      fontWeight: 600,
      lineHeight: '24px',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
    },
    subTitle: {
      color: token.colorTextSecondary,
      fontSize: token.fontSizeSM,
      fontWeight: 400,
    },
    extra: {
      flexShrink: 0,
      color: token.colorTextSecondary,
      fontSize: token.fontSize,
    },
    body: {
      padding: '24px',
    },
    bodyFlush: {
      padding: 0,
    },
  };
});

export default useStyles;
