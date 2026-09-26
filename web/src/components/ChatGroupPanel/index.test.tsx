/**
 * 群设置面板 · 按钮显隐是「权限点 ∧ 服务端 ability」的合取。
 *
 * <p>钉住这条口径：权限点回答「这个账号有没有群管理这项功能」，`ability` 回答
 * 「我在这个群里是什么身份」，只看其一都会做出「按钮在、点了必失败」的界面
 * （无权限点必回 1003，身份不够必回 1038 / 1041）。</p>
 *
 * <p>另外两条不可逆动作的回归也在这里：改名成功后直接用响应刷新（不补一次 GET），
 * 以及退群必须经过二次确认、确认后才通知调用方关掉会话。</p>
 */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { App } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { testFormatMessage } from '@/locales/testTranslate';
import {
  fetchChatGroupDetail,
  inviteChatGroupMembers,
  quitChatGroup,
  removeChatGroupMember,
  renameChatGroup,
  resolveChatTarget,
} from '@/services/chat/api';
import { CHAT_PERM } from '@/services/chat/perm';
import type { ChatGroupAbility, ChatGroupDetail } from '@/services/chat/types';

import ChatGroupPanel from './index';

/** 断言用文案从 zh-CN 语言包取，键写错即失败（不在测试里另抄一份中文）。 */
const t = (id: string, values?: Record<string, unknown>) =>
  testFormatMessage({ id, values });

/**
 * 按钮的可访问名匹配器。
 *
 * <p>antd 会给「恰好两个汉字」的按钮自动插入一个空格（渲染成「保 存」「邀 请」），
 * 按原文精确匹配会因这个排版细节而失败——那不是行为差异。这里允许字符间出现空白，
 * 四字按钮（如「退出群聊」）同样适用。</p>
 */
const buttonName = (text: string) =>
  new RegExp(
    text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').split('').join('\\s*'),
  );

/** `useAccess` 的替身：权限点由用例逐条给，默认为空（最小权限）。 */
const accessState = vi.hoisted(() => ({ allowed: [] as string[] }));

vi.mock('@umijs/max', async () => {
  const { testFormatMessage: translate } = await import(
    '@/locales/testTranslate'
  );
  return {
    // 兼容两种调用形态：`formatMessage({ id, values })` 与 `formatMessage({ id }, values)`
    useIntl: () => ({
      formatMessage: (
        descriptor: { id: string; values?: Record<string, unknown> },
        values?: Record<string, unknown>,
      ) => translate({ id: descriptor.id, values: values ?? descriptor.values }),
    }),
    useAccess: () => ({
      can: (code: string) => accessState.allowed.includes(code),
    }),
  };
});

vi.mock('@/services/chat/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/chat/api')>();
  return {
    ...actual,
    fetchChatGroupDetail: vi.fn(),
    renameChatGroup: vi.fn(),
    inviteChatGroupMembers: vi.fn(),
    removeChatGroupMember: vi.fn(),
    quitChatGroup: vi.fn(),
    dissolveChatGroup: vi.fn(),
    resolveChatTarget: vi.fn(),
  };
});

// 用户检索（system:user:list）会真发 HTTP；替身后才谈得上「管理员 / 非管理员两条路径」
vi.mock('@/services/system', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/system')>();
  return { ...actual, pageUsers: vi.fn() };
});

const GROUP_ID = '900000000000000777';
const OWNER_ID = '900000000000000001';
const OWNER_NAME = '群主甲';
const MEMBER_NAME = '成员乙';

/** 一份「我是群主」的群详情；用例只改自己关心的那几项。 */
function makeDetail(ability?: Partial<ChatGroupAbility>): ChatGroupDetail {
  return {
    id: GROUP_ID,
    name: '项目群',
    ownerUserId: OWNER_ID,
    memberCount: 2,
    memberLimit: 500,
    ability: {
      canRename: true,
      canInvite: true,
      canRemoveMember: true,
      canDissolve: true,
      canQuit: false,
      ...ability,
    },
    members: [
      {
        userId: OWNER_ID,
        displayName: OWNER_NAME,
        memberRole: 2,
        owner: true,
        joinTime: '2026-09-20 09:00:00',
      },
      {
        userId: '900000000000000002',
        displayName: MEMBER_NAME,
        memberRole: 1,
        owner: false,
        joinTime: '2026-09-21 09:00:00',
      },
    ],
  };
}

const onClose = vi.fn();
const onUpdated = vi.fn();
const onLeft = vi.fn();

function renderPanel() {
  return render(
    <App>
      <ChatGroupPanel
        open
        groupId={GROUP_ID}
        onClose={onClose}
        onUpdated={onUpdated}
        onLeft={onLeft}
      />
    </App>,
  );
}

