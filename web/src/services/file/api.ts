/**
 * 文件域 API。
 *
 * <p>全部走 `services/request` 统一封装（Bearer 注入、Result 识别、401 静默刷新一次），
 * 这里只负责「路径 + 参数 + 类型」三件事，不重复实现重试 / 提示。</p>
 */

import {
  del,
  get,
  patch,
  post,
  requestPage,
  startNativeDownload,
} from '@/services/request';
import type { PageResult } from '@/utils/result';

import {
  FILE_ENDPOINTS,
  FOLDER_ENDPOINTS,
  PERMISSION_APP_ENDPOINTS,
  SHARE_ENDPOINTS,
  SHARE_VISIT_ENDPOINTS,
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
  ShareAccessTicket,
  ShareLink,
  SharePayload,
  SnowflakeId,
  VerifySharePayload,
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
 *
 * <p>6. **取件由浏览器原生下载接管**（隐藏 `<a download>` 点击取件地址，见 `startNativeDownload`），
 * 而不是「XHR 整份取回再落盘」：只有前者会进入浏览器的下载面板 / 下载列表并显示进度，
 * 也只有前者能用上 `Range` 续传与服务端的分块流式限速（后者把整个文件驻留内存）。
 * 代价是「下载是否成功」前端拿不到回执——那由浏览器呈现。</p>
 */

/**
 * 预览元信息。
 *
 * <p>「能不能预览、用哪种方式预览」由服务端下发，前端不得按扩展名自行猜测：
 * Office 系服务端不转码（download-only），猜错会让用户对着转圈的白屏等下去。</p>
 */
export function fetchPreview(nodeId: SnowflakeId): Promise<PreviewInfo> {
  return get<PreviewInfo>(FILE_ENDPOINTS.preview(nodeId));
}

/**
 * 换下载票据（需 `file:download`）。票据绑定 `nodeId`，在 TTL 内可重复取件。
 *
 * @param silent 不弹全局错误提示，由调用方统一 toast（错误照常抛出）
 */
export function issueDownloadTicket(
  nodeId: SnowflakeId,
  silent?: boolean,
): Promise<DownloadTicket> {
  return post<DownloadTicket>(
    FILE_ENDPOINTS.issueTicket(nodeId),
    undefined,
    silent ? { silent: true } : {},
  );
}

/**
 * 票据 → 取件地址。
 *
 * <p>服务端已给出 `downloadUrl` 时直接用它；仅在缺失时按 content 端点兜底拼装，
 * 避免前端「猜」一个与网关不一致的路径。</p>
 */
export function ticketUrl(ticket: DownloadTicket, nodeId: SnowflakeId): string {
  const raw = ticket.downloadUrl?.trim();
  if (raw) {
    return raw;
  }
  return `${FILE_ENDPOINTS.content(nodeId)}?ticket=${encodeURIComponent(ticket.ticket)}`;
}

/** 把服务端下发的相对地址补成同源绝对路径（`<img src>` / `<a href>` 用）。 */
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
  /**
   * 静默：换票失败时不弹全局提示，由页面统一 toast（错误照常抛出）。
   *
   * <p>为的是一次失败只提示一次——全局提示与页面自己的 catch 各弹一条，用户会看到两条
   * 措辞还不太一样的重复消息。</p>
   */
  silent?: boolean;
}

/**
 * 下载文件：换票（XHR，失败可结构化处理）→ 取件交给**浏览器原生下载通道**。
 *
 * <p><b>为什么取件不再走 XHR + Blob：</b>见 {@link startNativeDownload} 的说明——简言之，
 * 只有走原生通道才会进入浏览器的下载面板并显示进度（火狐对 Blob 落盘不给任何提示），
 * 也只有原生通道能用上 `Range` 续传。</p>
 *
 * <p><b>票据不是一次即焚</b>（服务端只校验不销毁，过期由 TTL 兜底），故取件失败后用
 * <b>同一张票</b>重发即可——重试与 `Range` 断点续传都不会让票据失效，重试路径上无需再换票。
 * 协议细节见本节头部的「取件链路的协议口径」。改走原生下载后，续传由浏览器自己发起
 * （它本来就对同一 URL 带 `Range` 重试），前端不必再实现分块。</p>
 *
 * <p>这里仍每次调用都换票：票据 TTL 仅 5 分钟（`expiresInSeconds`），跨会话缓存 URL 必然
 * 在过期后拿到 `4018`；换票成本远低于为省一次请求而引入的过期判断。</p>
 *
 * <p>**本函数返回不代表文件已落盘**：下载进度与成败由浏览器下载列表呈现，前端拿不到回执。</p>
 */
