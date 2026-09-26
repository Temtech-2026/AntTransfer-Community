/**
 * 分片上传引擎的行为测试（网络层与 Worker 均被替换为可控替身）。
 *
 * 覆盖：秒传命中、断点续传只补缺失片、并发上限、指数退避重试、不可重试快速失败、
 * 暂停/继续（含暂停意图上报与续传时的状态对账）、取消清理、
 * 刷新后复用本地记录（跳过重算摘要与预检）。
 */

import { computeFileHashes } from '@/workers/hashWorkerClient';
import {
  ChunkUploadController,
  type ChunkUploadOptions,
} from './ChunkUploadController';
import { UploadAbortError } from './errors';
import type { PartStatus } from './types';
import {
  cancelUpload,
  changeTaskState,
  fetchPartStatus,
  mergeParts,
  precheck,
  TASK_STATUS_PAUSED,
  UploadApiError,
  uploadPart,
} from './uploadApi';
import { clearRecords, findRecordByFile, saveRecord } from './uploadStore';

vi.mock('@/workers/hashWorkerClient', () => ({
  computeFileHashes: vi.fn(),
}));

vi.mock('./uploadApi', () => {
  class MockUploadApiError extends Error {
    code: number;
    httpStatus: number;
    retryable: boolean;
    constructor(init: {
      message: string;
      code?: number;
      httpStatus?: number;
      retryable: boolean;
    }) {
      super(init.message);
      this.name = 'UploadApiError';
      this.code = init.code ?? -1;
      this.httpStatus = init.httpStatus ?? 0;
      this.retryable = init.retryable;
    }
  }
  return {
    UploadApiError: MockUploadApiError,
    UploadAbortError: class extends Error {},
    CODE_UPLOAD_TASK_NOT_FOUND: 4101,
    TASK_STATUS_PAUSED: 2,
    precheck: vi.fn(),
    fetchPartStatus: vi.fn(),
    mergeParts: vi.fn(),
    cancelUpload: vi.fn(),
    changeTaskState: vi.fn(),
    uploadPart: vi.fn(),
  };
});

const mockedHash = vi.mocked(computeFileHashes);
const mockedPrecheck = vi.mocked(precheck);
const mockedParts = vi.mocked(fetchPartStatus);
const mockedUploadPart = vi.mocked(uploadPart);
const mockedMerge = vi.mocked(mergeParts);
const mockedCancel = vi.mocked(cancelUpload);
const mockedTaskState = vi.mocked(changeTaskState);

/** 让出到宏任务，确保所有微任务链已跑完 */
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const flush = async (rounds = 6) => {
  for (let index = 0; index < rounds; index += 1) {
    await tick();
  }
};

const CHUNK = 4;

function makeFile(
  size: number,
  name = 'demo.bin',
  lastModified = 1_700_000_000_000,
) {
  return new File([new Uint8Array(size)], name, { lastModified });
}

function makeController(overrides: Record<string, unknown> = {}) {
  const delays: number[] = [];
  const controller = new ChunkUploadController({
    chunkSize: CHUNK,
    concurrency: 3,
    maxRetries: 3,
    sleep: async (ms: number) => {
      delays.push(ms);
    },
    ...overrides,
  });
  return { controller, delays };
}

/** 分片上传替身：支持并发闸门，便于观察在途数量与中止行为 */
function gateUploads() {
  const state = { inFlight: 0, maxInFlight: 0, indexes: [] as number[] };
  mockedUploadPart.mockImplementation(
    (params) =>
      new Promise<null>((resolve, reject) => {
        state.inFlight += 1;
        state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
        state.indexes.push(params.index);
        let settled = false;
        params.signal?.addEventListener('abort', () => {
          if (!settled) {
            settled = true;
            state.inFlight -= 1;
            reject(new UploadAbortError());
          }
        });
        // 记录放行函数（由测试手动触发完成）
        (state as unknown as { release?: () => void }).release = () => {
          if (!settled) {
            settled = true;
            state.inFlight -= 1;
            resolve(null);
          }
        };
      }),
  );
  return state;
}

