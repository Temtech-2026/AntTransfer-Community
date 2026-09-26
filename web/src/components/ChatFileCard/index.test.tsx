/**
 * 会话附件卡片：动作与提示的契约。
 *
 * <p>钉住两条容易漂移的口径：</p>
 * <ol>
 *   <li><b>动作由授权档位决定，不由前端猜。</b>仅预览档位不得出现下载入口，
 *       可下载 / 可转存档位按累进关系逐级放开。</li>
 *   <li><b>取流不会降级。</b>预览票只发 `inline`，不可内联的类型被服务端直接拒绝，
 *       卡片必须在会话内说明原因；且提示要与用户真正能做的动作一致——
 *       仅预览档位下没有下载入口，「请下载后查看」是一句做不到的建议。</li>
 * </ol>
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { history } from '@umijs/max';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { testFormatMessage } from '@/locales/testTranslate';
import {
  CHAT_ATTACHMENT_STATUS,
  CHAT_ATTACHMENT_USAGE_MODE,
  type ChatAttachment,
  type ChatAttachmentTicket,
  fetchChatAttachment,
  openChatAttachmentPreview,
  revokeChatAttachment,
} from '@/services/file/chatAttachment';
import { buildFileDeepLink } from '@/utils/fileDeepLink';

import ChatFileCard from './index';

/** 组件依赖的 `App.useApp()`：把 toast / 确认框换成探针，好断言「说了什么」 */
const { toastInfo, toastSuccess, modalConfirm } = vi.hoisted(() => ({
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
  modalConfirm: vi.fn(),
}));

/** 断言用：从 zh-CN 语言包取文案，键写错即失败（不在测试里另抄一份中文） */
const t = (id: string, values?: Record<string, unknown>) =>
  testFormatMessage({ id, values });

vi.mock('@umijs/max', async () => {
  const { testFormatMessage: translate } = await import('@/locales/testTranslate');
  return {
    history: { push: vi.fn() },
    useIntl: () => ({
      // 兼容两种调用形态：`formatMessage({ id, values })` 与 `formatMessage({ id }, values)`
      formatMessage: (
        descriptor: { id: string; values?: Record<string, unknown> },
        values?: Record<string, unknown>,
      ) => translate({ id: descriptor.id, values: values ?? descriptor.values }),
    }),
  };
});

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    App: {
      ...actual.App,
      useApp: () => ({
        message: { info: toastInfo, success: toastSuccess },
        modal: { confirm: modalConfirm },
      }),
    },
  };
});

vi.mock('@/services/file/chatAttachment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/file/chatAttachment')>();
  // 只打桩真正发请求的函数；canDownload / canResave 等档位判定用真实实现
  return {
    ...actual,
    fetchChatAttachment: vi.fn(),
    openChatAttachmentPreview: vi.fn(),
    downloadChatAttachment: vi.fn(),
    saveChatAttachmentToMyFiles: vi.fn(),
    revokeChatAttachment: vi.fn(),
  };
});

const mockedFetch = vi.mocked(fetchChatAttachment);
const mockedPreview = vi.mocked(openChatAttachmentPreview);
const mockedRevoke = vi.mocked(revokeChatAttachment);

const ATTACHMENT_ID = '2026092200000000123';
const NODE_ID = '2026092200000000777';
const FILE_NAME = '季度报告.pdf';

const attachment = (overrides: Partial<ChatAttachment> = {}): ChatAttachment => ({
  id: ATTACHMENT_ID,
  nodeId: NODE_ID,
  senderUserId: '1',
  receiverUserId: '2',
  fileName: FILE_NAME,
  sizeBytes: 2516582,
  usageMode: CHAT_ATTACHMENT_USAGE_MODE.DOWNLOADABLE,
  expireAt: '2099-01-01T00:00:00',
  downloadLimit: 5,
  downloadCount: 2,
  remaining: 3,
  status: CHAT_ATTACHMENT_STATUS.ACTIVE,
  ...overrides,
});

type CardProps = Parameters<typeof ChatFileCard>[0];

/** 挂载卡片：默认形态是「对方发来的、带授权的文件」 */
function renderCard(props: Partial<CardProps> = {}) {
  return render(
    <ChatFileCard
      name={FILE_NAME}
      sizeText="2.4 MB"
      attachmentId={ATTACHMENT_ID}
      {...props}
    />,
  );
}

/**
 * 把文案节点收敛到最近的按钮；文案不在按钮里说明断言写错了，直接失败。
 */
const toButton = (node: HTMLElement | null): HTMLButtonElement => {
  const button = node?.closest('button');
  if (!button) {
    throw new Error('该文案不在任何按钮内，无法定位动作按钮');
  }
  return button;
};

/**
 * 按文案找动作按钮。
 *
 * <p>这里刻意不用 `getByRole('button', { name })`：antd 图标按钮的可访问名会把图标的
 * `aria-label` 一起算进去（预览按钮实际是 `eye 预览`），而当前版本的可访问名匹配不支持
 * 模糊模式（`exact` 对 role 查询无效），精确匹配文案必然落空。</p>
 */
const actionButton = (label: string) => toButton(screen.getByText(label));
const queryActionButton = (label: string) =>
  screen.queryByText(label)?.closest('button') ?? null;
