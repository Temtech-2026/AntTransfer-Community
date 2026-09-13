/**
 * 分片上传示例页的本地 mock（umi 约定：页面目录下的 `_mock.ts`，见 config/config.ts 的 mock.include）。
 *
 * 只在 mock 开启时挂载（`npm run start`）；`npm run dev` 会 `MOCK=none` 并把 /api 代理到后端。
 * 价值在于「无后端也能验证前端链路」：
 * - 票据、已收分片、秒传索引全部放在 dev server 进程内存里，刷新浏览器不丢，
 *   因此「刷新页面 → 重新选择同一文件 → 续传」可以完整走通；
 * - 响应体严格遵循统一契约（code / message / data / traceId）；
 * - 分支码与 uploadApi.ts 对齐：4001 秒传未命中、4002 分片缺失、4101 票据失效。
 *
 * ⚠️ 真实 at-transfer 接口落地后应删除本文件（或仅保留作离线演示）。
 */
import type { Request, Response } from 'express';

/** 服务端下发的分片口径（4 MiB），与 constants.DEFAULT_CHUNK_SIZE 保持一致 */
const SERVER_CHUNK_SIZE = 4 * 1024 * 1024;
/** 单片落盘耗时：本机回环上传几乎瞬时，加一点延迟才能看清进度与速率 */
const PART_LATENCY_MS = 150;

interface MockTask {
  uploadId: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  chunkSize: number;
  chunkCount: number;
  /** 已确认收到的分片索引 */
  received: Set<number>;
}

/** 在途上传任务：uploadId → 任务 */
const tasks = new Map<string, MockTask>();
/** 已完成文件索引：sha256 → fileId，秒传就是命中它 */
const finished = new Map<string, string>();

let seq = 0;

function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}${seq.toString(36)}`;
}

function traceId(): string {
  return `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 统一成功响应 */
function ok<T>(res: Response, data: T, message = 'success'): void {
  res.send({ code: 0, message, data, traceId: traceId() });
}

/** 统一失败 / 分支响应：HTTP 仍是 200，业务判据看 code */
function fail(
  res: Response,
  code: number,
  message: string,
  data: unknown = null,
): void {
  res.send({ code, message, data, traceId: traceId() });
}

function receivedOf(task: MockTask): number[] {
  return [...task.received].sort((a, b) => a - b);
}

function missingOf(task: MockTask): number[] {
  const list: number[] = [];
  for (let index = 0; index < task.chunkCount; index += 1) {
    if (!task.received.has(index)) {
      list.push(index);
    }
  }
  return list;
}

export default {
  /** 秒传预检：命中 → code 0 + fileId；未命中 → code 4001 + 上传票据 */
  'POST /api/v1/transfers/precheck': (req: Request, res: Response) => {
    const body = req.body ?? {};
    const sha256 = String(body.sha256 ?? '');
    const sizeBytes = Number(body.sizeBytes) || 0;
    const fileName = String(body.fileName ?? 'unknown');

    const hit = sha256 ? finished.get(sha256) : undefined;
    if (hit) {
      ok(res, { instant: true, fileId: hit }, '秒传命中，无需传输字节');
      return;
    }

    // 与前端 normalizeChunkSize 同口径：不超过 4 MiB，也不超过文件本身
    const chunkSize = Math.max(1, Math.min(SERVER_CHUNK_SIZE, sizeBytes || 1));
    const task: MockTask = {
      uploadId: nextId('upload'),
      fileName,
      sizeBytes,
      sha256,
      chunkSize,
      chunkCount: Math.max(1, Math.ceil(sizeBytes / chunkSize)),
      received: new Set(),
    };
    tasks.set(task.uploadId, task);

    fail(res, 4001, '秒传未命中，请继续分片上传', {
      uploadId: task.uploadId,
      chunkSize: task.chunkSize,
      chunkCount: task.chunkCount,
    });
  },

  /** 已收分片清单：断点续传的权威来源 */
  'GET /api/v1/transfers/:uploadId/parts': (req: Request, res: Response) => {
    const task = tasks.get(String(req.params.uploadId));
    if (!task) {
      fail(res, 4101, '上传任务不存在或已过期');
      return;
    }
    ok(res, {
      received: receivedOf(task),
      chunkSize: task.chunkSize,
      chunkCount: task.chunkCount,
    });
  },

  /** 上传分片：幂等，同 index 重传即覆盖 */
  'PUT /api/v1/transfers/:uploadId/parts/:index': (
    req: Request,
    res: Response,
  ) => {
    const task = tasks.get(String(req.params.uploadId));
    if (!task) {
      fail(res, 4101, '上传任务不存在或已过期');
      return;
    }
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= task.chunkCount) {
      fail(res, 2001, `分片索引越界：${req.params.index}`);
      return;
    }
    // 这里不解析 multipart 正文：真实校验（分片 SHA-256）由后端负责
    setTimeout(() => {
      task.received.add(index);
      ok(res, {
        index,
        received: receivedOf(task),
        receivedCount: task.received.size,
      });
    }, PART_LATENCY_MS);
  },

  /** 合并分片：缺片返回 4002，齐了则登记摘要（供下次秒传命中） */
  'POST /api/v1/transfers/:uploadId/merge': (req: Request, res: Response) => {
    const task = tasks.get(String(req.params.uploadId));
    if (!task) {
      fail(res, 4101, '上传任务不存在或已过期');
      return;
    }
    const missing = missingOf(task);
    if (missing.length > 0) {
      fail(
        res,
        4002,
        `分片缺失：已收 ${task.received.size}/${task.chunkCount}`,
        { received: receivedOf(task), missing },
      );
      return;
    }

    const fileId = nextId('file');
    if (task.sha256) {
      finished.set(task.sha256, fileId);
    }
    tasks.delete(task.uploadId);
    ok(
      res,
      {
        fileId,
        sha256: task.sha256,
        fileName: task.fileName,
        sizeBytes: task.sizeBytes,
      },
      '合并完成',
    );
  },

  /** 取消上传：清理服务端临时分片 */
  'DELETE /api/v1/transfers/:uploadId': (req: Request, res: Response) => {
    tasks.delete(String(req.params.uploadId));
    ok(res, null, '上传任务已清理');
  },
};
