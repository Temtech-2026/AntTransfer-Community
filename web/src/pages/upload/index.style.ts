import { createStyles } from 'antd-style';

/**
 * 分片上传演示页样式：上传方式卡片入口。
 *
 * <p>用 CSS Grid 的 `auto-fit` 而不是 antd 的 `Row/Col`：两张卡片是**并列对比**关系，
 * 不是 12 栅格切分——窄屏时应当整行折成一列，宽屏时由 `minmax` 把可用宽度分完，
 * 不会像固定 `span` 那样在右侧留一条空白。</p>
 */
const useStyles = createStyles(({ token }) => ({
  modeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: token.marginMD,
    alignItems: 'stretch',
  },
  /** 未选中的方式卡片：与普通描边卡一致，仅悬停时提示可切换 */
  modeCard: {
    height: '100%',
    borderColor: token.colorBorderSecondary,
    transition: 'border-color 0.25s',
    '&:hover': {
      borderColor: token.colorPrimary,
    },
  },
  /** 选中的方式卡片：主色描边 + 主色浅底，和「当前使用」标签形成同一个视觉信号 */
  modeCardActive: {
    height: '100%',
    borderColor: token.colorPrimary,
    backgroundColor: token.colorPrimaryBg,
  },
  /** 卡片正文：纵向撑满，靠 `margin-top: auto` 把参数区压到卡片底部对齐 */
  modeBody: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    gap: token.marginSM,
  },
  modeHead: {
    display: 'flex',
    alignItems: 'center',
    gap: token.marginSM,
  },
  modeIcon: {
    display: 'flex',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: token.borderRadiusLG,
    backgroundColor: token.colorFillQuaternary,
    color: token.colorPrimary,
    fontSize: '18px',
  },
  modeTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  modeTitle: {
    display: 'block',
    color: token.colorTextHeading,
    fontSize: token.fontSize,
    fontWeight: 500,
    lineHeight: '20px',
  },
  /** 标题下方那行 `Content-Type`：用等宽字体的视觉重量弱化，只作标记用 */
  modeTag: {
    display: 'block',
    color: token.colorTextTertiary,
    fontSize: token.fontSizeSM,
    lineHeight: '18px',
  },
  modeFacts: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    margin: 0,
    paddingInlineStart: 0,
    listStyle: 'none',
  },
  modeFact: {
    display: 'flex',
    gap: '8px',
    fontSize: token.fontSizeSM,
    lineHeight: '20px',
  },
  modeFactLabel: {
    flexShrink: 0,
    color: token.colorTextTertiary,
  },
  modeFactValue: {
    minWidth: 0,
    color: token.colorTextSecondary,
  },
  /** 参数区：贴底 + 上分隔线，切方式时视觉焦点不会跳 */
  modeConfig: {
    marginTop: 'auto',
    paddingTop: token.paddingSM,
    borderTop: `1px solid ${token.colorBorderSecondary}`,
  },
  /** 操作区：固定最小高度，避免「当前使用」那张卡片没有按钮时和另一张错位 */
  modeFoot: {
    display: 'flex',
    alignItems: 'center',
    minHeight: '32px',
  },
  /**
   * 接入方式页签内容：代码块在上、要点在下。
   *
   * <p>要点刻意不并排到代码右侧——示例里最长的行接近 80 列，并排会把代码挤进横向滚动条，
   * 而「把代码抄走」是这一区域唯一的任务，代码必须优先拿到完整宽度。</p>
   */
  usagePanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: token.marginSM,
  },
  usagePoints: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '8px 16px',
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  usagePoint: {
    display: 'flex',
    gap: '8px',
    color: token.colorTextSecondary,
    fontSize: token.fontSizeSM,
    lineHeight: '20px',
  },
  usagePointIcon: {
    // 图标默认落在基线上会显得偏低，这里手动抬到首行文字的视觉中线
    marginTop: '4px',
    color: token.colorSuccess,
  },
}));

export default useStyles;
