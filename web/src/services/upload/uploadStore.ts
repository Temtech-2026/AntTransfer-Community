/**
 * 断点续传的**本地缓存**（localStorage）。
 *
 * ⚠️ 定位：这里存的只是「辅助信息」，用来在刷新后把任务重新认出来、
 * 并复用最耗时的全文件 SHA-256 结果。**哪些分片还需要传，恒以服务端
 * `GET …/parts` 返回的清单为准**（PRD §6「断点续传必须基于服务端分片清单增量完成」）。
 *
 * 浏览器无法持久化 `File` 对象（隐私与配额限制），因此刷新后必须由用户
 * 重新选择同一文件；本模块的 {@link matchKey} 用「名称 + 大小 + 最后修改时间」
 * 把新旧文件认成同一份，随后仅发送**缺失分片**。
 */

import { UPLOAD_RECORD_STORAGE_KEY, UPLOAD_RECORD_TTL_MS } from './constants';
import type { ResumableRecord, UploadRecord, UploadTaskStatus } from './types';

/** SSR / 单测 / 隐私模式下降级为内存存储 */
const memoryStore = new Map<string, string>();

function readRaw(): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return memoryStore.get(UPLOAD_RECORD_STORAGE_KEY) ?? null;
    }
    // 优先用真实 localStorage；同时镜像一份到内存，供隐私模式降级读取
    const value = window.localStorage.getItem(UPLOAD_RECORD_STORAGE_KEY);
    if (value !== null) {
      memoryStore.set(UPLOAD_RECORD_STORAGE_KEY, value);
      return value;
    }
    return memoryStore.get(UPLOAD_RECORD_STORAGE_KEY) ?? null;
  } catch {
    return memoryStore.get(UPLOAD_RECORD_STORAGE_KEY) ?? null;
  }
}

function writeRaw(value: string): void {
  memoryStore.set(UPLOAD_RECORD_STORAGE_KEY, value);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(UPLOAD_RECORD_STORAGE_KEY, value);
    }
  } catch {
    // 配额不足 / 隐私模式：静默降级为内存
  }
}

/** 任务匹配键：同名 + 同大小 + 同修改时间 → 视为同一份文件 */
export function matchKey(file: {
  name: string;
  size: number;
  lastModified: number;
}): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

function readAll(): Record<string, UploadRecord> {
  const raw = readRaw();
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, UploadRecord>)
      : {};
  } catch {
    return {};
  }
}

function persist(all: Record<string, UploadRecord>): void {
  writeRaw(JSON.stringify(all));
}

/** 是否已过期（服务端分片暂存默认 24h） */
function isExpired(record: UploadRecord, now = Date.now()): boolean {
  return now - (record.updatedAt ?? 0) > UPLOAD_RECORD_TTL_MS;
}

/** 读取单条记录（已过期返回 null） */
export function getRecord(key: string): UploadRecord | null {
  const record = readAll()[key];
  if (!record || isExpired(record)) {
    return null;
  }
  return record;
}

/** 按 File 查找记录 */
export function findRecordByFile(file: {
  name: string;
  size: number;
  lastModified: number;
}): UploadRecord | null {
  return getRecord(matchKey(file));
}

/** 写入 / 合并一条记录 */
export function saveRecord(record: UploadRecord): void {
  const all = readAll();
  all[record.key] = record;
  persist(all);
}

/** 局部更新（不存在则忽略） */
export function patchRecord(
  key: string,
  patch: Partial<UploadRecord>,
): UploadRecord | null {
  const all = readAll();
  const current = all[key];
  if (!current) {
    return null;
  }
  const next: UploadRecord = {
    ...current,
    ...patch,
    key,
    updatedAt: patch.updatedAt ?? Date.now(),
  };
  all[key] = next;
  persist(all);
  return next;
}

/** 删除一条记录（取消上传 / 完成 / 失败重选后调用） */
export function removeRecord(key: string): void {
  const all = readAll();
  if (key in all) {
    delete all[key];
    persist(all);
  }
}

/** 清空全部本地记录 */
export function clearRecords(): void {
  persist({});
}

/** 清理过期记录，返回剩余条数 */
export function pruneRecords(now = Date.now()): number {
  const all = readAll();
  let removed = 0;
  for (const key of Object.keys(all)) {
    if (isExpired(all[key], now)) {
      delete all[key];
      removed += 1;
    }
  }
  if (removed > 0) {
    persist(all);
  }
  return Object.keys(all).length;
}

/** 已完成 / 取消的任务不再作为「可续传」暴露 */
const RESUMABLE_STATUSES: UploadTaskStatus[] = [
  'pending',
  'hashing',
  'prechecking',
  'querying',
  'uploading',
  'paused',
  'error',
  'merging',
];

/** 列出刷新后可续传的任务（用于 UI 提示重新选择文件） */
export function listResumable(now = Date.now()): ResumableRecord[] {
  const all = readAll();
  const list: ResumableRecord[] = [];
  for (const record of Object.values(all)) {
    if (isExpired(record, now) || !RESUMABLE_STATUSES.includes(record.status)) {
      continue;
    }
    const receivedCount = record.received?.length ?? 0;
    const total = Math.max(1, record.chunkCount || 1);
    list.push({
      key: record.key,
      fileName: record.fileName,
      size: record.size,
      lastModified: record.lastModified,
      uploadId: record.uploadId,
      chunkCount: record.chunkCount,
      receivedCount,
      progress: Math.min(100, Math.round((receivedCount / total) * 100)),
      updatedAt: record.updatedAt,
    });
  }
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** 创建一条初始记录 */
export function createRecord(init: {
  key: string;
  fileName: string;
  size: number;
  lastModified: number;
  chunkSize: number;
  chunkCount: number;
  status: UploadTaskStatus;
}): UploadRecord {
  return {
    ...init,
    uploadId: null,
    received: [],
    sha256: null,
    updatedAt: Date.now(),
  };
}
