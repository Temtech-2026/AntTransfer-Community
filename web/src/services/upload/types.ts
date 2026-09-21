/** 分片上传领域类型（与 docs/architecture/use-case-flows.md §1.1 契约对齐） */

/** 秒传预检入参 */
export interface PrecheckPayload {
  fileName: string;
  sizeBytes: number;
  /** 全文件 SHA-256（小写十六进制），秒传唯一键 */
  sha256: string;
  /** 业务附加字段（如 spaceId / parentId），透传给后端 */
  [key: string]: unknown;
}

/** 预检命中：秒传完成 */
export interface PrecheckHit {
  instant: true;
  fileId: string;
}

/** 预检未命中：拿到上传票据，进入分片上传 */
export interface PrecheckMiss {
  instant: false;
  uploadId: string;
  chunkSize: number;
  chunkCount: number;
}

export type PrecheckResult = PrecheckHit | PrecheckMiss;

/** 分片清单查询结果（断点续传权威来源） */
export interface PartStatus {
  /** 服务端已确认收到的分片索引 */
  received: number[];
  /** 服务端侧分片大小（可用于纠正前端本地配置） */
  chunkSize?: number;
  /** 服务端侧分片总数（可选，便于校验前端切片是否与后端一致） */
  chunkCount?: number;
  /**
   * 服务端任务状态（`sys_upload_task.status`，仅续传对账用）。
   *
   * 与本地 `UploadTaskStatus` 不是同一套词表：本地状态含 `hashing`/`prechecking`
   * 等纯前端阶段，服务端只有 `0 排队 / 1 传输中 / 2 已暂停 / 3 完成 …`。
   * 续传时若服务端仍是 `2`，说明「暂停」已在服务端落地而本地已在续传，需要上报恢复追平。
   */
  status?: number;
}

/** 分片上传结果 */
export interface PartUploadedResult {
  /** 服务端回执中的已收分片索引（若返回） */
  received?: number[];
}

/** 合并结果 */
export interface MergeResult {
  fileId: string;
  sha256?: string;
}

/** 任务状态（前端展示用状态机） */
export type UploadTaskStatus =
  | 'pending'
  | 'hashing'
  | 'prechecking'
  | 'querying'
  | 'uploading'
  | 'paused'
  | 'merging'
  | 'success'
  | 'error'
  | 'canceled';

/** 分片级状态 */
export type ChunkStatus = 'pending' | 'uploading' | 'done' | 'error';

/** 单文件任务视图（Hook 对外暴露的快照） */
export interface UploadTaskView {
  /** 本地任务 id */
  id: string;
  fileName: string;
  size: number;
  status: UploadTaskStatus;
  /** 0~100，仅按「已上传字节 / 总字节」推进，保证单调不回退 */
  progress: number;
  /** 已上传字节 */
  uploadedBytes: number;
  /** 字节/秒（滑动窗口估算） */
  speed: number;
  /** 服务端上传票据 */
  uploadId?: string;
  /** 秒传命中或合并完成后返回的文件 id */
  fileId?: string;
  /** 是否秒传命中（未实际传输字节） */
  instant: boolean;
  chunkSize: number;
  chunkCount: number;
  /** 服务端已确认的分片索引（升序） */
  received: number[];
  /** 已发生的自动重试次数（累计） */
  retryCount: number;
  /** 上一次失败原因（面向用户的文案） */
  errorMessage?: string;
  /** 本次任务耗时（毫秒），完成后冻结 */
  elapsedMs: number;
}

/** 本地断点缓存记录（仅缓存辅助：权威状态是服务端分片清单） */
export interface UploadRecord {
  /** 匹配键：名称 + 大小 + 最后修改时间 */
  key: string;
  fileName: string;
  size: number;
  lastModified: number;
  /** 服务端上传票据；为 null 表示尚未预检 */
  uploadId: string | null;
  chunkSize: number;
  chunkCount: number;
  /** 本地缓存的服务端已收分片快照（用于刷新后先展示进度） */
  received: number[];
  /**
   * 上次会话算出的全文件摘要。**不用于跳过哈希**（分片摘要无法在此经济地缓存，
   * 而文件摘要与分片摘要同源一次读取），只用于识别「同名同大小但内容已变」的文件：
   * 摘要对不上就作废票据重传，避免把旧分片与新文件合并成损坏文件。
   */
  sha256: string | null;
  status: UploadTaskStatus;
  updatedAt: number;
}

/** 刷新后可续传任务（用于 UI 提示「重新选择同一文件即可续传」） */
export interface ResumableRecord {
  key: string;
  fileName: string;
  size: number;
  lastModified: number;
  uploadId: string | null;
  chunkCount: number;
  receivedCount: number;
  /** 进度百分比（基于本地缓存的 received 快照，仅供参考） */
  progress: number;
  updatedAt: number;
}