export async function downloadNode(
  node: FileNode,
  options: DownloadOptions = {},
): Promise<void> {
  // 换票留在 XHR 里：这一步的失败（1003 无权限 / 1005 账号禁用 …）是结构化 Result，
  // 要按 code 呈现；而取件一旦交出去就由浏览器接管，前端再也读不到错误了
  const ticket = await issueDownloadTicket(node.id, options.silent);
  const url = ticketUrl(ticket, node.id);
  // 服务端可能下发相对地址；`<a href>` 在嵌套路由下的相对解析结果与页面层级有关，统一补成同源绝对路径
  // 带上条目名作兜底文件名：服务端 `filename*` 优先，缺失时至少不会是「download」
  startNativeDownload(resolveAssetUrl(url) ?? url, node.name);
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
export function recycleNode(nodeId: SnowflakeId): Promise<void> {
  return del<void>(FILE_ENDPOINTS.remove(nodeId));
}

/** 批量移入回收站（需 `file:edit`）：返回实际生效条数（服务端单次上限 200）。 */
export function batchRecycleNodes(nodeIds: SnowflakeId[]): Promise<number> {
  return post<number>(FILE_ENDPOINTS.batchRecycle, { nodeIds });
}

/**
 * 移动条目到目标父目录（需 `file:edit`）。
 *
 * <p>`targetFolderId = 0` 表示根目录——这是服务端的约定（见 `MoveRequest`），
 * 不要在前端把 0 「归一成 undefined」，那会被校验拦成「目标目录不能为空」。</p>
 */
export function moveNode(nodeId: SnowflakeId, targetFolderId: SnowflakeId): Promise<FileNode> {
  return patch<FileNode>(FILE_ENDPOINTS.move(nodeId), { targetFolderId });
}

/** 从回收站还原（需 `file:edit`）。 */
export function restoreNode(nodeId: SnowflakeId): Promise<void> {
  return post<void>(FILE_ENDPOINTS.restore(nodeId));
}

/** 彻底销毁（需 `file:destroy`）：不可撤销，前端务必二次确认。 */
export function destroyNode(nodeId: SnowflakeId): Promise<void> {
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

/**
 * 批量失效所选外发链接（需 `file:share`，单次上限 200）：返回**实际失效条数**。
 *
 * <p>为什么返回条数而不是 `void`：服务端对「已终态 / 非本人」的令牌静默跳过，
 * 于是「撤掉 3 条」与「一条都没撤」都是 200。页面必须靠这个数字给出可核对的反馈
 * （0 条时明确提示「没有生效中的分享」），否则用户会以为操作没生效而反复点击。</p>
 */
export function revokeShareBatch(tokens: string[]): Promise<number> {
  return post<number>(SHARE_ENDPOINTS.batchRevoke, { tokens });
}

/**
 * 一键失效「我的全部」生效中链接（需 `file:share`）：返回实际失效条数，没有生效链接时为 0。
 *
 * <p>不带任何范围参数：作用域由服务端按登录主体确定，前端无从「少撤一页」。</p>
 */
export function revokeAllShares(): Promise<number> {
  return post<number>(SHARE_ENDPOINTS.revokeAll);
}

/* ========================== 外发分享：访客侧 ========================== */

/**
 * 访客换票（免登录）：校验令牌 / 有效期 / 提取码 / 次数，换取一次性票据。
 *
 * <p>失败语义都在协议里，页面按 `Result.code` 分流即可：`4010` 提取码错误、
 * `4011` 连错锁定、`4040` 链接不存在 / 已失效 / 已撤销、`4004` 次数用尽。</p>
 */
export function verifyShareTicket(
  token: string,
  payload: VerifySharePayload,
): Promise<ShareAccessTicket> {
  return post<ShareAccessTicket>(SHARE_VISIT_ENDPOINTS.verify(token), payload);
}

/**
 * 访客核销（免登录）：一次性票据取用即焚，服务端扣减次数并写审计，返回元信息 + 取件票。
 *
 * <p>这一步<b>才</b>是消耗下载次数的时刻，因此页面不要为了「先看看有没有权限」而提前调用——
 * 那会白白扣掉一次。另外核销结果里没有剩余次数，若需要展示请改用换票返回的 `remainingCount`
 * 快照（并发下以核销为准）。</p>
 */
export function redeemShareTicket(ticket: string): Promise<SharePayload> {
  return post<SharePayload>(SHARE_VISIT_ENDPOINTS.redeem, { ticket });
}

/**
 * 拼取件地址（免登录，可直接作为 `<a href>`）。
 *
 * <p>返回的是<b>相对路径</b>而非绝对 URL：取件端点与页面同源，交给浏览器按当前站点拼即可。
 * 若在这里写死 host，部署到反向代理路径下（或多域名）就会指向错误的站点。</p>
 */
export function buildShareContentUrl(
  token: string,
  contentTicket: string,
): string {
  return SHARE_VISIT_ENDPOINTS.content(token, contentTicket);
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
