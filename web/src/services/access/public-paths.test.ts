import { describe, expect, it } from 'vitest';

import { isPublicPath, LOGIN_PATH } from './public-paths';

describe('isPublicPath', () => {
  it('登录页是公开路径', () => {
    expect(isPublicPath(LOGIN_PATH)).toBe(true);
    expect(isPublicPath('/user/login')).toBe(true);
  });

  it('分享取件页是公开路径（访客没有账号）', () => {
    expect(isPublicPath('/share/AbC123')).toBe(true);
    // 允许一个尾部斜杠：邮件客户端/聊天工具常在改写链接时补上
    expect(isPublicPath('/share/AbC123/')).toBe(true);
  });

  it('放行时不依赖前导斜杠', () => {
    expect(isPublicPath('share/AbC123')).toBe(true);
  });

  it('裸前缀与深层路径都不放行（它们不属于任何路由，没理由绕过登录）', () => {
    expect(isPublicPath('/share')).toBe(false);
    expect(isPublicPath('/share/')).toBe(false);
    expect(isPublicPath('/share/a/b')).toBe(false);
  });

  it('前缀相近的其它路径不放行（避免 startsWith 式误判）', () => {
    expect(isPublicPath('/sharex/AbC123')).toBe(false);
    expect(isPublicPath('/user/loginX')).toBe(false);
    expect(isPublicPath('/system/users')).toBe(false);
  });

  it('空值一律不放行', () => {
    expect(isPublicPath(null)).toBe(false);
    expect(isPublicPath(undefined)).toBe(false);
    expect(isPublicPath('')).toBe(false);
  });
});
