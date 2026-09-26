/**
 * 分片上传引擎（框架无关，便于单测）。
 *
 * 单文件流水线（对齐 use-case-flows §1.1）：
 *   hashing → prechecking →(命中即秒传)→ querying(服务端分片清单) → uploading → merging → success
 *
 * 关键设计决定：
 * - **断点续传以服务端清单为权威**：每次进入 uploading 前都先 GET parts；
 *   localStorage 只负责「认出同一份文件」+ 复用已算好的 SHA-256；
 * - **进度单调不回退**：仅由「已上传字节 / 总字节」推进并取高水位（PRD US-01），
 *   哈希阶段不占用进度条，用文案表达；
 * - **暂停 = abort 在途请求 + 保留服务端已收分片 + 上报服务端登记意图**；
 *   **取消 = abort + 通知服务端清理 + 清本地记录**；
 *   暂停上报是尽力而为的（失败只影响服务端状态显示），服务端也刻意不把「已暂停」当闸门——
 *   分片写入与 abort 天然竞态，当闸门只会制造一批无意义的 4102；
 * - 重试用指数退避，只对可重试错误（网络 / 5xx / 429 / 超并发）生效；
 *   4003 完整性失败、4101 票据失效不重试。
 */

import { translateMessage } from '@/requestErrorConfig';
import {
  computeFileHashes,
  type FileHashResult,
} from '@/workers/hashWorkerClient';
import { normalizeChunkSize, normalizeConcurrency, sliceChunk } from './chunk';
import {
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_BASE_DELAY_MS,
  MAX_RETRY_DELAY_MS,
} from './constants';
import type { PartPayloadMode } from './endpoints';
import { isAbortError, UploadAbortError } from './errors';
import type {
  ResumableRecord,
  UploadTaskStatus,
  UploadTaskView,
} from './types';
import {
  CODE_UPLOAD_TASK_NOT_FOUND,
  cancelUpload,
  changeTaskState,
  fetchPartStatus,
  mergeParts,
  precheck,
  TASK_STATUS_PAUSED,
  UploadApiError,
  uploadPart,
} from './uploadApi';
import {
  createRecord,
  findRecordByFile,
  listResumable,
  matchKey,
  pruneRecords,
  removeRecord,
  saveRecord,
} from './uploadStore';

/** Hook 可配置项 */
export interface ChunkUploadOptions {
  /** 分片大小，默认 4 MiB，上限 8 MiB（契约） */
  chunkSize?: number;
  /** 单文件并发分片数，默认 3，上限 5（契约） */
  concurrency?: number;
  /** 失败自动重试次数，默认 3 */
  maxRetries?: number;
  /** 指数退避基数（毫秒），默认 500 */
  retryBaseDelayMs?: number;
  /** 预检附带业务字段（如 spaceId / parentId） */
  precheckExtra?: Record<string, unknown>;
  /** 单片超时（毫秒），默认 120000；0 表示不限 */
  partTimeoutMs?: number;
  /** 分片请求体形态，默认 multipart */
  partPayloadMode?: PartPayloadMode;
  /** 是否启用 localStorage 断点缓存，默认 true */
  persist?: boolean;
  /** 退避等待实现（测试注入以跳过真实等待） */
  sleep?: (ms: number) => Promise<void>;
  onTaskSuccess?: (task: UploadTaskView) => void;
  onTaskError?: (task: UploadTaskView) => void;
  onAllFinished?: (tasks: UploadTaskView[]) => void;
}

