/**
 * 工作台仪表盘端点。
 *
 * <p>这里**只有**一个端点，因为它只承载「工作台独有的能力」；其余三个卡片直接复用
 * 已有域的服务函数（审批 → services/approval，未读快照 → services/notify），
 * 不在这里另包一层——多一层包装就多一处会和原域漂移的口径。
 */

export const DASHBOARD_ENDPOINTS = {
  /** 传输统计聚合（传输量 / 成功率）：at-transfer `TransferStatisticsController`。 */
  transferStats: '/api/v1/transfers/statistics',
} as const;
