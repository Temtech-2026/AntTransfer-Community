/**
 * 文件域 API。
 *
 * <p>全部走 `services/request` 统一封装（Bearer 注入、Result 识别、401 静默刷新一次），
 * 这里只负责「路径 + 参数 + 类型」三件事，不重复实现重试 / 提示。</p>
 */

import {
  type BinaryProgress,
  del,
  downloadBinary,
  get,
  post,
  requestPage,
  saveBlob,
} from '@/services/request';
import type { PageResult } from '@/utils/result';

import {
  FILE_ENDPOINTS,
  FOLDER_ENDPOINTS,
  PERMISSION_APP_ENDPOINTS,
  SHARE_ENDPOINTS,
} from './endpoints';
import type {
  ApprovalRequest,
  CreateSharePayload,
  DownloadTicket,
  FileNode,
  FileNodeQuery,
  FolderNode,
  PermissionApplicationPayload,
  PreviewInfo,
  ShareLink,
} from './types';

/* ============================ 列表 / 目录 ============================ */

/** 文件分页列表（keyword / ext / level / 时间区间 / 排序）。 */
export function pageFiles(query: FileNodeQuery = {}): Promise<PageResult<FileNode>> {
  return requestPage<FileNode>(FILE_ENDPOINTS.page, {
    params: { ...query } as Record<string, unknown>,
  });
}

/** 当前用户的目录树（children 递归嵌套）。 */
export async function fetchFolderTree(): Promise<FolderNode[]> {
  const tree = await get<FolderNode[]>(FOLDER_ENDPOINTS.tree);
  return Array.isArray(tree) ? tree : [];
}

/* ============================ 预览 / 下载 ============================ */

/**
 * 预览元信息。
 *
 * <p>「能不能预览、用哪种方式预览」由服务端下发，前端不得按扩展名自行猜测：
 * Office 系服务端不转码（download-only），猜错会让用户对着转圈的白屏等下去。</p>
 */
export function fetchPreview(nodeId: number): Promise<PreviewInfo> {
  return get<PreviewInfo>(FILE_ENDPOINTS.preview(nodeId));
}

/** 换一次性下载票据（需 `file:download`）。 */
export function issueDownloadTicket(nodeId: number): Promise<DownloadTicket> {
  return post<DownloadTicket>(FILE_ENDPOINTS.issueTicket(nodeId));
}

/**
 * 票据 → 取件地址。
 *
 * <p>服务端已给出 `downloadUrl` 时直接用它；仅在缺失时按 content 端点兜底拼装，
 * 避免前端「猜」一个与网关不一致的路径。</p>
 */
export function ticketUrl(ticket: DownloadTicket, nodeId: number): string {
  const raw = ticket.downloadUrl?.trim();
  if (raw) {
    return raw;
  }
  return `${FILE_ENDPOINTS.content(nodeId)}?ticket=${encodeURIComponent(ticket.ticket)}`;
}

/** 把服务端下发的相对地址补成同源绝对路径（`<img src>` / `<iframe src>` 用）。 */
export function resolveAssetUrl(url?: string | null): string | undefined {
  const raw = url?.trim();
  if (!raw) {
    return undefined;
  }
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('/')) {
    return raw;
  }
  return `/${raw}`;
}

export interface DownloadOptions {
  /** 下载进度（服务端带 Content-Length 时才有意义） */
  onProgress?: (progress: BinaryProgress) => void;
  /** 默认静默：由页面统一 toast，避免和全局错误提示重复弹两次 */
  silent?: boolean;
}

/**
 * 下载文件：换票 → 凭票取件 → 落盘。
 *
 * <p>票据一次性且绑定单文件，所以每次下载都要重新换票（不要缓存 URL）。</p>
 */
export async function downloadNode(node: FileNode, options: DownloadOptions = {}): Promise<void> {
  const ticket = await issueDownloadTicket(node.id);
  const blob = await downloadBinary(ticketUrl(ticket, node.id), {
    onDownloadProgress: options.onProgress,
    silent: options.silent ?? true,
  });
  saveBlob(blob, node.name || `file-${node.id}`);
}

/* ============================ 删除 / 回收站 ============================ */

/**
 * 回收站分页（需 `file:preview`）。
 *
 * <p>与 {@link pageFiles} 共用 `NodeQuery`，但服务端只返回已移入回收站的条目，
 * 因此页面上「回收站」与「我的文件」是两个互斥的数据源，不能靠前端过滤模拟。
 */
export function pageRecycleFiles(query: FileNodeQuery = {}): Promise<PageResult<FileNode>> {
  return requestPage<FileNode>(FILE_ENDPOINTS.recycle, {
    params: { ...query } as Record<string, unknown>,
  });
}

/** 移入回收站（需 `file:edit`）：不是物理删除，用户仍可在回收站还原。 */
export function recycleNode(nodeId: number): Promise<void> {
  return del<void>(FILE_ENDPOINTS.remove(nodeId));
}

/** 从回收站还原（需 `file:edit`）。 */
export function restoreNode(nodeId: number): Promise<void> {
  return post<void>(FILE_ENDPOINTS.restore(nodeId));
}

/** 彻底销毁（需 `file:destroy`）：不可撤销，前端务必二次确认。 */
export function destroyNode(nodeId: number): Promise<void> {
  return del<void>(FILE_ENDPOINTS.destroy(nodeId));
}

/** 清空回收站（需 `file:destroy`）：返回本次销毁条数。 */
export function emptyRecycle(): Promise<number> {
  return post<number>(FILE_ENDPOINTS.emptyRecycle);
}

/* ============================ 外发分享 ============================ */

/** 创建外发链接（需 `file:share`；提取码只进不出）。 */
export function createShare(payload: CreateSharePayload): Promise<ShareLink> {
  return post<ShareLink>(SHARE_ENDPOINTS.create, payload);
}

/**
 * 我的外发链接分页。
 *
 * <p>注意分页参数名与文件域<b>不同</b>：分享域后端是 {@code @RequestParam page/size}
 * （{@code ShareController#mine}，服务端硬上限 100），文件域才是 {@code NodeQuery} 的
 * {@code current/pageSize}。传错名字不会报错，只会静默拿回默认的第一页。</p>
 */
export function pageMyShares(current = 1, pageSize = 20): Promise<PageResult<ShareLink>> {
  return requestPage<ShareLink>(SHARE_ENDPOINTS.mine, {
    params: { page: current, size: pageSize },
  });
}

/** 撤销外发链接（已签发票据随核销失效）。 */
export function revokeShare(token: string): Promise<void> {
  return del<void>(SHARE_ENDPOINTS.revoke(token));
}

/* ============================ 权限申请 ============================ */

/** 提交权限申请（申请人身份由登录态推导，不从请求体传）。 */
export function submitPermissionApplication(
  payload: PermissionApplicationPayload,
): Promise<ApprovalRequest> {
  return post<ApprovalRequest>(PERMISSION_APP_ENDPOINTS.create, payload);
}

/** 我发起的申请分页。 */
export function pageMyApplications(current = 1, pageSize = 20): Promise<PageResult<ApprovalRequest>> {
  return requestPage<ApprovalRequest>(PERMISSION_APP_ENDPOINTS.mine, {
    params: { current, pageSize },
  });
}

/** 待我审批分页。 */
export function pagePendingApplications(
  current = 1,
  pageSize = 20,
): Promise<PageResult<ApprovalRequest>> {
  return requestPage<ApprovalRequest>(PERMISSION_APP_ENDPOINTS.pending, {
    params: { current, pageSize },
  });
}
