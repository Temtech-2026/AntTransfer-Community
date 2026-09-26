/**
 * 会话附件 API（聊天里「带附件发消息」的授权与取件）。
 *
 * <h3>为什么授权由发送方单独创建，而不是塞进消息体</h3>
 * <p>用途档位 / 有效期 / 下载次数是<b>发送方的意志</b>，必须由服务端落库后作为唯一真相源。
 * 若让前端把「只允许预览」这类限制随消息一起上报，接收方只需改一个字段就能绕过它。
 * 因此流程是：<b>先建授权（拿到 attachmentId）→ 再发消息（正文尾注带 `#att:{id}`）</b>。</p>
 *
 * <h3>为什么取件要换票</h3>
 * <p>`<a href>` 原生下载与 `<img src>` 都带不了 Authorization 头，取件地址必须匿名可达。
 * 所以登录态下先换一张短时票据（此时完成全部裁决与次数扣减），再把票据拼进取件地址。
 * 票据在 TTL 内<b>可重复使用</b>（非一次即焚），`Range` 续传与失败重试都能用同一张票。</p>
 */

import { del, get, post, requestPage, startNativeDownload } from '@/services/request';
import type { PageResult } from '@/utils/result';

import { resolveAssetUrl } from './api';
import { CHAT_ATTACHMENT_ENDPOINTS } from './endpoints';
import type { SnowflakeId } from './types';

/**
 * 用途档位（与后端 `ChatAttachment` 常量一一对应，改动需两端同步）。
 *
 * <p>累进：档位 2 含档位 1 的能力，档位 3 含档位 2 的能力。</p>
 */
export const CHAT_ATTACHMENT_USAGE_MODE = {
  /** 1-仅预览：可在线看，不可下载、不可转存 */
  PREVIEW_ONLY: 1,
  /** 2-可下载：可按次下载，不可转存 */
  DOWNLOADABLE: 2,
  /** 3-可转发转存：可下载，也可存进自己的文件 */
  RESAVABLE: 3,
} as const;

export type ChatAttachmentUsageMode =
  (typeof CHAT_ATTACHMENT_USAGE_MODE)[keyof typeof CHAT_ATTACHMENT_USAGE_MODE];

/** 授权状态（0-生效 1-已撤销 2-已失效）。 */
export const CHAT_ATTACHMENT_STATUS = {
  ACTIVE: 0,
  REVOKED: 1,
  EXPIRED: 2,
} as const;

/**
 * 发送方设定的用途限制（三轴）。
 *
 * <p>缺省项交由服务端按配置补齐：前端只提交用户真正改过的轴，避免把默认值在两端各写一份。
 */
export interface ChatAttachmentPolicy {
  /** 用途档位 */
  usageMode: ChatAttachmentUsageMode;
  /**
   * 有效期（小时）。
   *
   * <p>与 `neverExpire` 互斥：`neverExpire` 为真时本项被忽略。
   */
  expireHours?: number;
  /** 不限期（会受服务端 `allow-never-expire` 开关约束） */
  neverExpire?: boolean;
  /** 下载次数上限；`0` = 不限次 */
  downloadLimit?: number;
}

/** 创建授权的请求体。 */
export interface CreateChatAttachmentPayload extends ChatAttachmentPolicy {
  /** 源文件条目（发送方必须持有它） */
  nodeId: SnowflakeId;
  /** 接收方用户 ID（群聊本期不走免申请取件，故恒为单聊对端） */
  receiverUserId: SnowflakeId;
  /**
   * 发送端幂等键（可空）。
   *
   * <p>连点发送 / 网络重试时，服务端据它返回同一条授权，而不是建出两条各扣各的次数。</p>
   */
  clientMsgKey?: string;
}

/** 附件授权视图。 */
export interface ChatAttachment {
  id: SnowflakeId;
  /** 源文件条目 ID */
  nodeId: SnowflakeId;
  senderUserId: SnowflakeId;
  receiverUserId: SnowflakeId;
  /** 文件名快照（源条目改名或移入回收站都不影响） */
  fileName: string;
  sizeBytes: number;
  usageMode: number;
  /** 到期时间；`null` = 不限期 */
  expireAt?: string | null;
  /** 下载次数上限；`0` = 不限次 */
  downloadLimit: number;
  downloadCount: number;
  /** 剩余次数（派生值）；`null` = 不限次 */
  remaining?: number | null;
  status: number;
  createTime?: string | null;
}

