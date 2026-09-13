/**
 * `useChunkUpload`：分片上传的 React 绑定。
 *
 * 引擎（{@link ChunkUploadController}）刻意与 React 解耦，这里只做三件事：
 * 1. 用模块级注册表按 `id` 复用同一个控制器实例——上传属于「离开页面也要继续」的
 *    长任务，组件卸载不能连带中止传输；
 * 2. 用 `useSyncExternalStore` 订阅快照，避免把高频进度写进 state 引发渲染风暴；
 * 3. 把动作函数包成稳定引用，便于配合 `useCallback` / 依赖数组使用。
 *
 * 入参对象每次渲染都会被同步到控制器持有的同一个 options 引用上，
 * 因此并发数、回调等配置变更无需重建控制器。
 */

import { useMemo, useRef, useSyncExternalStore } from 'react';

import {
  ChunkUploadController,
  type ChunkUploadOptions,
} from '@/services/upload/ChunkUploadController';
import type { ResumableRecord, UploadTaskView } from '@/services/upload/types';

/** 同一 `id` 全局共享一个控制器 */
const registry = new Map<string, ChunkUploadController>();

function getController(
  id: string,
  options: ChunkUploadOptions,
): ChunkUploadController {
  let controller = registry.get(id);
  if (!controller) {
    controller = new ChunkUploadController(options);
    registry.set(id, controller);
  }
  return controller;
}

/** 单测/登出时销毁指定控制器 */
export function disposeUploadController(id = 'default'): void {
  const controller = registry.get(id);
  if (controller) {
    controller.destroy();
    registry.delete(id);
  }
}

export interface UseChunkUploadOptions extends ChunkUploadOptions {
  /** 控制器实例标识：同 id 的多个组件共享同一份上传队列 */
  id?: string;
}

export interface UseChunkUploadResult {
  /** 当前队列（整体进度条据此汇总） */
  tasks: UploadTaskView[];
  /** 刷新前遗留、可续传的任务（需用户重新选择同一文件） */
  resumable: ResumableRecord[];
  /** 加入文件并立即开始 */
  start: (files: File[] | FileList) => string[];
  pause: (id: string) => void;
  pauseAll: () => void;
  resume: (id: string) => void;
  resumeAll: () => void;
  retry: (id: string) => void;
  cancel: (id: string) => void;
  remove: (id: string) => void;
  clearFinished: () => void;
  /** 忽略某条刷新前遗留记录 */
  discardRecord: (key: string) => void;
}

export function useChunkUpload(
  options: UseChunkUploadOptions = {},
): UseChunkUploadResult {
  const { id = 'default', ...rest } = options;
  // 稳定引用：控制器持有该对象本身，渲染时同步最新配置
  const liveOptions = useRef<ChunkUploadOptions>({}).current;
  Object.assign(liveOptions, rest);

  const store = useMemo(
    () => getController(id, liveOptions),
    [id, liveOptions],
  );

  const tasks = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const resumable = useSyncExternalStore(
    store.subscribe,
    store.getResumable,
    store.getResumable,
  );

  return useMemo(
    () => ({
      tasks,
      resumable,
      start: (files: File[] | FileList) => store.addFiles(files, true),
      pause: (taskId: string) => store.pause(taskId),
      pauseAll: () => store.pauseAll(),
      resume: (taskId: string) => store.resume(taskId),
      resumeAll: () => store.resumeAll(),
      retry: (taskId: string) => store.retry(taskId),
      cancel: (taskId: string) => store.cancel(taskId),
      remove: (taskId: string) => store.remove(taskId),
      clearFinished: () => store.clearFinished(),
      discardRecord: (key: string) => store.discardRecord(key),
    }),
    [store, tasks, resumable],
  );
}
