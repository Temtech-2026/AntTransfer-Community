/**
 * 审批中心 ProTable：渲染、视角切换与「审批动作不按权限点显隐」。
 *
 * <p><b>本页的显隐口径与文件列表相反，这是刻意的：</b>审批端点在后端**没有**
 * `@RequiresPerm`——资格由「是否为该单审批人 + 单子处于待审态」在服务层判定，
 * 根本不存在 `approval:decide` 这类权限点。所以这里的按钮由 `canDecide(单子, 视角)`
 * 这个**纯业务态**函数控制，而不是 `<Access perm>`。</p>
 *
 * <p>因此本文件要钉住的不是「无权限按钮不渲染」，而是两件更容易被改坏的事：</p>
 * <ol>
 *   <li><b>不臆造权限点</b>：若有人给「通过 / 驳回」套上 `<Access perm="...">`，
 *       权限模型为空时按钮就会消失，下面第 5 个用例会立刻失败——这是红线守卫；</li>
 *   <li><b>终态单与「我发起」视角不可决策</b>：把已通过/已驳回的单子渲染成可审批，
 *       会让审批人对同一张单重复决策。</li>
 * </ol>
 */

import { App } from 'antd';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { testFormatMessage } from '@/locales/testTranslate';
import { pageMyApprovals, pagePendingApprovals } from '@/services/approval';
import type { ApprovalApplication } from '@/services/approval';
import { APPROVAL_STATUS, approvalStatusTextId } from '@/services/approval';

import ApprovalCenterPage from './index';

/** 可变状态：`useAccess()` 与 `history.location` 每次读取都取这里的当前值 */
const holder = vi.hoisted(() => ({
  model: {} as unknown,
  search: '',
  replace: vi.fn(),
  push: vi.fn(),
}));

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
      // getter：模块在测试体之前就被导入，初始视角必须读「渲染那一刻」的 search
      location: {
        get search() {
          return holder.search;
        },
        pathname: '/approval',
      },
      replace: (...args: unknown[]) => holder.replace(...args),
      push: (...args: unknown[]) => holder.push(...args),
    },
  };
});

// 只替换两个列表端点：canDecide / approvalStatusTextId 等口径必须用真品，
// 否则「口径是否被改坏」就测不出来了。
vi.mock('@/services/approval', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/approval')>();
  return {
    ...actual,
    pagePendingApprovals: vi.fn(),
    pageMyApprovals: vi.fn(),
  };
});

// 决策弹窗与详情抽屉各自独立成单元，这里只关心列表与操作列
vi.mock('./components/ApprovalDecisionModal', () => ({ default: () => null }));
vi.mock('./components/ApprovalDetailDrawer', () => ({ default: () => null }));

const mockedPending = vi.mocked(pagePendingApprovals);
const mockedMine = vi.mocked(pageMyApprovals);

const application = (overrides: Partial<ApprovalApplication> = {}): ApprovalApplication => ({
  id: '1',
  applicationNo: 'AT-2026-0001',
  applicantId: '7',
  applyType: 'DOWNLOAD',
  resourceType: 'FILE',
  resourceId: '101',
  level: 2,
  purpose: '对外投标材料',
  desiredExpireAt: '2026-10-01 00:00:00',
  status: APPROVAL_STATUS.pending,
  approverId: '9',
  createdAt: '2026-09-14 09:00:00',
  ...overrides,
});

const PENDING_ROW = application();
/** 终态单：后端不会把它排进「待我审批」，此处用于守住「终态不可再决策」的兜底 */
const DECIDED_ROW = application({
  id: '2',
  applicationNo: 'AT-2026-0002',
  purpose: '季度审计取数',
  status: APPROVAL_STATUS.approved,
  opinion: '同意，仅限本次投标',
});

const renderPage = () =>
  render(
    <App>
      <ApprovalCenterPage />
    </App>,
  );

/** 定位某一行的单元格，避免跨行断言（ProTable 的所有行共用同一批文案） */
const rowOf = (applicationNo: string) => {
  const cell = screen.getByText(applicationNo);
  const row = cell.closest('tr');
  if (!row) {
    throw new Error(`未找到包含「${applicationNo}」的表格行`);
  }
  return within(row);
};

const rowAppeared = (applicationNo: string) => screen.findByText(applicationNo);

