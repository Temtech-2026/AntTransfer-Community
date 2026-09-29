/**
 * 新消息提示音的**纯决策层**：把「一份设置」翻译成「该怎么响」，以及上传前的本地预检。
 *
 * <p>这里刻意不碰 `AudioContext` / `Audio` / 网络：真正出声的动作在 `soundPlayer`。
 * 分开的理由是这一层全是会被反复追问的口径（关掉是否真静音、音色是 custom 却没有音频时听什么、
 * 上限从哪来），必须能在纯单测里逐条钉死；而一旦把 `AudioContext` 混进来，
 * jsdom 里连「设置面板渲染得出来吗」都测不了。</p>
 */

import {
  isBuiltinNotifySoundPreset,
  resolveNotifySoundPreset,
} from '@/services/auth/types';
import type {
  BuiltinNotifySoundPreset,
  NotifySetting,
  NotifySoundPreset,
} from '@/services/auth/types';

/** 提示音播放计划：要么不出声，要么放内置音，要么放那一段已上传的自定义音频。 */
export type NotifySoundPlan =
  | { kind: 'silent' }
  | { kind: 'builtin'; preset: BuiltinNotifySoundPreset }
  | { kind: 'custom'; url: string };

/**
 * 文件选择框的 `accept`。
 *
 * <p>写扩展名 + MIME 两套：扩展名管住系统文件选择器的默认过滤（macOS 尤其只认扩展名），
 * MIME 管住部分系统「按类型」视图。真正的判定仍以服务端魔数为准（4031）。</p>
 */
export const NOTIFY_SOUND_ACCEPT_ATTR =
  '.mp3,.wav,.ogg,audio/mpeg,audio/wav,audio/x-wav,audio/ogg';

/**
 * 可选的**内置**音色（顺序即界面上的展示顺序）。
 *
 * <p>不含 {@code custom}：自定义不是并列的一种音色，而是「确实有一段自己上传的音频」的结果，
 * 它的可点与否取决于有没有音频，因此单独渲染（见 {@code NotifySoundSetting}）。</p>
 */
export const NOTIFY_SOUND_PRESETS: readonly BuiltinNotifySoundPreset[] = [
  'default',
  'chime',
  'bubble',
];

/** 与后端 `AudioTypes` 一致的支持面：仅 MP3 / WAV / OGG（客户端 MIME 不可信，故只作提前拦截）。 */
const ACCEPTED_AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg'];
const ACCEPTED_AUDIO_MIME = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/vnd.wave',
  'audio/ogg',
  'application/ogg',
];

/** 本地预检的拒绝原因。空文件名 / 无扩展名的文件也按「格式不支持」处理。 */
export type NotifySoundFileRejection = 'type' | 'too-large';

/** 预检需要的上限（从服务端下发的设置里取，不写死）。 */
export interface NotifySoundLimits {
  maxSoundBytes: number;
  maxSoundDurationMillis: number;
}

/**
 * 上传前的本地预检：返回拒绝原因，通过则返回 `null`。
 *
 * <p><b>只判「格式」与「大小」，判不了「时长」</b>：时长要真正解码才能知道，
 * 而上传路径不本地解码（1 MiB 的文件解码一次只为提前 200ms 报错，代价与收益不成比例），
 * 时长由服务端解析容器头裁决（4030）。这里如实把不确定性留给服务端，
 * 而不是用「文件大小除以码率」估算一个假时长去拦用户——估错了会拦住本来合法的文件。</p>
 *
 * <p><b>为什么按扩展名 + MIME 双条件宽松通过（任一命中即放行）而不是都必须命中：</b>
 * 不同系统对 `.wav` / `.ogg` 给出的 MIME 五花八门（`audio/x-wav`、空串、甚至 `application/octet-stream`），
 * 严格要求会把合法文件挡在门外；而放行一个非法文件的最坏后果只是服务端 4031 拒绝一次。
 * 「宁可多一次往返，也不拦错人」——这正是客户端校验应有的定位。</p>
 */
export function checkNotifySoundFile(
  file: Pick<File, 'name' | 'type' | 'size'>,
  limits: NotifySoundLimits,
): NotifySoundFileRejection | null {
  if (!isAcceptedAudioFile(file.name, file.type)) {
    return 'type';
  }
  const maxBytes = limits.maxSoundBytes;
  if (typeof maxBytes === 'number' && maxBytes > 0 && file.size > maxBytes) {
    return 'too-large';
  }
  return null;
}

function isAcceptedAudioFile(name: string, type: string): boolean {
  const normalizedName = name.toLowerCase();
  const dot = normalizedName.lastIndexOf('.');
  const extension = dot >= 0 ? normalizedName.slice(dot + 1) : '';
  const normalizedType = typeof type === 'string' ? type.toLowerCase() : '';
  // 去掉 MIME 参数（如 `audio/ogg; codecs=vorbis`）再比对，否则合法的带参数类型会被误拒
  const bareType = normalizedType.split(';')[0].trim();
  return (
    ACCEPTED_AUDIO_EXTENSIONS.includes(extension) ||
    ACCEPTED_AUDIO_MIME.includes(bareType)
  );
}

