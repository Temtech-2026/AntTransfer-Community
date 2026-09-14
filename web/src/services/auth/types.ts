/**
 * 认证域类型（与后端 `at-auth` 的 DTO / VO 逐字段对齐）。
 *
 * <p>只放纯类型，不引入 React / antd，便于单测直接跑。</p>
 */

/** 登录用户摘要（对应 {@code AuthVos.UserSummary}，不含敏感字段）。 */
export interface AuthUserSummary {
  id?: number | null;
  username: string;
  nickname?: string | null;
  avatarUrl?: string | null;
  /** 角色编码集合（如 SUPER_ADMIN / AUDITOR）；服务端保证非 null，前端仍按可空兜底 */
  roles?: string[] | null;
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
