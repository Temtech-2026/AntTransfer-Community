import { createStyles } from 'antd-style';

/**
 * 聊天页布局样式。
 *
 * <p>高度用 `calc(100vh - Npx)` 而不是 `100%`：从 PageContainer 到本容器之间隔了若干层
 * 由布局库控制的盒子，`height: 100%` 需要逐层显式定高才生效，任何一层变矮都会静默塌陷；
 * `vh` 计算虽然要手写一个偏移量，但塌陷时会明显表现为「多出一截空白」而不是「整个聊天区消失」，
 * 更容易在联调时被发现。</p>
 *
 * <p>左栏固定宽度、右栏 `flex: 1`，两侧各自滚动——这样消息列表滚动时左栏不会跟着晃。</p>
 */
const useStyles = createStyles(({ token }) => ({
  /** 外层：卡片 body 无内边距，故这里自己控制圆角与裁切。 */
  shell: {
    display: 'flex',
    height: 'calc(100vh - 260px)',
    minHeight: 460,
    overflow: 'hidden',
    background: token.colorBgContainer,
  },

  /** 拖着文件悬停在本区上：与即时通讯抽屉完全同一套反馈（描边 + 底色），别让两处手感分叉。 */
  shellDragOver: {
    outline: `2px dashed ${token.colorPrimary}`,
    outlineOffset: -6,
    background: token.colorPrimaryBg,
  },

  /** 左栏（会话列表）。 */
  aside: {
    display: 'flex',
    width: 300,
    minWidth: 260,
    flexDirection: 'column',
    borderRight: `1px solid ${token.colorSplit}`,
    background: token.colorFillQuaternary,
  },

  asideHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '12px 16px',
    borderBottom: `1px solid ${token.colorSplit}`,
  },

  asideTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: token.colorTextHeading,
    fontSize: token.fontSizeLG,
    fontWeight: 600,
  },

  search: {
    padding: '8px 12px 4px',
  },

  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 8px 12px',
  },

  listState: {
    padding: '24px 8px',
  },

  /** 一个会话项（渲染为 `<button>` 以拿到键盘可达性，故这里要抹掉浏览器默认样式）。 */
  item: {
    display: 'flex',
    width: '100%',
    alignItems: 'center',
    gap: 12,
    padding: '10px 12px',
    marginBottom: 4,
    border: 'none',
    background: 'transparent',
    font: 'inherit',
    textAlign: 'left',
    borderRadius: token.borderRadius,
    cursor: 'pointer',
    transition: 'background 0.2s',
    '&:hover': {
      background: token.colorFillTertiary,
    },
  },

  itemActive: {
    background: token.colorPrimaryBg,
    '&:hover': {
      background: token.colorPrimaryBgHover,
    },
  },

  itemBody: {
    minWidth: 0,
    flex: 1,
  },

  itemHead: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },

  itemName: {
    overflow: 'hidden',
    color: token.colorText,
    fontSize: token.fontSize,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },

  itemTime: {
    flexShrink: 0,
    color: token.colorTextQuaternary,
    fontSize: token.fontSizeSM,
  },

  itemSummary: {
    overflow: 'hidden',
    marginTop: 2,
    color: token.colorTextSecondary,
    fontSize: token.fontSizeSM,
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },

  /** 右栏（聊天区）。 */
  main: {
    display: 'flex',
    minWidth: 0,
    flex: 1,
    flexDirection: 'column',
  },

  mainHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 20px',
    borderBottom: `1px solid ${token.colorSplit}`,
  },

  mainTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    color: token.colorTextHeading,
    fontSize: token.fontSizeLG,
    fontWeight: 600,
  },

  /**
   * 标题行 + 对端状态：两行堆叠，状态在会话名下方。
   *
   * <p>与微信同口径——「在线 / 正在输入…」挂在标题下面而不是挤在右侧：
   * 右侧是标签与窗口元信息的位置，状态放那儿会在窄屏被先挤掉，
   * 而这个信息恰恰是用户扫一眼会话头就想知道的。</p>
   */
  mainHeading: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },

  stream: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
  },

  streamState: {
    display: 'flex',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  historyBar: {
    display: 'flex',
    justifyContent: 'center',
    paddingBottom: 12,
  },

  /** 一行消息：自己靠右，对方靠左。 */
  row: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 14,
  },

  rowSelf: {
    flexDirection: 'row-reverse',
  },

  bubbleWrap: {
    display: 'flex',
    maxWidth: '68%',
    minWidth: 0,
    flexDirection: 'column',
    gap: 4,
  },

  bubbleWrapSelf: {
    alignItems: 'flex-end',
  },

  /** 气泡本体。 */
  bubble: {
    padding: '8px 12px',
    borderRadius: token.borderRadiusLG,
    background: token.colorFillSecondary,
    color: token.colorText,
    fontSize: token.fontSize,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },

  bubbleSelf: {
    background: token.colorPrimary,
    color: token.colorTextLightSolid,
  },

  /** 非文本消息（文件 / 审批）用左侧竖条区分，避免与用户原话混淆。 */
  bubbleTyped: {
    borderLeft: `3px solid ${token.colorPrimaryBorder}`,
  },

  /**
   * 已撤回气泡：底色与正文色一起退到「这不是一句话」的层级。
   *
   * <p><b>为什么不能只靠文字：</b>同一条消息撤回前后占的是同一个位置，正文却被清空了，
   * 若外观不变，用户扫一眼消息流仍会以为那句话还在（气泡忽然变窄只会被当成渲染抖动）。
   * 因此画成系统提示的样子：虚线描边、无底色、次要色文字。</p>
   *
   * <p>不与 `bubbleSelf` 叠加（调用方二者只取其一）：emotion 生成的类名顺序由样式插入
   * 顺序决定，靠「后写的类覆盖先写的类」在 className 里排顺序并不可靠。</p>
   */
  bubbleRecalled: {
    border: `1px dashed ${token.colorBorderSecondary}`,
    background: 'transparent',
    color: token.colorTextTertiary,
    fontStyle: 'italic',
  },

  bubbleMeta: {
    color: token.colorTextQuaternary,
    fontSize: token.fontSizeSM,
  },

  /** 已读回执：气泡下那排读者头像（只在自己发的消息上渲染）。 */
  readers: {
    display: 'flex',
    alignItems: 'center',
  },

  /**
   * 头像外壳：负外边距让后一位压住前一位的右半边，一眼看出「不止一个人读过」。
   *
   * <p>描边画在外壳上而不是头像上：头像与外壳同为一个圆，描边才不会被相邻头像盖掉半圈。</p>
   */
  readerAvatar: {
    display: 'inline-flex',
    marginInlineStart: -6,
    border: `1px solid ${token.colorBgContainer}`,
    borderRadius: '50%',
  },

  /** 第一位不缩进，否则整排会从气泡外侧开始、看起来脱离了气泡。 */
  readerAvatarFirst: {
    display: 'inline-flex',
    border: `1px solid ${token.colorBgContainer}`,
    borderRadius: '50%',
  },

  readerMore: {
    marginInlineStart: 4,
    color: token.colorTextQuaternary,
    fontSize: token.fontSizeSM,
  },

  /** 未选中会话时的占位。 */
  placeholder: {
    display: 'flex',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  /** 连接状态圆点。 */
  dot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
  },
}));

export default useStyles;
