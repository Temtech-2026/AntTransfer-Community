/**
 * 分享管理页：行复选框 + 批量 / 一键失效。
 *
 * <p>要钉住的不是「按钮长得对不对」，而是三个容易在后续迭代里被悄悄改坏的约定：</p>
 * <ol>
 *   <li><b>复选框只对「生效中」的行开放</b>：撤不掉的行被勾上，「失效所选」就成了一次
 *       静默空操作——用户勾了 5 条、实际只撤掉 2 条，却没有任何提示；</li>
 *   <li><b>「失效全部」不携带任何范围参数</b>：作用域由服务端按登录主体决定。
 *       参数一旦从请求侧可传，就可能出现「以为全撤了、其实只撤了一页」；</li>
 *   <li><b>0 条 ≠ 成功</b>：接口回的是实际失效条数，页面必须把「一条都没撤」如实说出来，
 *       否则用户会把「点了没反应」当成功能坏了，反复点击。</li>
 * </ol>
 *
 * <p>权限口径同 `docs/development/frontend-permission-map.md`：本页可见性与两个失效入口
 * 都收口在 `file:share`，前端只做渲染层显隐（真正的边界在后端 `@RequiresPerm`）。</p>
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import access, { type AccessModel } from '@/access';
import { testFormatMessage } from '@/locales/testTranslate';
import { DataScope } from '@/services/access';
import {
  type ShareLink,
  pageMyShares,
  revokeAllShares,
  revokeShareBatch,
} from '@/services/file';

import SharesPage from './index';

/** 断言用：从 zh-CN 语言包取文案，键写错即失败（不在测试里另抄一份中文）。 */
const t = (id: string, values?: Record<string, unknown>) =>
  testFormatMessage({ id, values });

/** 可变的权限模型：`useAccess()` 每次渲染都读它，从而在同一个用例里切换权限 */
const holder = vi.hoisted(() => ({ model: {} as unknown }));

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
      location: { pathname: '/shares', search: '' },
      push: vi.fn(),
      replace: vi.fn(),
    },
  };
});

vi.mock('@/services/file', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/file')>();
  return {
    ...actual,
    pageMyShares: vi.fn(),
    revokeShareBatch: vi.fn(),
    revokeAllShares: vi.fn(),
  };
});

// 创建弹窗独立成单元，此处只关心列表与工具条
vi.mock('./components/CreateShareModal', () => ({ default: () => null }));

const mockedPageMyShares = vi.mocked(pageMyShares);
const mockedRevokeBatch = vi.mocked(revokeShareBatch);
const mockedRevokeAll = vi.mocked(revokeAllShares);

const ACTIVE_TOKEN = 'tok-active';
const REVOKED_TOKEN = 'tok-revoked';

const row = (overrides: Partial<ShareLink> = {}): ShareLink => ({
  token: ACTIVE_TOKEN,
  fileName: '季度报告.pdf',
  status: 0,
  expireAt: '2026-10-01 00:00:00',
  downloadedCount: 1,
  downloadLimit: 10,
  remainingCount: 9,
  extractCodeRequired: true,
  createTime: '2026-09-21 10:00:00',
  ...overrides,
});

/** 授予一组权限点；前端只做「在不在集合里」的判定 */
const grant = (permCodes: string[]) => {
  holder.model = access({
    permissions: { roles: ['USER'], permCodes, dataScope: DataScope.ALL },
  }) as AccessModel;
};

const renderPage = () =>
  render(
    <App>
      <SharesPage />
    </App>,
  );

/** 转义正则元字符：文案里带 `（）`「」等全角符号，直接拼进 RegExp 会被当成分组 */
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 按钮名匹配：**尾锚定**，允许前面带图标标签。
 *
 * <p>两个坑凑在一起：</p>
 * <ul>
 *   <li>带 icon 的按钮，可访问名会拼上图标的 aria-label（如 {@code plus 创建分享}），
 *       用 {@code ^创建分享$} 反而一个都找不到；</li>
 *   <li>`失效所选` 是 `失效所选（1）` 的**前缀**，不锚定的话勾选后会一次命中两个按钮，
 *       `queryByRole` 直接抛「找到多个元素」。</li>
 * </ul>
 * <p>尾锚定 + 允许前置图标名，两个坑都绕开：前者仍能命中，后者各自只命中自己。</p>
 */
const buttonName = (id: string, values?: Record<string, unknown>) =>
  new RegExp(`^(?:\\S+\\s)*${escapeRegExp(t(id, values))}$`);

