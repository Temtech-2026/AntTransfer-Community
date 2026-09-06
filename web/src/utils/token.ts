/**
 * 双令牌本地存储（对应 docs/api/README.md §5）
 *
 * 说明：JWT 双令牌（access 30min / refresh 7d，refresh 轮换 + 重放吊销）由后端签发，
 * 前端只负责存储与透传；令牌解析与校验一律在服务端完成。
 * access token 存 localStorage 是为了刷新页面后保持会话，风险由 refresh 轮换与吊销机制兜底。
 */

const ACCESS_TOKEN_KEY = 'at:access_token';
const REFRESH_TOKEN_KEY = 'at:refresh_token';

/** SSR / 单测环境下降级为内存存储，避免直接访问 localStorage 抛错 */
const memoryStore = new Map<string, string>();

function read(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return memoryStore.get(key) ?? null;
    }
    return window.localStorage.getItem(key);
  } catch {
    return memoryStore.get(key) ?? null;
  }
}

function write(key: string, value: string): void {
  memoryStore.set(key, value);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // 隐私模式 / 存储配额不足时静默降级为内存存储
  }
}

function remove(key: string): void {
  memoryStore.delete(key);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // 同上，忽略
  }
}

export const tokenStore = {
  getAccessToken(): string | null {
    return read(ACCESS_TOKEN_KEY);
  },
  getRefreshToken(): string | null {
    return read(REFRESH_TOKEN_KEY);
  },
  /** 写入令牌对（登录成功 / refresh 轮换后调用） */
  setTokens(accessToken: string, refreshToken: string): void {
    write(ACCESS_TOKEN_KEY, accessToken);
    write(REFRESH_TOKEN_KEY, refreshToken);
  },
  /** 清除全部令牌（注销 / 被禁用 / refresh 失败时调用） */
  clear(): void {
    remove(ACCESS_TOKEN_KEY);
    remove(REFRESH_TOKEN_KEY);
  },
  hasSession(): boolean {
    return Boolean(read(REFRESH_TOKEN_KEY));
  },
};
