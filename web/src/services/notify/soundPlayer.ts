/**
 * 新消息提示音的**播放层**（唯一会真的出声的地方）。
 *
 * <p>职责边界：决策（放不放、放哪个）在 `soundPlan`，网络与设置在 `services/auth/api`，
 * 这里只做「把给定的东西放出来」，外加三件必须集中处理的事——</p>
 *
 * <ol>
 *   <li><b>浏览器的自动播放限制</b>：没有用户手势时 `AudioContext` 处于 `suspended`，
 *   直接播会被静默丢弃。这里在首次手势时解锁并记住状态，而不是每次播放都无谓地试一遍。</li>
 *   <li><b>自定义音频要带令牌</b>：内容端点不匿名放行，所以必须先用 XHR 取回 Blob
 *   再 `createObjectURL`。Blob URL 在这里按 `?v=` 版本号缓存并显式释放，
 *   否则「换一次铃声泄漏一个 Blob」（整个会话里一直挂着）。</li>
 *   <li><b>失败必须无声地回落到内置音</b>：提示音是后台行为，用户没提交任何东西，
 *   取音频失败就弹错误提示是不可接受的——回落到内置音既能提醒到人，又不打扰。</li>
 * </ol>
 *
 * <p>所有对外函数在非浏览器环境（SSR / 单测）下都安全返回，不抛异常。</p>
 */

import { fetchMyNotifySetting, fetchMyNotifySound } from '@/services/auth/api';
import type { BuiltinNotifySoundPreset, NotifySetting } from '@/services/auth/types';

import {
  builtinNotifySoundTones,
  planNotifySound,
} from './soundPlan';

/** 提示音音量：明显听得见但不至于压过语音通话（0~1）。 */
const NOTIFY_SOUND_GAIN = 0.18;

let cachedSetting: NotifySetting | null = null;
let loadingSetting: Promise<NotifySetting | null> | null = null;

let audioContext: AudioContext | null = null;
let unlockBound = false;
let unlocked = false;

let customBlobUrl: string | null = null;
let customBlobUrlKey: string | null = null;
let loadingCustomBlob: Promise<string | null> | null = null;
let loadingCustomBlobKey: string | null = null;

let currentAudio: HTMLAudioElement | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/** 设置面板保存 / 上传后回填：下次播放立刻用新设置，不必再拉一次。 */
export function setNotifySoundSetting(setting: NotifySetting | null): void {
  cachedSetting = setting;
  loadingSetting = null;
  // 音频换了（url 里的 ?v= 变化）就把旧 Blob 丢掉，避免「已经换了铃声却还在播旧的」
  if (customBlobUrl && customBlobUrlKey !== soundUrlKey(setting)) {
    releaseCustomBlob();
  }
}

/** 当前已知的设置（未加载过则为 null，调用方按「照常提醒」处理）。 */
export function getNotifySoundSetting(): NotifySetting | null {
  return cachedSetting;
}

/**
 * 确保设置已加载（同一时刻只发一个请求，失败不抛、返回 null）。
 *
 * <p>失败返回 null 而不是抛：调用方多在「收到消息」这条路径上，
 * 那里没有任何人能处理异常，抛出去只会变成一条控制台报错 + 一条不响的消息。</p>
 */
export function loadNotifySoundSetting(
  force = false,
): Promise<NotifySetting | null> {
  if (!force && cachedSetting) {
    return Promise.resolve(cachedSetting);
  }
  if (!force && loadingSetting) {
    return loadingSetting;
  }
  loadingSetting = fetchMyNotifySetting()
    .then((setting) => {
      setNotifySoundSetting(setting);
      return setting;
    })
    .catch(() => null)
    .finally(() => {
      loadingSetting = null;
    });
  return loadingSetting;
}

/**
 * 首次用户手势时解锁音频通道（挂一次即撤）。
 *
 * <p>必须在挂载时调用：浏览器只允许在用户手势「之内」创建 / 恢复 AudioContext，
 * 而第一条消息到达时通常早就没有手势了。若等到那时才 resume，用户会遇到
 * 「第一声永远不响、第二声才开始响」这种看起来像 bug 的行为。</p>
 */
export function primeNotifySound(): void {
  if (!isBrowser() || unlockBound) {
    return;
  }
  unlockBound = true;
  const unlock = () => {
    unlocked = ensureAudioContext()?.state === 'running';
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);
    document.removeEventListener('touchstart', unlock);
  };
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
  document.addEventListener('touchstart', unlock);
}

/**
 * 放一声新消息提示音。
 *
 * <p>全程不抛异常、不返回错误：这条路径上没有能处理错误的人。</p>
 */
export async function playNotifySound(): Promise<boolean> {
  if (!isBrowser()) {
    return false;
  }
  const setting = cachedSetting ?? (await loadNotifySoundSetting());
  const plan = planNotifySound(setting);
  if (plan.kind === 'silent') {
    return false;
  }
  if (plan.kind === 'builtin') {
    return playBuiltin(plan.preset);
  }
  const objectUrl = await resolveCustomBlobUrl(plan.url);
  if (!objectUrl) {
    // 取不到音频（4033 未设置 / 网络失败 / 文件已丢）→ 用内置默认音顶上，而不是不响
    return playBuiltin('default');
  }
  return playElement(objectUrl);
}