/** 等成员名单出现：它一出现就说明详情已经拉到并渲染完成。 */
async function loaded() {
  await screen.findByText(OWNER_NAME);
}

describe('ChatGroupPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessState.allowed = [];
    vi.mocked(fetchChatGroupDetail).mockResolvedValue(makeDetail());
  });

  afterEach(() => {
    cleanup();
  });

  it('有权限点但服务端说身份不够：不出现改名入口（否则就是「按钮在、点了报 1038」）', async () => {
    accessState.allowed = [CHAT_PERM.GROUP_UPDATE];
    vi.mocked(fetchChatGroupDetail).mockResolvedValue(
      makeDetail({ canRename: false }),
    );

    renderPanel();
    await loaded();

    expect(
      screen.queryByRole('button', { name: buttonName(t('chat.group.name.save')) }),
    ).toBeNull();
  });

  it('身份够但没有权限点：同样不出现改名入口（点了报 1003）', async () => {
    accessState.allowed = [];

    renderPanel();
    await loaded();

    expect(
      screen.queryByRole('button', { name: buttonName(t('chat.group.name.save')) }),
    ).toBeNull();
  });

  it('改名成功后用响应刷新面板并回传调用方（不再补一次 GET）', async () => {
    accessState.allowed = [CHAT_PERM.GROUP_UPDATE];
    vi.mocked(renameChatGroup).mockResolvedValue({
      ...makeDetail(),
      name: '新群名',
    });

    renderPanel();
    const input = await screen.findByDisplayValue('项目群');
    // 前后带空白：提交前必须裁掉，否则会写进一个「看起来一样却不一样」的群名
    fireEvent.change(input, { target: { value: ' 新群名 ' } });
    fireEvent.click(
      screen.getByRole('button', { name: buttonName(t('chat.group.name.save')) }),
    );

    await waitFor(() =>
      expect(renameChatGroup).toHaveBeenCalledWith(GROUP_ID, '新群名'),
    );
    await waitFor(() => expect(onUpdated).toHaveBeenCalled());
    expect(onUpdated.mock.calls.at(-1)?.[0].name).toBe('新群名');
    expect(screen.getByDisplayValue('新群名')).toBeTruthy();
  });

  it('危险操作按 ability 出：群主能解散、不出现退群', async () => {
    accessState.allowed = [CHAT_PERM.GROUP_DISSOLVE];

    renderPanel();
    await loaded();

    expect(
      screen.getByRole('button', { name: buttonName(t('chat.group.dissolve')) }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: buttonName(t('chat.group.quit')) }),
    ).toBeNull();
  });

  it('退群必须过二次确认：确认后才调接口，并通知调用方关掉会话', async () => {
    // 退群不挂权限点（作用对象恒是登录人自己），因此这里一个点也不给
    vi.mocked(fetchChatGroupDetail).mockResolvedValue(
      makeDetail({ canQuit: true, canDissolve: false }),
    );

    renderPanel();
    await loaded();
    fireEvent.click(
      screen.getByRole('button', { name: buttonName(t('chat.group.quit')) }),
    );

    const ok = await screen.findByRole('button', {
      name: buttonName(t('common.danger.ok')),
    });
    fireEvent.click(ok);

    await waitFor(() => expect(quitChatGroup).toHaveBeenCalledWith(GROUP_ID));
    await waitFor(() => expect(onLeft).toHaveBeenCalledWith(GROUP_ID));
  });

  it('已在群里的账号不进待邀请列表：服务端会幂等跳过，前端不必白跑一趟', async () => {
    // 不含 system:user:list ⇒ 走「账号 → 目标」解析这条非管理员路径
    accessState.allowed = [CHAT_PERM.GROUP_INVITE];
    vi.mocked(resolveChatTarget).mockResolvedValue({
      targetId: OWNER_ID,
      displayName: OWNER_NAME,
    });

    renderPanel();
    const field = await screen.findByPlaceholderText(
      t('chat.group.invite.placeholder'),
    );
    fireEvent.change(field, { target: { value: 'owner' } });
    fireEvent.keyDown(field, { key: 'Enter', code: 'Enter' });

    await waitFor(() => expect(resolveChatTarget).toHaveBeenCalledWith('owner'));
    const submit = screen.getByRole('button', {
      name: buttonName(t('chat.group.invite.button')),
    });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(inviteChatGroupMembers).not.toHaveBeenCalled();
  });

  it('群主那行不出现「移除」：群主不可被移除（服务端 1039）', async () => {
    accessState.allowed = [CHAT_PERM.GROUP_REMOVE];

    renderPanel();
    await loaded();

    // 两名成员：只有非群主那一行有移除按钮
    expect(
      screen.getAllByRole('button', {
        name: buttonName(t('chat.group.member.remove')),
      }),
    ).toHaveLength(1);
    expect(removeChatGroupMember).not.toHaveBeenCalled();
  });
});
