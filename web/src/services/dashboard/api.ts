/**
 * 工作台仪表盘数据访问。
 *
 * <p>降级策略与 PRD US-11 的验收口径一致：**单卡片失败只让该卡片降级，不阻塞整页**。
 * 因此三个数据源各自 try/catch、各自返回 null/零值，页面按「有值渲染值、无值渲染 --」处理。
 */

import { pagePendingApprovals } from '@/services/approval';
import { requestData } from '@/services/request';

import { DASHBOARD_ENDPOINTS } from './endpoints';
import type { TransferStats } from './types';

/**
 * 传输统计快照。
 *
 * <p>失败时返回 **null**（而非抛错）：统计是「锦上添花」的概览数字，拉不到只该让
 * 对应卡片降级，弹错误 toast 会把一次网络抖动放大成整页报错。因此请求静默 +
 * 返回 null，由页面渲染占位并显式说明「统计暂不可用」。
 */
export async function fetchTransferStats(): Promise<TransferStats | null> {
  try {
    const raw = await requestData<TransferStats>(DASHBOARD_ENDPOINTS.transferStats, {
      method: 'GET',
      silent: true,
    });
    return raw ?? null;
  } catch (error) {
    console.warn('[anttransfer] 传输统计拉取失败，传输量 / 成功率卡片按占位降级', error);
    return null;
  }
}

/**
 * 待我审批数量。
 *
 * <p>后端没有 count 端点，用 `pageSize=1` 的分页取 `total`——只回传一条记录，
 * 不会因为审批单多而变慢；也避免在前端把整页拉下来再数。
 */
export async function fetchPendingApprovalCount(): Promise<number | null> {
  try {
    const page = await pagePendingApprovals({ current: 1, pageSize: 1 });
    return page.total ?? 0;
  } catch (error) {
    console.warn('[anttransfer] 待审批数量拉取失败', error);
    return null;
  }
}
