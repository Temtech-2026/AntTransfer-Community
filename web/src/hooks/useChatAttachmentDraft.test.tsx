/**
 * `useChatAttachmentDraft`：两个聊天入口共用的「发一份文件」规则。
 *
 * <p>这里断言的是**请求体**，不是界面。这几条规则错了在页面上完全看不出来，
 * 只有发出去的授权与消息能证明它们成立：</p>
 * <ol>
 *   <li><b>消息与授权共用同一个幂等键</b>：各生成一个键的话，重试时消息被去重了、
 *       授权却会多出一条，发送方列表里凭空多一份额度；</li>
 *   <li><b>仅预览档位次数传 0</b>：留一个用不到的额度上限，只会让接收方在卡片上
 *       看到「剩余 5 次」却永远无法下载；</li>
 *   <li><b>群聊不建授权</b>：正文只带 `#file:` 尾注，取件仍走文件域的权限申请，
 *       免得群聊里凭空多出一批无人认领的授权；</li>
 *   <li><b>正文取 `buildFileCardContent` 的口径</b>：卡片靠尾注回文件域取件，
 *       少一个标记就等于把接收方指向一个打不开的卡片。</li>
 * </ol>
 *
 * <p>页面/抽屉那一层只负责「有没有把它挂上去」，由 `pages/chat/index.test.tsx` 覆盖。</p>
 */

import { act, renderHook, type RenderHookResult } from '@testing-library/react';

import {
  CHAT_ATTACHMENT_USAGE_MODE,
  createChatAttachment,
} from '@/services/file/chatAttachment';
import { ChatScope, MessageType } from '@/services/notify';
import { FILE_DRAG_MIME, type FileDragPayload } from '@/utils/dragFile';

import useChatAttachmentDraft, {
  type ChatAttachmentDraft,
} from './useChatAttachmentDraft';

vi.mock('@/services/file/chatAttachment', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/file/chatAttachment')>();
  return { ...actual, createChatAttachment: vi.fn() };
});

const mockedCreate = vi.mocked(createChatAttachment);

const NODE_ID = '900000000000000011';
const PEER_ID = '900000000000000009';
const GROUP_ID = '900000000000000012';
const GRANT_ID = 88;

const PRIVATE_SESSION = { chatScope: ChatScope.PRIVATE, targetId: PEER_ID };
const GROUP_SESSION = { chatScope: ChatScope.GROUP, targetId: GROUP_ID };

const file = (overrides: Partial<FileDragPayload> = {}): FileDragPayload => ({
  nodeId: NODE_ID,
  fileName: '季度报告.pdf',
  sizeBytes: 2517000,
  ...overrides,
});

/** 一次真实的投放：事件形状与 `utils/dragFile` 的解析口径对齐。 */
const dropEvent = (payload: FileDragPayload | null) => {
  const dataTransfer = {
    types: payload ? [FILE_DRAG_MIME] : ['text/plain'],
    getData: (type: string) =>
      payload && type === FILE_DRAG_MIME ? JSON.stringify(payload) : '',
  };
  return {
    preventDefault: vi.fn(),
    dataTransfer,
  } as unknown as Parameters<ChatAttachmentDraft['dropZoneProps']['onDrop']>[0];
};

type Hook = RenderHookResult<ChatAttachmentDraft, unknown>;

const setup = (): Hook => renderHook(() => useChatAttachmentDraft());

/** 投放一份待发文件（hook 未挂载 DOM，直接走挂载点的回调）。 */
const put = async (hook: Hook, payload: FileDragPayload | null = file()) => {
  await act(async () => {
    hook.result.current.dropZoneProps.onDrop(dropEvent(payload));
  });
};

const build = async (
  hook: Hook,
  session: { chatScope: number; targetId: string },
  text = '',
) => {
  let sent: Awaited<ReturnType<ChatAttachmentDraft['buildMessage']>> | undefined;
  await act(async () => {
    sent = await hook.result.current.buildMessage(session, text);
  });
  if (!sent) {
    throw new Error('buildMessage 没有返回消息');
  }
  return sent;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedCreate.mockResolvedValue({ id: GRANT_ID } as never);
});

