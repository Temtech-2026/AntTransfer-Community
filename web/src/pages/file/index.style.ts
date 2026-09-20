import { createStyles } from 'antd-style';

/**
 * 文件工作台样式。
 *
 * <p>文件类型图标原先写死 `rgba(0,0,0,0.45)`，在暗色模式下几乎不可见；
 * 这里改走 antd 调色板 token，按类型着色并随主题自动换算。
 * 颜色只承担「一眼分辨类型」的辅助作用，不参与任何判定。</p>
 *
 * <p>网格卡片与浮动操作条同样只取 token：暗色模式下 `colorBgContainer` /
 * `colorPrimaryBg` 会被算法换算，写死十六进制必漏改。</p>
 */
const useStyles = createStyles(({ token }) => {
  return {
    iconImage: { color: token['magenta-6'] },
    iconVideo: { color: token['purple-6'] },
    iconAudio: { color: token['cyan-6'] },
    iconZip: { color: token['gold-6'] },
    iconPdf: { color: token['red-6'] },
    iconWord: { color: token['blue-6'] },
    iconExcel: { color: token['green-6'] },
    iconPpt: { color: token['orange-6'] },
    iconText: { color: token.colorTextSecondary },
    iconUnknown: { color: token.colorTextTertiary },
    /** 文件名单元格：图标 / 文件名 / 标签 / 安全徽标一行排开 */
    nameCell: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      minWidth: 0,
    },
    /**
     * 文件名。
     *
     * <p>截断的只能是文件名本身：`minWidth: 0` + `flexShrink: 1` 保证长文件名先让步，
     * 而不是把右侧的安全徽标挤出可视区——徽标被裁掉等于安全提示不存在。
     * 徽标侧则用 {@link nameBadges} 的 `flexShrink: 0` 顶住。</p>
     */
    fileName: {
      color: token.colorText,
      fontWeight: 500,
      maxWidth: 320,
      minWidth: 0,
      flexShrink: 1,
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
    },
    nameBadges: { flexShrink: 0 },
    folderBar: {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '8px',
    },

    /* ============================ 查询 + 工具栏 ============================ */

    /** 查询表单与视图切换同处一行：窄屏时自动换行，不出现横向滚动 */
    queryBar: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
    },
    queryForm: {
      flex: '1 1 520px',
      minWidth: 0,
      rowGap: 8,
    },
    toolbar: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '8px',
    },

    /* ============================ 浮动操作条 ============================ */

    /**
     * 选中后的批量操作条。
     *
     * <p>`sticky` 而非 `fixed`：它属于列表区的一部分，滚动到列表顶部时就该停在那里，
     * 而不是像传输浮窗那样脱离文档流覆盖内容。</p>
     */
    actionBar: {
      position: 'sticky',
      top: 8,
      zIndex: 20,
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '4px',
      padding: '6px 12px',
      marginBottom: 12,
      borderRadius: token.borderRadiusLG,
      border: `1px solid ${token.colorPrimaryBorder}`,
      background: token.colorPrimaryBg,
    },
    actionBarCount: {
      fontWeight: 600,
      color: token.colorPrimaryText,
      marginInlineEnd: 4,
    },
    actionBarTail: {
      marginInlineStart: 'auto',
    },

    /* ============================ 网格视图 ============================ */

    grid: {
      display: 'grid',
      gap: '12px',
      // 自适应列数：窗口变窄时自动减少列而不是把卡片压扁
      gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
    },
    gridCard: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      padding: '12px 12px 8px',
      borderRadius: token.borderRadiusLG,
      border: `1px solid ${token.colorBorderSecondary}`,
      background: token.colorBgContainer,
      transition: 'border-color .2s, box-shadow .2s',
      cursor: 'pointer',
      '&:hover': {
        borderColor: token.colorPrimaryBorderHover,
        boxShadow: token.boxShadowTertiary,
      },
    },
    gridCardSelected: {
      borderColor: token.colorPrimary,
      background: token.colorPrimaryBg,
    },
    gridCheck: {
      position: 'absolute',
      top: 6,
      right: 6,
    },
    gridIcon: {
      fontSize: 28,
      lineHeight: 1,
      textAlign: 'center',
      margin: '6px 0 2px',
    },
    gridName: {
      fontWeight: 500,
      color: token.colorText,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    gridMeta: {
      fontSize: 12,
      color: token.colorTextSecondary,
    },
    gridActions: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
      fontSize: 13,
      marginTop: 'auto',
      paddingTop: 6,
      borderTop: `1px solid ${token.colorSplit}`,
    },
    gridFoot: {
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: 12,
    },

    /* ============================ 行内动作 ============================ */

    /**
     * 动作链接行。
     *
     * <p>间距必须由动作清单自己出：它渲染的是**一组**链接，若交给外层 `Space`，
     * 对 Space 而言这组链接只是「一个子元素」，gap 不会作用到它们之间，
     * 五个动作会挤成一条没有间隔的字符串。</p>
     */
    actionLinks: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '10px',
    },
  };
});

export default useStyles;
