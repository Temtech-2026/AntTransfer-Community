/**
 * 分片上传网络层。
 *
 * 设计要点：
 * 1. **业务判据恒为 `body.code`**（docs/api/README.md §2）。预检的 4001「秒传未命中」
 *    与 4002「分片缺失」是 B 类**流程分支码**，属正常分支，因此所有请求一律
 *    `skipErrorHandler: true`：不弹全局提示，由调用方（Hook）按 `code` 分流，
 *    并自行在任务行内呈现错误——避免重试过程中反复弹窗打断主流程（§7 红线）。
 * 2. 分片上传用 **XMLHttpRequest** 而非 axios/fetch：只有 XHR 能拿到
 *    `upload.onprogress`，从而给出平滑的单文件进度。
 * 3. 分片上传自带 `AbortSignal`，是暂停/取消得以「立即止血」的基础。
 */

import { request } from '@umijs/max';

import { isResult, type Result, SUCCESS_CODE } from '@/utils/result';
import { tokenStore } from '@/utils/token';
import {
  PART_FILE_FIELD,
  PART_HASH_FIELD,
  PART_INDEX_FIELD,
  type PartPayloadMode,
  UPLOAD_ENDPOINTS,
} from './endpoints';
import { UploadAbortError } from './errors';
import type {
  MergeResult,
  PartStatus,
  PartUploadedResult,
  PrecheckPayload,
  PrecheckResult,
} from './types';

/** 秒传未命中（B 类分支码，HTTP 200） */
export const CODE_INSTANT_UPLOAD_MISS = 4001;
/** 分片缺失（B 类分支码，HTTP 200） */
export const CODE_CHUNK_MISSING = 4002;
/** 文件完整性校验失败：必须重新上传，不可续传 */
export const CODE_FILE_INTEGRITY_ERROR = 4003;
/** 上传任务不存在 / 已过期：本地票据失效，需重新预检 */
export const CODE_UPLOAD_TASK_NOT_FOUND = 4101;
/** 任务状态冲突 */
export const CODE_STATE_CONFLICT = 4102;
/** 超并发 / 超流量 */
export const CODE_OVER_QUOTA = 4103;
/** 通用限流 */
export const CODE_RATE_LIMIT = 4290;
/** access token 过期 */
const CODE_TOKEN_EXPIRED = 1002;

/** 上传链路业务/网络错误（携带重试判定所需信息） */
export class UploadApiError extends Error {
  readonly code: number;
  readonly httpStatus: number;
  readonly traceId?: string;
  readonly retryable: boolean;

  constructor(init: {
    message: string;
    code?: number;
    httpStatus?: number;
    traceId?: string;
    retryable: boolean;
  }) {
    super(init.message);
    this.name = 'UploadApiError';
    this.code = init.code ?? -1;
    this.httpStatus = init.httpStatus ?? 0;
    this.traceId = init.traceId;
    this.retryable = init.retryable;
  }
}

/** HTTP 层是否值得重试：网络中断 / 超时 / 429 / 5xx */
function isRetryableStatus(status: number): boolean {
  if (status === 0) {
    return true; // 无响应：断网、DNS、连接重置
  }
  if (status === 408 || status === 429) {
    return true;
  }
  return status >= 500;
}

/** 业务码是否值得重试（覆盖 HTTP 层判定） */
function isRetryableCode(code: number, fallback: boolean): boolean {
  if (code === CODE_FILE_INTEGRITY_ERROR) {
    return false; // 完整性失败必须重新上传，重试无意义
  }
  if (code === CODE_UPLOAD_TASK_NOT_FOUND || code === CODE_STATE_CONFLICT) {
    return false; // 票据/状态失效：需重新预检或刷新状态，不是「重发同一请求」
  }
  if (code === CODE_OVER_QUOTA || code === CODE_RATE_LIMIT) {
    return true; // 超并发/限流：退避后重试
  }
  return fallback;
}

/** 把任意异常规整为 {@link UploadApiError} */
function toApiError(error: unknown): UploadApiError {
  if (error instanceof UploadAbortError) {
    throw error;
  }
  if (error instanceof UploadApiError) {
    return error;
  }
  const response = (error as any)?.response;
  const body = response?.data;
  const status: number = response?.status ?? 0;
  if (isResult(body)) {
    const result = body as Result<unknown>;
    return new UploadApiError({
      message: result.message || '上传失败',
      code: result.code,
      httpStatus: status,
      traceId: result.traceId,
      retryable: isRetryableCode(result.code, isRetryableStatus(status)),
    });
  }
  const message =
    (error as any)?.message === 'Network Error'
      ? '网络异常，请检查网络后重试'
      : ((error as any)?.message ?? '上传失败');
  return new UploadApiError({
    message,
    httpStatus: status,
    retryable: isRetryableStatus(status),
  });
}

