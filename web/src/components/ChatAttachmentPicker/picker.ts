/**
 * 「聊天里发文件」入口的纯规则：把两种来源归一成同一种待发载荷。
 *
 * <p>两种来源的字段形态并不一样——文件区列表里的 `sizeBytes` 可空、密级可空，
 * 而本机上传结果里连密级都没有。没有一处统一归一会让下游拿到 `NaN` 字节数或空 ID，
 * 而这两种脏值都不会当场报错：`NaN` 会在附件条上渲染成「NaN B」，空 ID 会一路走到
 * 「点发送」才失败。抽成纯函数是为了让这些回落分支能被单测直接钉住。</p>
 *
 * <p>产出的载荷形态与「从文件区拖进来」完全一致（见 `utils/dragFile`）：两条来源在
 * 附件条之后就是同一条链路，来源差异不许泄漏到下游，否则「怎么发」的规则会分叉。</p>
 */

import type { FileNode } from '@/services/file';
import type { UploadTaskStatus, UploadTaskView } from '@/services/upload';
import type { FileDragPayload } from '@/utils/dragFile';
import { isPositiveIdString } from '@/utils/id';

/**
 * 仍在推进的上传状态（用于「入口是否禁用 / 是否显示进度」）。
 *
 * <p>`paused` 刻意不算：用户在传输中心暂停了某个任务时，聊天入口若跟着锁死，
 * 就变成「暂停一个上传 = 再也不能从聊天发文件」，而入口本身没有任何恢复手段。
 * `success` / `error` / `canceled` 同样不算——那些任务已经结束，不该再挡住新的一次选择。</p>
 */
const ACTIVE_UPLOAD_STATUSES: UploadTaskStatus[] = [
  'pending',
  'hashing',
  'prechecking',
  'querying',
  'uploading',
  'merging',
];

/**
 * 字节数归一：可空 / 负数 / 非有限值一律按「未知」= 0。
 *
 * <p>不要在这里「估一个大概」：附件的体积会写进气泡卡片与消息摘要，猜出来的数字
 * 在收件人那边同样是错的。0 表示未知，展示层按既有口径渲染成「0 B」——
 * 与服务端没回体积时全站的表现一致，不为这个入口单独造一套文案。</p>
 */
export function normalizeSizeBytes(value?: number | null): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

/**
 * 文件区条目 → 待发载荷。
 *
 * @returns 条目 ID 不是合法正整数串时返回 null —— 调用方应拦住这次选择并给出提示，
 *          而不是产出一份注定发不出去的草稿（草稿会出现在附件条上，用户以为选好了）
 */
export function nodeToPayload(
  node: Pick<FileNode, 'id' | 'name' | 'sizeBytes' | 'level'>,
): FileDragPayload | null {
  if (!isPositiveIdString(node.id)) {
    return null;
  }
  return {
    nodeId: node.id,
    fileName: node.name,
    sizeBytes: normalizeSizeBytes(node.sizeBytes),
    level: node.level,
  };
}

/**
 * 本机上传结果 → 待发载荷。
 *
 * <p>{@code level} 传 `undefined`（未知）而不是替一个默认密级：密级由服务端在落库时
 * 决定（继承目录策略 / 默认值），上传响应里没有这个字段。在这里猜一个「低」会让附件
 * 卡片显示一个服务端从没答应过的密级，比留空更有害。</p>
 *
 * @returns 上传没回条目 ID（旧后端 / 异常响应）时返回 null，由调用方提示用户去文件页确认
 */
export function uploadedFileToPayload(
  task: Pick<UploadTaskView, 'nodeId' | 'fileName' | 'size'>,
): FileDragPayload | null {
  if (!isPositiveIdString(task.nodeId)) {
    return null;
  }
  return {
    nodeId: task.nodeId as string,
    fileName: task.fileName,
    sizeBytes: normalizeSizeBytes(task.size),
    level: undefined,
  };
}

/** 上传是否仍在推进（入口禁用与进度条展示共用同一口径）。 */
export function isUploadBusy(task: Pick<UploadTaskView, 'status'>): boolean {
  return ACTIVE_UPLOAD_STATUSES.includes(task.status);
}
