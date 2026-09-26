/**
 * 头像上传预检的边界口径。
 *
 * <p>要钉住的是「预检与后端同一套常量、且刻意留了一条宽松出口」这两件事：
 * 上限与 MIME 白名单一旦与后端 {@code AvatarStoragePort} / {@code ImageTypes} 分叉，
 * 就会稳定地产生两类反向事故——前端放行、后端 400，或者前端拦住、后端其实支持。</p>
 *
 * <p>另一条容易在重构中被「顺手收紧」的是空 {@code type} 的放行：某些桌面环境的
 * 文件选择器不给 MIME，此时拦截等于把服务端支持的图片挡在门外。真正的类型判定
 * 在服务端按文件头魔数做，这里只是省一次必然失败的往返。</p>
 */

import { describe, expect, it } from 'vitest';

import { AVATAR_ACCEPT_MIME, AVATAR_MAX_BYTES, checkAvatarFile } from './types';

/** 文件替身：预检只读 size 与 type 两个字段。 */
const file = (size: number, type?: string) => ({ size, type });

describe('checkAvatarFile · 头像上传预检', () => {
  it('超过字节上限时报 tooLarge（先于类型判断，给出更贴切的提示）', () => {
    expect(checkAvatarFile(file(AVATAR_MAX_BYTES + 1, 'image/png'))).toBe(
      'system.user.avatar.tooLarge',
    );
  });

  it('恰好等于上限时放行（闭区间，与后端常量口径一致）', () => {
    expect(checkAvatarFile(file(AVATAR_MAX_BYTES, 'image/png'))).toBeNull();
  });

  it('白名单内的 4 种 MIME 全部放行', () => {
    for (const mime of AVATAR_ACCEPT_MIME) {
      expect(checkAvatarFile(file(1024, mime))).toBeNull();
    }
  });

  it('svg / bmp 等非白名单类型被拦下', () => {
    expect(checkAvatarFile(file(1024, 'image/svg+xml'))).toBe('system.user.avatar.typeInvalid');
    expect(checkAvatarFile(file(1024, 'image/bmp'))).toBe('system.user.avatar.typeInvalid');
  });

  it('浏览器未给出 type 时不拦截，交给服务端按魔数判定', () => {
    expect(checkAvatarFile(file(1024, ''))).toBeNull();
    expect(checkAvatarFile(file(1024, undefined))).toBeNull();
  });
});
