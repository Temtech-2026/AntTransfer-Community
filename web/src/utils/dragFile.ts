/**
 * 「从文件区拖一个文件到聊天抽屉」的跨组件协议。
 *
 * <p>用自定义 MIME 而不是 {@code text/plain}：
 * <ul>
 *   <li>带自定义类型时，浏览器只在**本应用内**的拖拽里携带数据，
 *       从桌面拖进来的文件不会命中（那条路径要的是真正的文件上传，语义不同）；</li>
 *   <li>解析必须容错：{@code dataTransfer} 的内容来自页面自身，但中间可能有
 *       其它库写过同名键，且 JSON 解析失败不该让投递流程抛异常。</li>
 * </ul>
 *
 * <p>这些函数是纯函数，便于单测覆盖「脏数据 → null」的回落分支。
 */

/** 拖拽载荷的 MIME 类型。 */
export const FILE_DRAG_MIME = 'application/x-anttransfer-file';

/** 拖拽载荷：只带渲染卡片所需的最小字段，不传整个 FileNode。 */
export interface FileDragPayload {
  /** 文件主键（发送消息时只做引用，不重新上传） */
  fileId: number;
  fileName: string;
  /** 字节数；未知传 0 */
  sizeBytes: number;
  /** 密级：1-低 2-中 3-高，未知传 undefined */
  level?: number | null;
}

/** 把载荷写入拖拽数据（拖拽源调用）。 */
export function writeDragPayload(
  dataTransfer: DataTransfer | null | undefined,
  payload: FileDragPayload,
): void {
  if (!dataTransfer) {
    return;
  }
  try {
    dataTransfer.setData(FILE_DRAG_MIME, JSON.stringify(payload));
    // 兼容「只认纯文本」的投放区（例如第三方富文本输入框）
    dataTransfer.setData('text/plain', payload.fileName);
    dataTransfer.effectAllowed = 'copy';
  } catch {
    // 浏览器拒绝写入（极老的实现）：静默失败，投递区自会按「无载荷」处理
  }
}

function isPayload(value: unknown): value is FileDragPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.fileId === 'number' &&
    Number.isFinite(record.fileId) &&
    typeof record.fileName === 'string' &&
    record.fileName.length > 0 &&
    typeof record.sizeBytes === 'number' &&
    Number.isFinite(record.sizeBytes)
  );
}

/**
 * 从拖拽数据解析载荷。
 *
 * @returns 非本应用拖拽、或数据损坏时返回 null（调用方据此忽略这次拖拽）
 */
export function readDragPayload(
  dataTransfer: DataTransfer | null | undefined,
): FileDragPayload | null {
  if (!dataTransfer) {
    return null;
  }
  // 有些实现（含部分 WebKit）在 dragover 之外读不到自定义类型，因此两种都试
  const raw =
    dataTransfer.getData(FILE_DRAG_MIME) || dataTransfer.getData('text/plain');
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** 判断本次拖拽是否携带本应用的载荷（用于 dragover 时决定是否允许投放）。 */
export function hasDragPayload(
  dataTransfer: DataTransfer | null | undefined,
): boolean {
  if (!dataTransfer) {
    return false;
  }
  const types = Array.from(dataTransfer.types ?? []);
  return types.includes(FILE_DRAG_MIME);
}

/** 把载荷格式化成聊天消息正文（免附件表，纯文本引用）。 */
export function toChatContent(payload: FileDragPayload, sizeText: string): string {
  return `${payload.fileName}（${sizeText}）`;
}
