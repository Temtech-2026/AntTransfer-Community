/** 文件切片工具：切片大小收敛 + 分片索引/边界计算 */

import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CONCURRENCY,
  MAX_CHUNK_SIZE,
  MAX_CONCURRENCY,
} from './constants';

/** 单个分片的元信息（blob 为惰性切片，不占用额外内存） */
export interface ChunkMeta {
  index: number;
  start: number;
  end: number;
  size: number;
  blob: Blob;
}

/** 收敛分片大小：正数、不超过契约上限、不超过文件本身 */
export function normalizeChunkSize(
  fileSize: number,
  preferred?: number,
): number {
  const want = preferred && preferred > 0 ? preferred : DEFAULT_CHUNK_SIZE;
  const capped = Math.min(want, MAX_CHUNK_SIZE);
  const byContract = Math.max(1, Math.floor(capped));
  return fileSize > 0 ? Math.min(byContract, fileSize) : byContract;
}

/** 收敛并发数：1 ~ {@link MAX_CONCURRENCY}（超上限会被服务端以 4103 拒绝） */
export function normalizeConcurrency(preferred?: number): number {
  const want = preferred && preferred > 0 ? preferred : DEFAULT_CONCURRENCY;
  return Math.min(MAX_CONCURRENCY, Math.max(1, Math.floor(want)));
}

/** 分片总数（向上取整；空文件视为 1 片，与后端约定保持一致） */
export function countChunks(fileSize: number, chunkSize: number): number {
  if (fileSize <= 0) {
    return 1;
  }
  return Math.ceil(fileSize / chunkSize);
}

/** 第 index 片的字节区间 [start, end) */
export function chunkRange(
  index: number,
  chunkSize: number,
  fileSize: number,
): { start: number; end: number } {
  const start = index * chunkSize;
  return { start, end: Math.min(start + chunkSize, fileSize) };
}

/**
 * 生成分片清单。
 *
 * `Blob.slice()` 是惰性视图（不复制字节），因此即使 10 GiB 文件切出上千片，
 * 也只持有元信息，真正的读取发生在分片上传/哈希时。
 */
export function splitFile(file: Blob, chunkSize: number): ChunkMeta[] {
  const total = countChunks(file.size, chunkSize);
  const list: ChunkMeta[] = [];
  for (let index = 0; index < total; index += 1) {
    const { start, end } = chunkRange(index, chunkSize, file.size);
    list.push({
      index,
      start,
      end,
      size: end - start,
      blob: file.slice(start, end),
    });
  }
  return list;
}

/** 取第 index 片（不预先切全量，用于按需上传的场景） */
export function sliceChunk(
  file: Blob,
  index: number,
  chunkSize: number,
): ChunkMeta {
  const { start, end } = chunkRange(index, chunkSize, file.size);
  return { index, start, end, size: end - start, blob: file.slice(start, end) };
}