interface InternalTask {
  id: string;
  key: string;
  file: File;
  fileName: string;
  size: number;
  lastModified: number;
  status: UploadTaskStatus;
  chunkSize: number;
  chunkCount: number;
  /** 生成 chunkHashes 时所用的分片大小，用于判断是否需重算 */
  hashedChunkSize: number;
  /**
   * 分片请求体形态快照：入队时取一次，之后不再跟随 options 变化。
   *
   * <p>因此运行中切换上传方式只影响**之后加入的任务**，同一次上传的前后分片
   * 不会混用两种请求体（表单与裸流的服务端接收方式互不兼容）。</p>
   */
  partPayloadMode?: PartPayloadMode;
  uploadId?: string;
  fileId?: string;
  /** 引用条目 ID（`sys_file_node.id`）；上传成功后对外引用这份文件用的是它，不是 fileId */
  nodeId?: string;
  instant: boolean;
  sha256?: string;
  /** 上次会话缓存的摘要，用于识别「同名同大小但内容已变」的文件 */
  cachedSha256?: string;
  chunkHashes: string[];
  received: Set<number>;
  /** 已完成分片的字节数 */
  doneBytes: number;
  /** 在途分片的已发送字节（key = 分片索引） */
  inflight: Map<number, number>;
  progress: number;
  speed: number;
  speedAt: number;
  speedBytes: number;
  retryCount: number;
  errorMessage?: string;
  startedAt: number;
  finishedAt: number;
  controller: AbortController;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** 指数退避 + 抖动：base * 2^(attempt-1)，封顶 {@link MAX_RETRY_DELAY_MS} */
export function backoffDelay(
  attempt: number,
  baseMs = DEFAULT_RETRY_BASE_DELAY_MS,
): number {
  const raw = Math.min(
    baseMs * 2 ** Math.max(0, attempt - 1),
    MAX_RETRY_DELAY_MS,
  );
  // 抖动 ±20%，避免一批分片同时重试形成「重试风暴」
  return Math.round(raw * (0.8 + Math.random() * 0.4));
}

const TERMINAL: UploadTaskStatus[] = ['success', 'error', 'canceled'];
export const isTerminalStatus = (status: UploadTaskStatus): boolean =>
  TERMINAL.includes(status);

function sumValues(map: Map<number, number>): number {
  let total = 0;
  for (const value of map.values()) {
    total += value;
  }
  return total;
}

/** 已收分片对应的字节数（用于恢复 doneBytes） */
function receivedBytes(
  received: Set<number>,
  chunkSize: number,
  fileSize: number,
): number {
  let bytes = 0;
  for (const index of received) {
    const start = index * chunkSize;
    bytes += Math.max(0, Math.min(start + chunkSize, fileSize) - start);
  }
  return Math.min(bytes, fileSize);
}

function toMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return translateMessage('upload.error.generic');
}

export class ChunkUploadController {
  private readonly options: ChunkUploadOptions;
  private readonly sleep: (ms: number) => Promise<void>;
  private tasks = new Map<string, InternalTask>();
  private listeners = new Set<() => void>();
  private snapshot: UploadTaskView[] = [];
  private resumableSnapshot: ResumableRecord[] = [];
  private seq = 0;
  private notifyScheduled = false;

  constructor(options: ChunkUploadOptions = {}) {
    this.options = options;
    this.sleep = options.sleep ?? defaultSleep;
    if (this.persistEnabled) {
      pruneRecords();
      this.resumableSnapshot = listResumable();
    }
  }

  private get persistEnabled(): boolean {
    return this.options.persist !== false;
  }

  /* ------------------------------ 订阅 ------------------------------ */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** 稳定引用快照（useSyncExternalStore 要求同一数据返回同一引用） */
  getSnapshot = (): UploadTaskView[] => this.snapshot;

  getResumable = (): ResumableRecord[] => this.resumableSnapshot;

