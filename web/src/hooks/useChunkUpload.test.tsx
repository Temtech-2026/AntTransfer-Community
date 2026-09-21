/**
 * `useChunkUpload` 的 React 绑定层测试。
 *
 * <p>引擎（{@link ChunkUploadController}）自身的行为已由 `ChunkUploadController.test.ts` 覆盖；
 * 这里钉的是**绑定层独有的四条语义**，这四条错了引擎再对也没用：</p>
 * <ol>
 *   <li><b>卸载不等于中止</b>：上传是「离开页面也要继续」的长任务，
 *       `unmount` 只应解除订阅，不得连带取消传输；</li>
 *   <li><b>同 id 共享、异 id 隔离</b>：队列归属决定顶栏聚合与页面可见性，
 *       串号会让用户看到别人的任务；</li>
 *   <li><b>配置变更走同一 options 引用</b>：并发数等改动应即时生效且不重建控制器，
 *       重建会丢掉在途任务与已完成分片；</li>
 *   <li>用户请求的三条上传分支（秒传命中 / 分片失败重试 / 续传跳过已传分片）
 *       在**经由 Hook 调用**时同样成立——避免「引擎对、接线错」。</li>
 * </ol>
 *
 * <p>网络层（`uploadApi`）与哈希 Worker 整体替换为可控替身，
 * 与 `ChunkUploadController.test.ts` 采用同一套替身，保证两层断言可相互印证。</p>
 */

import { act, cleanup, render } from '@testing-library/react';

import { resetUploadQueueHub, uploadQueueHub } from '@/services/upload/queueHub';
import { UPLOAD_RECORD_STORAGE_KEY } from '@/services/upload/constants';
import { UploadAbortError } from '@/services/upload/errors';
import {
  fetchPartStatus,
  mergeParts,
  precheck,
  UploadApiError,
  uploadPart,
} from '@/services/upload/uploadApi';
import { clearRecords } from '@/services/upload/uploadStore';
import { computeFileHashes } from '@/workers/hashWorkerClient';

import {
  disposeUploadController,
  useChunkUpload,
  type UseChunkUploadOptions,
  type UseChunkUploadResult,
} from './useChunkUpload';

vi.mock('@/workers/hashWorkerClient', () => ({
  computeFileHashes: vi.fn(),
}));

