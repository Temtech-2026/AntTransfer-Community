import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatScope } from '@/services/notify/types';

import {
  applyPeerAliasChange,
  applyPeerAliasOverride,
  getPeerAliasOverrides,
  type PeerAliasOverrides,
  resetPeerAliasOverrides,
  subscribePeerAliasOverrides,
} from './peerAlias';

const PEER = '900000000000000009';

/** 单聊会话（页面数据）：服务端说「我给这个人起了备注：老张」。 */
const privateConversation = {
  chatScope: ChatScope.PRIVATE,
  targetId: PEER,
  targetName: '系统管理员',
  peerAlias: '老张' as string | null,
};

/** 群聊会话：`targetId` 是群组 ID，与上面的用户 ID 取同一个值，用来验「不串域」。 */
const groupConversation = {
  chatScope: ChatScope.GROUP,
  targetId: PEER,
  targetName: '运维支持群',
  peerAlias: null as string | null,
};

beforeEach(() => {
  resetPeerAliasOverrides();
});

describe('备注覆盖表', () => {
  it('本端没改过时放行页面数据，且保持原引用', () => {
    const view = applyPeerAliasOverride(
      privateConversation,
      getPeerAliasOverrides(),
    );
    expect(view).toBe(privateConversation);
    expect(view.peerAlias).toBe('老张');
  });

  it('保存后覆盖页面数据——列表不必重拉就显示新名字', () => {
    expect(applyPeerAliasChange(PEER, '张工')).toBe(true);
    const view = applyPeerAliasOverride(
      privateConversation,
      getPeerAliasOverrides(),
    );
    expect(view.peerAlias).toBe('张工');
    expect(view).not.toBe(privateConversation);
  });

  it('取消备注（null）压过页面数据里的旧备注——真值判定会在这里漏掉', () => {
    applyPeerAliasChange(PEER, null);
    const view = applyPeerAliasOverride(
      privateConversation,
      getPeerAliasOverrides(),
    );
    expect(view.peerAlias).toBeNull();
    // 名字该回落成对方真实昵称，而不是「没有任何展示名」
    expect(view.targetName).toBe('系统管理员');
  });

  it('群聊不吃备注：相同的 targetId 也不生效，避免拿群组 ID 当用户 ID 查表', () => {
    applyPeerAliasChange(PEER, '张工');
    const view = applyPeerAliasOverride(
      groupConversation,
      getPeerAliasOverrides(),
    );
    expect(view).toBe(groupConversation);
    expect(view.peerAlias).toBeNull();
  });

  it('同值重复保存视为无变更：不通知订阅者，快照引用也不换', () => {
    applyPeerAliasChange(PEER, '张工');
    const snapshot = getPeerAliasOverrides();
    const listener = vi.fn();
    const unsubscribe = subscribePeerAliasOverrides(listener);

    expect(applyPeerAliasChange(PEER, '张工')).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    expect(getPeerAliasOverrides()).toBe(snapshot);

    unsubscribe();
  });

  it('peerId 为空时不写表（避免记出一个谁都匹配不上的键）', () => {
    const listener = vi.fn();
    const unsubscribe = subscribePeerAliasOverrides(listener);
    expect(applyPeerAliasChange('', '张工')).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    expect(getPeerAliasOverrides()).toEqual({});
    unsubscribe();
  });

  it('登出清空：备注是私有数据，跨账号残留会把别人的称呼展示给下一个人', () => {
    applyPeerAliasChange(PEER, '张工');
    const listener = vi.fn();
    const unsubscribe = subscribePeerAliasOverrides(listener);

    resetPeerAliasOverrides();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getPeerAliasOverrides()).toEqual({});
    // 清空后页面数据重新生效：服务端下次拉取仍会给「老张」，本端改动不该永久遮蔽它
    expect(
      applyPeerAliasOverride(privateConversation, getPeerAliasOverrides())
        .peerAlias,
    ).toBe('老张');

    // 已经是空表时再清一次不算变更，不再通知（登出流程会被走两遍）
    listener.mockClear();
    resetPeerAliasOverrides();
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('快照函数在无记录时返回同一个空表引用，供 useSyncExternalStore 稳定比较', () => {
    const empty: PeerAliasOverrides = getPeerAliasOverrides();
    applyPeerAliasChange(PEER, '张工');
    resetPeerAliasOverrides();
    expect(getPeerAliasOverrides()).toBe(empty);
  });
});