beforeEach(() => {
  vi.clearAllMocks();
  holder.model = {};
  holder.search = '';
  mockedPending.mockResolvedValue({ records: [PENDING_ROW, DECIDED_ROW], total: 2 } as never);
  mockedMine.mockResolvedValue({ records: [PENDING_ROW], total: 1 } as never);
});

describe('待我审批视角', () => {
  it('默认停在「待我审批」，只打待我审批端点并渲染行数据', async () => {
    renderPage();
    await rowAppeared('AT-2026-0001');
    await rowAppeared('AT-2026-0002');

    expect(mockedPending).toHaveBeenCalled();
    expect(mockedMine).not.toHaveBeenCalled();
    // 字段落位按行断言，避免两行共用同一批文案时误判
    expect(rowOf('AT-2026-0001').getByText('对外投标材料')).toBeTruthy();
    expect(rowOf('AT-2026-0002').getByText('季度审计取数')).toBeTruthy();
    // 动作列走 applyType 的格式化结果
    expect(screen.getAllByText('下载').length).toBeGreaterThan(0);
    // SLA 是「提醒」列，只在这一视角出现
    expect(screen.getByRole('columnheader', { name: 'SLA' })).toBeTruthy();
  });

  it('待审单渲染「通过 / 驳回」，终态单只留「详情」', async () => {
    renderPage();
    await rowAppeared('AT-2026-0001');
    await rowAppeared('AT-2026-0002');

    expect(rowOf('AT-2026-0001').getByText('通过')).toBeTruthy();
    expect(rowOf('AT-2026-0001').getByText('驳回')).toBeTruthy();

    // 已通过的单子再出现「通过 / 驳回」＝引导用户重复决策
    const decided = rowOf('AT-2026-0002');
    expect(decided.queryByText('通过')).toBeNull();
    expect(decided.queryByText('驳回')).toBeNull();
    expect(decided.getByText('详情')).toBeTruthy();
  });

  it('权限模型为空时「通过 / 驳回」照常渲染：审批动作不吃 perm_code', async () => {
    // 有人给操作列套上 <Access perm="approval:decide"> 的话，这条会失败
    holder.model = {};
    renderPage();
    await rowAppeared('AT-2026-0001');

    expect(rowOf('AT-2026-0001').getByText('通过')).toBeTruthy();
    expect(rowOf('AT-2026-0001').getByText('驳回')).toBeTruthy();
  });
});

describe('视角切换与深链', () => {
  const switchToMine = async () => {
    renderPage();
    await rowAppeared('AT-2026-0001');
    fireEvent.click(screen.getByRole('tab', { name: '我发起' }));
    await waitFor(() => expect(mockedMine).toHaveBeenCalled());
  };

  it('切到「我发起」后换成我发起的端点，并把视角写回地址栏', async () => {
    await switchToMine();

    expect(mockedMine).toHaveBeenCalledWith(
      expect.objectContaining({ current: expect.any(Number) }),
    );
    // replace 而非 push：切 Tab 不该污染后退栈
    expect(holder.replace).toHaveBeenCalledWith('/approval?view=mine');
  });

  it('「我发起」视角下即便是待审单也不可决策，且改看状态与审批意见', async () => {
    await switchToMine();

    const row = rowOf('AT-2026-0001');
    expect(row.queryByText('通过')).toBeNull();
    expect(row.queryByText('驳回')).toBeNull();
    expect(row.getByText('详情')).toBeTruthy();
    // 该视角关心的信息：状态与审批意见（取代 SLA 列）
    expect(
      row.getByText(
        testFormatMessage({ id: approvalStatusTextId(APPROVAL_STATUS.pending) }),
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'SLA' })).toBeNull();
  });

  it('?view=mine 深链直接落在「我发起」视角', async () => {
    holder.search = '?view=mine';
    renderPage();

    await waitFor(() => expect(mockedMine).toHaveBeenCalled());
    expect(mockedPending).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('我发起');
  });

  it('非法 view 值回落到「待我审批」：它是本页主视角', async () => {
    holder.search = '?view=whatever';
    renderPage();

    await waitFor(() => expect(mockedPending).toHaveBeenCalled());
    expect(mockedMine).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { selected: true }).textContent).toBe('待我审批');
  });
});
