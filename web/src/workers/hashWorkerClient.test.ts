/**
 * 哈希 Worker 客户端：故障回退主线程的回归测试。
 *
 * 背景：Worker 因「脚本加载失败 / 模块 Worker 不受支持 / 内部抛错 / 内存不足」而报错时，
 * 早期实现会把这个错误直接抛给上传流水线，导致整次上传显示「上传失败」——
 * 首次大文件上传（worker chunk 冷启动 + 文件名片尺寸协商后的二次哈希）最容易踩到。
 * 现在必须回退到主线程同算法实现，且摘要结果与原生实现逐字节一致。
 */

import { UploadAbortError } from '@/services/upload/errors';
import { sha256Hex } from '@/utils/sha256';
import { computeFileHashes, resetHashWorkerForTest } from './hashWorkerClient';

type Listener = (event: any) => void;

/** 可控 Worker 替身：允许测试手动派发 message / error 事件 */
class FakeWorker {
  static instances: FakeWorker[] = [];
  static behavior: ((message: any, self: FakeWorker) => void) | null = null;

  listeners = new Map<string, Set<Listener>>();
  terminated = false;

  constructor(public url: string) {
    FakeWorker.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)?.add(listener);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(message: any) {
    FakeWorker.behavior?.(message, this);
  }

  terminate() {
    this.terminated = true;
  }

  dispatch(type: string, event: any) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener(event);
    }
  }
}

const MB = 1024 * 1024;
const CHUNK_SIZE = 1 * MB;
/** 2.5 MiB → 3 片（含尾片），覆盖非整除切片 */
const FILE_SIZE = 2.5 * MB;

const originalWorker = globalThis.Worker;

function makeBlob(size = FILE_SIZE): Blob {
  const bytes = new Uint8Array(size);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = index % 251;
  }
  return new Blob([bytes]);
}

async function digestOf(blob: Blob): Promise<string> {
  return sha256Hex(new Uint8Array(await blob.arrayBuffer()));
}

describe('hashWorkerClient 故障回退', () => {
  beforeEach(() => {
    resetHashWorkerForTest();
    FakeWorker.instances = [];
    FakeWorker.behavior = null;
    globalThis.Worker = FakeWorker as unknown as typeof Worker;
  });

  afterAll(() => {
    globalThis.Worker = originalWorker;
    resetHashWorkerForTest();
  });

  it('Worker 正常应答时使用 Worker 的结果，不回退主线程', async () => {
    const workerFileHash = 'f'.repeat(64);
    const workerChunkHash = 'a'.repeat(64);
    FakeWorker.behavior = (message, self) => {
      if (message.type !== 'hash') {
        return;
      }
      setTimeout(() => {
        self.dispatch('message', {
          data: {
            type: 'done',
            jobId: message.jobId,
            fileHash: workerFileHash,
            chunkHashes: [workerChunkHash],
          },
        });
      }, 0);
    };

    const result = await computeFileHashes(makeBlob(), CHUNK_SIZE);

    expect(result.fileHash).toBe(workerFileHash);
    expect(result.chunkHashes).toEqual([workerChunkHash]);
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it('Worker 触发 error 事件时回退主线程算出正确摘要', async () => {
    FakeWorker.behavior = (_message, self) => {
      setTimeout(() => {
        self.dispatch('error', { message: 'worker script load failed' });
      }, 0);
    };

    const blob = makeBlob();
    const result = await computeFileHashes(blob, CHUNK_SIZE);

    expect(result.fileHash).toBe(await digestOf(blob));
    expect(result.chunkHashes).toHaveLength(3);
    for (let index = 0; index < 3; index += 1) {
      const start = index * CHUNK_SIZE;
      const slice = blob.slice(start, Math.min(start + CHUNK_SIZE, blob.size));
      expect(result.chunkHashes[index]).toBe(await digestOf(slice));
    }
  });

  it('Worker 回传内部错误时回退主线程', async () => {
    FakeWorker.behavior = (message, self) => {
      setTimeout(() => {
        self.dispatch('message', {
          data: {
            type: 'error',
            jobId: message.jobId,
            message: 'out of memory',
          },
        });
      }, 0);
    };

    const blob = makeBlob();
    const result = await computeFileHashes(blob, CHUNK_SIZE);

    expect(result.fileHash).toBe(await digestOf(blob));
  });

  it('Worker 异常失败后下次任务重建 Worker 并重试', async () => {
    let calls = 0;
    FakeWorker.behavior = (message, self) => {
      calls += 1;
      if (calls === 1) {
        setTimeout(() => {
          self.dispatch('error', { message: 'worker boom' });
        }, 0);
        return;
      }
      setTimeout(() => {
        self.dispatch('message', {
          data: {
            type: 'done',
            jobId: message.jobId,
            fileHash: 'b'.repeat(64),
            chunkHashes: ['c'.repeat(64)],
          },
        });
      }, 0);
    };

    const blob = makeBlob();
    // 第一次：Worker 故障 → 回退主线程
    const first = await computeFileHashes(blob, CHUNK_SIZE);
    expect(first.fileHash).toBe(await digestOf(blob));

    // 第二次：故障实例已被丢弃并重建，重新走 Worker 路径
    const second = await computeFileHashes(blob, CHUNK_SIZE);
    expect(second.fileHash).toBe('b'.repeat(64));
    expect(FakeWorker.instances.length).toBeGreaterThanOrEqual(2);
  });

  it('已中止的信号直接抛 UploadAbortError，不进入 Worker', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      computeFileHashes(makeBlob(), CHUNK_SIZE, { signal: controller.signal }),
    ).rejects.toBeInstanceOf(UploadAbortError);
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it('任务执行中被中止时抛 UploadAbortError，且不偷偷回退主线程重算', async () => {
    // Worker 永不应答，模拟「任务在途」状态
    FakeWorker.behavior = () => {};

    const controller = new AbortController();
    const promise = computeFileHashes(makeBlob(), CHUNK_SIZE, {
      signal: controller.signal,
    });
    // 等串行队列把任务真正投递给 Worker
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();

    await expect(promise).rejects.toBeInstanceOf(UploadAbortError);
  });
});
