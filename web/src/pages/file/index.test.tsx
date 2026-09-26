/**
 * 文件列表 ProTable：渲染与「无权限按钮不渲染」。
 *
 * <p>本页的权限口径是<b>「渲染层显隐」而非安全边界</b>（真正的边界在后端 `@RequiresPerm`），
 * 所以这里断言的每一条都对应 `docs/development/frontend-permission-map.md` 里的一行——
 * 该文档是前端权限映射的单一事实源，代码与它不一致即为缺陷。</p>
 *
 * <p>要钉住的三件事：</p>
 * <ol>
 *   <li><b>数据源由视角决定</b>：「我的文件」与「回收站」是两个端点，
 *       翻页/筛选不得串源；</li>
 *   <li><b>无权限的入口必须消失</b>：按钮可见但点击必然 403，
 *       比按钮不存在更糟（用户会认为系统坏了）；</li>
 *   <li><b>「申请权限」与「发送到聊天」都不受权限点约束</b>：前者的对象正是没有权限的人，
 *       加门禁即成死锁；后者发出去的只是一个条目引用，取件边界在接收方那一侧，
 *       给发送方加门禁只会让看得见文件的人发不出去。</li>
 * </ol>
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { history } from '@umijs/max';
import { App } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import access, { type AccessModel } from '@/access';
import { formatBytes } from '@/components/ChunkUpload';
import { testFormatMessage } from '@/locales/testTranslate';
import { DataScope } from '@/services/access';
import {
  type FileNode,
  fetchFileNode,
  fetchFolderTree,
  levelTextId,
  pageFiles,
  pageRecycleFiles,
} from '@/services/file';
import { attachToChat, setChatOpen } from '@/services/ui/panelHub';
import { FILE_DRAG_MIME } from '@/utils/dragFile';

import FileWorkbenchPage from './index';

/** 断言用：从 zh-CN 语言包取文案，键写错即失败（不在测试里另抄一份中文）。 */
const t = (id: string, values?: Record<string, unknown>) =>
  testFormatMessage({ id, values });

/**
 * 可变输入：`useAccess()` 每次渲染都读它，从而在同一个用例里切换权限；
 * `search` 用来构造「从聊天里的文件卡片深链进来」的落地地址。
 */
const holder = vi.hoisted(() => ({ model: {} as unknown, search: '' }));

/** 预览弹窗被要求打开的那个条目——深链用例靠它断言「真的定位到了那一条」 */
const previewHolder = vi.hoisted(() => ({ node: null as unknown }));

vi.mock('@umijs/max', async () => {
  const { testFormatMessage: translate } = await import('@/locales/testTranslate');
  return {
    useAccess: () => holder.model,
    // 兼容两种调用形态：`formatMessage({ id, values })` 与 `formatMessage({ id }, values)`
    useIntl: () => ({
      formatMessage: (
        descriptor: { id: string; values?: Record<string, unknown> },
        values?: Record<string, unknown>,
      ) => translate({ id: descriptor.id, values: values ?? descriptor.values }),
    }),
    request: vi.fn(),
    history: {
      get location() {
        return { pathname: '/file', search: holder.search };
      },
      push: vi.fn(),
      replace: vi.fn(),
    },
  };
});

vi.mock('@/services/file', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/file')>();
  return {
    ...actual,
    pageFiles: vi.fn(),
    pageRecycleFiles: vi.fn(),
    fetchFolderTree: vi.fn(),
    fetchFileNode: vi.fn(),
  };
});

// 通讯抽屉是另一个模块的单元，这里只钉住「文件页交给它什么」
vi.mock('@/services/ui/panelHub', () => ({
  attachToChat: vi.fn(),
  setChatOpen: vi.fn(),
}));

// 四个弹窗各自独立成单元（上传弹窗还需要 uploader 注入），此处只关心列表与工具条
vi.mock('./components/UploadModal', () => ({ default: () => null }));
// 预览弹窗把收到的条目记下来，供深链用例断言定位结果
vi.mock('./components/PreviewModal', () => ({
  default: (props: { node: unknown }) => {
    previewHolder.node = props.node;
    return null;
  },
}));
vi.mock('./components/ShareModal', () => ({ default: () => null }));
vi.mock('./components/PermissionApplyModal', () => ({ default: () => null }));

const mockedPageFiles = vi.mocked(pageFiles);
const mockedPageRecycle = vi.mocked(pageRecycleFiles);
const mockedFolderTree = vi.mocked(fetchFolderTree);
const mockedFetchFileNode = vi.mocked(fetchFileNode);
const mockedAttachToChat = vi.mocked(attachToChat);
const mockedSetChatOpen = vi.mocked(setChatOpen);

