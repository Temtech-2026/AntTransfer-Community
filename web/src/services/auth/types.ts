/**
 * 认证域类型（与后端 `at-auth` 的 DTO / VO 逐字段对齐）。
 *
 * <p>只放纯类型，不引入 React / antd，便于单测直接跑。</p>
 */

/** 登录用户摘要（对应 {@code AuthVos.UserSummary}，不含敏感字段）。 */
export interface AuthUserSummary {
  /** 用户主键：19 位雪花 ID，服务端以字符串下发（超出 JS 安全整数范围，禁止 `Number()` 归一）。 */
  id?: string | null;
  username: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  /** 角色编码集合（如 SUPER_ADMIN / AUDITOR）；服务端保证非 null，前端仍按可空兜底 */
  roles?: string[] | null;
}

/**
 * 本人自助改密请求（对应 {@code AuthDtos.ChangePasswordRequest}）。
 *
 * <p>这里只描述形状；强度策略（长度 8~64、字母 + 数字、不得与原口令相同）的<b>权威判定在后端</b>，
 * 前端表单规则只是「少一次往返」的提前拦截，两边口径不一致时以后端返回的 1030 为准。</p>
 */
export interface ChangePasswordRequest {
  /** 当前口令（用于「确有账号控制权」的再确认） */
  oldPassword: string;
  /** 新口令，上限 64（BCrypt 72 字节截断的安全边界） */
  newPassword: string;
}

/** 令牌对响应（对应 {@code AuthVos.TokenResponse}）。 */
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  /** 恒为 Bearer，前端不依赖该字段拼装请求头 */
  tokenType?: string | null;
  /** access token 有效期（秒） */
  expiresIn?: number | null;
  /** 登录用户摘要（登录接口返回，/me 单独返回） */
  user?: AuthUserSummary | null;
}

/** 内置音色（前端用自己的合成音实现，不依赖任何音频资源文件）。 */
export type BuiltinNotifySoundPreset = 'default' | 'chime' | 'bubble';

/** 音色（镜像后端 {@code UserNotifySetting.PRESET_*}）。 */
export type NotifySoundPreset = BuiltinNotifySoundPreset | 'custom';

/**
 * 本人消息提醒设置（对应 {@code AuthVos.NotifySettingVO}）。
 *
 * <p><b>上限（{@link maxSoundBytes} / {@link maxSoundDurationMillis}）是服务端下发的</b>，
 * 不是前端写死的常数：前端据此做「选好文件立刻拦下」的即时反馈，
 * 幂等使「前端拦得住」与「后端真的拒」永远同一口径——两边各写一份迟早会漂移。</p>
 */
export interface NotifySetting {
  /** 收到新消息时是否出声 */
  soundEnabled: boolean;
  /** 当前音色；{@code custom} 只在确实上传过音频后才可能出现 */
  soundPreset: NotifySoundPreset;
  /** 自定义音频的原始文件名（回显用，不含路径） */
  customSoundName?: string | null;
  /** 自定义音频字节数 */
  customSoundSize?: number | null;
  /** 自定义音频时长（毫秒，由服务端解析容器头得出，不采信前端上报） */
  customSoundDurationMs?: number | null;
  /**
   * 自定义音频内容地址（带 `?v=` 版本号）。**需带令牌才能取到字节**，
   * 不能直接塞进 `<audio src>`；前端用 `downloadBinary` 取回 Blob 后播放。
   */
  customSoundUrl?: string | null;
  /** 服务端允许的音频字节上限 */
  maxSoundBytes: number;
  /** 服务端允许的音频时长上限（毫秒） */
  maxSoundDurationMillis: number;
}

/**
 * 更新提示音开关与音色（对应 {@code AuthDtos.UpdateNotifySettingRequest}）。
 *
 * <p>两个字段都是必填（整体覆盖语义）：漏传 {@code soundEnabled} 会被服务端 400，
 * 而不是被静默当成「关闭」——「只想换个音色」不该顺手把提示音关掉。</p>
 *
 * <p>{@code soundPreset} 可以传 {@code custom}（表示「保持我现在的自定义音色」）；
 * 若该用户其实没有音频，服务端会回落到内置默认音而不是落出一个悬空状态。</p>
 */
export interface UpdateNotifySettingPayload {
  soundEnabled: boolean;
  soundPreset: NotifySoundPreset;
}

const BUILTIN_NOTIFY_SOUND_PRESETS: readonly BuiltinNotifySoundPreset[] = [
  'default',
  'chime',
  'bubble',
];

/** 该音色是否是「前端能自己发出来的内置音」（{@code custom} 需要真实音频，不算）。 */
export function isBuiltinNotifySoundPreset(
  preset: unknown,
): preset is BuiltinNotifySoundPreset {
  return (
    typeof preset === 'string' &&
    (BUILTIN_NOTIFY_SOUND_PRESETS as readonly string[]).includes(preset)
  );
}

/**
 * 把服务端给的音色收敛成可渲染的值：认不出来的一律当内置默认音。
 *
 * <p>为什么宁可变默认音也不抛错：音色是「播放偏好」而非需要用户确认的数据，
 * 一个前端还不认识的新音色（服务端先行上线）不该让整个设置面板白屏或让提示音彻底消失。
 * 但 {@code custom} 会原样保留——它对应的音频是否需要回落，得看 {@link NotifySetting.customSoundName}
 * 等字段是否实际有值，交由 {@code planNotifySound} 裁决。</p>
 */
export function resolveNotifySoundPreset(preset: unknown): NotifySoundPreset {
  return preset === 'custom' || isBuiltinNotifySoundPreset(preset)
    ? preset
    : 'default';
}
