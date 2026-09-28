/**
 * `useAvatarUrl`：头像取值口径的收口。
 *
 * <p>钉住三件事：覆盖表优先、无记录回落页面数据、<b>记录为 `null` 时必须压掉回落值</b>
 * （把 `null` 当成「没记录」会让「删头像」在别的端永远不生效）。</p>
 */

import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { applyAvatarChange, resetAvatarOverrides } from '@/services/avatar/overrides';

import { useAvatarUrl } from './useAvatarUrl';

beforeEach(() => {
  resetAvatarOverrides();
});

describe('useAvatarUrl', () => {
  it('覆盖表没有记录时，回落页面数据里的地址', () => {
    const { result } = renderHook(() => useAvatarUrl('1', '/v1/users/1/avatar?v=1'));

    expect(result.current).toBe('/v1/users/1/avatar?v=1');
  });

  it('覆盖表有记录时，以覆盖表为准（页面数据是旧图）', () => {
    applyAvatarChange('1', '/v1/users/1/avatar?v=2');

    const { result } = renderHook(() => useAvatarUrl('1', '/v1/users/1/avatar?v=1'));

    expect(result.current).toBe('/v1/users/1/avatar?v=2');
  });

  it('记录为 null（已无头像）时必须压掉回落值，而不是回退到旧地址', () => {
    applyAvatarChange('1', null);

    const { result } = renderHook(() => useAvatarUrl('1', '/v1/users/1/avatar?v=1'));

    expect(result.current).toBeUndefined();
  });

  it('覆盖表更新后立刻取到新地址（这就是「立刻刷新」）', () => {
    const { result } = renderHook(() => useAvatarUrl('1', '/v1/users/1/avatar?v=1'));

    act(() => {
      applyAvatarChange('1', '/v1/users/1/avatar?v=2');
    });

    expect(result.current).toBe('/v1/users/1/avatar?v=2');
  });

  it('数字 userId 与字符串 userId 等价（调用方不必手动转换）', () => {
    applyAvatarChange('1', '/v1/users/1/avatar?v=2');

    const { result } = renderHook(() => useAvatarUrl(1, '/v1/users/1/avatar?v=1'));

    expect(result.current).toBe('/v1/users/1/avatar?v=2');
  });

  it('没有 userId 时不做覆盖表查找，直接用回落值（群头像场景）', () => {
    applyAvatarChange('1', '/v1/users/1/avatar?v=2');

    const { result } = renderHook(() => useAvatarUrl(undefined, '/v1/groups/9/avatar'));

    expect(result.current).toBe('/v1/groups/9/avatar');
  });

  it('两边都没有值时返回 undefined（交给 Avatar 走首字符兜底）', () => {
    const { result } = renderHook(() => useAvatarUrl('1', null));

    expect(result.current).toBeUndefined();
  });
});
