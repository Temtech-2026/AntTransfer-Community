/**
 * 待办中心数据访问。
 *
 * <p>分页参数名是 {@code current / pageSize}（`PageResult` 口径），与分享域的
 * {@code page / size} 不同——这是后端两个域的既有差异，映射只在这一层做。
 */

import { markNotificationRead } from '@/services/notify';
import { requestData, requestPage } from '@/services/request';

import { TODO_ENDPOINTS } from './endpoints';
import { normalizeTodoCount, toPendingParam, type TodoItem, type TodoPendingFilter } from './types';

/** 待办分页。 */
export function pageTodos(
  params: { pending?: TodoPendingFilter; current?: number; pageSize?: number } = {},
) {
  const { pending = 'pending', current = 1, pageSize = 20 } = params;
  return requestPage<TodoItem>(TODO_ENDPOINTS.page, {
    method: 'GET',
    params: {
      // undefined 会被 axios 丢弃，正好等价于后端「缺省 = 全部」
      pending: toPendingParam(pending),
      current,
      pageSize,
    },
  });
}

/**
 * 待办角标数（失败时按 0 降级）。
 *
 * <p>与未读快照同理：这是后台维护性调用，弹 toast 只会打扰用户；
 * 数字下一轮快照会自我纠正。
 */
export async function fetchTodoCount(): Promise<number> {
  try {
    const raw = await requestData<{ todo?: number } | null>(TODO_ENDPOINTS.count, {
      method: 'GET',
      silent: true,
    });
    return normalizeTodoCount(raw?.todo);
  } catch (error) {
    console.warn('[anttransfer] 待办角标拉取失败，按 0 降级', error);
    return 0;
  }
}

/**
 * 标记待办已处置。
 *
 * <p>复用通知域的 {@code POST /v1/notifications/{id}/read}：待办的「已办」就是那条通知的
 * 「已读」（后端以通知为唯一事实源，见 {@code TodoItemVO} 类注释），没有独立的待办写接口。
 */
export function markTodoHandled(id: number) {
  return markNotificationRead(id);
}
