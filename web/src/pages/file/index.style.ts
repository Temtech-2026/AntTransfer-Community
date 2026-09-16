import { createStyles } from 'antd-style';

/**
 * 文件工作台样式。
 *
 * <p>文件类型图标原先写死 `rgba(0,0,0,0.45)`，在暗色模式下几乎不可见；
 * 这里改走 antd 调色板 token，按类型着色并随主题自动换算。
 * 颜色只承担「一眼分辨类型」的辅助作用，不参与任何判定。
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
    fileName: {
      color: token.colorText,
      fontWeight: 500,
    },
    folderBar: {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '8px',
    },
  };
});

export default useStyles;
