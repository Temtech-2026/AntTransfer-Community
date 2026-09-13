/** 切片工具 / 本地断点缓存 / 退避算法的单元测试 */

import { backoffDelay } from './ChunkUploadController';
import {
  chunkRange,
  countChunks,
  normalizeChunkSize,
  normalizeConcurrency,
  sliceChunk,
  splitFile,
} from './chunk';
import {
  DEFAULT_CHUNK_SIZE,
  MAX_CHUNK_SIZE,
  MAX_CONCURRENCY,
  MAX_RETRY_DELAY_MS,
} from './constants';
import {
  clearRecords,
  createRecord,
  findRecordByFile,
  listResumable,
  matchKey,
  patchRecord,
  pruneRecords,
  removeRecord,
  saveRecord,
} from './uploadStore';

const MB = 1024 * 1024;

describe('chunk 切片工具', () => {
  it('分片大小收敛：默认 4 MiB、上限 8 MiB、不超过文件大小', () => {
    expect(normalizeChunkSize(100 * MB)).toBe(DEFAULT_CHUNK_SIZE);
    expect(normalizeChunkSize(100 * MB, 64 * MB)).toBe(MAX_CHUNK_SIZE);
    expect(normalizeChunkSize(100 * MB, -1)).toBe(DEFAULT_CHUNK_SIZE);
    expect(normalizeChunkSize(3 * MB, 8 * MB)).toBe(3 * MB);
  });

  it('并发数收敛到 1 ~ 5（契约上限）', () => {
    expect(normalizeConcurrency()).toBe(3);
    expect(normalizeConcurrency(99)).toBe(MAX_CONCURRENCY);
    expect(normalizeConcurrency(0)).toBe(3);
    expect(normalizeConcurrency(2.6)).toBe(2);
  });

  it('分片总数与区间正确（含整除 / 余数 / 空文件）', () => {
    expect(countChunks(10 * MB, 4 * MB)).toBe(3);
    expect(countChunks(8 * MB, 4 * MB)).toBe(2);
    expect(countChunks(0, 4 * MB)).toBe(1);
    expect(chunkRange(2, 4 * MB, 10 * MB)).toEqual({
      start: 8 * MB,
      end: 10 * MB,
    });
    expect(chunkRange(1, 4 * MB, 8 * MB)).toEqual({
      start: 4 * MB,
      end: 8 * MB,
    });
  });

  it('splitFile 覆盖全文件且不产生重叠', () => {
    const blob = new Blob([new Uint8Array(9 * MB)]);
    const chunks = splitFile(blob, 4 * MB);
    expect(chunks.map((chunk) => chunk.size)).toEqual([4 * MB, 4 * MB, 1 * MB]);
    expect(chunks.map((chunk) => chunk.index)).toEqual([0, 1, 2]);
    expect(sliceChunk(blob, 2, 4 * MB).size).toBe(1 * MB);
  });
});

describe('backoffDelay 指数退避', () => {
  it('随重试次数指数增长并封顶（含 ±20% 抖动）', () => {
    const base = 1000;
    const first = backoffDelay(1, base);
    const second = backoffDelay(2, base);
    const third = backoffDelay(3, base);
    expect(first).toBeGreaterThanOrEqual(800);
    expect(first).toBeLessThanOrEqual(1200);
    expect(second).toBeGreaterThanOrEqual(1600);
    expect(second).toBeLessThanOrEqual(2400);
    expect(third).toBeGreaterThanOrEqual(3200);
    expect(third).toBeLessThanOrEqual(4800);
    // 超大重试次数不会超过封顶值（含抖动上限）
    expect(backoffDelay(20, base)).toBeLessThanOrEqual(
      Math.round(MAX_RETRY_DELAY_MS * 1.2),
    );
  });
});

describe('uploadStore 本地断点缓存', () => {
  beforeEach(() => {
    clearRecords();
    window.localStorage.clear();
  });

  const file = {
    name: 'demo.bin',
    size: 1024,
    lastModified: 1_700_000_000_000,
  };

  it('按「名称+大小+修改时间」匹配同一份文件', () => {
    const key = matchKey(file);
    saveRecord({
      ...createRecord({
        key,
        fileName: file.name,
        size: file.size,
        lastModified: file.lastModified,
        chunkSize: DEFAULT_CHUNK_SIZE,
        chunkCount: 1,
        status: 'uploading',
      }),
      uploadId: 'u-1',
      received: [0],
    });

    expect(matchKey({ ...file })).toBe(key);
    expect(matchKey({ ...file, size: 2048 })).not.toBe(key);
    expect(findRecordByFile(file)?.uploadId).toBe('u-1');
    expect(listResumable()[0]).toMatchObject({
      fileName: 'demo.bin',
      uploadId: 'u-1',
      receivedCount: 1,
      chunkCount: 1,
      progress: 100,
    });
  });

  it('完成的任务不再出现在可续传列表，且可被清理', () => {
    const key = matchKey(file);
    saveRecord(
      createRecord({
        key,
        fileName: file.name,
        size: file.size,
        lastModified: file.lastModified,
        chunkSize: DEFAULT_CHUNK_SIZE,
        chunkCount: 1,
        status: 'success',
      }),
    );
    expect(listResumable()).toHaveLength(0);
    removeRecord(key);
    expect(findRecordByFile(file)).toBeNull();
  });

  it('patchRecord 合并字段并刷新时间戳；过期记录被 prune 清除', () => {
    const key = matchKey(file);
    saveRecord(
      createRecord({
        key,
        fileName: file.name,
        size: file.size,
        lastModified: file.lastModified,
        chunkSize: DEFAULT_CHUNK_SIZE,
        chunkCount: 4,
        status: 'pending',
      }),
    );
    const patched = patchRecord(key, { received: [0, 1], uploadId: 'u-9' });
    expect(patched?.uploadId).toBe('u-9');
    expect(patched?.received).toEqual([0, 1]);

    // 超过 TTL（23h）后应被清理
    const stale = patchRecord(key, {
      updatedAt: Date.now() - 30 * 60 * 60 * 1000,
    });
    expect(stale?.updatedAt).toBeLessThan(Date.now());
    pruneRecords();
    expect(findRecordByFile(file)).toBeNull();
  });
});
