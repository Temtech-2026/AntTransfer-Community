/**
 * 哈希 Worker：一次遍历同时算出**分片 SHA-256** 与**全文件 SHA-256**。
 *
 * 为什么放在 Worker：10 GiB 文件的哈希是纯 CPU 的分钟级任务，放主线程会冻结 UI
 * （进度条都不动）。放这里后主线程只收进度消息。
 *
 * 两个摘要共用一趟读取：每读 4 MiB →
 *   ① 用原生 `crypto.subtle.digest` 算该片摘要（快，且服务端要逐片校验）；
 *   ② 把同一段字节喂给增量 {@link Sha256} 更新全件状态（流式，内存 O(1) 片）。
 *
 * 协议见 `hashWorkerClient.ts`。
 */

import { Sha256 } from '../utils/sha256';

const ctx = self as unknown as {
  postMessage: (message: unknown) => void;
  onmessage: ((event: MessageEvent) => void) | null;
};

interface HashRequest {
  type: 'hash';
  jobId: string;
  file: Blob;
  chunkSize: number;
}

interface AbortRequest {
  type: 'abort';
  jobId: string;
}

type WorkerRequest = HashRequest | AbortRequest;

/** 当前在跑的任务 id；收到 abort 即置空，循环下一轮自然退出 */
let currentJobId: string | null = null;

/** 原生 SHA-256；环境不支持时返回 null，由调用方回退到纯 JS 实现 */
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

async function runHash(request: HashRequest): Promise<void> {
  const { jobId, file, chunkSize } = request;
  const total = file.size;
  const chunkCount = Math.max(1, Math.ceil(total / chunkSize));
  const hasher = new Sha256();
  const chunkHashes: string[] = [];
  let processed = 0;

  for (let index = 0; index < chunkCount; index += 1) {
    // 被中止：静默退出，由主线程负责 reject
    if (currentJobId !== jobId) {
      return;
    }
    const start = index * chunkSize;
    const blob = file.slice(start, Math.min(start + chunkSize, total));
    const buffer = await blob.arrayBuffer();

    hasher.update(new Uint8Array(buffer));
    const hash =
      (await nativeSha256(buffer)) ??
      new Sha256().update(new Uint8Array(buffer)).hex();
    chunkHashes.push(hash);

    processed += buffer.byteLength;
    ctx.postMessage({
      type: 'chunk-hash',
      jobId,
      index,
      hash,
    });
    ctx.postMessage({
      type: 'progress',
      jobId,
      index,
      chunkCount,
      processed,
      total,
      percent: total > 0 ? Math.round((processed / total) * 100) : 100,
    });
  }

  if (currentJobId !== jobId) {
    return;
  }
  ctx.postMessage({
    type: 'done',
    jobId,
    fileHash: hasher.hex(),
    chunkHashes,
  });
}

ctx.onmessage = (event: MessageEvent) => {
  const request = event.data as WorkerRequest;
  if (!request || typeof request !== 'object') {
    return;
  }

  if (request.type === 'abort') {
    if (currentJobId === request.jobId) {
      currentJobId = null;
    }
    return;
  }

  if (request.type === 'hash') {
    currentJobId = request.jobId;
    runHash(request).catch((error: unknown) => {
      ctx.postMessage({
        type: 'error',
        jobId: request.jobId,
        message: (error as Error)?.message ?? '哈希计算失败',
      });
    });
  }
};
