/**
 * 飞传文件背景。
 *
 * <p>登录页专用的装饰性背景：深空渐变底 + 网格，16 个文件图标沿弧线双向穿屏，
 * 配合光晕呼吸与速度线闪烁，表达「文件在有序传递」。</p>
 *
 * <p>纯装饰，不含任何可交互元素，因此对辅助技术整体隐藏（`aria-hidden`）；
 * 动效遵循 `prefers-reduced-motion`，由样式层统一关闭。</p>
 */
import React from 'react';

import useStyles from './index.style';

/** 单个飞行文件的行进参数 */
interface FlyPath {
  /** 穿屏时长（秒） */
  duration: number;
  /** 起步延迟（秒）：错开相位，避免所有图标同时涌入 */
  delay: number;
  /** 纵向位置（屏高百分比） */
  top: number;
  /** 弧顶偏移（px）：正负决定轨迹向上还是向下弯 */
  arcHeight: number;
  /** 缩放：越小越像远景，用来拉开层次 */
  scale: number;
  /** 不透明度 */
  opacity: number;
  /** 起始倾斜角（度） */
  rotate: number;
  /** 图标主色 */
  color: string;
  /** 图标上的文件类型字样；空串表示不显示标签（远景小方块） */
  label: string;
  /** 是否从屏幕右侧起飞（否则从左侧） */
  fromRight: boolean;
}

/**
 * 飞行文件清单。
 *
 * <p>时长跨度 4.5s–18s、缩放 0.25–1.1：快的短、慢的长，近大远小，
 * 这样即便都是直线匀速，观感上也有纵深与速度差，而不是满屏等速平移。</p>
 */
const FLY_PATHS: FlyPath[] = [
  {
    duration: 14,
    delay: 0,
    top: 15,
    arcHeight: -60,
    scale: 1,
    opacity: 0.7,
    rotate: -5,
    color: '#00d4ff',
    label: 'PDF',
    fromRight: false,
  },
  {
    duration: 18,
    delay: 2,
    top: 70,
    arcHeight: 50,
    scale: 0.9,
    opacity: 0.6,
    rotate: 3,
    color: '#7c4dff',
    label: 'ZIP',
    fromRight: true,
  },
  {
    duration: 16,
    delay: 5,
    top: 40,
    arcHeight: -70,
    scale: 1.1,
    opacity: 0.7,
    rotate: -8,
    color: '#00e676',
    label: 'DOC',
    fromRight: false,
  },
  {
    duration: 11,
    delay: 1,
    top: 25,
    arcHeight: -40,
    scale: 0.7,
    opacity: 0.8,
    rotate: 2,
    color: '#448aff',
    label: 'IMG',
    fromRight: true,
  },
  {
    duration: 12,
    delay: 4,
    top: 55,
    arcHeight: 45,
    scale: 0.75,
    opacity: 0.7,
    rotate: -3,
    color: '#ff4081',
    label: 'VID',
    fromRight: false,
  },
  {
    duration: 10,
    delay: 7,
    top: 80,
    arcHeight: -35,
    scale: 0.65,
    opacity: 0.75,
    rotate: 5,
    color: '#ffd740',
    label: 'TXT',
    fromRight: true,
  },
  {
    duration: 13,
    delay: 3,
    top: 10,
    arcHeight: 55,
    scale: 0.8,
    opacity: 0.7,
    rotate: -6,
    color: '#69f0ae',
    label: 'EXE',
    fromRight: false,
  },
  {
    duration: 8,
    delay: 0.5,
    top: 35,
    arcHeight: -25,
    scale: 0.5,
    opacity: 0.85,
    rotate: 4,
    color: '#40c4ff',
    label: 'JS',
    fromRight: false,
  },
  {
    duration: 7,
    delay: 3.5,
    top: 65,
    arcHeight: 30,
    scale: 0.45,
    opacity: 0.8,
    rotate: -2,
    color: '#ea80fc',
    label: 'CSS',
    fromRight: true,
  },
  {
    duration: 9,
    delay: 6,
    top: 20,
    arcHeight: -30,
    scale: 0.55,
    opacity: 0.85,
    rotate: 5,
    color: '#82b1ff',
    label: 'PNG',
    fromRight: false,
  },
  {
    duration: 6,
    delay: 8,
    top: 50,
    arcHeight: 25,
    scale: 0.4,
    opacity: 0.9,
    rotate: -4,
    color: '#b9f6ca',
    label: 'MD',
    fromRight: true,
  },
  {
    duration: 8.5,
    delay: 2.5,
    top: 88,
    arcHeight: -20,
    scale: 0.5,
    opacity: 0.8,
    rotate: 3,
    color: '#ff80ab',
    label: 'MP4',
    fromRight: false,
  },
  {
    duration: 7.5,
    delay: 5.5,
    top: 45,
    arcHeight: 35,
    scale: 0.48,
    opacity: 0.85,
    rotate: -5,
    color: '#a7c0ff',
    label: 'SQL',
    fromRight: true,
  },
  // 末三条不带标签、只留小色块：填补前景缝隙，不喧宾夺主
  {
    duration: 5,
    delay: 1.5,
    top: 30,
    arcHeight: -15,
    scale: 0.3,
    opacity: 0.9,
    rotate: 0,
    color: '#00d4ff',
    label: '',
    fromRight: false,
  },
  {
    duration: 4.5,
    delay: 4.5,
    top: 75,
    arcHeight: 20,
    scale: 0.25,
    opacity: 0.9,
    rotate: 0,
    color: '#7c4dff',
    label: '',
    fromRight: true,
  },
  {
    duration: 5.5,
    delay: 7.5,
    top: 60,
    arcHeight: -18,
    scale: 0.3,
    opacity: 0.85,
    rotate: 0,
    color: '#00e676',
    label: '',
    fromRight: false,
  },
];