  /** 合并同一帧内的多次变更，避免进度更新引发渲染风暴 */
  private scheduleNotify(): void {
    if (this.notifyScheduled) {
      return;
    }
    this.notifyScheduled = true;
    const flush = () => {
      this.notifyScheduled = false;
      this.rebuildSnapshot();
      for (const listener of this.listeners) {
        listener();
      }
    };
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(flush);
    } else {
      setTimeout(flush, 0);
    }
  }

  private rebuildSnapshot(): void {
    this.snapshot = Array.from(this.tasks.values()).map((task) =>
      this.toView(task),
    );
    if (this.persistEnabled) {
      this.resumableSnapshot = listResumable();
    }
  }

  private toView(task: InternalTask): UploadTaskView {
    return {
      id: task.id,
      fileName: task.fileName,
      size: task.size,
      status: task.status,
      progress: task.progress,
      uploadedBytes: Math.min(
        task.size,
        task.doneBytes + sumValues(task.inflight),
      ),
      speed: task.status === 'uploading' ? task.speed : 0,
      uploadId: task.uploadId,
      fileId: task.fileId,
      nodeId: task.nodeId,
      instant: task.instant,
      chunkSize: task.chunkSize,
      chunkCount: task.chunkCount,
      received: Array.from(task.received).sort((a, b) => a - b),
      retryCount: task.retryCount,
      errorMessage: task.errorMessage,
      elapsedMs:
        (task.finishedAt || Date.now()) - (task.startedAt || Date.now()),
    };
  }

  /* ------------------------------ 对外操作 ------------------------------ */

  /**
   * 加入待上传文件。
   *
   * 若 localStorage 里有同一份文件（名称 + 大小 + 最后修改时间一致）的未完成记录，
   * 该任务自动进入续传模式：复用已算摘要与 uploadId，只补传缺失分片。
   */
  addFiles(files: File[] | FileList, autoStart = true): string[] {
    const ids: string[] = [];
    for (const file of Array.from(files)) {
      const key = matchKey(file);
      const existing = Array.from(this.tasks.values()).find(
        (task) => task.key === key && task.status !== 'canceled',
      );
      if (existing) {
        ids.push(existing.id);
        if (autoStart && existing.status === 'paused') {
          void this.resume(existing.id);
        }
        continue;
      }

      const record = this.persistEnabled ? findRecordByFile(file) : null;
      const chunkSize = normalizeChunkSize(
        file.size,
        record?.chunkSize || this.options.chunkSize,
      );
      this.seq += 1;
      const task: InternalTask = {
        id: `upload-${this.seq}`,
        key,
        file,
        fileName: file.name,
        size: file.size,
        lastModified: file.lastModified,
        status: 'pending',
        chunkSize,
        chunkCount: Math.max(1, Math.ceil(file.size / chunkSize) || 1),
        hashedChunkSize: 0,
        partPayloadMode: this.options.partPayloadMode,
        uploadId: record?.uploadId ?? undefined,
        instant: false,
        // 不复用缓存摘要来跳过哈希：分片摘要无法在 localStorage 里经济地缓存
        // （10 GiB 文件上千条），而文件摘要与分片摘要出自同一趟读取，单独复用省不下 IO。
        // 缓存里真正有价值的是 uploadId + received（避免重传已完成的 GiB 级分片）。
        cachedSha256: record?.sha256 ?? undefined,
        chunkHashes: [],
        received: new Set(record?.received ?? []),
        doneBytes: 0,
        inflight: new Map(),
        progress: 0,
        speed: 0,
        speedAt: 0,
        speedBytes: 0,
        retryCount: 0,
        startedAt: 0,
        finishedAt: 0,
        controller: new AbortController(),
      };
      task.doneBytes = receivedBytes(task.received, chunkSize, file.size);
      this.tasks.set(task.id, task);
      if (this.persistEnabled) {
        saveRecord(
          createRecord({
            key,
            fileName: task.fileName,
            size: task.size,
            lastModified: task.lastModified,
            chunkSize,
            chunkCount: task.chunkCount,
            status: 'pending',
          }),
        );
      }
      ids.push(task.id);
      if (autoStart) {
        void this.run(task);
      }
    }
    this.scheduleNotify();
    return ids;
  }

  /** 继续：暂停后继续 / 失败重试 */
  resume(id: string): Promise<void> {
    const task = this.tasks.get(id);
    if (!task || task.status === 'uploading' || task.status === 'hashing') {
      return Promise.resolve();
    }
    if (task.controller.signal.aborted) {
      task.controller = new AbortController();
    }
    task.errorMessage = undefined;
    return this.run(task);
  }

  /**
   * 暂停：中止在途请求，保留服务端已收分片（下次只传缺失片），并上报服务端登记意图。
   *
   * 上报是**不 await 的**：暂停必须同步「立即止血」，网络往返不能挡在 `abort()` 后面；
   * 上报失败也只是服务端状态显示不准，续传能力不受影响（服务端允许暂停态分片落库）。
   */
  pause(id: string): void {
    const task = this.tasks.get(id);
    if (!task || isTerminalStatus(task.status)) {
      return;
    }
    task.controller.abort();
    task.inflight.clear();
    task.status = 'paused';
    if (task.uploadId) {
      void changeTaskState(task.uploadId, 'pause');
    }
    this.scheduleNotify();
  }

  /**
   * 运行时调整并发分片数（「极速模式」开关）。
   *
   * <p>并发数在每轮分片调度时才被读取（见 `uploadMissingChunks`），
   * 因此调整对正在推进的任务同样生效，不需要重新入队；
   * 越界值由 `normalizeConcurrency` 截断到契约区间。
   */
  setConcurrency(concurrency?: number): void {
    this.options.concurrency = normalizeConcurrency(concurrency);
  }

  pauseAll(): void {
    for (const id of Array.from(this.tasks.keys())) {
      this.pause(id);
    }
  }

  resumeAll(): void {
    for (const task of Array.from(this.tasks.values())) {
      if (task.status === 'paused' || task.status === 'error') {
        void this.resume(task.id);
      }
    }
  }

  retry(id: string): void {
    void this.resume(id);
  }

  /** 取消：中止 + 通知服务端清理临时分片 + 清本地记录 */
  cancel(id: string): void {
    const task = this.tasks.get(id);
    if (!task) {
      return;
    }
    task.controller.abort();
    task.inflight.clear();
    task.status = 'canceled';
    task.errorMessage = undefined;
    if (this.persistEnabled) {
      removeRecord(task.key);
    }
    if (task.uploadId) {
      // 尽力而为：服务端清理失败也不阻塞本地态清理
      void cancelUpload(task.uploadId);
    }
    this.scheduleNotify();
  }

  /** 从列表移除（上传中会先取消） */
  remove(id: string): void {
    const task = this.tasks.get(id);
    if (!task) {
      return;
    }
    if (!isTerminalStatus(task.status)) {
      this.cancel(id);
    } else if (this.persistEnabled) {
      removeRecord(task.key);
    }
    this.tasks.delete(id);
    this.scheduleNotify();
  }

  /** 清空已完成 / 已取消 / 失败任务 */
  clearFinished(): void {
    for (const [id, task] of Array.from(this.tasks.entries())) {
      if (isTerminalStatus(task.status)) {
        this.tasks.delete(id);
      }
    }
    this.scheduleNotify();
  }

  /** 丢弃刷新前遗留的本地记录（UI 上的「忽略」） */
  discardRecord(key: string): void {
    if (this.persistEnabled) {
      removeRecord(key);
      this.scheduleNotify();
    }
  }

  /** 仅释放监听（组件卸载；不销毁任务状态，便于再次挂载后继续） */
  destroy(): void {
    this.listeners.clear();
  }

  /* ------------------------------ 流水线 ------------------------------ */

  /** 已因「服务端票据失效」重启过预检的任务，避免 4101 循环 */
  private resynced = new Set<string>();
  private allFinishedNotified = false;

  private async run(task: InternalTask): Promise<void> {
    if (task.status === 'uploading' && task.startedAt > 0) {
      return; // 防重入
    }
    task.startedAt = task.startedAt || Date.now();
    task.finishedAt = 0;
    this.allFinishedNotified = false;
    const { signal } = task.controller;
    try {
      // ① 全文件 SHA-256 + 分片 SHA-256（Worker）
      if (!task.sha256 || task.hashedChunkSize !== task.chunkSize) {
        this.setStatus(task, 'hashing');
        await this.hashFile(task, signal);
      }

      // ①' 续传一致性校验：同名 / 同大小 / 同修改时间但内容已变（摘要不一致）时，
      //     服务端已收分片不可信，必须作废票据从头开始，否则会合并出损坏文件。
      if (
        task.uploadId &&
        task.cachedSha256 &&
        task.cachedSha256 !== task.sha256
      ) {
        task.uploadId = undefined;
        task.cachedSha256 = undefined;
        task.received = new Set();
        task.doneBytes = 0;
        task.progress = 0;
        this.persist(task);
      }

      // ② 秒传预检
      if (!task.uploadId) {
        this.setStatus(task, 'prechecking');
        const result = await this.withRetry(task, () =>
          precheck({
            fileName: task.fileName,
            sizeBytes: task.size,
            sha256: task.sha256 as string,
            ...this.options.precheckExtra,
          }),
        );
        if (result.instant) {
          this.finishInstant(task, result.fileId, result.nodeId);
          return;
        }
        task.uploadId = result.uploadId;
        await this.applyServerChunking(task, result.chunkSize, signal);
        this.persist(task);
      }

      // ③ 服务端分片清单（断点续传权威来源）
      const phase = await this.syncPartStatus(task);
      if (phase === 'restart') {
        await this.run(task);
        return;
      }

      // ④ 只传缺失分片
      this.setStatus(task, 'uploading');
      const aborted = await this.uploadMissingChunks(task);
      if (aborted) {
        this.onAborted(task);
        return;
      }

      // ⑤ 合并（服务端整件重算 SHA-256 校验）
      this.setStatus(task, 'merging');
      const merged = await this.withRetry(task, () =>
        mergeParts(task.uploadId as string, {
          sha256: task.sha256 as string,
          sizeBytes: task.size,
          chunkCount: task.chunkCount,
        }),
      );
      this.finishSuccess(task, merged.fileId, merged.nodeId);
    } catch (error) {
      if (isAbortError(error)) {
        this.onAborted(task);
        return;
      }
      this.finishError(task, toMessage(error));
    }
  }

  /** 哈希：结果写入任务并落本地缓存（刷新后可免去这次最耗时的计算） */
  private async hashFile(
    task: InternalTask,
    signal: AbortSignal,
  ): Promise<void> {
    const result: FileHashResult = await computeFileHashes(
      task.file,
      task.chunkSize,
      {
        signal,
      },
    );
    task.sha256 = result.fileHash;
    task.chunkHashes = result.chunkHashes;
    task.hashedChunkSize = task.chunkSize;
    this.persist(task);
    this.scheduleNotify();
  }

  /**
   * 对齐服务端下发的分片参数。服务端是切片口径的权威：若其 chunkSize 与本地不同，
   * 本地分片摘要随即失效，必须按新尺寸重算（文件级摘要是流式结果，与切片无关，保留）。
   */
  private async applyServerChunking(
    task: InternalTask,
    serverChunkSize: number,
    signal: AbortSignal,
  ): Promise<void> {
    if (!serverChunkSize || serverChunkSize <= 0) {
      return;
    }
    const next = normalizeChunkSize(task.size, serverChunkSize);
    if (next === task.chunkSize) {
      return;
    }
    task.chunkSize = next;
    task.chunkCount = Math.max(1, Math.ceil(task.size / next) || 1);
    this.setStatus(task, 'hashing');
    await this.hashFile(task, signal);
  }

  /**
   * 查询服务端已收分片。
   * 票据失效（4101）时返回 `'restart'`，由调用方清理本地票据后重走预检。
   */
  private async syncPartStatus(task: InternalTask): Promise<'ok' | 'restart'> {
    this.setStatus(task, 'querying');
    try {
      const status = await this.withRetry(task, () =>
        fetchPartStatus(task.uploadId as string),
      );
      task.received = new Set(status.received);
      task.doneBytes = receivedBytes(task.received, task.chunkSize, task.size);
      this.persist(task);
      // 对账任务状态：能走到这里说明本地正在续传，而服务端若仍是「已暂停」，
      // 只可能是上一次「恢复上报」丢了（暂停上报是尽力而为的）。此处补一次恢复，
      // 让服务端状态自己追平，避免任务在库里永远停在「已暂停」。
      // 信号已 abort 说明用户刚又点了暂停，此时不能反手把它恢复回来。
      if (status.status === TASK_STATUS_PAUSED && !task.controller.signal.aborted) {
        await changeTaskState(task.uploadId as string, 'resume');
      }
      return 'ok';
    } catch (error) {
      if (
        error instanceof UploadApiError &&
        error.code === CODE_UPLOAD_TASK_NOT_FOUND &&
        !this.resynced.has(task.id)
      ) {
        // 服务端任务已过期（默认保留 24h）：本地票据作废，重新预检
        this.resynced.add(task.id);
        task.uploadId = undefined;
        task.received = new Set();
        task.doneBytes = 0;
        task.chunkHashes = [];
        task.hashedChunkSize = 0;
        task.progress = 0;
        this.persist(task);
        return 'restart';
      }
      throw error;
    }
  }

  /** 并发上传缺失分片；返回 true 表示被中止 */
  private async uploadMissingChunks(task: InternalTask): Promise<boolean> {
    const pending: number[] = [];
    for (let index = 0; index < task.chunkCount; index += 1) {
      if (!task.received.has(index)) {
        pending.push(index);
      }
    }
    if (pending.length === 0) {
      return false; // 秒传级别的「已全部在服务端」
    }
    const concurrency = Math.min(
      normalizeConcurrency(this.options.concurrency),
      pending.length,
    );
    let cursor = 0;
    const workers = Array.from({ length: concurrency }, () =>
      this.chunkWorker(task, pending, () => cursor++),
    );
    try {
      await Promise.all(workers);
      return false;
    } catch (error) {
      if (isAbortError(error)) {
        return true;
      }
      throw error;
    }
  }

  /** 单个并发「工人」：不断领取下一个缺失分片，直到取完 */
  private async chunkWorker(
    task: InternalTask,
    pending: number[],
    next: () => number,
  ): Promise<void> {
    for (;;) {
      const position = next();
      if (position >= pending.length) {
        return;
      }
      if (task.controller.signal.aborted) {
        throw new UploadAbortError();
      }
      await this.uploadOneChunk(task, pending[position]);
    }
  }

  /** 上传单片，内含指数退避重试 */
  private async uploadOneChunk(
    task: InternalTask,
    index: number,
  ): Promise<void> {
    let attempt = 0;
    for (;;) {
      try {
        const meta = sliceChunk(task.file, index, task.chunkSize);
        task.inflight.set(index, 0);
        await uploadPart({
          uploadId: task.uploadId as string,
          index,
          blob: meta.blob,
          hash: task.chunkHashes[index],
          signal: task.controller.signal,
          timeoutMs: this.options.partTimeoutMs ?? 120000,
          // 优先用任务自己的快照：切换方式不影响在途任务
          mode: task.partPayloadMode ?? this.options.partPayloadMode,
          onProgress: (loaded) => {
            task.inflight.set(index, Math.min(loaded, meta.size));
            this.recordProgress(task);
            this.recordSpeed(task);
          },
        });
        task.inflight.delete(index);
        task.received.add(index);
        task.doneBytes += meta.size;
        this.recordProgress(task);
        this.recordSpeed(task);
        this.persist(task);
        return;
      } catch (error) {
        task.inflight.delete(index);
        if (isAbortError(error) || task.controller.signal.aborted) {
          throw new UploadAbortError();
        }
        const retryable =
          error instanceof UploadApiError ? error.retryable : true;
        const maxRetries = this.options.maxRetries ?? DEFAULT_MAX_RETRIES;
        if (!retryable || attempt >= maxRetries) {
          throw error;
        }
        attempt += 1;
        task.retryCount += 1;
        this.setStatus(task, 'uploading', toMessage(error));
        await this.sleep(backoffDelay(attempt, this.options.retryBaseDelayMs));
      }
    }
  }

  /** 对幂等步骤（预检 / 清单 / 合并）统一套用指数退避重试 */
  private async withRetry<T>(
    task: InternalTask,
    action: () => Promise<T>,
  ): Promise<T> {
    const maxRetries = this.options.maxRetries ?? DEFAULT_MAX_RETRIES;
    let attempt = 0;
    for (;;) {
      try {
        return await action();
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }
        const retryable =
          error instanceof UploadApiError ? error.retryable : true;
        if (!retryable || attempt >= maxRetries) {
          throw error;
        }
        attempt += 1;
        task.retryCount += 1;
        await this.sleep(backoffDelay(attempt, this.options.retryBaseDelayMs));
        if (task.controller.signal.aborted) {
          throw new UploadAbortError();
        }
      }
    }
  }

  /* ------------------------------ 状态与回调 ------------------------------ */

  private setStatus(
    task: InternalTask,
    status: UploadTaskStatus,
    errorMessage?: string,
  ): void {
    task.status = status;
    if (status === 'uploading' && !errorMessage) {
      task.errorMessage = undefined;
    }
    if (errorMessage) {
      task.errorMessage = errorMessage;
    }
    this.scheduleNotify();
  }

  /** 进度只前进：取高水位，杜绝跳变回退 */
  private recordProgress(task: InternalTask): void {
    if (task.size <= 0) {
      task.progress = Math.max(task.progress, 0);
      return;
    }
    const uploaded = task.doneBytes + sumValues(task.inflight);
    const percent = Math.floor((uploaded / task.size) * 100);
    task.progress = Math.max(task.progress, Math.min(100, percent));
    this.scheduleNotify();
  }

  /** 速率：500ms 采样 + EMA 平滑 */
  private recordSpeed(task: InternalTask): void {
    const now = Date.now();
    const uploaded = task.doneBytes + sumValues(task.inflight);
    if (task.speedAt === 0) {
      task.speedAt = now;
      task.speedBytes = uploaded;
      return;
    }
    const elapsed = now - task.speedAt;
    if (elapsed < 500) {
      return;
    }
    const sample = ((uploaded - task.speedBytes) / elapsed) * 1000;
    task.speed =
      task.speed === 0 ? Math.max(0, sample) : task.speed * 0.7 + sample * 0.3;
    task.speedAt = now;
    task.speedBytes = uploaded;
  }

  /** 落本地缓存（仅辅助信息；权威分片清单始终来自服务端） */
  private persist(task: InternalTask): void {
    if (!this.persistEnabled) {
      return;
    }
    saveRecord({
      key: task.key,
      fileName: task.fileName,
      size: task.size,
      lastModified: task.lastModified,
      uploadId: task.uploadId ?? null,
      chunkSize: task.chunkSize,
      chunkCount: task.chunkCount,
      received: Array.from(task.received).sort((a, b) => a - b),
      sha256: task.sha256 ?? null,
      status: task.status,
      updatedAt: Date.now(),
    });
  }

  private settle(task: InternalTask, status: UploadTaskStatus): void {
    task.status = status;
    task.finishedAt = Date.now();
    task.speed = 0;
    if (status === 'success') {
      task.errorMessage = undefined;
      task.progress = 100;
      if (this.persistEnabled) {
        removeRecord(task.key);
      }
    } else {
      this.persist(task);
    }
    this.scheduleNotify();
    const view = this.toView(task);
    if (status === 'success') {
      this.options.onTaskSuccess?.(view);
    } else if (status === 'error') {
      this.options.onTaskError?.(view);
    }
    this.notifyAllFinished();
  }

  private notifyAllFinished(): void {
    const all = Array.from(this.tasks.values());
    if (
      all.length === 0 ||
      !all.every((task) => isTerminalStatus(task.status))
    ) {
      return;
    }
    if (this.allFinishedNotified) {
      return;
    }
    this.allFinishedNotified = true;
    this.options.onAllFinished?.(this.snapshot);
  }

  private finishInstant(task: InternalTask, fileId: string, nodeId?: string): void {
    task.instant = true;
    task.fileId = fileId || undefined;
    task.nodeId = nodeId || undefined;
    task.doneBytes = task.size;
    task.inflight.clear();
    task.progress = 100;
    this.settle(task, 'success');
  }

  private finishSuccess(task: InternalTask, fileId: string, nodeId?: string): void {
    task.fileId = fileId || undefined;
    task.nodeId = nodeId || undefined;
    task.doneBytes = task.size;
    task.inflight.clear();
    this.settle(task, 'success');
  }

  private finishError(task: InternalTask, message: string): void {
    task.errorMessage = message;
    this.settle(task, 'error');
  }

  /**
   * 中止兜底：仅当信号确实被 abort 时才落 `paused`
   * （`pause()` / `cancel()` 已各自写好终态，此处只防止在途 worker 把状态改花）。
   */
  private onAborted(task: InternalTask): void {
    task.inflight.clear();
    if (!task.controller.signal.aborted || isTerminalStatus(task.status)) {
      return;
    }
    task.status = 'paused';
    this.scheduleNotify();
  }
}
