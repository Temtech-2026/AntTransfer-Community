/**
 * 上传队列登记处：跨页面聚合的唯一事实源。
 *
 * `useChunkUpload` 的模块级注册表只解决「同一 `id` 复用控制器」，
 * 页面各自只看得见自己那条队列；而顶栏的「全局上传进度」需要看**所有**队列
 * （上传页的 `default`、文件工作台的 `file-workbench`……），所以把登记职责
 * 上提到这里：
 *
 * - `ensure()` 惰性建队列并接力订阅，任一队列变化即重算聚合快照；
 * - 聚合快照缓存为稳定引用，供 `useSyncExternalStore` 使用；
 * - 创建控制器时**不**广播（新队列必然没有任务），避免在其它组件渲染期间
 *   触发订阅者更新（React 会告警 "Cannot update a component while rendering"）。
 */

import {
  ChunkUploadController,
  type ChunkUploadOptions,
} from './ChunkUploadController';
import type { UploadTaskStatus, UploadTaskView } from './types';

/** 仍在推进的状态（未终结） */
const ACTIVE_STATUS: UploadTaskStatus[] = [
  'pending',
  'hashing',
  'prechecking',
  'querying',
  'uploading',
  'paused',
  'merging',
];

/** 汇总任务：带上来路，便于顶栏分组与跳转 */
export interface GlobalUploadTask extends UploadTaskView {
  /** 所属队列 id（同 id 的多个组件共享一份队列） */
  queueId: string;
  /** 跨队列唯一键（各队列的任务 id 都从 `upload-1` 起，不能直接当 key） */
  key: string;
}

/** 全队列聚合快照（稳定引用） */
export interface GlobalUploadSnapshot {
  /** 所有队列的任务，按「活跃 → 失败 → 完成」排序 */
  tasks: GlobalUploadTask[];
  /** 参与进度计算的任务（排除已取消） */
  countedTasks: number;
  /** 推进中的任务数 */
  activeCount: number;
  /** 失败待处理的任务数 */
  failedCount: number;
  /** 已完成（含秒传）的任务数 */
  succeededCount: number;
  /** 字节加权总进度 0~100 */
  percent: number;
  /** 是否存在未终结任务（顶栏据此决定是否展示进度条动画） */
  uploading: boolean;
}

const EMPTY_SNAPSHOT: GlobalUploadSnapshot = {
  tasks: [],
  countedTasks: 0,
  activeCount: 0,
  failedCount: 0,
  succeededCount: 0,
  percent: 0,
  uploading: false,
};

interface QueueEntry {
  controller: ChunkUploadController;
  unsubscribe: () => void;
}

const entries = new Map<string, QueueEntry>();
const listeners = new Set<() => void>();
let snapshot: GlobalUploadSnapshot = EMPTY_SNAPSHOT;

const isActive = (status: UploadTaskStatus): boolean =>
  ACTIVE_STATUS.includes(status);

/** 排序权重：推进中 → 失败 → 其它终态 */
function orderWeight(status: UploadTaskStatus): number {
  if (isActive(status)) {
    return 0;
  }
  if (status === 'error') {
    return 1;
  }
  return 2;
}

function computeSnapshot(): GlobalUploadSnapshot {
  const tasks: GlobalUploadTask[] = [];
  let activeCount = 0;
  let failedCount = 0;
  let succeededCount = 0;
  let totalBytes = 0;
  let uploadedBytes = 0;

  for (const [queueId, entry] of entries) {
    for (const task of entry.controller.getSnapshot()) {
      tasks.push({ ...task, queueId, key: `${queueId}:${task.id}` });
      if (task.status === 'canceled') {
        // 取消的任务不计入分母，否则整体进度会被永远拉不满
        continue;
      }
      totalBytes += task.size;
      uploadedBytes += Math.min(task.size, task.uploadedBytes);
      if (isActive(task.status)) {
        activeCount += 1;
      } else if (task.status === 'error') {
        failedCount += 1;
      } else if (task.status === 'success') {
        succeededCount += 1;
      }
    }
  }

  tasks.sort((a, b) => {
    const diff = orderWeight(a.status) - orderWeight(b.status);
    return diff !== 0 ? diff : a.fileName.localeCompare(b.fileName);
  });

  const countedTasks = tasks.filter(
    (task) => task.status !== 'canceled',
  ).length;
  const percent =
    totalBytes > 0
      ? Math.min(100, Math.floor((uploadedBytes / totalBytes) * 100))
      : 0;

  return {
    tasks,
    countedTasks,
    activeCount,
    failedCount,
    succeededCount,
    percent,
    uploading: activeCount > 0,
  };
}

function refresh(): void {
  snapshot = computeSnapshot();
  for (const listener of listeners) {
    listener();
  }
}

/** 仅登记新队列，不广播（新队列必然没有任务，无需通知订阅者） */
function ensure(
  id: string,
  options: ChunkUploadOptions,
): ChunkUploadController {
  const existing = entries.get(id);
  if (existing) {
    return existing.controller;
  }
  const controller = new ChunkUploadController(options);
  const unsubscribe = controller.subscribe(refresh);
  entries.set(id, { controller, unsubscribe });
  return controller;
}

/** 释放队列（登出 / 单测）；仍有任务时会重算聚合快照 */
export function releaseUploadQueue(id: string): void {
  const entry = entries.get(id);
  if (!entry) {
    return;
  }
  entry.unsubscribe();
  entry.controller.destroy();
  entries.delete(id);
  refresh();
}

/**
 * 销毁全部队列（登出时调用）。
 *
 * <p>必须在登出时清掉：控制器持有 `File` 引用与在途请求，留着既有内存占用，
 * 又会在令牌失效后继续用旧凭证打服务端；换个账号登录还会看到上个账号的
 * 上传任务挂在顶栏。
 */
export function disposeAllUploadQueues(): void {
  for (const entry of entries.values()) {
    entry.unsubscribe();
    entry.controller.destroy();
  }
  entries.clear();
  snapshot = EMPTY_SNAPSHOT;
  for (const listener of listeners) {
    listener();
  }
}

export const uploadQueueHub = {
  ensure,
  release: releaseUploadQueue,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot(): GlobalUploadSnapshot {
    return snapshot;
  },
  /** 已登记队列 id（单测用） */
  ids(): string[] {
    return Array.from(entries.keys());
  },
};

/** 单测重置：与 {@link disposeAllUploadQueues} 同语义，语义化别名便于测试里表达意图 */
export function resetUploadQueueHub(): void {
  disposeAllUploadQueues();
}
