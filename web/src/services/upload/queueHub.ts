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
import { DEFAULT_CONCURRENCY, MAX_CONCURRENCY } from './constants';
import type { UploadTaskStatus, UploadTaskView } from './types';

/** 极速模式偏好 key（刷新后仍需保持，否则用户会以为开关没生效） */
const FAST_MODE_STORAGE_KEY = 'at:upload:fast-mode:v1';

/** 读取极速模式偏好；localStorage 不可用（隐私模式 / 单测）时回退关闭。 */
function readFastMode(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    return window.localStorage.getItem(FAST_MODE_STORAGE_KEY) === '1';
  } catch (_error) {
    return false;
  }
}

/** 持久化极速模式偏好（失败不阻断开关本身）。 */
function persistFastMode(enabled: boolean): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.setItem(FAST_MODE_STORAGE_KEY, enabled ? '1' : '0');
  } catch (_error) {
    // 忽略
  }
}

/** 极速模式开关：全队列共享（并发数是契约上限内的同一口径） */
let fastMode = readFastMode();

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
  /** 活跃任务速度之和（字节/秒），供传输面板画速度曲线 */
  speed: number;
  /** 极速模式是否开启（并发分片数取契约上限） */
  fastMode: boolean;
}

const EMPTY_SNAPSHOT: GlobalUploadSnapshot = {
  tasks: [],
  countedTasks: 0,
  activeCount: 0,
  failedCount: 0,
  succeededCount: 0,
  percent: 0,
  uploading: false,
  speed: 0,
  fastMode: false,
};

interface QueueEntry {
  controller: ChunkUploadController;
  unsubscribe: () => void;
}

const entries = new Map<string, QueueEntry>();
const listeners = new Set<() => void>();
let snapshot: GlobalUploadSnapshot = { ...EMPTY_SNAPSHOT, fastMode };

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
  let speed = 0;

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
        // 只累加活跃任务：已完成任务会保留末次速度，计入会让曲线虚高
        speed += task.speed ?? 0;
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
    speed,
    fastMode,
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
  // 极速模式：新建队列按当前偏好起跑；已登记的队列由 setUploadFastMode 就地改写。
  // 关闭极速模式时保留调用方显式传入的并发数，避免覆盖上传页自己的设置。
  options.concurrency = fastMode
    ? MAX_CONCURRENCY
    : (options.concurrency ?? DEFAULT_CONCURRENCY);
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
  // 保留极速模式偏好：销毁队列不等于用户关掉了加速开关
  snapshot = { ...EMPTY_SNAPSHOT, fastMode };
  for (const listener of listeners) {
    listener();
  }
}

/** 遍历全部队列控制器（全局动作的唯一入口，避免各调用方各写一遍循环） */
function eachController(action: (controller: ChunkUploadController) => void): void {
  for (const entry of entries.values()) {
    action(entry.controller);
  }
}

/** 暂停全部队列（传输面板「全部暂停」） */
export function pauseAllUploadQueues(): void {
  eachController((controller) => controller.pauseAll());
  refresh();
}

/** 继续全部队列：恢复暂停任务，并重试失败任务（控制器内部走同一入口） */
export function resumeAllUploadQueues(): void {
  eachController((controller) => controller.resumeAll());
  refresh();
}

/** 清空全部已终结任务（进行中与失败任务保留，避免误清待处理项） */
export function clearFinishedUploadTasks(): void {
  eachController((controller) => controller.clearFinished());
  refresh();
}

/**
 * 暂停单个任务。
 *
 * <p>任务 id 只在所属队列内唯一（各队列都从 `upload-1` 起编号），因此必须带 queueId。
 */
export function pauseUploadTask(queueId: string, taskId: string): void {
  entries.get(queueId)?.controller.pause(taskId);
  refresh();
}

/** 继续 / 重试单个任务（控制器内部把 paused 与 error 走同一入口） */
export function resumeUploadTask(queueId: string, taskId: string): void {
  void entries.get(queueId)?.controller.resume(taskId);
  refresh();
}

/**
 * 极速模式：把并发分片数切到契约上限。
 *
 * <p>控制器在每轮分片调度时才读并发数，所以对进行中的任务同样生效
 * （下一批分片按新并发发出），不需要重新入队。
 */
export function setUploadFastMode(enabled: boolean): void {
  fastMode = enabled;
  persistFastMode(enabled);
  eachController((controller) => {
    controller.setConcurrency(
      enabled ? MAX_CONCURRENCY : DEFAULT_CONCURRENCY,
    );
  });
  refresh();
}

/** 当前极速模式开关（面板直接读，避免额外订阅） */
export function isUploadFastMode(): boolean {
  return fastMode;
}

export const uploadQueueHub = {
  ensure,
  release: releaseUploadQueue,
  pauseAll: pauseAllUploadQueues,
  resumeAll: resumeAllUploadQueues,
  pauseTask: pauseUploadTask,
  resumeTask: resumeUploadTask,
  clearFinished: clearFinishedUploadTasks,
  setFastMode: setUploadFastMode,
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
