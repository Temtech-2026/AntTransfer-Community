/**
 * `ProfileSync`：把「本人的 PROFILE 帧」落到登录态上，实现头像多端同步。
 *
 * <p>这是本轮「换头像后另一端的头像要跟着变」的落地点：帧只推给本人各端，
 * 所以这里<b>不做 userId 过滤</b>；又因为帧里带的就是服务端算好的最终地址
 * （含 `?v=` 版本号），直接写状态即可，不必再拉一次 `/auth/me`。</p>
 *
 * <p>必钉的边界：只改 `avatar` 不动其余字段（昵称 / 权限有各自的刷新时机）、
 * 值没变就不造新对象（否则每帧都会抖一次全树重渲染）、没有当前用户时不凭空造一个。</p>
 */

import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WsProfilePayload } from '@/services/ws';

import ProfileSync from './index';

/** 登录态形状：只关心 `currentUser.avatar`，其余字段用来验证「没被顺手覆盖」。 */
type InitialState = {
  currentUser?: { name?: string; avatar?: string };
  permissions?: Record<string, unknown>;
};

/** 捕获组件传给 `useWebSocket` 的入参，用例里手动伪造一帧 PROFILE。 */
const wsHolder = vi.hoisted(() => ({
  options: undefined as { onProfile?: (profile: unknown) => void } | undefined,
}));

vi.mock('@/hooks/useWebSocket', () => {
  const capture = (options: { onProfile?: (profile: unknown) => void }) => {
    wsHolder.options = options;
  };
  return { useWebSocket: capture, default: capture };
});

/** `@umijs/max` 的 `useModel` 替身：`setInitialState` 支持 updater 形态。 */
const model = vi.hoisted(() => ({
  state: undefined as unknown,
  setInitialState: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  useModel: () => ({ initialState: model.state, setInitialState: model.setInitialState }),
}));

const PROFILE_FRAME: WsProfilePayload = {
  userId: '1',
  avatarUrl: '/v1/users/1/avatar?v=2',
};

beforeEach(() => {
  vi.clearAllMocks();
  wsHolder.options = undefined;
  model.state = {
    currentUser: { name: '张三', avatar: '/v1/users/1/avatar?v=1' },
    permissions: { 'chat:send': true },
  };
  // 复刻 umi 的行为：updater 拿当前 state 求新值
  model.setInitialState.mockImplementation(
    (updater: (state: InitialState) => InitialState) => {
      model.state = updater(model.state as InitialState);
      return model.state;
    },
  );
});

/** 渲染组件并取回它注册的 `onProfile`（拿不到就是没订阅，直接让用例红）。 */
function renderAndCaptureProfile(): (profile: WsProfilePayload) => void {
  const { container } = render(<ProfileSync />);
  // 纯逻辑组件：不该往页面里塞任何节点
  expect(container).toBeEmptyDOMElement();
  const onProfile = wsHolder.options?.onProfile;
  expect(typeof onProfile).toBe('function');
  return onProfile as (profile: WsProfilePayload) => void;
}

describe('ProfileSync', () => {
  it('收到 PROFILE 就把新头像写进登录态，其余字段原样保留', () => {
    const onProfile = renderAndCaptureProfile();

    onProfile(PROFILE_FRAME);

    expect(model.state).toEqual({
      currentUser: { name: '张三', avatar: '/v1/users/1/avatar?v=2' },
      permissions: { 'chat:send': true },
    });
  });

  it('avatarUrl 为 null 时把头像置空 → 渲染回落首字符，而不是留着旧图', () => {
    const onProfile = renderAndCaptureProfile();

    onProfile({ userId: '1', avatarUrl: null });

    expect((model.state as InitialState).currentUser).toEqual({
      name: '张三',
      avatar: undefined,
    });
  });

  it('值没变时返回同一个 state 引用（每帧都造新对象会让整棵树无谓重渲染）', () => {
    const onProfile = renderAndCaptureProfile();
    const before = model.state;

    onProfile({ userId: '1', avatarUrl: '/v1/users/1/avatar?v=1' });

    expect(model.state).toBe(before);
  });

  it('没有当前用户（登录页 / 极早期渲染）时原样返回，不凭空造一个空用户', () => {
    model.state = undefined;
    const onProfile = renderAndCaptureProfile();

    onProfile(PROFILE_FRAME);

    expect(model.state).toBeUndefined();
  });
});