const node = (overrides: Partial<FileNode> = {}): FileNode =>
  ({
    // ID 一律用字符串：接口返回的就是 19 位雪花 ID 串，测试替身不该自降口径
    id: '101',
    name: '季度报告.pdf',
    ext: 'pdf',
    level: 1,
    sizeBytes: 2048,
    updateTime: '2026-09-13 10:00:00',
    ...overrides,
  }) as unknown as FileNode;

/** 授予一组权限点；前端只做「在不在集合里」的判定 */
const grant = (permCodes: string[]) => {
  holder.model = access({
    permissions: { roles: ['USER'], permCodes, dataScope: DataScope.ALL },
  }) as AccessModel;
};

const ALL_PERMS = [
  'file:upload',
  'file:preview',
  'file:download',
  'file:share',
  'file:edit',
  'file:destroy',
];

const renderPage = () =>
  render(
    <App>
      <FileWorkbenchPage />
    </App>,
  );

/** 等到首屏数据行渲染出来 */
const waitForRow = async (name = '季度报告.pdf') => {
  await screen.findByText(name);
};

const queryAction = (id: string) => screen.queryByText(t(id));

const buttonNamed = (id: string) =>
  screen.queryByRole('button', { name: new RegExp(t(id)) });

beforeEach(() => {
  vi.clearAllMocks();
  grant(ALL_PERMS);
  holder.search = '';
  previewHolder.node = null;
  mockedFolderTree.mockResolvedValue([]);
  mockedPageFiles.mockResolvedValue({ records: [node()], total: 1 } as never);
  mockedPageRecycle.mockResolvedValue({
    records: [node({ id: '202' })],
    total: 1,
  } as never);
});

describe('文件列表渲染', () => {
  it('渲染数据行的名称 / 大小 / 密级，并渲染全部操作入口', async () => {
    renderPage();
    await waitForRow();

    // 大小与密级用各自格式化函数的结果断言，避免把展示格式写死在测试里
    expect(screen.getByText(formatBytes(2048))).toBeTruthy();
    expect(screen.getByText(t(levelTextId(1)))).toBeTruthy();

    for (const id of [
      'file.action.preview',
      'file.action.download',
      'file.action.share',
      'file.action.sendToChat',
      'file.action.applyPerm',
      'file.action.delete',
    ]) {
      expect(queryAction(id), `有权限时「${t(id)}」应渲染`).not.toBeNull();
    }
    // 工具栏
    expect(buttonNamed('file.action.upload')).toBeTruthy();
    expect(buttonNamed('file.action.enterRecycle')).toBeTruthy();
    // 数据源必须是「我的文件」而不是回收站
    expect(mockedPageFiles).toHaveBeenCalled();
    expect(mockedPageRecycle).not.toHaveBeenCalled();
  });

  it('更新时间按系统管理「创建时间」的口径渲染：ISO 的 T 不摆给用户', async () => {
    // 服务端契约是 ISO-8601（application.yml: write-dates-as-timestamps=false），
    // 列上若直出原始串，用户看到的就是 `2026-09-13T10:00:00` 这种带 T 的形态
    mockedPageFiles.mockResolvedValue({
      records: [node({ updateTime: '2026-09-13T10:00:00' })],
      total: 1,
    } as never);

    renderPage();
    await waitForRow();

    expect(screen.getByText('2026-09-13 10:00:00')).toBeTruthy();
    expect(screen.queryByText('2026-09-13T10:00:00')).toBeNull();
  });

  it('无权限的入口不渲染，但「申请权限」始终保留', async () => {
    grant(['file:download']);
    renderPage();
    await waitForRow();

    expect(queryAction('file.action.download')).not.toBeNull();
    // 没有 file:preview / file:share / file:edit，这三个入口必须消失
    expect(queryAction('file.action.preview')).toBeNull();
    expect(queryAction('file.action.share')).toBeNull();
    expect(queryAction('file.action.delete')).toBeNull();
    // 关键：申请权限无门禁——没有权限的人正是要申请的人，加门禁会形成死锁
    expect(queryAction('file.action.applyPerm')).not.toBeNull();
    // 发送到聊天同样无门禁：发出去的只是条目引用，能看见文件的人就该发得出去
    expect(queryAction('file.action.sendToChat')).not.toBeNull();
  });

  it('上传入口由 file:upload 控制（对齐 frontend-permission-map 的「上传 / 秒传」一行）', async () => {
    grant(['file:download']);
    renderPage();
    await waitForRow();

    expect(buttonNamed('file.action.upload')).toBeNull();
  });

  it('回收站入口由 file:preview 控制：无该权限时进不去', async () => {
    grant(['file:download', 'file:upload']);
    renderPage();
    await waitForRow();

    expect(buttonNamed('file.action.enterRecycle')).toBeNull();
  });
});