describe('useChatAttachmentDraft', () => {
  it('单聊发文件：先建授权，再把授权尾注写进文件消息正文', async () => {
    const hook = setup();
    await put(hook);

    const sent = await build(hook, PRIVATE_SESSION);

    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate.mock.calls[0][0]).toMatchObject({
      nodeId: NODE_ID,
      receiverUserId: PEER_ID,
      usageMode: CHAT_ATTACHMENT_USAGE_MODE.DOWNLOADABLE,
    });
    expect(sent.messageType).toBe(MessageType.FILE);
    expect(sent.content).toContain('季度报告.pdf');
    expect(sent.content).toContain('2.4 MB');
    expect(sent.content).toContain(`#file:${NODE_ID}`);
    expect(sent.content).toContain(`#att:${GRANT_ID}`);
  });

  it('幂等键同源：消息与它携带的授权必须是同一个键', async () => {
    const hook = setup();
    await put(hook);

    const sent = await build(hook, PRIVATE_SESSION, '季度数据');

    expect(sent.clientMsgId).toBe(mockedCreate.mock.calls[0][0].clientMsgKey);
  });

  it('仅预览档位：次数显式传 0，哪怕用户先前把上限设成了 5 次', async () => {
    const hook = setup();
    await put(hook);
    await act(async () => {
      hook.result.current.setPolicy({
        usageMode: CHAT_ATTACHMENT_USAGE_MODE.DOWNLOADABLE,
        expireHours: 168,
        downloadLimit: 5,
      });
    });
    // 先确认宽松档位下上限确实带得出去，后面的 0 才有意义
    await build(hook, PRIVATE_SESSION);
    expect(mockedCreate.mock.calls[0][0].downloadLimit).toBe(5);

    await act(async () => {
      hook.result.current.setPolicy({
        usageMode: CHAT_ATTACHMENT_USAGE_MODE.PREVIEW_ONLY,
        expireHours: 168,
        downloadLimit: 5,
      });
    });
    await build(hook, PRIVATE_SESSION);

    expect(mockedCreate.mock.calls[1][0]).toMatchObject({
      usageMode: CHAT_ATTACHMENT_USAGE_MODE.PREVIEW_ONLY,
      downloadLimit: 0,
    });
  });

  it('群聊：不建授权，正文只带条目引用（取件仍走文件域申请）', async () => {
    const hook = setup();
    await put(hook);

    const sent = await build(hook, GROUP_SESSION);

    expect(mockedCreate).not.toHaveBeenCalled();
    expect(sent.messageType).toBe(MessageType.FILE);
    expect(sent.content).toContain(`#file:${NODE_ID}`);
    expect(sent.content).not.toContain('#att:');
  });

  it('纯文本：不建授权，正文原样发出', async () => {
    const hook = setup();

    const sent = await build(hook, PRIVATE_SESSION, '文件发你了');

    expect(mockedCreate).not.toHaveBeenCalled();
    expect(sent.messageType).toBe(MessageType.TEXT);
    expect(sent.content).toBe('文件发你了');
  });

  it('拖进来的不是文件条目：保持原有待发文件不动', async () => {
    const hook = setup();
    await put(hook);
    const before = hook.result.current.attachment;

    await put(hook, null);

    expect(hook.result.current.attachment).toBe(before);
  });

  it('拖入新文件即替换待发送文件', async () => {
    const hook = setup();
    await put(hook);

    const next = file({ nodeId: '900000000000000013', fileName: '预算.xlsx' });
    await put(hook, next);

    expect(hook.result.current.attachment?.fileName).toBe('预算.xlsx');

    const sent = await build(hook, PRIVATE_SESSION);
    expect(sent.content).toContain('#file:900000000000000013');
  });
});
