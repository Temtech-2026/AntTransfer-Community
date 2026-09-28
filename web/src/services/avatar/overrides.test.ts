/**
 * 全局头像覆盖表：它是「所有用到头像的地方立刻刷新」的落点，所以几条语义必须钉死。
 *
 * <p>最容易被写错、也最致命的是一条：<b>`null` 与「没有记录」不是一回事</b>。
 * `null` 表示「该用户已无头像」，必须压掉页面数据里的旧地址；把它当成「没记录」，
 * 「删头像」这个动作在别的端就永远不生效。</p>
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyAvatarChange,
  getAvatarOverrides,
  resetAvatarOverrides,
  subscribeAvatarOverrides,
} from './overrides';

beforeEach(() => {
  resetAvatarOverrides();
});

describe('头像覆盖表', () => {
  it('记下新地址，并通知订阅者', () => {
    const listener = vi.fn();
    subscribeAvatarOverrides(listener);

    const changed = applyAvatarChange('1', '/v1/users/1/avatar?v=2');

    expect(changed).toBe(true);
    expect(getAvatarOverrides()).toEqual({ '1': '/v1/users/1/avatar?v=2' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('值没变时不通知、不换快照（同一帧重复到达不该抖一次重渲染）', () => {
    applyAvatarChange('1', '/v1/users/1/avatar?v=2');
    const snapshot = getAvatarOverrides();
    const listener = vi.fn();
    subscribeAvatarOverrides(listener);

    const changed = applyAvatarChange('1', '/v1/users/1/avatar?v=2');

    expect(changed).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    // 引用必须稳定：`useSyncExternalStore` 靠它判断是否要重渲染
    expect(getAvatarOverrides()).toBe(snapshot);
  });

  it('null 是有效值：表示「已无头像」，与「没有记录」是两回事', () => {
    applyAvatarChange('1', '/v1/users/1/avatar?v=2');

    const changed = applyAvatarChange('1', null);

    expect(changed).toBe(true);
    expect(getAvatarOverrides()).toEqual({ '1': null });
    // `in` 判定为真、取值为 null —— useAvatarUrl 据此压掉页面数据里的旧地址
    expect('1' in getAvatarOverrides()).toBe(true);
    expect(getAvatarOverrides()['1']).toBeNull();
  });

  it('多个用户互不干扰', () => {
    applyAvatarChange('1', '/v1/users/1/avatar?v=2');
    applyAvatarChange('2', null);

    expect(getAvatarOverrides()).toEqual({ '1': '/v1/users/1/avatar?v=2', '2': null });
  });

  it('userId 为空时直接忽略（不写脏键）', () => {
    const listener = vi.fn();
    subscribeAvatarOverrides(listener);

    expect(applyAvatarChange('', '/v1/users/1/avatar?v=2')).toBe(false);
    expect(getAvatarOverrides()).toEqual({});
    expect(listener).not.toHaveBeenCalled();
  });

  it('reset 清空覆盖表并通知（登出时调用，避免跨账号残留）', () => {
    applyAvatarChange('1', '/v1/users/1/avatar?v=2');
    const listener = vi.fn();
    subscribeAvatarOverrides(listener);

    resetAvatarOverrides();

    expect(getAvatarOverrides()).toEqual({});
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('已经为空时 reset 不再通知', () => {
    const listener = vi.fn();
    subscribeAvatarOverrides(listener);

    resetAvatarOverrides();

    expect(listener).not.toHaveBeenCalled();
  });

  it('退订后不再收到通知', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAvatarOverrides(listener);
    unsubscribe();

    applyAvatarChange('1', '/v1/users/1/avatar?v=2');

    expect(listener).not.toHaveBeenCalled();
  });

  it('单个订阅者抛错不影响其它订阅者', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const boom = vi.fn(() => {
      throw new Error('boom');
    });
    const healthy = vi.fn();
    subscribeAvatarOverrides(boom);
    subscribeAvatarOverrides(healthy);

    applyAvatarChange('1', '/v1/users/1/avatar?v=2');

    expect(healthy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