vi.mock('@/services/upload/uploadApi', () => {
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
    CODE_UPLOAD_TASK_NOT_FOUND: 4101,
    // 与 `ChunkUploadController.test.ts` 采用同一套替身：续传对账要用到「服务端已暂停」这一格取值，
    // 以及 best-effort 的 pause / resume 上报函数。替身漏掉它们会让 `undefined === undefined`
    // 误判成「服务端停着」而调用不存在的函数，把任务打成 error（与引擎行为无关）。
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

/** 4 字节一片，便于用小文件精确构造分片数 */
const CHUNK = 4;

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
/** 让出到宏任务，确保哈希 → 预检 → 清单 → 上传 → 合并的微任务链全部跑完 */
const flush = async (rounds = 8) => {
  for (let index = 0; index < rounds; index += 1) {
    await tick();
  }
};

/** 跳过真实退避等待，并把等待时长记下来供断言 */
const noSleep = async () => undefined;

const makeFile = (
  size: number,
  name = 'demo.bin',
  lastModified = 1_700_000_000_000,
) => new File([new Uint8Array(size)], name, { lastModified });

/** 探针组件：把 Hook 返回值捕获到外部变量，避免依赖 renderHook 的版本差异 */
let latest: UseChunkUploadResult;

function Probe({ options }: { options: UseChunkUploadOptions }) {
  latest = useChunkUpload(options);
  return null;
}

const renderHookWith = (options: UseChunkUploadOptions) => {
  const view = render(<Probe options={options} />);
  return {
    ...view,
    rerenderWith: (next: UseChunkUploadOptions) =>
      view.rerender(<Probe options={next} />),
  };
};

/** 基础配置：默认不落 localStorage，让「续传」只由服务端清单决定，隔离持久化干扰 */
const baseOptions = (overrides: UseChunkUploadOptions = {}): UseChunkUploadOptions => ({
  id: 'default',
  chunkSize: CHUNK,
  concurrency: 3,
  maxRetries: 3,
  persist: false,
  sleep: noSleep,
  ...overrides,
});

/** 分片上传替身：挂起不返回，用于观察在途并发数 */
function gateUploads() {
  const state = { inFlight: 0, maxInFlight: 0 };
  mockedUploadPart.mockImplementation(
    (params) =>
      new Promise<null>((resolve, reject) => {
        state.inFlight += 1;
        state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
        params.signal?.addEventListener('abort', () => {
          state.inFlight -= 1;
          reject(new UploadAbortError());
        });
        void resolve;
      }),
  );
  return state;
}

beforeEach(() => {
  vi.clearAllMocks();
  // 队列登记处是模块级单例：不重置会把上一条用例的控制器与任务带进来
  resetUploadQueueHub();
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
  mockedMerge.mockResolvedValue({ fileId: 'file-1' });
});

afterEach(() => {
  cleanup();
  resetUploadQueueHub();
});

describe('useChunkUpload', () => {
  /* ==================== 用户请求的三条上传分支 ==================== */

  it('秒传命中：直接完成，不发起任何分片请求、不调用合并', async () => {
    mockedPrecheck.mockResolvedValue({ instant: true, fileId: 'exist-1' });
    renderHookWith(baseOptions());

    await act(async () => {
      latest.start([makeFile(10)]);
    });
    await flush();

    const task = latest.tasks[0];
    expect(task.status).toBe('success');
    expect(task.instant).toBe(true);
    expect(task.fileId).toBe('exist-1');
    expect(task.progress).toBe(100);
    // 秒传的全部价值就在这两条：一个字节都不上传、不做无谓合并
    expect(mockedUploadPart).not.toHaveBeenCalled();
    expect(mockedMerge).not.toHaveBeenCalled();
    // 预检必须带全文件摘要（秒传判据）
    expect(mockedPrecheck).toHaveBeenCalledWith(
      expect.objectContaining({ sha256: 'f'.repeat(64), sizeBytes: 10 }),
    );
  });

  it('分片失败重试：可重试错误退避后自动重传，重试次数计入任务', async () => {
    let attempts = 0;
    mockedUploadPart.mockImplementation(async () => {
      attempts += 1;
      if (attempts <= 2) {
        throw new UploadApiError({ message: '网络异常', retryable: true });
      }
      return null;
    });
    renderHookWith(baseOptions());

    await act(async () => {
      latest.start([makeFile(4)]); // 1 片
    });
    await flush();

    const task = latest.tasks[0];
    expect(task.status).toBe('success');
    // 首传 + 2 次重试 = 3 次尝试，用户可见的重试计数为 2
    expect(mockedUploadPart).toHaveBeenCalledTimes(3);
    expect(task.retryCount).toBe(2);
    // 重试最终仍要落到合并，不能把「重试成功」当成上传成功
    expect(mockedMerge).toHaveBeenCalledWith('u-1', {
      sha256: 'f'.repeat(64),
      sizeBytes: 4,
      chunkCount: 1,
    });
  });

  it('续传：以服务端分片清单为准，只补缺失分片', async () => {
    // 16 字节 / 4 字节 = 4 片；服务端已确认收到 0、2
    mockedParts.mockResolvedValue({ received: [0, 2], chunkSize: CHUNK });
    renderHookWith(baseOptions());

    await act(async () => {
      latest.start([makeFile(16)]);
    });
    await flush();

    const uploaded = mockedUploadPart.mock.calls.map((call) => call[0].index);
    expect(uploaded.slice().sort((a, b) => a - b)).toEqual([1, 3]);
    expect(latest.tasks[0].chunkCount).toBe(4);
    expect(latest.tasks[0].received).toEqual([0, 1, 2, 3]);
    expect(latest.tasks[0].status).toBe('success');
  });

  it('续传不信任本地缓存：服务端清单为空时全部重传', async () => {
    // 本地记录声称已传 0、1，但服务端清单为空 —— 权威来源是服务端
    window.localStorage.setItem(
      UPLOAD_RECORD_STORAGE_KEY,
      JSON.stringify([
        {
          key: 'demo.bin::16::1700000000000',
          fileName: 'demo.bin',
          size: 16,
          lastModified: 1_700_000_000_000,
          uploadId: 'u-1',
          chunkSize: CHUNK,
          chunkCount: 4,
          received: [0, 1],
          sha256: 'f'.repeat(64),
          status: 'uploading',
          updatedAt: Date.now(),
        },
      ]),
    );
    mockedParts.mockResolvedValue({ received: [], chunkSize: CHUNK });
    // 必须开启断点缓存，否则本地记录根本不会被读取，用例就退化成「persist 关闭」而失去意义
    renderHookWith(baseOptions({ persist: true }));

    await act(async () => {
      latest.start([makeFile(16)]);
    });
    await flush();

    const uploaded = mockedUploadPart.mock.calls.map((call) => call[0].index);
    expect(uploaded.slice().sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
  });

  /* ==================== 绑定层独有语义 ==================== */

  it('卸载不中止长任务：重新挂载同一 id 能看到已完成的任务', async () => {
    const view = renderHookWith(baseOptions());

    await act(async () => {
      latest.start([makeFile(10)]);
    });
    // 任务尚未跑完就离开页面
    view.unmount();
    await flush();

    // 重新挂载：任务仍在该队列里，且已完成（没有被卸载连带取消）
    renderHookWith(baseOptions());
    expect(latest.tasks).toHaveLength(1);
    expect(latest.tasks[0].status).toBe('success');
  });

  it('同 id 共享同一队列，不同 id 相互隔离', async () => {
    renderHookWith(baseOptions({ id: 'q1' }));
    await act(async () => {
      latest.start([makeFile(4)]);
    });
    await flush();
    expect(latest.tasks).toHaveLength(1);

    // 同一 id 再挂载：看到的是同一份队列
    const shared = renderHookWith(baseOptions({ id: 'q1' }));
    expect(latest.tasks).toHaveLength(1);

    // 换 id：不能看到别的队列的任务
    shared.rerenderWith(baseOptions({ id: 'q2' }));
    expect(latest.tasks).toHaveLength(0);
    expect(uploadQueueHub.ids().sort()).toEqual(['q1', 'q2']);
  });

  it('配置变更同步到同一控制器：并发数即时生效且不重建队列', async () => {
    const state = gateUploads();
    const view = renderHookWith(baseOptions({ id: 'sync', concurrency: 1 }));

    view.rerenderWith(baseOptions({ id: 'sync', concurrency: 3 }));
    expect(uploadQueueHub.ids()).toEqual(['sync']); // 未新建队列

    await act(async () => {
      latest.start([makeFile(40)]); // 10 片
    });
    await flush();

    // 若配置变更导致重建控制器，这里最多只会有 1 个在途分片
    expect(state.maxInFlight).toBe(3);
  });

  it('disposeUploadController：登出时释放队列，不留任务与文件引用', async () => {
    renderHookWith(baseOptions({ id: 'logout-me' }));
    await act(async () => {
      latest.start([makeFile(4)]);
    });
    await flush();
    expect(uploadQueueHub.ids()).toContain('logout-me');

    disposeUploadController('logout-me');

    expect(uploadQueueHub.ids()).not.toContain('logout-me');
    expect(uploadQueueHub.getSnapshot().tasks).toHaveLength(0);
  });
});
