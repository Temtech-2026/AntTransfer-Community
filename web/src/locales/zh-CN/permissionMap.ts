/** 权限地图（资源 × 主体矩阵 / 授权时间线）文案。 */
export default {
  /* ============================ 页面骨架 ============================ */
  'permissionMap.page.title': '权限地图',
  'permissionMap.page.subTitle': '我持有的权限点、来源与有效期',
  'permissionMap.loadFailed': '权限地图加载失败',

  /* ============================ 概览卡片 ============================ */
  'permissionMap.stat.perm.title': '权限点',
  'permissionMap.stat.perm.footer': '后端只提供「是否持有」',
  'permissionMap.stat.role.title': '角色',
  'permissionMap.stat.role.footer': '权限点的已知来源之一',
  'permissionMap.stat.grant.title': '审批授权',
  'permissionMap.stat.grant.footer': '其中 {expired} 条已过期',
  'permissionMap.stat.expiring.footer': '7 天内到期',

  /* ============================ 权限概览 ============================ */
  'permissionMap.overview.title': '权限概览',
  'permissionMap.overview.subTitle': '用户、数据范围与权限点',
  'permissionMap.overview.userId': '用户 ID',
  'permissionMap.overview.dataScope': '数据范围',
  'permissionMap.overview.roles': '角色',
  'permissionMap.overview.grants': '审批授权',
  'permissionMap.grant.total': '共 {total} 条',
  'permissionMap.grant.expiringSuffix': '{count} 条即将到期',
  'permissionMap.grant.expiredSuffix': '{count} 条已过期',
  'permissionMap.permCodes.title': '权限点（{count}）',
  'permissionMap.permCodes.desc':
    '后端只提供「是否持有」，逐点来源需等后续接口；下方角色与审批授权是两条已知来源。',
  'permissionMap.permCodes.empty': '暂无权限点',

  /* ============================ 授权来源表 ============================ */
  'permissionMap.grants.title': '授权来源',
  'permissionMap.grants.subTitle': '共 {count} 条审批授权',
  'permissionMap.grants.empty': '暂无审批授权',
  'permissionMap.column.source': '来源',
  'permissionMap.column.grantType': '授权动作',
  'permissionMap.column.resource': '资源',
  'permissionMap.column.application': '来源申请单',
  'permissionMap.column.expireAt': '到期时间',
  'permissionMap.column.validity': '有效期状态',
  'permissionMap.source.approval': '审批授权',

  /* ============================ 有效期时间轴 ============================ */
  'permissionMap.timeline.title': '有效期时间轴',
  'permissionMap.timeline.subTitle': '到期轴：授权落库即生效',
  'permissionMap.timeline.expirePrefix': '到期',
  'permissionMap.timeline.fromApplication': '来源申请单 #{id}',
  'permissionMap.timeline.empty': '暂无带有效期的授权',

  /* ============================ 授权状态分布（可视化） ============================ */
  'permissionMap.distribution.title': '授权状态分布',
  'permissionMap.distribution.subTitle':
    '共 {count} 条审批授权，按有效期状态汇总',
  'permissionMap.distribution.empty': '暂无审批授权，画不出状态分布',
  'permissionMap.distribution.percent': '{percent}%',
  'permissionMap.validity.barTip':
    '剩 {days} 天；条长是 {horizon} 天封顶的视觉刻度（后端不下发生效时间，画不出「已用比例」）',

  /* ============================ 授权状态与剩余天数 ============================ */
  'permissionMap.grantState.active': '生效中',
  'permissionMap.grantState.expiring': '即将到期',
  'permissionMap.grantState.expired': '已过期',
  'permissionMap.grantState.permanent': '长期有效',
  'permissionMap.remainDays': '剩 {days} 天',

  /* ============================ 权限域分布（前端按前缀分组） ============================ */
  'permissionMap.permCodes.domainTitle': '权限域分布',
  'permissionMap.permCodes.domainDesc':
    '按权限点 `:` 前缀做的前端分组（后端没有「域」这个字段）；条长相对条数最多的一组。',
  'permissionMap.permCodes.domainOther': '其他',
  'permissionMap.permCodes.domainCount': '{count} 个',
} as const;
