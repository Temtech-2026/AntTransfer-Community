/**
 * 工作台仪表盘出口（services/dashboard）。
 *
 * <p>只导出「本域独有」的东西：传输统计、待我审批数量、
 * 以及成功率的折算纯函数。待办数请直接用 `services/notify` 的 `fetchUnreadCount().todo`。
 */

export * from './api';
export * from './endpoints';
export * from './types';