/** 发一个 JSON 请求并校验统一响应体结构 */
async function callJson<T>(
  url: string,
  options: Record<string, unknown>,
): Promise<Result<T>> {
  try {
    const body = (await request(url, {
      ...options,
      skipErrorHandler: true,
    })) as Result<T>;
    if (!isResult(body)) {
      throw new UploadApiError({
        message: '服务端响应结构不符合统一契约',
        retryable: true,
      });
    }
    return body;
  } catch (error) {
    throw toApiError(error);
  }
}

/**
 * 秒传预检。
 *
 * - `code=0` → 秒传命中，返回既有 `fileId`；
 * - `code=4001` → 未命中（B 类分支，非错误），返回上传票据。
 */
export async function precheck(
  payload: PrecheckPayload,
): Promise<PrecheckResult> {
  const body = await callJson<Record<string, any>>(UPLOAD_ENDPOINTS.precheck, {
    method: 'POST',
    data: payload,
  });

  if (body.code === SUCCESS_CODE) {
    const fileId = body.data?.fileId ?? body.data?.id;
    if (!fileId) {
      throw new UploadApiError({
        message: '秒传命中但未返回 fileId',
        retryable: true,
      });
    }
    return { instant: true, fileId: String(fileId) };
  }

  if (body.code === CODE_INSTANT_UPLOAD_MISS) {
    const data = body.data ?? {};
    const uploadId = data.uploadId;
    if (!uploadId) {
      throw new UploadApiError({
        message: '秒传未命中但未返回 uploadId',
        code: body.code,
        retryable: true,
      });
    }
    return {
      instant: false,
      uploadId: String(uploadId),
      chunkSize: Number(data.chunkSize) || 0,
      chunkCount: Number(data.chunkCount) || 0,
    };
  }

  throw toApiError(
    Object.assign(new Error(body.message), {
      response: { status: 200, data: body },
    }),
  );
}

/**
 * 查询服务端已收分片清单——**断点续传的唯一权威来源**。
 *
 * 本地 localStorage 里的 `received` 只是快照缓存，用于刷新后先行渲染进度；
 * 真正决定「哪些片要传」的永远是本接口返回值。
 */
export async function fetchPartStatus(uploadId: string): Promise<PartStatus> {
  const body = await callJson<Record<string, any>>(
    UPLOAD_ENDPOINTS.parts(uploadId),
    { method: 'GET' },
  );
  ensureSuccess(body);
  const data = body.data ?? {};
  const raw =
    data.received ??
    data.receivedIndexes ??
    data.uploadedIndexes ??
    data.uploaded;
  const received = Array.isArray(raw)
    ? Array.from(
        new Set(
          raw
            .map((item: unknown) => Number(item))
            .filter((item: number) => Number.isInteger(item) && item >= 0),
        ),
      ).sort((a, b) => a - b)
    : [];
  return {
    received,
    chunkSize: Number(data.chunkSize) || undefined,
    chunkCount: Number(data.chunkCount) || undefined,
  };
}

/** code 非 0 即抛错（非 B 类分支的接口用） */
function ensureSuccess(body: Result<unknown>): void {
  if (body.code !== SUCCESS_CODE) {
    throw toApiError(
      Object.assign(new Error(body.message), {
        response: { status: 200, data: body },
      }),
    );
  }
}

/** 合并分片（服务端整件重算 SHA-256 比对，见 use-case-flows §1.1-6） */
export async function mergeParts(
  uploadId: string,
  payload: { sha256: string; sizeBytes: number; chunkCount: number },
): Promise<MergeResult> {
  const body = await callJson<Record<string, any>>(
    UPLOAD_ENDPOINTS.merge(uploadId),
    { method: 'POST', data: payload },
  );
  ensureSuccess(body);
  const fileId = body.data?.fileId ?? body.data?.id;
  return {
    fileId: fileId ? String(fileId) : '',
    sha256: body.data?.sha256,
  };
}

/**
 * 取消上传：通知服务端清理临时分片与任务。
 * 失败不抛错——取消是「尽力而为」，本地态必须无条件清干净。
 */
export async function cancelUpload(uploadId: string): Promise<void> {
  try {
    await request(UPLOAD_ENDPOINTS.task(uploadId), {
      method: 'DELETE',
      skipErrorHandler: true,
    });
  } catch {
    // 忽略：本地清理不依赖服务端回执
  }
}

