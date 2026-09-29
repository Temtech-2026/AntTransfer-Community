/**
 * 对端资料面板 · 备注是「我这边的称呼」，不是改昵称。
 *
 * <p>钉住四件容易做错、且错了用户会以为「备注没生效 / 备注改动了对方」的事：
 * ① 展示名按「备注 → 真实昵称」的同一套口径取值，同时把真实昵称如实并列展示；
 * ② 提交前裁空白，且与当前备注相同时不发请求（服务端会拒空白）；
 * ③ 取消备注只在确实有备注时出现，并回传 `null`（不是空串）；
 * ④ 失败时保持面板打开、不回调调用方——错误文案由请求层负责。</p>
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
import { clearPeerAlias, setPeerAlias } from '@/services/chat/api';

import ChatPeerPanel from './index';

/** 断言用文案从 zh-CN 语言包取，键写错即失败（不在测试里另抄一份中文）。 */
const t = (id: string, values?: Record<string, unknown>) =>
  testFormatMessage({ id, values });

/**
 * 按钮的可访问名匹配器。
 *
 * <p>antd 会给「恰好两个汉字」的按钮自动插入一个空格（渲染成「保 存」），
 * 按原文精确匹配会因这个排版细节失败——那不是行为差异。</p>
 */
const buttonName = (text: string) =>
  new RegExp(
    text
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .split('')
      .join('\\s*'),
  );

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
      ) =>
        translate({ id: descriptor.id, values: values ?? descriptor.values }),
    }),
  };
});

// 面板不该自己去拉对端信息，只允许发备注的两条写请求
vi.mock('@/services/chat/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/chat/api')>();
  return {
    ...actual,
    setPeerAlias: vi.fn(),
    clearPeerAlias: vi.fn(),
  };
});

const PEER_ID = '900000000000000009';
const NICKNAME = '系统管理员';
const onClose = vi.fn();
const onChanged = vi.fn();

function renderPanel(alias: string | null = null) {
  return render(
    <App>
      <ChatPeerPanel
        open
        peerId={PEER_ID}
        nickname={NICKNAME}
        alias={alias}
        onClose={onClose}
        onChanged={onChanged}
      />
    </App>,
  );
}

/** 备注输入框：按 aria-label 取，不依赖占位文案的措辞。 */
const aliasInput = () => screen.getByLabelText(t('chat.peer.alias.label'));

const saveButton = () =>
  screen.getByRole('button', { name: buttonName(t('chat.peer.alias.save')) });

describe('ChatPeerPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('没有备注时展示真实昵称；不会凭空造一个备注', () => {
    renderPanel();

    expect(screen.getByText(NICKNAME)).toBeTruthy();
    expect((aliasInput() as HTMLInputElement).value).toBe('');
  });

  it('有备注时展示名用备注、真实昵称仍并列可见（否则用户以为改了对方昵称）', () => {
    renderPanel('老张');

    expect(screen.getByText('老张')).toBeTruthy();
    expect(
      screen.getByText(t('chat.peer.nickname.label', { name: NICKNAME })),
    ).toBeTruthy();
    expect((aliasInput() as HTMLInputElement).value).toBe('老张');
  });

  it('保存前裁掉首尾空白，成功后把服务端回吐的值交回调用方', async () => {
    vi.mocked(setPeerAlias).mockResolvedValue({
      peerId: PEER_ID,
      alias: '张工',
    });

    renderPanel();
    fireEvent.change(aliasInput(), { target: { value: ' 张工 ' } });
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(setPeerAlias).toHaveBeenCalledWith(PEER_ID, '张工'),
    );
    await waitFor(() =>
      expect(onChanged).toHaveBeenCalledWith(PEER_ID, '张工'),
    );
  });

  it('只有空白（或没改动）时保存不可点：不要让用户白跑一趟 1013 / 校验', () => {
    renderPanel('老张');

    fireEvent.change(aliasInput(), { target: { value: '   ' } });
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(aliasInput(), { target: { value: '老张' } });
    expect((saveButton() as HTMLButtonElement).disabled).toBe(true);

    expect(setPeerAlias).not.toHaveBeenCalled();
  });

  it('没有备注时不摆「取消备注」：按钮在就说明有东西可取消', () => {
    renderPanel();

    expect(
      screen.queryByRole('button', {
        name: buttonName(t('chat.peer.alias.clear')),
      }),
    ).toBeNull();
  });

  it('取消备注走 DELETE，并回传 null（不是空串）', async () => {
    vi.mocked(clearPeerAlias).mockResolvedValue({
      peerId: PEER_ID,
      alias: null,
    });

    renderPanel('老张');
    fireEvent.click(
      screen.getByRole('button', {
        name: buttonName(t('chat.peer.alias.clear')),
      }),
    );

    await waitFor(() => expect(clearPeerAlias).toHaveBeenCalledWith(PEER_ID));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(PEER_ID, null));
    expect((aliasInput() as HTMLInputElement).value).toBe('');
  });

  it('失败时保持面板打开、不回调调用方（错误文案由请求层给出）', async () => {
    vi.mocked(setPeerAlias).mockRejectedValue(
      new Error('目标账号不存在或不可用'),
    );

    renderPanel();
    fireEvent.change(aliasInput(), { target: { value: '张工' } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(setPeerAlias).toHaveBeenCalled());
    expect(onChanged).not.toHaveBeenCalled();
    // 面板还开着，输入内容也在：用户可以直接改条件重试
    expect((aliasInput() as HTMLInputElement).value).toBe('张工');
  });

  it('没有对端（groupId 误传 / 返回列表）时不渲染内容，也不发请求', () => {
    render(
      <App>
        <ChatPeerPanel
          open
          peerId={null}
          nickname=""
          alias={null}
          onClose={onClose}
          onChanged={onChanged}
        />
      </App>,
    );

    expect(screen.queryByLabelText(t('chat.peer.alias.label'))).toBeNull();
    expect(setPeerAlias).not.toHaveBeenCalled();
  });
});
