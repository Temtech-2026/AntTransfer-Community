/**
 * 哈希 Worker 的主线程客户端。
 *
 * 职责：
 * 1. 懒创建 Worker（`new Worker(new URL('./hash.worker.ts', import.meta.url), {type:'module'})`，
 *    由打包器把 worker 单独拆成 chunk）；
 * 2. **任务串行化**——哈希是 CPU 密集任务，N 个文件并发哈希只会互相抢核、
 *    让每个文件都变慢；串行后「先选的文件先算完」体验更可预期；
 * 3. 环境不支持 Worker（SSR / happy-dom / 老浏览器），或 Worker 本身故障
 *    （worker chunk 加载失败、模块 Worker 不受支持、Worker 内抛错 / 内存不足）时
 *    **自动回退主线程**同算法实现，保证功能可用（只是会占用主线程）。
 */

import { translateMessage } from '@/requestErrorConfig';
import { UploadAbortError } from '@/services/upload/errors';
import { Sha256 } from '@/utils/sha256';

/** 哈希进度 */
export interface HashProgressInfo {
  /** 已处理字节 */
  processed: number;
  /** 文件总字节 */
  total: number;
  /** 0~100 */
  percent: number;
  /** 当前分片索引 */
  index: number;
  /** 分片总数 */
  chunkCount: number;
}

/** 哈希结果 */
export interface FileHashResult {
  /** 全文件 SHA-256（秒传键） */
  fileHash: string;
  /** 逐片 SHA-256，下标即分片索引 */
  chunkHashes: string[];
}

export interface ComputeHashOptions {
  onProgress?: (info: HashProgressInfo) => void;
  signal?: AbortSignal;
}

interface WorkerDoneMessage {
  type: 'done';
  jobId: string;
  fileHash: string;
  chunkHashes: string[];
}
interface WorkerProgressMessage extends HashProgressInfo {
  type: 'progress';
  jobId: string;
}
interface WorkerErrorMessage {
  type: 'error';
  jobId: string;
  message: string;
}

type WorkerMessage =
  | WorkerDoneMessage
  | WorkerProgressMessage
  | WorkerErrorMessage;

let worker: Worker | null = null;
let jobSeq = 0;
/** 串行队列：前一个任务（无论成败）结束后再跑下一个 */
let queue: Promise<unknown> = Promise.resolve();

function ensureWorker(): Worker | null {
  if (worker) {
    return worker;
  }
  if (typeof Worker === 'undefined' || typeof URL === 'undefined') {
    return null;
  }
  try {
    worker = new Worker(new URL('./hash.worker.ts', import.meta.url), {
      type: 'module',
    });
    return worker;
  } catch {
    worker = null;
    return null;
  }
}