/**
 * 裁决「当前设置该怎么响」。
 *
 * <p>三条口径，都是用户会直接感知的：</p>
 * <ol>
 *   <li><b>设置读不到（`null`）视为「照常提醒」</b>：网络抖动 / 首次进入时若按静音处理，
 *   用户会以为提示音坏了；按提醒处理最多是响一次，两个方向的代价不对称。</li>
 *   <li><b>关掉就是关掉</b>：`soundEnabled` 为 false 时不看音色，任何情况下都不出声。</li>
 *   <li><b>音色是 custom 但没有音频 → 落到内置默认音</b>：这是服务端也在防的「悬空状态」，
 *   前端这一层再兜一次，保证「用户有自定义音色」这个状态永远不会表现为「什么都不响」。</li>
 * </ol>
 */
export function planNotifySound(setting: NotifySetting | null): NotifySoundPlan {
  if (!setting || !setting.soundEnabled) {
    return { kind: 'silent' };
  }
  const preset = resolveNotifySoundPreset(setting.soundPreset);
  if (preset === 'custom') {
    const url = normalizeSoundUrl(setting.customSoundUrl);
    return url ? { kind: 'custom', url } : { kind: 'builtin', preset: 'default' };
  }
  return { kind: 'builtin', preset };
}

function normalizeSoundUrl(url: unknown): string | null {
  return typeof url === 'string' && url.trim() !== '' ? url.trim() : null;
}

/** 音色 → i18n 文案 id（设置面板的单选标签共用一处，避免四年后多出两个拼错的前缀）。 */
export function notifySoundPresetMessageId(preset: NotifySoundPreset): string {
  return `component.avatar.notifySound.preset.${preset}`;
}

/** 内置音的波形（`OscillatorNode` 参数）：一段提示音 = 一个或多个依次起音的音符。 */
export interface NotifySoundTone {
  /** 频率（Hz） */
  frequency: number;
  /** 相对这段提示音起点的延迟（ms） */
  offsetMs: number;
  /** 音符时长（ms） */
  durationMs: number;
  type: OscillatorType;
}

/**
 * 三个内置音色的音符表。
 *
 * <p><b>为什么用合成音而不是打包 mp3 资源：</b>提示音是功能性声音、不是内容，
 * 打包音频会带来「资源许可 / 体积 / 多端播放差异」三件与功能无关的事；
 * 用 `OscillatorNode` 现场合成则零资源、跨端一致。代价是只能做「电子提示音」，
 * 因此需要真实音效的用户走「上传自定义音频」这条路，两条路各自完整。</p>
 *
 * <p>共同约束：<b>总时长都控制在 400ms 内</b>——消息提示音是高频声音，
 * 超过半秒就会从「提醒」变成「干扰」，群里连发几条消息时尤其明显。</p>
 */
const BUILTIN_TONES: Record<BuiltinNotifySoundPreset, readonly NotifySoundTone[]> =
  {
    // 默认：单声短促高音，最不打扰
    default: [{ frequency: 880, offsetMs: 0, durationMs: 140, type: 'sine' }],
    // 铃声：两声上行（C6 → G6），像门铃，辨识度高
    chime: [
      { frequency: 1046.5, offsetMs: 0, durationMs: 160, type: 'sine' },
      { frequency: 1568, offsetMs: 130, durationMs: 220, type: 'sine' },
    ],
    // 气泡：两声快速上行 + 短音，轻快
    bubble: [
      { frequency: 520, offsetMs: 0, durationMs: 90, type: 'triangle' },
      { frequency: 780, offsetMs: 70, durationMs: 120, type: 'triangle' },
    ],
  };

/** 取某个内置音色的音符表（返回只读副本，调用方不得就地改动）。 */
export function builtinNotifySoundTones(
  preset: BuiltinNotifySoundPreset,
): readonly NotifySoundTone[] {
  return isBuiltinNotifySoundPreset(preset)
    ? BUILTIN_TONES[preset]
    : BUILTIN_TONES.default;
}

/** 整段提示音的总时长（ms，含末音符），用于决定「还要不要继续播」与单测断言上界。 */
export function builtinNotifySoundDurationMs(
  preset: BuiltinNotifySoundPreset,
): number {
  return builtinNotifySoundTones(preset).reduce(
    (max, tone) => Math.max(max, tone.offsetMs + tone.durationMs),
    0,
  );
}

/**
 * 人类可读的字节数（用于「不超过 1 MiB」这类提示与已上传音频的回显）。
 *
 * <p>进位用 1024（KiB/MiB）而不是 1000：这与服务端 `MAX_SOUND_BYTES = 1 MiB = 1048576`
 * 是同一把尺子——用 1000 会让「1.05 MB」这种显示与实际判定上限对不上。</p>
 */
export function formatSoundFileSize(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  if (bytes >= 1024 * 1024) {
    return `${trimTrailingZero(bytes / (1024 * 1024))} MiB`;
  }
  if (bytes >= 1024) {
    return `${trimTrailingZero(bytes / 1024)} KiB`;
  }
  return `${Math.round(bytes)} B`;
}

/**
 * 人类可读的时长（秒，最多一位小数）。
 *
 * <p>取整到 0.1 秒而不是毫秒：提示音时长是给人看的量级（「0.8 秒」有意义，「823 毫秒」没有），
 * 但保留一位小数是为了让「超过 10 秒」的判定看起来不冤——整秒四舍五入会把 10.4 秒显示成「10 秒」，
 * 用户明明看到 10 却被告知超限。</p>
 */
export function formatSoundDuration(ms: number | null | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) {
    return '0';
  }
  return trimTrailingZero(Math.round(ms / 100) / 10);
}

function trimTrailingZero(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));
}
