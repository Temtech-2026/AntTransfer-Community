/** 分片上传默认参数与硬性边界（契约来源：docs/prd/README.md §6 / use-case-flows §1.1） */

/** 默认分片大小：4 MiB */
export const DEFAULT_CHUNK_SIZE = 4 * 1024 * 1024;

/**
 * 分片大小上限 8 MiB。
 * 服务端契约规定「单片 ≤ 8 MiB」（use-case-flows §1.1-4），超出即被拒绝，
 * 故前端在切片前收敛，避免把非法分片发到线上。
 */
export const MAX_CHUNK_SIZE = 8 * 1024 * 1024;

/** 默认单文件并发上传分片数 */
export const DEFAULT_CONCURRENCY = 3;

/** 单文件并发上限 5（契约：同一时刻单文件并发分片数 ≤ 5，超出报 4103） */
export const MAX_CONCURRENCY = 5;

/** 默认失败自动重试次数（首传不算，即最多 1 + 3 次尝试） */
export const DEFAULT_MAX_RETRIES = 3;

/** 指数退避基数（毫秒）：第 n 次重试等待 base * 2^(n-1) + 抖动 */
export const DEFAULT_RETRY_BASE_DELAY_MS = 500;

/** 指数退避封顶（毫秒），避免退避时间无限增长 */
export const MAX_RETRY_DELAY_MS = 8000;

/** 本地断点缓存 TTL：与服务端分片暂存保留期对齐（默认 24h，留 1h 余量） */
export const UPLOAD_RECORD_TTL_MS = 23 * 60 * 60 * 1000;

/** 本地断点缓存 localStorage key（仅缓存辅助，权威状态恒为服务端分片清单） */
export const UPLOAD_RECORD_STORAGE_KEY = 'at:upload:records:v1';

/** 速率采样窗口（毫秒），用于单文件上传速率估算 */
export const SPEED_SAMPLE_WINDOW_MS = 3000;