/** 终止并丢弃当前 Worker（中止任务后调用，下次自动重建） */
function disposeWorker(): void {
  try {
    worker?.terminate();
  } catch {
    // 忽略
  }
  worker = null;
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

async function nativeSha256(buffer: ArrayBuffer): Promise<string | null> {
  const subtle = (globalThis as any).crypto?.subtle;
  if (!subtle?.digest) {
    return null;
  }
  const digest: ArrayBuffer = await subtle.digest('SHA-256', buffer);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/** 主线程回退实现：与 Worker 内算法完全一致，便于相互校验 */
async function runOnMainThread(
  file: Blob,
  chunkSize: number,
  options: ComputeHashOptions,
): Promise<FileHashResult> {
  const total = file.size;
  const chunkCount = Math.max(1, Math.ceil(total / chunkSize));
  const hasher = new Sha256();
  const chunkHashes: string[] = [];
  let processed = 0;

  for (let index = 0; index < chunkCount; index += 1) {
    if (options.signal?.aborted) {
      throw new UploadAbortError();
    }
    const start = index * chunkSize;
    const buffer = await file
      .slice(start, Math.min(start + chunkSize, total))
      .arrayBuffer();
    const bytes = new Uint8Array(buffer);
    hasher.update(bytes);
    chunkHashes.push(
      (await nativeSha256(buffer)) ?? new Sha256().update(bytes).hex(),
    );
    processed += buffer.byteLength;
    options.onProgress?.({
      processed,
      total,
      percent: total > 0 ? Math.round((processed / total) * 100) : 100,
      index,
      chunkCount,
    });
    // 让出主线程，避免长任务把页面卡死
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return { fileHash: hasher.hex(), chunkHashes };
}

/** 在 Worker 中执行一次哈希任务 */
function runInWorker(
  instance: Worker,
  file: Blob,
  chunkSize: number,
  options: ComputeHashOptions,
): Promise<FileHashResult> {
  jobSeq += 1;
  const jobId = `hash-${jobSeq}`;
  return new Promise<FileHashResult>((resolve, reject) => {
    let settled = false;

    function onMessage(event: MessageEvent) {
      const message = event.data as WorkerMessage;
      if (!message || message.jobId !== jobId) {
        return;
      }
      if (message.type === 'progress') {
        options.onProgress?.(message);
        return;
      }
      if (message.type === 'done') {
        finish(() =>
          resolve({
            fileHash: message.fileHash,
            chunkHashes: message.chunkHashes,
          }),
        );
        return;
      }
      if (message.type === 'error') {
        // Worker 只传原始错误信息；缺省时由主线程补本地化文案
        finish(() =>
          reject(new Error(message.message || translateMessage('upload.error.hashFailed'))),
        );
      }
    }

    function onError(event: ErrorEvent) {
      finish(() =>
        reject(
          new Error(event.message || translateMessage('upload.error.hashWorkerFailed')),
        ),
      );
    }

    function onAbort() {
      // 通知 Worker 停下（若它尚未进入下一轮循环），再直接终止该实例
      try {
        instance.postMessage({ type: 'abort', jobId });
      } catch {
        // 忽略
      }
      disposeWorker();
      finish(() => reject(new UploadAbortError()));
    }

    function cleanup() {
      instance.removeEventListener('message', onMessage);
      instance.removeEventListener('error', onError);
      options.signal?.removeEventListener('abort', onAbort);
    }

    function finish(fn: () => void) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      fn();
    }

    instance.addEventListener('message', onMessage);
    instance.addEventListener('error', onError);
    options.signal?.addEventListener('abort', onAbort, { once: true });

    instance.postMessage({ type: 'hash', jobId, file, chunkSize });
  });
}

/**
 * 计算全文件 SHA-256 与各分片 SHA-256。
 *
 * 多次调用会串行执行；`options.signal` 触发中止时立即终止 Worker 并 reject。
 */
export function computeFileHashes(
  file: Blob,
  chunkSize: number,
  options: ComputeHashOptions = {},
): Promise<FileHashResult> {
  return enqueue(async () => {
    if (options.signal?.aborted) {
      throw new UploadAbortError();
    }
    const instance = ensureWorker();
    if (!instance) {
      return runOnMainThread(file, chunkSize, options);
    }
    try {
      return await runInWorker(instance, file, chunkSize, options);
    } catch (error) {
      // 用户主动中止：原样上抛，绝不能当故障处理（否则中止会变成偷偷重算）
      if (error instanceof UploadAbortError) {
        throw error;
      }
      if (options.signal?.aborted) {
        throw new UploadAbortError();
      }
      // Worker 故障：脚本加载失败（打包器 worker chunk 404 / 首次冷启动）、
      // 模块 Worker 不受支持、Worker 内抛错或内存不足。
      // 这类失败与「文件内容」无关，不应让整次上传直接判死——
      // 丢弃可疑实例并回退主线程同算法实现，保证上传能继续（大文件时尤其关键）。
      disposeWorker();
      options.onProgress?.({
        processed: 0,
        total: file.size,
        percent: 0,
        index: 0,
        chunkCount: Math.max(1, Math.ceil(file.size / chunkSize) || 1),
      });
      console.warn(
        '[upload] hash worker unavailable, fallback to main thread:',
        error,
      );
      return runOnMainThread(file, chunkSize, options);
    }
  });
}

/** 释放 Worker（组件卸载 / 页面离开时调用） */
export function disposeHashWorker(): void {
  disposeWorker();
}

/** 关闭 Worker 后重置串行队列（单测隔离用） */
export function resetHashWorkerForTest(): void {
  disposeWorker();
  queue = Promise.resolve();
}