/** 原生 XHR 发送，返回 HTTP 状态与响应文本 */
function xhrSend(init: {
  url: string;
  method: string;
  body: XMLHttpRequestBodyInit;
  headers: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: (loaded: number, total: number) => void;
}): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    if (init.signal?.aborted) {
      reject(new UploadAbortError());
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open(init.method, init.url, true);
    xhr.withCredentials = true;
    if (init.timeoutMs) {
      xhr.timeout = init.timeoutMs;
    }
    // 不手写 Content-Type：交由浏览器为 FormData 生成带 boundary 的值
    for (const [key, value] of Object.entries(init.headers)) {
      if (value) {
        xhr.setRequestHeader(key, value);
      }
    }

    const onAbort = () => xhr.abort();
    init.signal?.addEventListener('abort', onAbort, { once: true });

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        init.onProgress?.(event.loaded, event.total);
      }
    };
    xhr.onload = () => {
      init.signal?.removeEventListener('abort', onAbort);
      resolve({ status: xhr.status, text: xhr.responseText });
    };
    xhr.onerror = () => {
      init.signal?.removeEventListener('abort', onAbort);
      reject(new UploadApiError({ message: '网络异常', retryable: true }));
    };
    xhr.ontimeout = () => {
      init.signal?.removeEventListener('abort', onAbort);
      reject(
        new UploadApiError({
          message: '上传超时',
          httpStatus: 408,
          retryable: true,
        }),
      );
    };
    xhr.onabort = () => {
      init.signal?.removeEventListener('abort', onAbort);
      reject(new UploadAbortError());
    };
    xhr.send(init.body);
  });
}

/** 组装分片请求体 */
function buildPartBody(
  blob: Blob,
  index: number,
  hash: string,
  mode: PartPayloadMode,
): XMLHttpRequestBodyInit {
  if (mode === 'octet-stream') {
    return blob;
  }
  const form = new FormData();
  form.append(PART_FILE_FIELD, blob);
  form.append(PART_INDEX_FIELD, String(index));
  form.append(PART_HASH_FIELD, hash);
  return form;
}

/** 分片上传入参 */
export interface UploadPartParams {
  uploadId: string;
  index: number;
  blob: Blob;
  /** 分片 SHA-256（服务端逐片校验，use-case-flows §1.1-4） */
  hash: string;
  signal?: AbortSignal;
  /** 单片超时（毫秒）；0 表示不限 */
  timeoutMs?: number;
  /** 请求体形态，默认 multipart */
  mode?: PartPayloadMode;
  /** 分片内字节进度（用于平滑进度条） */
  onProgress?: (loaded: number) => void;
}

/** 分片上传：401/1002 时静默续期令牌并重发一次 */
export async function uploadPart(
  params: UploadPartParams,
): Promise<PartUploadedResult | null> {
  const send = async (token: string | null) => {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (params.mode === 'octet-stream') {
      headers['Content-Type'] = 'application/octet-stream';
    }
    const { status, text } = await xhrSend({
      url: UPLOAD_ENDPOINTS.part(params.uploadId, params.index),
      method: 'PUT',
      body: buildPartBody(
        params.blob,
        params.index,
        params.hash,
        params.mode ?? 'multipart',
      ),
      headers,
      signal: params.signal,
      timeoutMs: params.timeoutMs,
      onProgress: (_loaded, _total) => {
        params.onProgress?.(Math.min(_loaded, params.blob.size));
      },
    });

    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (isResult(body)) {
      return { status, result: body as Result<PartUploadedResult> };
    }
    if (status >= 200 && status < 300) {
      // 兼容无统一响应体的实现
      return { status, result: null };
    }
    throw new UploadApiError({
      message: `分片上传失败（HTTP ${status}）`,
      httpStatus: status,
      retryable: isRetryableStatus(status),
    });
  };

  let response = await send(tokenStore.getAccessToken());

  // 401 + 1002：静默续期后重发一次（与 requestErrorConfig 的单飞刷新共用同一 Promise）
  if (
    response.status === 401 &&
    response.result?.code === CODE_TOKEN_EXPIRED &&
    !params.signal?.aborted
  ) {
    const { refreshTokenOnce } = await import('@/requestErrorConfig');
    const refreshed = await refreshTokenOnce();
    if (refreshed) {
      response = await send(tokenStore.getAccessToken());
    }
  }

  const result = response.result;
  if (result && result.code !== SUCCESS_CODE) {
    throw toApiError(
      Object.assign(new Error(result.message), {
        response: { status: response.status, data: result },
      }),
    );
  }
  const received = (result?.data as PartUploadedResult | undefined)?.received;
  return received ? { received } : null;
}
