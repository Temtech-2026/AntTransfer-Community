/**
 * 待办 → 跳转目标解析（纯函数，可单测）。
 *
 * <p>为什么单独抽一个文件而不是写在页面里：这段映射的口径来自后端（`TodoItemVO` 的
 * `notifyType` / `bizType` 两个字段），改一处就会影响「点待办跳去哪儿」这个高频动作，
 * 而页面组件很难为它写单测。抽成纯函数后可以逐条断言，且不依赖 React / Umi。
 *
 * <p>两条口径：
 * <ol>
 *   <li><b>优先看 `notifyType`</b>：1 待我审批 → 审批中心「待我审批」页签；2 审批结果 →
 *       审批中心「我发起」页签；8 传输完成 → 文件工作台。审批两类<b>类型不同但落点同域</b>，
 *       只是页签不同，所以用 `?view=` 区分而不是两个路由。</li>
 *   <li><b>`bizType` 只做兜底</b>：后端以后新增通知类型时，`notifyType` 落不进上面三支，
 *       但 `bizType=APPLICATION / TRANSFER` 仍能给出大致正确的落点——总比「点了没反应」好。</li>
 * </ol>
 */

import type { PermCode } from '@/services/access';
import { NotifyType } from '@/services/notify';
import { TodoBizType, type TodoItem } from '@/services/todo';

/** 跳转目标语义（决定按钮文案与权限点，与具体 URL 解耦）。 */
export type TodoTargetKind = 'approval-todo' | 'approval-result' | 'transfer';

/** 解析结果。 */
export interface TodoTarget {
  kind: TodoTargetKind;
  /** 目标路径（含查询串，可直接交给 `history.push`）。 */
  path: string;
  /**
   * 落点页面所需的权限点。
   *
   * <p>调用方应先 `access.can(perm)`：没有权限就<b>不要跳</b>（否则跳到 /file 只会看到 403），
   * 而是就地提示「对应页面暂未开放」。审批中心两个端点后端不要求权限点，
   * 因此 approval 两类不设 `perm`。
   */
  perm?: PermCode;
}

/** 页面侧只关心这三个字段，入参放宽到 `Pick` 便于单测构造最小对象。 */
type TodoTargetSource = Pick<TodoItem, 'notifyType' | 'bizType'>;

/**
 * 解析跳转目标。
 *
 * @returns 无法识别时返回 `null`（调用方据此不渲染「去处理」按钮，而不是给一个死链）
 */
export function resolveTodoTarget(item: TodoTargetSource): TodoTarget | null {
  switch (item.notifyType) {
    case NotifyType.APPROVAL_TODO:
      return { kind: 'approval-todo', path: '/approval?view=pending' };
    case NotifyType.APPROVAL_RESULT:
      return { kind: 'approval-result', path: '/approval?view=mine' };
    case NotifyType.TRANSFER_COMPLETED:
      return { kind: 'transfer', path: '/file', perm: 'file:download' };
    default:
      break;
  }

  // 兜底：notifyType 未知时按业务类型给大致落点
  if (item.bizType === TodoBizType.APPLICATION) {
    return { kind: 'approval-todo', path: '/approval?view=pending' };
  }
  if (item.bizType === TodoBizType.TRANSFER) {
    return { kind: 'transfer', path: '/file', perm: 'file:download' };
  }
  return null;
}

/**
 * 带权限判定的解析。
 *
 * <p>`can` 缺省时视为「未提供权限信息」→ 一律放行，让后端 403 去兜底；
 * 传了 `can` 且判定为无权限才返回 `null`。
 */
export function resolveTodoTargetWithAccess(
  item: TodoTargetSource,
  can?: (perm: PermCode) => boolean,
): TodoTarget | null {
  const target = resolveTodoTarget(item);
  if (!target?.perm || !can) {
    return target;
  }
  return can(target.perm) ? target : null;
}