/** 光晕的定位与配色，四项定位用哪个给哪个 */
interface GlowOrb {
  key: string;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  /** 直径（px） */
  size: number;
  color: string;
  /** 呼吸相位延迟（秒），三团错开避免同频闪烁 */
  delay: number;
}

/** 光晕：三团不同色的模糊光斑，错开相位呼吸 */
const GLOW_ORBS: GlowOrb[] = [
  {
    key: 'orb-blue',
    top: '10%',
    left: '20%',
    size: 400,
    color: 'rgba(0, 100, 255, 0.12)',
    delay: 0,
  },
  {
    key: 'orb-violet',
    top: '60%',
    right: '15%',
    size: 350,
    color: 'rgba(124, 77, 255, 0.1)',
    delay: 2,
  },
  {
    key: 'orb-green',
    bottom: '5%',
    left: '40%',
    size: 300,
    color: 'rgba(0, 230, 118, 0.08)',
    delay: 1,
  },
] as const;

/** 轨道指示线所在的屏高位置 */
const ORBIT_TOPS = [15, 25, 40, 55, 70, 85];

/** 速度线所在的屏高位置 */
const SPEED_TOPS = [8, 22, 38, 52, 68, 82, 95];

const FlyingFilesBackground: React.FC = () => {
  const { styles } = useStyles();

  return (
    <div className={styles.container} aria-hidden>
      {GLOW_ORBS.map((orb) => (
        <div
          key={orb.key}
          className={styles.glowOrb}
          style={{
            top: orb.top,
            right: orb.right,
            bottom: orb.bottom,
            left: orb.left,
            width: orb.size,
            height: orb.size,
            background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
            animationDelay: `${orb.delay}s`,
          }}
        />
      ))}

      {ORBIT_TOPS.map((top) => (
        <div
          key={`orbit-${top}`}
          className={styles.orbitLine}
          style={{ top: `${top}%` }}
        />
      ))}

      {SPEED_TOPS.map((top, i) => (
        <div
          key={`speed-${top}`}
          className={styles.speedLine}
          style={{
            top: `${top}%`,
            left: `${10 + i * 12}%`,
            width: `${80 + (i % 3) * 40}px`,
            animationDuration: `${1.2 + (i % 2) * 0.6}s`,
            animationDelay: `${i * 0.4}s`,
          }}
        />
      ))}

      {FLY_PATHS.map((file, index) => (
        <div
          key={`file-${file.label || file.color}-${file.top}`}
          className={`${styles.file} ${file.fromRight ? styles.fileFromRight : ''}`}
          style={
            {
              top: `${file.top}%`,
              // 左侧起飞的错开起始横坐标，避免图标叠在同一个点上
              left: file.fromRight ? '100vw' : `${-(80 + (index % 3) * 40)}px`,
              width: file.label ? 48 : 20,
              height: file.label ? 56 : 20,
              background: file.label
                ? `linear-gradient(135deg, ${file.color}22, ${file.color}44)`
                : 'transparent',
              border: file.label ? `1px solid ${file.color}88` : 'none',
              boxShadow: file.label
                ? `0 0 20px ${file.color}44, inset 0 0 15px ${file.color}22`
                : 'none',
              animationDuration: `${file.duration}s`,
              animationDelay: `${file.delay}s`,
              scale: file.scale,
              // 关键帧与拖尾通过自定义属性读取，见 index.style.ts
              '--file-color': file.color,
              '--op': file.opacity,
              '--arc': `${file.arcHeight}px`,
              '--rm': `${file.rotate * 2}deg`,
              '--re': `${file.rotate}deg`,
            } as React.CSSProperties
          }
        >
          {file.label ? (
            <>
              {/* 右上角折角：让色块读起来像一个文件 */}
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 8,
                  height: 8,
                  borderRadius: '0 2px 0 0',
                  background: file.color,
                  opacity: 0.6,
                }}
              />
              {file.label}
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
};

export default FlyingFilesBackground;
