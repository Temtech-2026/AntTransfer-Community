/**
 * `ProfileSync`：把 `PROFILE` 帧落到「登录态 + 全局头像覆盖表」，实现头像全端即时刷新。
 *
 * <p>帧是<b>广播帧</b>（推给所有在线端），所以这里必须区分两类接收方：</p>
 * <ul>
 *   <li><b>任何人的帧</b> → 写全局头像覆盖表：会话列表 / 群成员 / 用户管理里正展示这张
 *       头像的地方经由 `UserAvatar` 读它；</li>
 *   <li><b>本人的帧</b> → 额外写登录态：顶栏、个人信息弹窗、自己发的气泡读它。</li>
 * </ul>
 *
 * <p>必钉的边界：<b>他人的帧绝不能改我的登录态</b>（否则别人换头像会改掉我的顶栏头像）、
 * 只改 `avatar` 不动其余字段（昵称 / 权限有各自的刷新时机）、值没变就不造新对象
 * （否则每帧都会抖一次全树重渲染）、没有当前用户时不凭空造一个。</p>
 */

import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAvatarOverrides, resetAvatarOverrides } from '@/services/avatar/overrides';
import type { WsProfilePayload } from '@/services/ws';

import ProfileSync from './index';

/** 登录态形状：只关心 `currentUser`，其余字段用来验证「没被顺手覆盖」。 */
type InitialState = {
  currentUser?: { userid?: string; name?: string; avatar?: string };
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

/** 本人的资料变更帧（`userId` 与登录态里的 `userid` 一致）。 */
const PROFILE_FRAME: WsProfilePayload = {
  userId: '1',
  avatarUrl: '/v1/users/1/avatar?v=2',
};

/** 他人的资料变更帧（会广播到本端，但绝不能改我的登录态）。 */
const PEER_PROFILE_FRAME: WsProfilePayload = {
  userId: '2',
  avatarUrl: '/v1/users/2/avatar?v=9',
};

beforeEach(() => {
  vi.clearAllMocks();
  wsHolder.options = undefined;
  // 覆盖表是模块级状态，用例之间必须隔离，否则上一个用例的帧会渗到下一个
  resetAvatarOverrides();
  model.state = {
    currentUser: { userid: '1', name: '张三', avatar: '/v1/users/1/avatar?v=1' },
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
  it('收到本人的 PROFILE：写登录态，其余字段原样保留，同时写全局覆盖表', () => {
    const onProfile = renderAndCaptureProfile();

    onProfile(PROFILE_FRAME);

    expect(model.state).toEqual({
      currentUser: { userid: '1', name: '张三', avatar: '/v1/users/1/avatar?v=2' },
      permissions: { 'chat:send': true },
    });
    // 覆盖表同样要写：本人头像在会话列表 / 群成员里也经 `UserAvatar` 渲染
    expect(getAvatarOverrides()).toEqual({ '1': '/v1/users/1/avatar?v=2' });
  });

  it('收到他人的 PROFILE：只写覆盖表，绝不改我的登录态', () => {
    const onProfile = renderAndCaptureProfile();
    const before = model.state;

    onProfile(PEER_PROFILE_FRAME);

    // 登录态必须原样（连引用都不换）：否则别人换头像会把我的顶栏头像改掉
    expect(model.state).toBe(before);
    expect((model.state as InitialState).currentUser?.avatar).toBe('/v1/users/1/avatar?v=1');
    // 但要记进覆盖表，否则「A 换了头像，B 的会话列表还是旧图」
    expect(getAvatarOverrides()).toEqual({ '2': '/v1/users/2/avatar?v=9' });
  });

  it('avatarUrl 为 null 时把头像置空 → 渲染回落首字符，而不是留着旧图', () => {
    const onProfile = renderAndCaptureProfile();

    onProfile({ userId: '1', avatarUrl: null });

    expect((model.state as InitialState).currentUser).toEqual({
      userid: '1',
      name: '张三',
      avatar: undefined,
    });
    // 覆盖表用 null 表达「已无头像」：它要**压掉**页面数据里的旧地址，而非被当成「没记录」
    expect(getAvatarOverrides()).toEqual({ '1': null });
  });

  it('值没变时返回同一个 state 引用（每帧都造新对象会让整棵树无谓重渲染）', () => {
    const onProfile = renderAndCaptureProfile();
    const before = model.state;

    onProfile({ userId: '1', avatarUrl: '/v1/users/1/avatar?v=1' });

    expect(model.state).toBe(before);
  });

  it('没有当前用户（登录页 / 极早期渲染）时不凭空造空用户，但仍记覆盖表', () => {
    model.state = undefined;
    const onProfile = renderAndCaptureProfile();

    onProfile(PEER_PROFILE_FRAME);

    expect(model.state).toBeUndefined();
    expect(getAvatarOverrides()).toEqual({ '2': '/v1/users/2/avatar?v=9' });
  });
});
