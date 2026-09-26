/**
 * `useCurrentUserAvatar`：读登录态里的头像地址。
 *
 * <p>它的存在是为了「顶栏与聊天气泡同源」：服务端不在「我发的」那一行回填发送人头像，
 * 自己的头像只能从登录态取。这里钉住三件事——有图就给地址、没图给 `undefined`
 * （交给 `Avatar` 走首字符兜底）、以及**绝不透出空串**（空串进 `img src` 会变成破图，
 * 比不画图更糟）。</p>
 */

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import useCurrentUserAvatar from './useCurrentUserAvatar';

/** `@umijs/max` 的 `useModel` 替身：每次渲染读同一个 holder。 */
const holder = vi.hoisted(() => ({
  initialState: undefined as { currentUser?: { avatar?: string } } | undefined,
}));

vi.mock('@umijs/max', () => ({
  useModel: () => ({ initialState: holder.initialState }),
}));

describe('useCurrentUserAvatar', () => {
  it('返回登录态里的头像地址（含服务端拼好的缓存版本号）', () => {
    holder.initialState = { currentUser: { avatar: '/v1/users/1/avatar?v=3' } };

    expect(renderHook(() => useCurrentUserAvatar()).result.current).toBe(
      '/v1/users/1/avatar?v=3',
    );
  });

  it('没有头像 / 空串一律返回 undefined，让 Avatar 走首字符兜底', () => {
    holder.initialState = { currentUser: { avatar: '' } };
    expect(renderHook(() => useCurrentUserAvatar()).result.current).toBeUndefined();

    holder.initialState = { currentUser: {} };
    expect(renderHook(() => useCurrentUserAvatar()).result.current).toBeUndefined();
  });

  it('极早期渲染（登录页 / 未登录）没有登录态时返回 undefined，不抛错', () => {
    holder.initialState = undefined;

    expect(renderHook(() => useCurrentUserAvatar()).result.current).toBeUndefined();
  });
});
