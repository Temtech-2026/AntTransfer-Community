/**
 * 上传链路端点集中定义（单一改动点）。
 *
 * 默认口径 = 项目权威契约 `docs/architecture/use-case-flows.md` §1.1
 * （precheck / parts / parts/{index} / merge），并由 docs/api/README.md §1 规定
 * 全局前缀 `/api` + 版本段 `/v1`。
 *
 * ⚠️ 若后端最终采用「S3 风格 multipart」命名（例如状态查询为
 * `GET /files/multipart/{uploadId}`），**只需改本文件**，其余代码零改动。
 */
export const UPLOAD_ENDPOINTS = {
  /** 秒传预检：命中 → code=0 + fileId；未命中 → code=4001 + { uploadId, chunkSize, chunkCount } */
  precheck: '/api/v1/transfers/precheck',
  /** 分片清单（断点续传权威来源）：GET → { received: number[], chunkSize } */
  parts: (uploadId: string) =>
    `/api/v1/transfers/${encodeURIComponent(uploadId)}/parts`,
  /** 单片上传（幂等：同 index 重传覆盖） */
  part: (uploadId: string, index: number) =>
    `/api/v1/transfers/${encodeURIComponent(uploadId)}/parts/${index}`,
  /** 合并分片并做整件 SHA-256 校验 */
  merge: (uploadId: string) =>
    `/api/v1/transfers/${encodeURIComponent(uploadId)}/merge`,
  /** 任务详情（4101 表示任务不存在/已过期） */
  task: (uploadId: string) =>
    `/api/v1/transfers/${encodeURIComponent(uploadId)}`,
} as const;

/**
 * 分片上传的请求体形态。
 *
 * - `multipart`（默认）：`FormData`，字段 `chunk` + `index` + `hash`，
 *   对应 Spring `@RequestPart MultipartFile`，是最常见的后端落点；
 * - `octet-stream`：裸 `application/octet-stream`（更适合对象存储直传）。
 */
export type PartPayloadMode = 'multipart' | 'octet-stream';

/** 分片上传的 multipart 字段名 */
export const PART_FILE_FIELD = 'chunk';
export const PART_INDEX_FIELD = 'index';
export const PART_HASH_FIELD = 'hash';
