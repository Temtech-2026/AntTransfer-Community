import { createStyles, keyframes } from 'antd-style';

/**
 * 登录页样式（深空科技风）。
 *
 * <p>视觉骨架：全屏深色背景（由 FlyingFilesBackground 提供）+ 居中 420px 磨砂玻璃卡片，
 * 卡片边缘有一道缓慢循环的彩色呼吸光。配色沿用「深蓝紫底 + 青色霓虹」的设计语言，
 * 与背景中飞行文件的图标色系一致。</p>
 *
 * <p>关于 antd 组件的暗色适配：基础色（文字、边框、输入框底色、占位符）全部交给
 * `ConfigProvider` 的 `darkAlgorithm` 与 token 处理，本文件只负责呼吸光这类
 * antd 不提供的装饰动效。这样无需用 `!important` 去覆盖 antd 的内部类名——
 * 那类写法一旦 antd 调整 DOM 结构就会静默失效。</p>
 */

/** 卡片边缘呼吸光：青 → 紫 → 粉 → 绿，与飞行文件图标同色系 */
const breathe = keyframes`
  0% {
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 212, 255, 0.06);
    border-color: rgba(0, 212, 255, 0.12);
  }
  25% {
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(124, 77, 255, 0.08), 0 0 60px rgba(124, 77, 255, 0.04);
    border-color: rgba(124, 77, 255, 0.25);
  }
  50% {
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5), 0 0 60px rgba(255, 64, 129, 0.2), 0 0 120px rgba(255, 64, 129, 0.06);
    border-color: rgba(255, 64, 129, 0.35);
  }
  75% {
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 230, 118, 0.08), 0 0 60px rgba(0, 230, 118, 0.04);
    border-color: rgba(0, 230, 118, 0.25);
  }
  100% {
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 212, 255, 0.06);
    border-color: rgba(0, 212, 255, 0.12);
  }
`;

/** 输入框呼吸光：幅度比卡片小得多，避免抢焦 */
const breatheInput = keyframes`
  0% {
    box-shadow: 0 0 0 1px rgba(0, 212, 255, 0.1), 0 0 8px rgba(0, 212, 255, 0.03);
    border-color: rgba(0, 212, 255, 0.15);
  }
  25% {
    box-shadow: 0 0 0 1px rgba(124, 77, 255, 0.12), 0 0 8px rgba(124, 77, 255, 0.04);
    border-color: rgba(124, 77, 255, 0.2);
  }
  50% {
    box-shadow: 0 0 0 1px rgba(255, 64, 129, 0.2), 0 0 12px rgba(255, 64, 129, 0.08), 0 0 20px rgba(255, 64, 129, 0.03);
    border-color: rgba(255, 64, 129, 0.32);
  }
  75% {
    box-shadow: 0 0 0 1px rgba(0, 230, 118, 0.12), 0 0 8px rgba(0, 230, 118, 0.04);
    border-color: rgba(0, 230, 118, 0.2);
  }
  100% {
    box-shadow: 0 0 0 1px rgba(0, 212, 255, 0.1), 0 0 8px rgba(0, 212, 255, 0.03);
    border-color: rgba(0, 212, 255, 0.15);
  }
`;

const useStyles = createStyles(() => ({
  container: {
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#0a0e27',
    // 只裁横向：背景是 fixed 不产生溢出，而纵向必须留出滚动——
    // 小屏上卡片高于视口时若一并裁掉，底部内容将无法触达
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

  formCard: {
    width: 420,
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
    animationName: breathe,
    animationDuration: '4s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
    color: '#e0e8f5',
    '@media (prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
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

  /** 输入框的呼吸光；颜色与聚焦态由 ConfigProvider token 给出 */
  inputField: {
    animationName: breatheInput,
    animationDuration: '4s',
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
    // 聚焦时停跳，让边框稳定停在强调色上，避免「正在输入还在呼吸」的干扰
    '&:focus-within': {
      animationName: 'none',
    },
    '@media (prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
  },
}));

export default useStyles;
