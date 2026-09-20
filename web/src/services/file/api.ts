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
  patch,
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

/*
 * 取件链路的协议口径（权威实现在服务端 `FileDownloadService`，前端只依赖、不重定义）。
 *
 * <p>1. 取件地址免登录，鉴权全在 `?ticket=`；**不要**给它再加 Authorization 头——
 * 服务端本就不读，加了只会让人误判「鉴权发生在这里」。</p>
 *
 * <p>2. 成功响应恒带 `Accept-Ranges: bytes`（`416` 与错误响应不带）。**续传 = 用同一张票对
 * 同一个 URL 重发 `Range`**：票据在 TTL 内可重复使用（见 `DownloadTicket`），中断重试不会
 * 让票据失效，因此重试路径上不需要重新换票。</p>
 *
 * <p>3. 单段 `Range` 生效时返回 `206` + `Content-Range: bytes start-end/total`；
 * 但**不能假定「带了 Range 就一定 206」**——多段（含逗号）与语法不合法的 `Range`
 * 会被忽略并整份返回 `200`（HTTP 允许服务端忽略不支持的 Range）。判定续传是否生效
 * 要看状态码与 `Content-Range`，不能只看请求发没发。</p>
 *
 * <p>4. 只有**起点**越界才返回 `416`（`end` 超出总长会被收敛到末尾），此时
 * `Content-Range` 只带总长（`bytes *<总长>`）：应按该总长重算区间再续传，而不是从头再来。</p>
 *
 * <p>5. 传输中断不会得到错误码（响应头早已提交，服务端无力回改），只在审计里记
 * 「已发送字节数」。故**用户侧感知不到这次失败**，续传只能由客户端主动发起。</p>
 */

/**
 * 预览元信息。
 *
 * <p>「能不能预览、用哪种方式预览」由服务端下发，前端不得按扩展名自行猜测：
 * Office 系服务端不转码（download-only），猜错会让用户对着转圈的白屏等下去。</p>
 */
export function fetchPreview(nodeId: number): Promise<PreviewInfo> {
  return get<PreviewInfo>(FILE_ENDPOINTS.preview(nodeId));
}

/** 换下载票据（需 `file:download`）。票据绑定 `nodeId`，在 TTL 内可重复取件。 */
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
 * <p><b>票据不是一次即焚</b>（服务端只校验不销毁，过期由 TTL 兜底），故取件失败后用
 * <b>同一张票</b>重发即可——重试与 `Range` 断点续传都不会让票据失效，重试路径上无需再换票。
 * 协议细节见本节头部的「取件链路的协议口径」。</p>
 *
 * <p>这里仍每次调用都换票：票据 TTL 仅 5 分钟（`expiresInSeconds`），跨会话缓存 URL 必然
 * 在过期后拿到 `4018`；换票成本远低于为省一次请求而引入的过期判断。</p>
 *
 * <p>本函数走 {@link downloadBinary} 整份落盘，不做分块续传；若要支持大文件续传，对同一个
 * 取件 URL 带 `Range` 重发即可（服务端返回 `206` + `Content-Range`）。</p>
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

/** 批量移入回收站（需 `file:edit`）：返回实际生效条数（服务端单次上限 200）。 */
export function batchRecycleNodes(nodeIds: number[]): Promise<number> {
  return post<number>(FILE_ENDPOINTS.batchRecycle, { nodeIds });
}

/**
 * 移动条目到目标父目录（需 `file:edit`）。
 *
 * <p>`targetFolderId = 0` 表示根目录——这是服务端的约定（见 `MoveRequest`），
 * 不要在前端把 0 「归一成 undefined」，那会被校验拦成「目标目录不能为空」。</p>
 */
export function moveNode(nodeId: number, targetFolderId: number): Promise<FileNode> {
  return patch<FileNode>(FILE_ENDPOINTS.move(nodeId), { targetFolderId });
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
