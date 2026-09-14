/**
 * 待办中心端点常量（唯一改动点）。
 *
 * <p>与后端 {@code at-collaboration} 的 {@code TodoController}（{@code @RequestMapping("/v1/todos")}）
 * 逐条对齐。待办**不是独立实体**：它是 {@code sys_notify_message} 按类型（1 待我审批 /
 * 2 审批结果 / 8 传输完成）+ 未读状态的投影视图，因此这里只有「分页」与「计数」两个端点，
 * 没有创建 / 删除待办——待办由业务动作（提交申请、审批、传输完成）产生，
 * 前端能建待办就会出现「有待办但单据不存在」的幽灵条目（后端类注释同口径）。
 */

export const TODO_ENDPOINTS = {
  /** 待办分页（`pending` 三态：true 未办 / false 已办 / 缺省=全部）。 */
  page: '/api/v1/todos',

  /** 待办角标数（单值接口，角标轮询不必拉整个未读快照）。 */
  count: '/api/v1/todos/count',
} as const;