/**
 * 试听：优先按传入的设置播（设置面板里「刚改完还没保存」也能试听），
 * 否则用当前缓存的设置。返回是否真的发出了声音（false 用于提示「被浏览器拦了」）。
 */
export async function previewNotifySound(
  setting?: NotifySetting | null,
): Promise<boolean> {
  if (!isBrowser()) {
    return false;
  }
  const effective = setting ?? cachedSetting ?? (await loadNotifySoundSetting());
  const plan = planNotifySound(effective);
  if (plan.kind === 'silent') {
    return false;
  }
  if (plan.kind === 'builtin') {
    return playBuiltin(plan.preset);
  }
  const objectUrl = await resolveCustomBlobUrl(plan.url);
  return objectUrl ? playElement(objectUrl) : false;
}

/** 登出 / 卸载时清理：释放 Blob URL、停掉在播的音频、丢掉缓存的设置。 */
export function disposeNotifySound(): void {
  releaseCustomBlob();
  stopCurrentAudio();
  cachedSetting = null;
  loadingSetting = null;
  unlocked = false;
}

function soundUrlKey(setting: NotifySetting | null): string | null {
  const url = setting?.customSoundUrl;
  return typeof url === 'string' && url.trim() !== '' ? url.trim() : null;
}

function resolveCustomBlobUrl(url: string): Promise<string | null> {
  if (customBlobUrl && customBlobUrlKey === url) {
    return Promise.resolve(customBlobUrl);
  }
  if (loadingCustomBlob && loadingCustomBlobKey === url) {
    return loadingCustomBlob;
  }
  loadingCustomBlobKey = url;
  loadingCustomBlob = fetchMyNotifySound()
    .then((blob) => {
      releaseCustomBlob();
      const objectUrl = URL.createObjectURL(blob);
      customBlobUrl = objectUrl;
      customBlobUrlKey = url;
      return objectUrl;
    })
    .catch(() => null)
    .finally(() => {
      loadingCustomBlob = null;
      loadingCustomBlobKey = null;
    });
  return loadingCustomBlob;
}

function releaseCustomBlob(): void {
  if (customBlobUrl) {
    URL.revokeObjectURL(customBlobUrl);
  }
  customBlobUrl = null;
  customBlobUrlKey = null;
}

function stopCurrentAudio(): void {
  if (!currentAudio) {
    return;
  }
  try {
    currentAudio.pause();
  } catch {
    // 忽略：暂停一个已结束 / 已卸载的媒体元素不影响任何状态
  }
  currentAudio = null;
}

function ensureAudioContext(): AudioContext | null {
  if (!isBrowser()) {
    return null;
  }
  const Ctor =
    typeof AudioContext !== 'undefined'
      ? AudioContext
      : (window as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
  if (!Ctor) {
    return null;
  }
  if (!audioContext) {
    try {
      audioContext = new Ctor();
    } catch {
      return null;
    }
  }
  return audioContext;
}

/**
 * 用 Web Audio 合成并播放内置音。
 *
 * <p>返回 false 表示「这次没响」（环境不支持 / 自动播放被拦），
 * 供设置面板提示用户「点一下再试听」，不用于阻断任何业务流程。</p>
 */
function playBuiltin(preset: BuiltinNotifySoundPreset): boolean {
  const context = ensureAudioContext();
  if (!context) {
    return false;
  }
  if (context.state === 'suspended' && !unlocked) {
    // 第一次手势之前不放：硬播只会静默失败，还给人一种「提示音坏了」的错觉。
    // 顺手把 resume 发出去预热，但**不能等它**——resume 是异步的，从这里往下同步读到的
    // state 必然还是 suspended，所以这一轮直接放弃出声（下一轮若已 running 就走正常路径）
    void context.resume().catch(() => undefined);
    return false;
  }
  const startedAt = context.currentTime;
  for (const tone of builtinNotifySoundTones(preset)) {
    const start = startedAt + tone.offsetMs / 1000;
    const end = start + tone.durationMs / 1000;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = tone.type;
    oscillator.frequency.setValueAtTime(tone.frequency, start);
    // 指数衰减的包络：直接开关会产生「咔」的爆音，提示音听感上最忌讳这个
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(NOTIFY_SOUND_GAIN, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }
  return true;
}

function playElement(objectUrl: string): Promise<boolean> {
  stopCurrentAudio();
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (played: boolean) => {
      if (!settled) {
        settled = true;
        resolve(played);
      }
    };
    try {
      const audio = new Audio(objectUrl);
      audio.volume = 1;
      currentAudio = audio;
      audio.addEventListener('ended', () => settle(true), { once: true });
      audio.addEventListener('error', () => settle(false), { once: true });
      const played = audio.play();
      if (played && typeof played.then === 'function') {
        played.then(() => settle(true)).catch(() => settle(false));
      } else {
        settle(true);
      }
      // 兜底：某些浏览器既不触发 ended 也不触发 error（解码中被打断），
      // 用超时把 Promise 收掉，避免调用方永久挂着
      window.setTimeout(() => settle(true), 3000);
    } catch {
      settle(false);
    }
  });
}