const findActionButton = async (label: string) => toButton(await screen.findByText(label));

const downloadButton = () => actionButton(t('chat.attachCard.download'));

describe('ChatFileCard 取件动作', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetch.mockResolvedValue(attachment());
  });

  it('可下载档位：给出预览与下载，并显示剩余次数', async () => {
    renderCard();

    expect(await findActionButton(t('chat.attachCard.preview'))).toBeVisible();
    expect(downloadButton()).toBeVisible();
    expect(await screen.findByText(t('chat.attachCard.remaining', { count: 3 }))).toBeVisible();
  });

  it('仅预览档位：没有下载入口，也不显示消耗性次数', async () => {
    mockedFetch.mockResolvedValue(
      attachment({ usageMode: CHAT_ATTACHMENT_USAGE_MODE.PREVIEW_ONLY }),
    );
    renderCard();

    expect(await findActionButton(t('chat.attachCard.preview'))).toBeVisible();
    expect(queryActionButton(t('chat.attachCard.download'))).toBeNull();
    expect(screen.queryByText(t('chat.attachCard.remaining', { count: 3 }))).toBeNull();
  });

  it('可转存档位：比可下载档位多出「保存到我的文件」', async () => {
    mockedFetch.mockResolvedValue(
      attachment({ usageMode: CHAT_ATTACHMENT_USAGE_MODE.RESAVABLE }),
    );
    renderCard();

    await findActionButton(t('chat.attachCard.preview'));
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('已撤销：不再提供任何动作，只留状态标记', async () => {
    mockedFetch.mockResolvedValue(
      attachment({ status: CHAT_ATTACHMENT_STATUS.REVOKED }),
    );
    renderCard();

    expect(await screen.findByText(t('chat.attachCard.revoked'))).toBeVisible();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('发送方：只给撤销，不给取件动作', async () => {
    renderCard({ mine: true });

    expect(await findActionButton(t('chat.attachCard.revoke'))).toBeVisible();
    expect(queryActionButton(t('chat.attachCard.preview'))).toBeNull();
    expect(queryActionButton(t('chat.attachCard.download'))).toBeNull();
  });

  it('确认撤销后调撤销接口并回显结果', async () => {
    mockedRevoke.mockResolvedValue(undefined);
    renderCard({ mine: true });

    fireEvent.click(await findActionButton(t('chat.attachCard.revoke')));
    expect(modalConfirm).toHaveBeenCalledTimes(1);

    // 撤销是不可逆动作，必须过一次二次确认：直接执行 onOk，跳过确认框的渲染。
    // onOk 会落「撤销中」状态并刷新卡片，属于会触发更新的异步交互，须包进 act
    const { onOk } = modalConfirm.mock.calls[0][0] as { onOk: () => Promise<void> };
    await act(async () => {
      await onOk();
    });

    expect(mockedRevoke).toHaveBeenCalledWith(ATTACHMENT_ID);
    expect(toastSuccess).toHaveBeenCalledWith(t('chat.attachCard.revokeOk'));
  });

  it('没有授权（历史消息）：整卡可点，跳回文件域', async () => {
    renderCard({ attachmentId: undefined, nodeId: NODE_ID });

    const card = screen.getByTitle(t('chat.fileCard.open', { name: FILE_NAME }));
    expect(card).toHaveAttribute('role', 'button');

    fireEvent.click(card);
    expect(vi.mocked(history.push)).toHaveBeenCalledWith(buildFileDeepLink(NODE_ID));
  });
});

describe('ChatFileCard 预览不支持内联时的提示', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** 服务端不会把内联请求降级成下载，因此这里返回的是「没打开任何页面」 */
  const unsupported = () =>
    mockedPreview.mockResolvedValue({
      previewSupported: false,
    } as ChatAttachmentTicket);

  it('可下载时引导去下载', async () => {
    mockedFetch.mockResolvedValue(attachment());
    unsupported();
    renderCard();

    // 这一击可能落在详情回来之前（档位未知）。无论哪种时序，结论都必须是
    // 「请下载后查看」——不能说「发送方未允许下载」，那与事实相反
    fireEvent.click(await findActionButton(t('chat.attachCard.preview')));

    await waitFor(() =>
      expect(toastInfo).toHaveBeenCalledWith(t('chat.attachCard.previewUnsupported')),
    );
    expect(toastInfo).not.toHaveBeenCalledWith(
      t('chat.attachCard.previewUnsupportedNoDownload'),
    );
  });

  it('仅预览档位下不劝用户下载，而是说明这条路走不通', async () => {
    mockedFetch.mockResolvedValue(
      attachment({ usageMode: CHAT_ATTACHMENT_USAGE_MODE.PREVIEW_ONLY }),
    );
    unsupported();
    renderCard();

    fireEvent.click(await findActionButton(t('chat.attachCard.preview')));

    await waitFor(() =>
      expect(toastInfo).toHaveBeenCalledWith(
        t('chat.attachCard.previewUnsupportedNoDownload'),
      ),
    );
    // 没有下载入口却提示「请下载后查看」，用户会去找一个不存在的按钮
    expect(toastInfo).not.toHaveBeenCalledWith(t('chat.attachCard.previewUnsupported'));
  });
});