const buttonNamed = (id: string, values?: Record<string, unknown>) =>
  screen.queryByRole('button', { name: buttonName(id, values) });

const isDisabled = (el: Element | null) => (el as HTMLButtonElement | null)?.disabled === true;

beforeEach(() => {
  vi.clearAllMocks();
  grant(['file:share']);
  mockedPageMyShares.mockResolvedValue({
    records: [row()],
    total: 1,
  } as never);
  mockedRevokeBatch.mockResolvedValue(1);
  mockedRevokeAll.mockResolvedValue(1);
});

describe('分享管理页 · 批量失效入口', () => {
  it('渲染三个入口：创建分享 / 失效所选（未勾选时禁用）/ 失效全部', async () => {
    renderPage();
    await screen.findByText('季度报告.pdf');

    expect(buttonNamed('shares.action.create')).not.toBeNull();
    expect(isDisabled(buttonNamed('shares.action.revokeSelected'))).toBe(true);
    // 「失效全部」不需要先勾选：作用域由服务端决定，禁用反而会让用户以为没有可撤的链接
    expect(isDisabled(buttonNamed('shares.action.revokeAll'))).toBe(false);
  });

  it('复选框只对「生效中」的行开放：已撤销的行不可勾选', async () => {
    mockedPageMyShares.mockResolvedValue({
      records: [row(), row({ token: REVOKED_TOKEN, fileName: '已撤销.txt', status: 1 })],
      total: 2,
    } as never);
    renderPage();
    await screen.findByText('已撤销.txt');

    // [0] 表头全选、[1] 生效中行、[2] 已撤销行
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes).toHaveLength(3);
    expect(boxes[1].disabled).toBe(false);
    expect(boxes[2].disabled).toBe(true);
  });

  it('勾选后「失效所选」带出条数，确认后按令牌批量失效并清空勾选', async () => {
    renderPage();
    await screen.findByText('季度报告.pdf');

    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    const selected = await screen.findByRole('button', {
      name: buttonName('shares.action.revokeSelectedCount', { count: 1 }),
    });

    fireEvent.click(selected);
    fireEvent.click(
      await screen.findByRole('button', {
        name: buttonName('shares.revokeSelected.confirmOk'),
      }),
    );

    await waitFor(() => expect(mockedRevokeBatch).toHaveBeenCalledWith([ACTIVE_TOKEN]));
    // 刷新后这些行已不是「生效中」，勾选必须清空，否则会指向一批撤不掉的行
    await waitFor(() =>
      expect(isDisabled(buttonNamed('shares.action.revokeSelected'))).toBe(true),
    );
    expect(await screen.findByText(t('shares.revokeBatch.success', { count: 1 }))).toBeTruthy();
  });

  it('「失效全部」不带任何范围参数，确认后调用一键失效并如实回报条数', async () => {
    mockedRevokeAll.mockResolvedValue(3);
    renderPage();
    await screen.findByText('季度报告.pdf');

    fireEvent.click(buttonNamed('shares.action.revokeAll')!);
    fireEvent.click(
      await screen.findByRole('button', {
        name: buttonName('shares.revokeAll.confirmOk'),
      }),
    );

    await waitFor(() => expect(mockedRevokeAll).toHaveBeenCalled());
    // 关键：作用域由服务端按登录主体决定，请求侧不得出现范围参数
    expect(mockedRevokeAll).toHaveBeenCalledWith();
    expect(await screen.findByText(t('shares.revokeBatch.success', { count: 3 }))).toBeTruthy();
  });

  it('没有生效中的链接（返回 0）时不谎报成功，明确提示「没有可撤的」', async () => {
    mockedRevokeAll.mockResolvedValue(0);
    renderPage();
    await screen.findByText('季度报告.pdf');

    fireEvent.click(buttonNamed('shares.action.revokeAll')!);
    fireEvent.click(
      await screen.findByRole('button', {
        name: buttonName('shares.revokeAll.confirmOk'),
      }),
    );

    expect(await screen.findByText(t('shares.revoke.none'))).toBeTruthy();
    expect(screen.queryByText(t('shares.revokeBatch.success', { count: 0 }))).toBeNull();
  });

  it('无 file:share 时整页拒绝，连批量入口都不渲染', async () => {
    grant(['file:download']);
    renderPage();

    expect(await screen.findByText(t('shares.denied'))).toBeTruthy();
    expect(buttonNamed('shares.action.revokeAll')).toBeNull();
    expect(buttonNamed('shares.action.revokeSelected')).toBeNull();
    expect(mockedPageMyShares).not.toHaveBeenCalled();
  });
});