/** 取件票据视图。 */
export interface ChatAttachmentTicket {
  ticket: string;
  attachmentId: SnowflakeId;
  nodeId: SnowflakeId;
  fileName: string;
  sizeBytes: number;
  usageMode: number;
  accessType: 'preview' | 'download';
  /** 服务端拼好的取件地址（免登录，直接交给浏览器原生通道） */
  contentUrl: string;
  /** 票据有效期（秒） */
  expiresIn: number;
  /**
   * 是否支持在线预览（PDF / 光栅图 / 文本）。
   *
   * <p>语义是「能不能看」，不是「能不能交给浏览器渲染」：文本属于「能看」但「不能按文档 MIME
   * 渲染」的一类，服务端会为它切到 `text/plain + nosniff` 专用通道，浏览器以纯文本显示。
   * 前端无需区分，照常打开 `contentUrl` 即可。</p>
   *
   * <p>为 `false` 时<b>不要</b>发起内联渲染：预览票只发 `inline`，Office / 压缩包等类型会被取流层
   * 以「不支持在线预览」拒绝，<b>不会</b>降级成下载——降级等于把预览票变成下载票，
   * 绕过「仅预览」档位。故前端塞进 `<img src>` / iframe 拿到的是错误响应而不是字节。</p>
   */
  previewSupported: boolean;
}

/** 转存结果（结构对齐上传，前端可复用同一套「成功后刷新列表」的处理）。 */
export interface ChatAttachmentSaveResult {
  nodeId?: SnowflakeId;
  name?: string;
  sizeBytes?: number;
  [key: string]: unknown;
}

/* ============================== 发送方侧 ============================== */

/** 创建授权：必须在发送消息之前调用，否则消息里的 `#att:` 会指向不存在的授权。 */
export function createChatAttachment(
  payload: CreateChatAttachmentPayload,
): Promise<ChatAttachment> {
  return post<ChatAttachment>(CHAT_ATTACHMENT_ENDPOINTS.create, payload);
}

/**
 * 撤销授权（发送方；幂等）。
 *
 * <p>撤销<b>立即生效</b>：取件端点会回源复核状态，不会因为票据还在 TTL 内而继续放行。
 * 但已经取走的字节无法追回——这是分享语义的固有边界，不是本实现的缺陷。
 */
export function revokeChatAttachment(attachmentId: SnowflakeId): Promise<void> {
  return del<void>(CHAT_ATTACHMENT_ENDPOINTS.revoke(attachmentId));
}

/** 「我发出的」分页（含已撤销 / 已失效，便于解释「对方为什么取不到」）。 */
export function pageMyChatAttachments(
  current = 1,
  pageSize = 20,
): Promise<PageResult<ChatAttachment>> {
  return requestPage<ChatAttachment>(CHAT_ATTACHMENT_ENDPOINTS.mine, {
    params: { current, pageSize },
  });
}

/** 「我收到的」分页。 */
export function pageReceivedChatAttachments(
  current = 1,
  pageSize = 20,
): Promise<PageResult<ChatAttachment>> {
  return requestPage<ChatAttachment>(CHAT_ATTACHMENT_ENDPOINTS.received, {
    params: { current, pageSize },
  });
}

/** 授权详情（发送方与接收方均可）。 */
export function fetchChatAttachment(
  attachmentId: SnowflakeId,
): Promise<ChatAttachment> {
  return get<ChatAttachment>(CHAT_ATTACHMENT_ENDPOINTS.detail(attachmentId));
}

/* ============================== 接收方侧 ============================== */

/**
 * 换取件票据（登录态）。
 *
 * <p>本调用<b>就是</b>取件的裁决点：`download` 会在这一步扣减剩余次数，
 * 因此不要在用户还在犹豫时提前换票——预览用 `preview`，它不消耗额度。</p>
 *
 * @param silent 不弹全局错误提示，由调用方统一 toast（错误照常抛出）
 */
export function issueChatAttachmentTicket(
  attachmentId: SnowflakeId,
  accessType: 'preview' | 'download' = 'preview',
  silent?: boolean,
): Promise<ChatAttachmentTicket> {
  return post<ChatAttachmentTicket>(
    CHAT_ATTACHMENT_ENDPOINTS.ticket(attachmentId, accessType),
    undefined,
    silent ? { silent: true } : {},
  );
}

/**
 * 取件地址：优先用服务端下发的 `contentUrl`。
 *
 * <p>仅在服务端未下发时按 content 端点兜底拼装——路径拼接规则只应有一处真相源，
 * 前端自己拼的字符串在换绑路径时会静默失效（表现成「点了没反应」）。</p>
 */
