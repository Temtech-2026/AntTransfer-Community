/**
 * `useRefreshCurrentUser` 的取舍：只在拿到结果时才写全局状态。
 *
 * <p>这个 Hook 存在的唯一理由是「改了自己的资料后，顶栏头像 / 个人信息要立刻跟上」。
 * 它的两条失败路径都必须保持**不写状态**：拿到 `undefined`（会话失效，`fetchUserInfo`
 * 已接管跳登录）或极早期没有 `fetchUserInfo`（登录页）。否则正常页面会先闪一次
 * 「未登录」的空头像，甚至把上个账号的权限态冲掉。</p>
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useRefreshCurrentUser from './useRefreshCurrentUser';

/** `@umijs/max` 的 `useModel` 替身：每次渲染读同一个 holder，便于在用例内改初值。 */
const holder = vi.hoisted(() => ({
  initialState: undefined as
    | { fetchUserInfo?: () => Promise<unknown> }
    | undefined,
  setInitialState: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  useModel: () => holder,
}));

/** 捕获 `setInitialState` 收到的 updater，便于断言它算出的新状态。 */
let lastUpdater: ((state: any) => any) | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  lastUpdater = undefined;
  holder.initialState = undefined;
  holder.setInitialState = vi.fn((updater: (state: any) => any) => {
    lastUpdater = updater;
  });
});

describe('useRefreshCurrentUser', () => {
  it('拉到新用户时写入全局状态（不改动其余字段）', async () => {
    const nextUser = { name: '李四', avatar: '/api/v1/users/2/avatar?v=9' };
    holder.initialState = { fetchUserInfo: vi.fn().mockResolvedValue(nextUser) };

    const { result } = renderHook(() => useRefreshCurrentUser());
    await act(async () => {
      await result.current();
    });

    expect(holder.initialState.fetchUserInfo).toHaveBeenCalledTimes(1);
    expect(holder.setInitialState).toHaveBeenCalledTimes(1);
    // 只覆盖 currentUser：权限 / 菜单等其它字段必须原样保留
    expect(lastUpdater?.({ currentUser: undefined, permissions: { x: 1 } })).toEqual({
      currentUser: nextUser,
      permissions: { x: 1 },
    });
  });

  it('拉取失败（undefined）时不写状态，避免闪出未登录态', async () => {
    holder.initialState = { fetchUserInfo: vi.fn().mockResolvedValue(undefined) };

    const { result } = renderHook(() => useRefreshCurrentUser());
    await act(async () => {
      await result.current();
    });

    expect(holder.setInitialState).not.toHaveBeenCalled();
  });

  it('没有 fetchUserInfo（登录页等极早期渲染）时静默返回，不抛错', async () => {
    holder.initialState = {};

    const { result } = renderHook(() => useRefreshCurrentUser());
    await act(async () => {
      await result.current();
    });

    expect(holder.setInitialState).not.toHaveBeenCalled();
  });
});