describe('发送到聊天', () => {
  it('把条目整条交给通讯抽屉，而不是自己拼一段文本', async () => {
    renderPage();
    await waitForRow();

    const sendAction = queryAction('file.action.sendToChat');
    if (!sendAction) {
      throw new Error('未渲染「发送到聊天」入口');
    }
    fireEvent.click(sendAction);

    expect(mockedAttachToChat).toHaveBeenCalledWith({
      nodeId: '101',
      fileName: '季度报告.pdf',
      sizeBytes: 2048,
      level: 1,
    });
  });

  it('文件行可拖：拖起就打开抽屉，并按拖拽协议把条目写进 dataTransfer', async () => {
    renderPage();
    await waitForRow();

    const row = screen.getByText('季度报告.pdf').closest('tr');
    expect(row?.getAttribute('draggable')).toBe('true');
    if (!row) {
      throw new Error('未找到文件行');
    }

    const setData = vi.fn();
    fireEvent.dragStart(row, { dataTransfer: { setData, effectAllowed: 'none' } });

    // 投放区长在抽屉里：抽屉不打开，用户就没有可投放的地方
    expect(mockedSetChatOpen).toHaveBeenCalledWith(true);
    const [, serialized] = setData.mock.calls.find(
      ([type]) => type === FILE_DRAG_MIME,
    ) ?? [];
    expect(JSON.parse(serialized as string)).toEqual({
      nodeId: '101',
      fileName: '季度报告.pdf',
      sizeBytes: 2048,
      level: 1,
    });
  });

  it('从聊天文件卡片深链进来：按 nodeId 取回条目并打开预览，同时抹掉地址参数', async () => {
    holder.search = '?nodeId=101';
    mockedFetchFileNode.mockResolvedValue(node({ id: '101' }));

    renderPage();

    expect(mockedFetchFileNode).toHaveBeenCalledWith('101');
    // 参数要先清掉，否则用户关掉预览、随手翻个页都会被再弹一次
    expect(vi.mocked(history.replace)).toHaveBeenCalledWith('/file');
    await waitFor(() => expect(previewHolder.node).toMatchObject({ id: '101' }));
  });

  it('没有 nodeId 时不发请求，避免每次进文件页都白跑一趟', async () => {
    renderPage();

    await waitForRow();
    expect(mockedFetchFileNode).not.toHaveBeenCalled();
  });
});

describe('回收站视角', () => {
  const enterRecycle = async () => {
    renderPage();
    await waitForRow();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('file.action.enterRecycle')) }));
    await waitFor(() => expect(mockedPageRecycle).toHaveBeenCalled());
  };

  it('切换后数据源换成 pageRecycleFiles，操作列换成「还原 / 彻底销毁」', async () => {
    await enterRecycle();

    // 撤回：预览 / 下载 / 分享 对已移入回收站的文件没有意义
    expect(queryAction('file.action.preview')).toBeNull();
    expect(queryAction('file.action.download')).toBeNull();
    expect(queryAction('file.action.share')).toBeNull();
    // 已移入回收站的条目不该还能发到聊天里去
    expect(queryAction('file.action.sendToChat')).toBeNull();
    expect(queryAction('file.action.restore')).not.toBeNull();
    expect(queryAction('file.action.destroy')).not.toBeNull();
    // 工具栏出现返回入口与清空入口
    expect(buttonNamed('file.action.backToFiles')).toBeTruthy();
    expect(buttonNamed('file.action.emptyRecycle')).toBeTruthy();
    expect(mockedPageRecycle).toHaveBeenCalledWith(
      expect.objectContaining({ current: expect.any(Number) }),
    );
  });

  it('「清空回收站」由 file:destroy 控制', async () => {
    // 进入回收站需要 file:preview；能还原但无销毁权
    grant(['file:preview', 'file:edit']);
    await enterRecycle();

    expect(queryAction('file.action.restore')).not.toBeNull();
    expect(buttonNamed('file.action.emptyRecycle')).toBeNull();
    // 行内的「彻底销毁」同样不可见
    expect(queryAction('file.action.destroy')).toBeNull();
  });
});