beforeEach(() => {
  vi.clearAllMocks();
  clearRecords();
  window.localStorage.clear();

  mockedHash.mockResolvedValue({
    fileHash: 'f'.repeat(64),
    chunkHashes: Array.from({ length: 64 }, (_, index) =>
      `${index}`.padStart(64, 'a'),
    ),
  });
  mockedPrecheck.mockResolvedValue({
    instant: false,
    uploadId: 'u-1',
    chunkSize: CHUNK,
    chunkCount: 0,
  });
  mockedParts.mockResolvedValue({ received: [], chunkSize: CHUNK });
  mockedUploadPart.mockResolvedValue(null);
  mockedMerge.mockResolvedValue({ fileId: 'file-1', nodeId: 'node-1' });
  mockedCancel.mockResolvedValue(undefined);
  mockedTaskState.mockResolvedValue(undefined);
});

describe('ChunkUploadController', () => {
  it('完整流程：秒传未命中 → 查询服务端清单 → 只补缺失分片 → 合并', async () => {
    // 10 字节按 4 字节切片 = 3 片；服务端已收到 0、2
    mockedParts.mockResolvedValue({ received: [0, 2], chunkSize: CHUNK });
    const { controller } = makeController();

    const [taskId] = controller.addFiles([makeFile(10)]);
    await flush();

    const task = controller.getSnapshot()[0];
    expect(task.id).toBe(taskId);
    expect(mockedUploadPart).toHaveBeenCalledTimes(1);
    expect(mockedUploadPart.mock.calls[0][0].index).toBe(1);
    expect(mockedMerge).toHaveBeenCalledWith('u-1', {
      sha256: 'f'.repeat(64),
      sizeBytes: 10,
      chunkCount: 3,
    });
    expect(task.status).toBe('success');
    expect(task.progress).toBe(100);
    expect(task.fileId).toBe('file-1');
    // 条目 ID 必须一路带到任务视图：聊天「上传后直接发送」只有拿到它才能引用这份文件
    expect(task.nodeId).toBe('node-1');
    expect(task.received).toEqual([0, 1, 2]);
    // 完成的任务不留在本地缓存里
    expect(findRecordByFile(makeFile(10))).toBeNull();
  });

  it('秒传命中：不传任何分片、不合并，直接完成', async () => {
    mockedPrecheck.mockResolvedValue({
      instant: true,
      fileId: 'exist-1',
      nodeId: 'node-exist-1',
    });
    const { controller } = makeController();

    controller.addFiles([makeFile(10)]);
    await flush();

    const task = controller.getSnapshot()[0];
    expect(task.status).toBe('success');
    expect(task.instant).toBe(true);
    expect(task.fileId).toBe('exist-1');
    // 秒传复用的是内容，条目是新建的——引用必须用新条目
    expect(task.nodeId).toBe('node-exist-1');
    expect(task.progress).toBe(100);
    expect(mockedUploadPart).not.toHaveBeenCalled();
    expect(mockedMerge).not.toHaveBeenCalled();
  });

  it('并发上限：单文件同时在途分片数不超过配置值', async () => {
    const state = gateUploads();
    const { controller } = makeController({ concurrency: 3 });

    controller.addFiles([makeFile(40)]); // 10 片
    await flush();

    expect(state.inFlight).toBe(3);
    expect(state.maxInFlight).toBe(3);
  });

  it('失败自动重试 3 次：指数退避后成功，并累计重试次数', async () => {
    let attempts = 0;
    mockedUploadPart.mockImplementation(async () => {
      attempts += 1;
      if (attempts <= 2) {
        throw new UploadApiError({ message: '网络异常', retryable: true });
      }
      return null;
    });
    const { controller, delays } = makeController();

    controller.addFiles([makeFile(4)]); // 1 片
    await flush();

    const task = controller.getSnapshot()[0];
    expect(task.status).toBe('success');
    expect(task.retryCount).toBe(2);
    expect(delays).toHaveLength(2);
    expect(delays[1]).toBeGreaterThan(delays[0]);
  });

  it('不可重试错误：立即失败，不做无谓重试（如 4003 完整性失败）', async () => {
    mockedUploadPart.mockRejectedValue(
      new UploadApiError({
        message: '文件校验失败，请重新上传',
        code: 4003,
        retryable: false,
      }),
    );
    const { controller, delays } = makeController();

    controller.addFiles([makeFile(4)]);
    await flush();

    const task = controller.getSnapshot()[0];
    expect(task.status).toBe('error');
    expect(task.retryCount).toBe(0);
    expect(task.errorMessage).toBe('文件校验失败，请重新上传');
    expect(delays).toHaveLength(0);
    // 失败任务保留本地记录，供刷新后重试
    expect(findRecordByFile(makeFile(4))).not.toBeNull();
  });

  it('暂停不置错、继续只补缺失分片', async () => {
    const state = gateUploads();
    const { controller } = makeController({ concurrency: 2 });

    controller.addFiles([makeFile(16)]); // 4 片
    await flush();
    expect(state.inFlight).toBe(2);

    controller.pause(controller.getSnapshot()[0].id);
    await flush();
    const paused = controller.getSnapshot()[0];
    expect(paused.status).toBe('paused');
    expect(paused.errorMessage).toBeUndefined();

    // 恢复：服务端此时已收到第 0 片
    const callsBeforeResume = mockedUploadPart.mock.calls.length;
    mockedParts.mockResolvedValue({ received: [0], chunkSize: CHUNK });
    mockedUploadPart.mockResolvedValue(null);
    await controller.resume(paused.id);
    await flush();

    const task = controller.getSnapshot()[0];
    expect(task.status).toBe('success');
    // 第二次进入上传阶段时只需补 1、2、3 三片（0 已被服务端确认；1 虽在暂停时被中止，
    // 但服务端未确认收妥，必须重传 —— 重传是幂等的）
    const uploadedIndexes = mockedUploadPart.mock.calls
      .slice(callsBeforeResume)
      .map((call) => call[0].index);
    expect(uploadedIndexes).toEqual([1, 2, 3]);
    expect(task.received).toEqual([0, 1, 2, 3]);
  });

  it('暂停：上报服务端登记意图，且不等往返就本地生效', async () => {
    gateUploads();
    // 上报挂起不 resolve：若 `pause()` 还在等它，本地状态就不会变成 paused
    let settleReport!: () => void;
    mockedTaskState.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          settleReport = resolve;
        }),
    );
    const { controller } = makeController();

    controller.addFiles([makeFile(16)]);
    await flush();

    controller.pause(controller.getSnapshot()[0].id);
    await flush();

    expect(mockedTaskState).toHaveBeenCalledWith('u-1', 'pause');
    expect(controller.getSnapshot()[0].status).toBe('paused');
    settleReport();
  });

  it('暂停：票据还没生成时不发无意义的上报', async () => {
    // 卡在摘要计算阶段：此时服务端还没有任何任务，暂停无处可报
    type HashResult = Awaited<ReturnType<typeof computeFileHashes>>;
    let releaseHash!: (value: HashResult) => void;
    mockedHash.mockImplementation(
      () =>
        new Promise<HashResult>((resolve) => {
          releaseHash = resolve;
        }),
    );
    gateUploads();
    const { controller } = makeController();

    controller.addFiles([makeFile(16)]);
    await flush();

    const [task] = controller.getSnapshot();
    expect(task).toBeDefined();
    controller.pause(task.id);
    await flush();

    expect(controller.getSnapshot()[0].status).toBe('paused');
    expect(mockedTaskState).not.toHaveBeenCalled();

    releaseHash({
      fileHash: 'f'.repeat(64),
      chunkHashes: Array.from({ length: 64 }, (_, index) =>
        `${index}`.padStart(64, 'a'),
      ),
    });
    await flush();
  });

  it('续传对账：服务端仍停在已暂停态时补一次恢复上报', async () => {
    mockedParts.mockResolvedValue({
      received: [0],
      chunkSize: CHUNK,
      status: TASK_STATUS_PAUSED,
    });
    const { controller } = makeController();

    controller.addFiles([makeFile(16)]);
    await flush();

    // 上一次恢复上报丢了也不会把任务永远留在「已暂停」：对账时自愈
    expect(mockedTaskState).toHaveBeenCalledTimes(1);
    expect(mockedTaskState).toHaveBeenCalledWith('u-1', 'resume');
    expect(controller.getSnapshot()[0].status).toBe('success');
  });

  it('续传对账：对账期间用户又点了暂停，就不再把任务恢复回来', async () => {
    let release!: (status: PartStatus) => void;
    mockedParts.mockImplementation(
      () =>
        new Promise<PartStatus>((resolve) => {
          release = resolve;
        }),
    );
    const { controller } = makeController();

    controller.addFiles([makeFile(16)]);
    await flush();

    controller.pause(controller.getSnapshot()[0].id);
    release({ received: [], chunkSize: CHUNK, status: TASK_STATUS_PAUSED });
    await flush();

    // 只剩 pause 那一次上报，不能再补一次 resume 把用户刚点的暂停顶掉
    expect(mockedTaskState).toHaveBeenCalledTimes(1);
    expect(mockedTaskState).toHaveBeenCalledWith('u-1', 'pause');
  });

  it('取消：通知服务端清理、清空本地记录并置终态', async () => {
    gateUploads();
    const { controller } = makeController();

    controller.addFiles([makeFile(16)]);
    await flush();
    const taskId = controller.getSnapshot()[0].id;
    expect(findRecordByFile(makeFile(16))).not.toBeNull();

    controller.cancel(taskId);
    await flush();

    expect(mockedCancel).toHaveBeenCalledWith('u-1');
    expect(controller.getSnapshot()[0].status).toBe('canceled');
    expect(findRecordByFile(makeFile(16))).toBeNull();
  });

  it('刷新后恢复：复用票据跳过预检，只补缺失分片', async () => {
    const file = makeFile(16);
    saveRecord({
      key: `${file.name}::${file.size}::${file.lastModified}`,
      fileName: file.name,
      size: file.size,
      lastModified: file.lastModified,
      uploadId: 'u-old',
      chunkSize: CHUNK,
      chunkCount: 4,
      received: [0, 1],
      sha256: 'f'.repeat(64), // 与本次实算摘要一致 → 内容未变，票据可复用
      status: 'uploading',
      updatedAt: Date.now(),
    });
    mockedParts.mockResolvedValue({ received: [0, 1], chunkSize: CHUNK });
    const { controller } = makeController();

    controller.addFiles([file]);
    await flush();

    // 分片摘要无法在 localStorage 里经济地缓存，故仍需跑一趟哈希（文件摘要与分片摘要同源）
    expect(mockedHash).toHaveBeenCalledTimes(1);
    expect(mockedPrecheck).not.toHaveBeenCalled(); // 票据仍在，无需重新预检
    expect(mockedParts).toHaveBeenCalledWith('u-old');
    expect(mockedUploadPart.mock.calls.map((call) => call[0].index)).toEqual([
      2, 3,
    ]);
    expect(mockedMerge).toHaveBeenCalledWith('u-old', {
      sha256: 'f'.repeat(64),
      sizeBytes: 16,
      chunkCount: 4,
    });
    expect(controller.getSnapshot()[0].status).toBe('success');
  });

  it('同名同大小但内容已变：作废旧票据并重新预检，不复用失效分片', async () => {
    const file = makeFile(8);
    saveRecord({
      key: `${file.name}::${file.size}::${file.lastModified}`,
      fileName: file.name,
      size: file.size,
      lastModified: file.lastModified,
      uploadId: 'u-stale',
      chunkSize: CHUNK,
      chunkCount: 2,
      received: [0],
      sha256: 'stale-hash',
      status: 'uploading',
      updatedAt: Date.now(),
    });
    mockedParts.mockResolvedValue({ received: [], chunkSize: CHUNK });
    const { controller } = makeController();

    controller.addFiles([file]);
    await flush();

    expect(mockedPrecheck).toHaveBeenCalledTimes(1); // 摘要不一致 → 重走预检
    expect(mockedParts).toHaveBeenCalledWith('u-1'); // 旧票据 u-stale 未被查询
    expect(mockedUploadPart).toHaveBeenCalledTimes(2); // 两片全传，不含已失效的 [0]
    expect(mockedMerge).toHaveBeenCalledWith('u-1', {
      sha256: 'f'.repeat(64),
      sizeBytes: 8,
      chunkCount: 2,
    });
    expect(controller.getSnapshot()[0].status).toBe('success');
  });

  it('服务端票据失效（4101）：重新预检并重算分片', async () => {
    const file = makeFile(8);
    saveRecord({
      key: `${file.name}::${file.size}::${file.lastModified}`,
      fileName: file.name,
      size: file.size,
      lastModified: file.lastModified,
      uploadId: 'u-expired',
      chunkSize: CHUNK,
      chunkCount: 2,
      received: [0],
      sha256: 'f'.repeat(64), // 内容未变，用于隔离「票据过期」这一条路径
      status: 'uploading',
      updatedAt: Date.now(),
    });
    let first = true;
    mockedParts.mockImplementation(async (_uploadId: string) => {
      if (first) {
        first = false;
        throw new UploadApiError({
          message: '上传任务不存在或已过期',
          code: 4101,
          retryable: false,
        });
      }
      return { received: [], chunkSize: CHUNK };
    });
    mockedUploadPart.mockResolvedValue(null);
    const { controller } = makeController();

    controller.addFiles([file]);
    await flush(10);

    expect(mockedPrecheck).toHaveBeenCalledTimes(1);
    expect(mockedParts.mock.calls.map((call) => call[0])).toEqual([
      'u-expired',
      'u-1',
    ]);
    expect(mockedUploadPart).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()[0].status).toBe('success');
  });

  it('进度单调不回退，且完成时归零速率', async () => {
    const seen: number[] = [];
    mockedUploadPart.mockImplementation(async (params) => {
      params.onProgress?.(CHUNK);
      return null;
    });
    const { controller } = makeController({ concurrency: 1 });
    const unsubscribe = controller.subscribe(() => {
      const task = controller.getSnapshot()[0];
      if (task) {
        seen.push(task.progress);
      }
    });

    controller.addFiles([makeFile(16)]);
    await flush();
    unsubscribe();

    for (let index = 1; index < seen.length; index += 1) {
      expect(seen[index]).toBeGreaterThanOrEqual(seen[index - 1]);
    }
    const task = controller.getSnapshot()[0];
    expect(task.progress).toBe(100);
    expect(task.speed).toBe(0);
  });

  it('上传方式：入队时快照，运行中切换只影响之后加入的任务', async () => {
    const state = gateUploads();
    const options: ChunkUploadOptions = {
      chunkSize: CHUNK,
      concurrency: 1, // 串行，才能精确控制「第 0 片发出之后」再切
      maxRetries: 3,
      sleep: async () => {},
      partPayloadMode: 'multipart',
    };
    const controller = new ChunkUploadController(options);

    controller.addFiles([makeFile(16)]); // 4 片
    await flush();
    expect(mockedUploadPart).toHaveBeenCalledTimes(1); // 并发 1 → 只有第 0 片在途

    // 在途期间改上传方式：表单与裸流的服务端接收方式互不兼容，
    // 同一次上传必须锁死在入队时的形态上
    options.partPayloadMode = 'octet-stream';
    for (let round = 0; round < 4; round += 1) {
      (state as unknown as { release?: () => void }).release?.();
      await flush();
    }

    expect(mockedUploadPart.mock.calls.map((call) => call[0].mode)).toEqual([
      'multipart',
      'multipart',
      'multipart',
      'multipart',
    ]);
    expect(controller.getSnapshot()[0].status).toBe('success');

    // 新方式从下一个任务开始生效（撤掉闸门，让新任务跑完）
    mockedUploadPart.mockResolvedValue(null);
    controller.addFiles([makeFile(8)]); // 2 片
    await flush();
    expect(
      mockedUploadPart.mock.calls.slice(4).map((call) => call[0].mode),
    ).toEqual(['octet-stream', 'octet-stream']);
  });
});
