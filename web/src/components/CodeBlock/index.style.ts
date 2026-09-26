import { createStyles } from 'antd-style';

/**
 * 代码块样式：工具条 + 可横向滚动的只读代码区。
 *
 * <p>刻意不做语法高亮。演示代码的作用是「拷走就能跑」，高亮要么引一层依赖、
 * 要么把标记混进复制内容里，收益不抵成本；这里用等宽字体 + 工具条建立层级即可。</p>
 */
const useStyles = createStyles(({ token }) => ({
  block: {
    overflow: 'hidden',
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
    backgroundColor: token.colorFillQuaternary,
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: token.marginSM,
    padding: `${token.paddingXS}px ${token.paddingSM}px`,
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
  },
  toolbarMain: {
    display: 'flex',
    alignItems: 'center',
    gap: token.marginXS,
    // 代码区可以横向滚动，但工具条不跟着滚：这里必须允许收缩，否则长文件名会顶掉复制按钮
    minWidth: 0,
  },
  /** 语言徽标：小一号的等宽标记，只用来回答「这是什么语言」 */
  language: {
    flexShrink: 0,
    padding: '0 6px',
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusSM,
    backgroundColor: token.colorBgContainer,
    color: token.colorTextSecondary,
    fontFamily: token.fontFamilyCode,
    fontSize: token.fontSizeSM,
    lineHeight: '18px',
    textTransform: 'uppercase',
  },
  title: {
    overflow: 'hidden',
    minWidth: 0,
    color: token.colorTextTertiary,
    fontFamily: token.fontFamilyCode,
    fontSize: token.fontSizeSM,
    lineHeight: '18px',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  /** 滚动容器：`pre` 自身不换行，超长行在块内横向滚动，不撑破外层卡片 */
  scroll: {
    margin: 0,
    padding: token.paddingSM,
    overflowX: 'auto',
  },
  code: {
    color: token.colorText,
    fontFamily: token.fontFamilyCode,
    fontSize: token.fontSizeSM,
    // 略大于正文字号的行高：注释与代码行之间要能一眼分开
    lineHeight: '22px',
    whiteSpace: 'pre',
  },
}));

export default useStyles;
