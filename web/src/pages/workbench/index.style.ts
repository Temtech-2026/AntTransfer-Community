import { createStyles } from 'antd-style';

/** 工作台首页样式：KPI 区 + 快捷入口。 */
const useStyles = createStyles(({ token }) => {
  return {
    /**
     * 快捷入口网格。
     *
     * <p><b>为什么是 `auto-fit` 而不是 `auto-fill`</b>：条目固定 5 个，两者算轨道数的方式
     * 相同，但 `auto-fit` 会把**没有条目的空轨道折叠掉**，`1fr` 于是把整行宽度分给现有卡片。
     * 用 `auto-fill` 时，≥1440px 就会排出 6 条以上轨道（2560px 宽屏下多到 12 条），
     * 5 张卡被压到最小宽度挤在左侧、右侧空一大片；而卡片内是「图标固定不缩
     * （`flexShrink: 0`）+ 文字 `min-width: 0`」，被压掉的宽度全落在标题与说明上，
     * 文字一折行就显得挤。</p>
     *
     * <p><b>下限 200px 按「中文说明不折行」定</b>：中文说明最长 7 字（约 84px），
     * 扣掉 40px 图标、12px 间距与 32px 内边距，文字区在最窄时仍有约 116px。
     * 英文文案更长（最长约 190px），窄屏下会折成两行——这里宁可折行也不做省略号截断
     * （截断等于丢信息），折行时同一行的卡片仍等高（grid 行内拉伸）。</p>
     *
     * <p>`16px` 与上方 KPI 区的 `Row gutter={[16, 16]}` 取齐，两段栅格不各说各话。</p>
     */
    quickGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px',
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
    /**
     * 入口图标底块。
     *
     * <p>`flexShrink: 0`：宽度不够时缩的是文字，不是图标——正因如此，卡片的**最小宽度**
     * 才是这套布局的真正约束（见上方 `quickGrid`）。尺寸取 40px/18px（上方 KPI 区是
     * 44px/20px），既与它同一套观感，也保住「KPI 比快捷入口重」的层级。</p>
     */
    quickIcon: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      width: '40px',
      height: '40px',
      borderRadius: token.borderRadiusLG,
      background: token.colorPrimaryBg,
      color: token.colorPrimary,
      fontSize: '18px',
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
