import { createStyles } from 'antd-style';

/**
 * 权限地图页可视化样式：授权状态占比条 + 权限域分布条。
 *
 * <p>颜色一律取 antd 语义 token（`colorSuccess` / `colorWarning` / `colorError`），
 * 不写死十六进制——暗色主题下由算法自动换算，不然深色底上会出现一条刺眼的高饱和色块。</p>
 */
const useStyles = createStyles(({ token }) => {
  return {
    /* ==================== 授权状态占比条 ==================== */
    bar: {
      display: 'flex',
      height: '14px',
      overflow: 'hidden',
      borderRadius: token.borderRadiusSM,
      // 兜底色：段与段之间若有亚像素缝隙，露出来的是轨道灰而不是刺眼的白
      background: token.colorFillQuaternary,
    },
    barSegment: {
      height: '100%',
      transition: 'width 0.3s ease',
    },
    /** 四态色块：条与图例色点共用，颜色不会在两处漂移 */
    toneActive: { background: token.colorSuccess },
    toneExpiring: { background: token.colorWarning },
    toneExpired: { background: token.colorError },
    tonePermanent: { background: token.colorTextTertiary },
    legend: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
      gap: '8px 16px',
      marginTop: '12px',
    },
    legendItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      minWidth: 0,
    },
    dot: {
      flexShrink: 0,
      width: '8px',
      height: '8px',
      borderRadius: '50%',
    },
    legendLabel: {
      color: token.colorTextSecondary,
      fontSize: token.fontSizeSM,
    },
    legendValue: {
      color: token.colorTextHeading,
      fontSize: token.fontSizeLG,
      fontWeight: 600,
      lineHeight: 1,
    },

    /* ==================== 权限域分布条 ==================== */
    domainList: {
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },
    domainRow: {
      display: 'grid',
      // 域名取内容宽但不挤压条，条占满剩余空间，右侧条数右对齐
      gridTemplateColumns:
        'minmax(72px, max-content) 1fr minmax(56px, max-content)',
      alignItems: 'center',
      gap: '12px',
    },
    domainName: {
      color: token.colorText,
      fontFamily: token.fontFamilyCode,
      fontSize: token.fontSizeSM,
      lineHeight: '18px',
    },
    domainTrack: {
      height: '8px',
      overflow: 'hidden',
      borderRadius: token.borderRadiusSM,
      background: token.colorFillQuaternary,
    },
    domainFill: {
      display: 'block',
      height: '100%',
      borderRadius: token.borderRadiusSM,
      background: token.colorPrimary,
    },
    domainCount: {
      color: token.colorTextSecondary,
      fontSize: token.fontSizeSM,
      textAlign: 'right',
    },
  };
});

export default useStyles;
