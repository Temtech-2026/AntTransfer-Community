/**
 * 群聊 API 客户端的契约单测（建群 / 我加入的群）。
 *
 * <p>只钉住三件容易悄悄写错、且错了只有真实操作才暴露的事：
 * ① 建群走 POST 且<b>不静默</b>（1031~1033 必须让用户看到原因）；
 * ② 「我加入的群」走 GET 且静默 + 把 null 归一成空数组（空列表不是错误态）；
 * ③ 19 位雪花 ID 全程以字符串传递，中途不得被 `Number()` 归一。</p>
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requestData } = vi.hoisted(() => ({ requestData: vi.fn() }));

// api.ts 只依赖 services/request 与 ./endpoints，替换传输层即可隔离被测逻辑
vi.mock('@/services/request', () => ({ requestData }));

import { CHAT_ENDPOINTS } from './endpoints';
import {
  createChatGroup,
  dissolveChatGroup,
  fetchChatGroupDetail,
  fetchChatGroups,
  inviteChatGroupMembers,
  quitChatGroup,
  removeChatGroupMember,
  renameChatGroup,
} from './api';

const GROUP = {
  id: '1949000000000000001',
  name: '运维支持群',
  ownerUserId: '1949000000000000002',
  memberCount: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createChatGroup', () => {
  it('POST 到群聊端点，成员 ID 原样以字符串提交', async () => {
    requestData.mockResolvedValue(GROUP);

    await createChatGroup({
      name: '运维支持群',
      memberIds: ['1949000000000000002', '1949000000000000003'],
    });

    expect(requestData).toHaveBeenCalledWith(CHAT_ENDPOINTS.groups, {
      method: 'POST',
      data: {
        name: '运维支持群',
        memberIds: ['1949000000000000002', '1949000000000000003'],
      },
    });
  });

  it('不静默：建群失败（无权限 1003 / 校验 1031~1033）必须给出明确反馈', async () => {
    requestData.mockResolvedValue(GROUP);

    await createChatGroup({ name: 'g', memberIds: ['1'] });

    const [, options] = requestData.mock.calls[0];
    expect(options.silent).toBeUndefined();
  });

  it('失败时把异常抛给调用方（调用方据此决定是否留在弹窗里改条件重试）', async () => {
    requestData.mockRejectedValue(new Error('请至少邀请一位成员'));

    await expect(
      createChatGroup({ name: 'g', memberIds: [] }),
    ).rejects.toThrow('请至少邀请一位成员');
  });
});

describe('fetchChatGroups', () => {
  it('GET 群聊端点且静默（页面主数据，失败由页面渲染空态）', async () => {
    requestData.mockResolvedValue([GROUP]);

    await expect(fetchChatGroups()).resolves.toEqual([GROUP]);
    expect(requestData).toHaveBeenCalledWith(CHAT_ENDPOINTS.groups, {
      method: 'GET',
      silent: true,
    });
  });

  it('null / 非数组归一为空数组：还没加入任何群不是错误', async () => {
    requestData.mockResolvedValue(null);
    await expect(fetchChatGroups()).resolves.toEqual([]);

    requestData.mockResolvedValue(undefined);
    await expect(fetchChatGroups()).resolves.toEqual([]);
  });

  it('群 ID 保持字符串形态（拿它当会话 targetId 时禁止再经 Number）', async () => {
    requestData.mockResolvedValue([GROUP]);

    const [group] = await fetchChatGroups();

    expect(typeof group.id).toBe('string');
    expect(group.id).toBe('1949000000000000001');
  });
});

/**
 * 群管理客户端的契约单测（详情 / 改名 / 邀请 / 移除 / 退群 / 解散）。
 *
 * <p>只钉住三件「错了只有真实操作才暴露」的事：
 * ① 路径里的雪花 ID 原样拼接（经 `Number` 会指向另一个群）；
 * ② 详情静默（面板主数据）、写动作不静默（用户主动动作，失败必须说清原因）；
 * ③ 方法语义与后端一致（`PATCH` 改名、`DELETE` 移除 / 解散、`POST` 邀请 / 退群）——
 * 方法写错会命中另一个端点，且返回体形状不同，是典型的「静默做错事」。</p>
 */
describe('群管理 API', () => {
  const GROUP_ID = '1949000000000000001';
  const MEMBER_ID = '1949000000000000003';

  it('fetchChatGroupDetail：GET 且静默（面板主数据，失败由面板渲染空态）', async () => {
    requestData.mockResolvedValue({ id: GROUP_ID, name: '运维群' });

    await fetchChatGroupDetail(GROUP_ID);

    expect(requestData).toHaveBeenCalledWith(
      `/api/v1/chat/groups/${GROUP_ID}`,
      { method: 'GET', silent: true },
    );
  });

  it('renameChatGroup：PATCH 且不静默，只提交群名', async () => {
    requestData.mockResolvedValue({ id: GROUP_ID, name: '新名字' });

    await renameChatGroup(GROUP_ID, '新名字');

    expect(requestData).toHaveBeenCalledWith(
      `/api/v1/chat/groups/${GROUP_ID}`,
      { method: 'PATCH', data: { name: '新名字' } },
    );
    const [, options] = requestData.mock.calls[0];
    expect(options.silent).toBeUndefined();
  });

  it('inviteChatGroupMembers：POST /members，成员 ID 原样以字符串提交', async () => {
    requestData.mockResolvedValue({ id: GROUP_ID });

    await inviteChatGroupMembers(GROUP_ID, [MEMBER_ID]);

    expect(requestData).toHaveBeenCalledWith(
      `/api/v1/chat/groups/${GROUP_ID}/members`,
      { method: 'POST', data: { memberIds: [MEMBER_ID] } },
    );
  });

  it('removeChatGroupMember：DELETE /members/{userId}，被移除者进路径而非 body', async () => {
    requestData.mockResolvedValue({ id: GROUP_ID });

    await removeChatGroupMember(GROUP_ID, MEMBER_ID);

    expect(requestData).toHaveBeenCalledWith(
      `/api/v1/chat/groups/${GROUP_ID}/members/${MEMBER_ID}`,
      { method: 'DELETE' },
    );
  });

  it('quitChatGroup：POST /quit，不静默（群主退群会被 1039 拒绝，必须给出原因）', async () => {
    requestData.mockResolvedValue(undefined);

    await quitChatGroup(GROUP_ID);

    expect(requestData).toHaveBeenCalledWith(
      `/api/v1/chat/groups/${GROUP_ID}/quit`,
      { method: 'POST' },
    );
    const [, options] = requestData.mock.calls[0];
    expect(options.silent).toBeUndefined();
  });

  it('dissolveChatGroup：DELETE 群路径（与改群名同路径、不同方法）', async () => {
    requestData.mockResolvedValue(undefined);

    await dissolveChatGroup(GROUP_ID);

    expect(requestData).toHaveBeenCalledWith(
      `/api/v1/chat/groups/${GROUP_ID}`,
      { method: 'DELETE' },
    );
  });

  it('写失败一律把异常抛给调用方（面板据此决定提示文案与是否重试）', async () => {
    requestData.mockRejectedValue(new Error('只有群主可以执行该操作'));

    await expect(quitChatGroup(GROUP_ID)).rejects.toThrow(
      '只有群主可以执行该操作',
    );
  });
});
