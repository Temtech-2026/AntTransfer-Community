/**
 * 待办域类型与取值口径（前端镜像后端 {@code TodoItemVO} / {@code TodoController}）。
 *
 * <p>两个容易踩的点，都在这里收口：
 * <ol>
 *   <li>{@code pending} 是<b>三态字符串</b>而不是布尔：后端 {@code parsePending} 把
 *       「缺省 / 空串 / all」判为 {@code null}（=全部），其余走 {@code Boolean.parseBoolean}。
 *       若图省事传 {@code pending=false} 想表达「全部」，拿到的其实是「仅已办」。
 *       故用 {@link TodoPendingFilter} 显式表达三态，再由 {@link toPendingParam} 映射。</li>
 *   <li>跳转目标不能只看 {@code notifyType}，「审批待办」与「审批结果」类型不同但落点相同，
 *       而「传输完成」的落点取决于 {@code bizType}——映射见页面侧 {@code todoTarget.ts}。</li>
 * </ol>
 */

/** 待办三态筛选。 */
export type TodoPendingFilter = 'pending' | 'done' | 'all';

/** 关联业务类型（与后端 bizType 常量逐字符对齐）。 */
export const TodoBizType = {
  /** 权限申请单（跳审批中心）。 */
  APPLICATION: 'APPLICATION',
  /** 传输任务（跳传输/文件）。 */
  TRANSFER: 'TRANSFER',
} as const;

/** 待办条目（`TodoItemVO`）。 */
export interface TodoItem {
  /** 消息 ID，同时也是待办项 ID。 */
  id: number;
  /** 通知类型：1 待我审批 / 2 审批结果 / 8 传输完成。 */
  notifyType: number;
  title?: string | null;
  content?: string | null;
  /** 关联业务类型（APPLICATION / TRANSFER）。 */
  bizType?: string | null;
  /** 关联业务 ID，据此跳转到申请单 / 传输详情。 */
  bizId?: number | null;
  /** 是否未办（后端由 readStatus 判定，前端不反推）。 */
  pending: boolean;
  createTime?: string | null;
}

/**
 * 三态 → 后端 `pending` 查询参数。
 *
 * <p>`all` 刻意返回 `undefined`（让 axios 丢掉该参数）而不是字符串 `'all'`：
 * 后端对「缺省」与「all」等价，省略参数是两边都不会误解的最小契约。
 */
export function toPendingParam(filter: TodoPendingFilter): string | undefined {
  if (filter === 'all') {
    return undefined;
  }
  return filter === 'done' ? 'false' : 'true';
}

/** 角标计数兜底：非数字 / 负数一律归零，避免出现 "-1"。 */
export function normalizeTodoCount(raw: unknown): number {
  const num = Number(raw);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : 0;
}
