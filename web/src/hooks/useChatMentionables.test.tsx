/**
 * `useChatMentionables`：给出「本会话可以 @ 谁」。
 *
 * <p>这里钉的是四件事——只有群聊有名单、缺展示名的人不进名单、名单按群缓存且<b>切群不串群</b>、
 * 拉不到成员时静默降级成空名单（输入框不显示 @ 入口，而不是弹错误）。</p>
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ChatGroupDetail,
  ChatGroupMember,
  ChatSession,
} from '@/services/chat/types';
import { ChatScope } from '@/services/notify';

import useChatMentionables, { toMentionCandidates } from './useChatMentionables';

vi.mock('@/services/chat/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/chat/api')>();
  return { ...actual, fetchChatGroupDetail: vi.fn() };
});

import { fetchChatGroupDetail } from '@/services/chat/api';

const mockedDetail = vi.mocked(fetchChatGroupDetail);

/** 只写用例关心的字段，其余按「正常成员」补齐 */
function member(overrides: Partial<ChatGroupMember>): ChatGroupMember {
  return {
    userId: '900000000000000001',
    displayName: '张三',
    avatarUrl: null,
    memberRole: 1,
    owner: false,
    joinTime: '2026-09-01T09:00:00',
    ...overrides,
  };
}

function detailOf(members: ChatGroupMember[]): ChatGroupDetail {
  return {
    id: '900000000000000777',
    name: '运维支持群',
    ownerUserId: '900000000000000001',
    memberCount: members.length,
    memberLimit: 200,
    ability: {
      canRename: false,
      canInvite: false,
      canRemoveMember: false,
      canDissolve: false,
      canQuit: true,
    },
    members,
  };
}

const privateSession: ChatSession = {
  chatScope: ChatScope.PRIVATE,
  targetId: '900000000000000002',
};
const groupSession: ChatSession = {
  chatScope: ChatScope.GROUP,
  targetId: '900000000000000777',
};

beforeEach(() => {
  mockedDetail.mockReset();
});

describe('toMentionCandidates 成员名单折算', () => {
  it('保留 userId / 展示名 / 头像', () => {
    expect(
      toMentionCandidates([
        member({ userId: '1', displayName: '张三', avatarUrl: '/v1/users/1/avatar?v=2' }),
      ]),
    ).toEqual([{ userId: '1', displayName: '张三', avatarUrl: '/v1/users/1/avatar?v=2' }]);
  });

  it('展示名裁掉首尾空白：否则插入正文会写出两个空格', () => {
    expect(toMentionCandidates([member({ displayName: ' 张三 ' })])[0].displayName).toBe(
      '张三',
    );
  });

  it('没有展示名的成员不进名单（写不出可读的 @昵称）', () => {
    expect(
      toMentionCandidates([
        member({ userId: '1', displayName: null }),
        member({ userId: '2', displayName: '   ' }),
        member({ userId: '3', displayName: '李四' }),
      ]).map((item) => item.userId),
    ).toEqual(['3']);
  });

  it('同一个 userId 只出现一次（后端异常重复下发时不出现两份同名候选）', () => {
    expect(
      toMentionCandidates([
        member({ userId: '1', displayName: '张三' }),
        member({ userId: '1', displayName: '张三' }),
      ]),
    ).toHaveLength(1);
  });

  it('头像缺失时给 null，交给 Avatar 走首字符兜底', () => {
    expect(toMentionCandidates([member({ avatarUrl: undefined })])[0].avatarUrl).toBeNull();
  });
});

describe('useChatMentionables 取名单', () => {
  it('单聊不问群成员（没有点名语义，也就没有这次请求）', () => {
    const { result } = renderHook(() => useChatMentionables(privateSession));

    expect(result.current).toEqual([]);
    expect(mockedDetail).not.toHaveBeenCalled();
  });

  it('未选中会话时不请求任何东西', () => {
    const { result } = renderHook(() => useChatMentionables(null));

    expect(result.current).toEqual([]);
    expect(mockedDetail).not.toHaveBeenCalled();
  });

  it('群聊拉群详情并给出候选名单', async () => {
    mockedDetail.mockResolvedValue(
      detailOf([
        member({ userId: '1', displayName: '张三' }),
        member({ userId: '2', displayName: '李四' }),
      ]),
    );

    const { result } = renderHook(() => useChatMentionables(groupSession));

    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(mockedDetail).toHaveBeenCalledWith('900000000000000777');
    expect(result.current.map((item) => item.displayName)).toEqual(['张三', '李四']);
  });

  it('同一个群切走再切回只拉一次（列表来回切是最高频的操作）', async () => {
    mockedDetail.mockResolvedValue(detailOf([member({ displayName: '张三' })]));

    const { result, rerender } = renderHook(
      ({ session }: { session: ChatSession }) => useChatMentionables(session),
      { initialProps: { session: groupSession } },
    );
    await waitFor(() => expect(result.current).toHaveLength(1));

    rerender({ session: privateSession });
    expect(result.current).toEqual([]);
    rerender({ session: groupSession });
    await waitFor(() => expect(result.current).toHaveLength(1));

    expect(mockedDetail).toHaveBeenCalledTimes(1);
  });

  it('拉不到成员时静默给空名单（不弹错误、不影响发送）', async () => {
    mockedDetail.mockRejectedValue(new Error('1040 群已解散'));

    const { result } = renderHook(() => useChatMentionables(groupSession));

    await waitFor(() => expect(mockedDetail).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });

  it('切群时不会先把上一个群的名单画给新会话（宁可晚一拍也不给错名单）', async () => {
    let resolveSecond: ((value: ChatGroupDetail) => void) | undefined;
    mockedDetail.mockImplementation((groupId: string) => {
      if (groupId === '900000000000000777') {
        return Promise.resolve(detailOf([member({ userId: '1', displayName: '张三' })]));
      }
      return new Promise<ChatGroupDetail>((resolve) => {
        resolveSecond = resolve;
      });
    });

    const otherGroup: ChatSession = {
      chatScope: ChatScope.GROUP,
      targetId: '900000000000000888',
    };
    const { result, rerender } = renderHook(
      ({ session }: { session: ChatSession }) => useChatMentionables(session),
      { initialProps: { session: groupSession } },
    );
    await waitFor(() => expect(result.current).toHaveLength(1));

    // 切到第二个群：它的成员还没回来，此刻绝不能仍然显示张三
    rerender({ session: otherGroup });
    expect(result.current).toEqual([]);

    await act(async () => {
      resolveSecond?.(detailOf([member({ userId: '2', displayName: '李四' })]));
    });
    expect(result.current.map((item) => item.displayName)).toEqual(['李四']);
  });

  it('两个群各自缓存：来回切都命中已有名单，不再发请求', async () => {
    mockedDetail.mockImplementation((groupId: string) =>
      Promise.resolve(
        detailOf([
          member({ userId: groupId, displayName: groupId === '900000000000000777' ? '张三' : '李四' }),
        ]),
      ),
    );

    const otherGroup: ChatSession = {
      chatScope: ChatScope.GROUP,
      targetId: '900000000000000888',
    };
    const { result, rerender } = renderHook(
      ({ session }: { session: ChatSession }) => useChatMentionables(session),
      { initialProps: { session: groupSession } },
    );
    await waitFor(() => expect(result.current[0]?.displayName).toBe('张三'));

    rerender({ session: otherGroup });
    await waitFor(() => expect(result.current[0]?.displayName).toBe('李四'));

    rerender({ session: groupSession });
    expect(result.current[0]?.displayName).toBe('张三');
    expect(mockedDetail).toHaveBeenCalledTimes(2);
  });
});
