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
