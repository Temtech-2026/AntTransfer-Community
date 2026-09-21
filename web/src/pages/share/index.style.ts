import { createStyles } from 'antd-style';

/**
 * 访客取件页样式（与登录页同一套深空视觉）。
 *
 * <p>与登录页的差别只在信息密度：取件页在提取码之外还要承载「文件名 + 大小 + 有效期」，
 * 故卡片更宽（520px）并在成功态内部走纵向排布；装饰动效一律不做——
 * 访客只来一次，稳定可读优先于动效。</p>
 */

const useStyles = createStyles(() => ({
  container: {
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#0a0e27',
    // 只裁横向：背景是 fixed 不产生溢出，而纵向必须留出滚动——
    // 小屏上卡片高于视口时若一并裁掉，下载按钮将无法触达
    overflowX: 'hidden',
  },

  /** 内容层：压在固定定位的背景之上 */
  contentWrapper: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
  },

  card: {
    width: 520,
    maxWidth: '100%',
    padding: '24px 20px',
    borderRadius: 16,
    border: '1px solid rgba(0, 212, 255, 0.12)',
    // 高不透明度 + 强模糊：既透出背景的流光，又保证表单文字有足够对比度
    background:
      'linear-gradient(145deg, rgba(15, 40, 30, 0.95), rgba(8, 25, 18, 0.95))',
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    boxShadow:
      '0 8px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 212, 255, 0.06)',
    color: '#e0e8f5',
  },

  /** 品牌区：Logo + 标题 + 副标题 */
  brand: {
    marginBottom: 24,
    textAlign: 'center',
  },

  logo: {
    height: 44,
    marginBottom: 12,
  },

  /** 文件信息区（成功态）：靠左对齐，避免继承品牌区的居中导致长文件名难读 */
  fileMeta: {
    marginBottom: 20,
    textAlign: 'left',
  },

  fileName: {
    display: 'block',
    marginBottom: 4,
    wordBreak: 'break-all',
  },
}));

export default useStyles;