export function chatAttachmentUrl(ticket: ChatAttachmentTicket): string {
  const raw = ticket.contentUrl?.trim();
  if (raw) {
    return resolveAssetUrl(raw) ?? raw;
  }
  return (
    resolveAssetUrl(
      CHAT_ATTACHMENT_ENDPOINTS.content(ticket.attachmentId, ticket.ticket),
    ) ?? ''
  );
}

/**
 * 内联预览：换 `preview` 票后在新标签打开。
 *
 * <p>用 `disposition=inline`（服务端对预览票强制内联）交给浏览器原生渲染，
 * 而不是把字节拉进 Blob：原生渲染能直接复用浏览器的 PDF 阅读器与图片查看器，
 * 也不会因为一份大文件在内存里再存一份而卡住页面。</p>
 *
 * <p><b>不支持预览时不开标签页：</b>{@link ChatAttachmentTicket.previewSupported} 为假时，
 * 取流会被服务端以「不支持在线预览」拒绝。若照旧 `window.open`，用户只会看到一个与上下文
 * 脱节的报错页，不如留在会话里说明原因。故此处把处置权交回调用方。
 * 文本类文件 `previewSupported` 为真，打开后由浏览器以纯文本呈现（服务端强制 `text/plain`）。</p>
 *
 * <p>预览票不消耗下载次数，所以「换了票却没打开页面」不会白扣额度——这也是允许
 * 先换票、再按 `previewSupported` 决定的原因。</p>
 *
 * @returns 票据；`previewSupported` 为假时<b>没有</b>打开任何页面，调用方需提示原因
 */
export async function openChatAttachmentPreview(
  attachmentId: SnowflakeId,
): Promise<ChatAttachmentTicket> {
  const ticket = await issueChatAttachmentTicket(attachmentId, 'preview');
  if (!ticket.previewSupported) {
    return ticket;
  }
  const url = chatAttachmentUrl(ticket);
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  return ticket;
}

/**
 * 下载：换 `download` 票 → 交给浏览器原生下载通道。
 *
 * <p>本条<b>会消耗一次下载额度</b>，因此 UI 上要有明确的「下载」动作而不是悬停预取。</p>
 *
 * <p>{@link startNativeDownload} 的 `fileName` 仅作兜底：服务端 `Content-Disposition`
 * 里的文件名优先，前端传它只是为了避免落到一个叫 `download` 的无名文件。</p>
 *
 * @param silent 不弹全局错误提示，由调用方统一 toast（错误照常抛出）
 */
export async function downloadChatAttachment(
  attachmentId: SnowflakeId,
  silent?: boolean,
): Promise<void> {
  const ticket = await issueChatAttachmentTicket(attachmentId, 'download', silent);
  startNativeDownload(chatAttachmentUrl(ticket), ticket.fileName);
}

/**
 * 转存到自己的文件（需 `file:upload`，且档位须为「可转发转存」）。
 *
 * <p>转存不计入下载次数：档位 3 的语义就是「你可以拿走并归你所有」，
 * 拿到条目后可自行下载任意次，此时再按次限制没有意义。</p>
 */
export function saveChatAttachmentToMyFiles(
  attachmentId: SnowflakeId,
): Promise<ChatAttachmentSaveResult> {
  return post<ChatAttachmentSaveResult>(
    CHAT_ATTACHMENT_ENDPOINTS.save(attachmentId),
  );
}

/* ============================== 展示助手 ============================== */

/** 档位是否允许下载（含转存档位）。 */
export function canDownload(usageMode: number | null | undefined): boolean {
  return (
    usageMode === CHAT_ATTACHMENT_USAGE_MODE.DOWNLOADABLE ||
    usageMode === CHAT_ATTACHMENT_USAGE_MODE.RESAVABLE
  );
}

/** 档位是否允许转存。 */
export function canResave(usageMode: number | null | undefined): boolean {
  return usageMode === CHAT_ATTACHMENT_USAGE_MODE.RESAVABLE;
}

/** 授权是否仍可取件（生效中，且未到期）。 */
export function isAttachmentActive(
  attachment: Pick<ChatAttachment, 'status' | 'expireAt'>,
  now: number = Date.now(),
): boolean {
  if (attachment.status !== CHAT_ATTACHMENT_STATUS.ACTIVE) {
    return false;
  }
  if (!attachment.expireAt) {
    return true;
  }
  const expireAt = Date.parse(attachment.expireAt);
  return Number.isNaN(expireAt) || expireAt > now;
}
