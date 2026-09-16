import { createStyles, keyframes } from 'antd-style';

/**
 * 飞传文件背景的样式与动画。
 *
 * <p>纯 CSS 实现：不引入 canvas、也不加动画库。16 个文件图标各带一套行进参数
 * （时长、延迟、高度、弧高、缩放、色相），沿弧线双向穿屏，叠加网格底纹、
 * 光晕与速度线，表达「文件在有序传递」的科技感。</p>
 *
 * <p>关键帧内使用 `--op` / `--arc` / `--rm` / `--re` 四个自定义属性，由组件按
 * 文件逐个注入，因此同一套关键帧能复用出互不相同的轨迹。</p>
 *
 * <p>动画名写在样式对象里而不是组件的内联 style 里：emotion 只有在序列化样式
 * 对象时才会把 `@keyframes` 注入样式表，仅在内联 style 中引用动画名不会生效。
 * 逐文件差异化的时长与延迟走内联 style——它们是互不冲突的 animation 长属性。</p>
 */

/** 左 → 右：起点在屏幕左侧外 */
const flyLeftToRight = keyframes`
  0%   { transform: translateX(0) translateY(0) rotate(0deg); opacity: 0; }
  5%   { opacity: var(--op); }
  45%  { transform: translateX(40vw) translateY(var(--arc)) rotate(var(--rm)); opacity: var(--op); }
  85%  { opacity: var(--op); }
  100% { transform: translateX(80vw) translateY(0) rotate(var(--re)); opacity: 0; }
`;

/** 右 → 左：起点在屏幕右侧外 */
const flyRightToLeft = keyframes`
  0%   { transform: translateX(0) translateY(0) rotate(0deg); opacity: 0; }
  5%   { opacity: var(--op); }
  45%  { transform: translateX(-40vw) translateY(var(--arc)) rotate(var(--rm)); opacity: var(--op); }
  85%  { opacity: var(--op); }
  100% { transform: translateX(-80vw) translateY(0) rotate(var(--re)); opacity: 0; }
`;

/** 速度线明暗闪烁 */
const twinkle = keyframes`
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
`;

/** 光晕缓慢缩放呼吸 */
const pulse = keyframes`
  0%, 100% { opacity: 0.15; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(1.1); }
`;

const useStyles = createStyles(() => ({
  container: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    zIndex: 0,
    background:
      'linear-gradient(135deg, #0a0e27 0%, #12163a 25%, #0d1b2e 50%, #0a0e27 75%, #141945 100%)',
    // 网格底纹：给深空背景一点结构感，透明度极低以免抢主体
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundImage:
        'linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px)',
      backgroundSize: '60px 60px',
    },
    // 纯装饰动效：对开启「减少动态效果」的用户整体关闭，避免眩晕
    '@media (prefers-reduced-motion: reduce)': {
      '& *': {
        animation: 'none !important',
        transition: 'none !important',
      },
      '&::before': {
        display: 'none',
      },
    },
  },

  glowOrb: {
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(80px)',
    animationName: pulse,
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  },

  file: {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    color: '#fff',
    fontSize: 11,
    borderRadius: 4,
    animationName: flyLeftToRight,
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
    animationFillMode: 'forwards',
    // 拖尾：从图标背后向外淡出，制造速度感
    '&::after': {
      content: '""',
      position: 'absolute',
      top: '50%',
      width: 60,
      height: 2,
      background: 'linear-gradient(90deg, var(--file-color), transparent)',
      transform: 'translateY(-50%)',
      opacity: 0.6,
    },
  },

  /** 从右侧起飞的文件换用反方向关键帧 */
  fileFromRight: {
    animationName: flyRightToLeft,
  },

  speedLine: {
    position: 'absolute',
    height: 1,
    background:
      'linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.15), transparent)',
    animationName: twinkle,
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  },

  orbitLine: {
    position: 'absolute',
    width: '100%',
    height: 1,
    background:
      'linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.06), rgba(0, 212, 255, 0.1), rgba(0, 212, 255, 0.06), transparent)',
    transform: 'scaleY(0.5)',
  },
}));

export default useStyles;
