/** 权限地图（资源 × 主体矩阵 / 授权时间线）文案。 */
export default {
  /* ============================ 页面骨架 ============================ */
  'permissionMap.page.title': 'Permission Map',
  'permissionMap.page.subTitle': 'The permissions I hold, their sources and validity',
  'permissionMap.loadFailed': 'Failed to load the permission map',

  /* ============================ 概览卡片 ============================ */
  'permissionMap.stat.perm.title': 'Permission points',
  'permissionMap.stat.perm.footer': 'The backend only reports whether you hold them',
  'permissionMap.stat.role.title': 'Roles',
  'permissionMap.stat.role.footer': 'One of the known sources of permission points',
  'permissionMap.stat.grant.title': 'Approved grants',
  'permissionMap.stat.grant.footer': '{expired} of them have expired',
  'permissionMap.stat.expiring.footer': 'Expiring within 7 days',

  /* ============================ 权限概览 ============================ */
  'permissionMap.overview.title': 'Permission overview',
  'permissionMap.overview.subTitle': 'User, data scope and permission points',
  'permissionMap.overview.userId': 'User ID',
  'permissionMap.overview.dataScope': 'Data scope',
  'permissionMap.overview.roles': 'Roles',
  'permissionMap.overview.grants': 'Approved grants',
  'permissionMap.grant.total': '{total} in total',
  'permissionMap.grant.expiringSuffix': '{count} expiring soon',
  'permissionMap.grant.expiredSuffix': '{count} expired',
  'permissionMap.permCodes.title': 'Permission points ({count})',
  'permissionMap.permCodes.desc':
    'The backend only reports whether you hold each permission point; a per-point source mapping needs a future endpoint. The roles and approved grants below are the two known sources.',
  'permissionMap.permCodes.empty': 'No permission points',

  /* ============================ 授权来源表 ============================ */
  'permissionMap.grants.title': 'Grant sources',
  'permissionMap.grants.subTitle': '{count} approved grants',
  'permissionMap.grants.empty': 'No approved grants',
  'permissionMap.column.source': 'Source',
  'permissionMap.column.grantType': 'Grant action',
  'permissionMap.column.resource': 'Resource',
  'permissionMap.column.application': 'Source application',
  'permissionMap.column.expireAt': 'Expires at',
  'permissionMap.column.validity': 'Validity status',
  'permissionMap.source.approval': 'Approved grant',

  /* ============================ 有效期时间轴 ============================ */
  'permissionMap.timeline.title': 'Validity timeline',
  'permissionMap.timeline.subTitle': 'Expiry axis: a grant takes effect once persisted',
  'permissionMap.timeline.expirePrefix': 'Expires',
  'permissionMap.timeline.fromApplication': 'Source application #{id}',
  'permissionMap.timeline.empty': 'No grants with a validity period',

  /* ============================ 授权状态分布（可视化） ============================ */
  'permissionMap.distribution.title': 'Grant status distribution',
  'permissionMap.distribution.subTitle':
    '{count} approved grants, grouped by validity status',
  'permissionMap.distribution.empty':
    'No approved grants yet, so there is no distribution to draw',
  'permissionMap.distribution.percent': '{percent}%',
  'permissionMap.validity.barTip':
    '{days} days left; the bar is a visual scale capped at {horizon} days (the backend does not send the start time, so an "elapsed share" cannot be drawn)',

  /* ============================ 授权状态与剩余天数 ============================ */
  'permissionMap.grantState.active': 'Active',
  'permissionMap.grantState.expiring': 'Expiring soon',
  'permissionMap.grantState.expired': 'Expired',
  'permissionMap.grantState.permanent': 'Permanent',
  'permissionMap.remainDays': '{days} days left',

  /* ============================ 权限域分布（前端按前缀分组） ============================ */
  'permissionMap.permCodes.domainTitle': 'Permission domains',
  'permissionMap.permCodes.domainDesc':
    'A front-end grouping by the `:` prefix of each permission point (the backend has no "domain" field); bar length is relative to the largest group.',
  'permissionMap.permCodes.domainOther': 'Other',
  'permissionMap.permCodes.domainCount': '{count}',
} as const;
