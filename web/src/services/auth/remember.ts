/**
 * 「记住我」的账号记忆（只记账号，<b>绝不记密码</b>）。
 *
 * <p>与 `utils/token` 同口径：SSR / 单测环境下降级为内存存储，隐私模式下写入失败静默忽略，
 * 不能因为记住账号失败就阻断登录。</p>
 */

const REMEMBERED_USERNAME_KEY = 'at:remembered_username';

/** 非浏览器环境 / 存储不可用时的降级存储。 */
const memoryStore = new Map<string, string>();

/** 读取已记住的账号（未记住时返回空串，调用方无需判空）。 */
export function readRememberedUsername(): string {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return memoryStore.get(REMEMBERED_USERNAME_KEY) ?? '';
    }
    return window.localStorage.getItem(REMEMBERED_USERNAME_KEY) ?? '';
  } catch {
    return memoryStore.get(REMEMBERED_USERNAME_KEY) ?? '';
  }
}

/** 写入 / 清除已记住的账号：传空值即清除（取消勾选「记住我」）。 */
export function saveRememberedUsername(username?: string | null): void {
  const value = username?.trim() ?? '';
  if (value) {
    memoryStore.set(REMEMBERED_USERNAME_KEY, value);
  } else {
    memoryStore.delete(REMEMBERED_USERNAME_KEY);
  }
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    if (value) {
      window.localStorage.setItem(REMEMBERED_USERNAME_KEY, value);
    } else {
      window.localStorage.removeItem(REMEMBERED_USERNAME_KEY);
    }
  } catch {
    // 隐私模式 / 配额不足：静默降级为内存存储
  }
}
