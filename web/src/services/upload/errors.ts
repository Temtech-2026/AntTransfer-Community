/** 上传链路的共享错误类型（独立成模块，避免 Worker 端与 API 端互相引用） */

/**
 * 用户主动中止（暂停 / 取消）。
 *
 * 语义上**不是失败**：并发调度器捕获它后不得计入重试、不得置任务为 error。
 */
export class UploadAbortError extends Error {
  constructor(message = '上传已中止') {
    super(message);
    this.name = 'UploadAbortError';
  }
}

/** 判断任意异常是否为「主动中止」 */
export function isAbortError(error: unknown): boolean {
  return (
    error instanceof UploadAbortError ||
    (error as any)?.name === 'UploadAbortError' ||
    (error as any)?.name === 'AbortError'
  );
}
