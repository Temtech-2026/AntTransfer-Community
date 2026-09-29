/** 권한 지도(리소스 × 주체 매트릭스 / 권한 타임라인) 문구. */
export default {
  /* ============================ 页面骨架 ============================ */
  'permissionMap.page.title': '권한 지도',
  'permissionMap.page.subTitle': '내가 보유한 권한 포인트, 출처 및 유효 기간',
  'permissionMap.loadFailed': '권한 지도를 불러오지 못했습니다',

  /* ============================ 概览卡片 ============================ */
  'permissionMap.stat.perm.title': '권한 포인트',
  'permissionMap.stat.perm.footer': '백엔드는 “보유 여부”만 제공합니다',
  'permissionMap.stat.role.title': '역할',
  'permissionMap.stat.role.footer': '권한 포인트의 알려진 출처 중 하나',
  'permissionMap.stat.grant.title': '승인된 권한 부여',
  'permissionMap.stat.grant.footer': '그중 {expired}건은 만료됨',
  'permissionMap.stat.expiring.footer': '7일 내 만료',

  /* ============================ 权限概览 ============================ */
  'permissionMap.overview.title': '권한 개요',
  'permissionMap.overview.subTitle': '사용자, 데이터 범위 및 권한 포인트',
  'permissionMap.overview.userId': '사용자 ID',
  'permissionMap.overview.dataScope': '데이터 범위',
  'permissionMap.overview.roles': '역할',
  'permissionMap.overview.grants': '승인된 권한 부여',
  'permissionMap.grant.total': '총 {total}건',
  'permissionMap.grant.expiringSuffix': '{count}건 만료 예정',
  'permissionMap.grant.expiredSuffix': '{count}건 만료됨',
  'permissionMap.permCodes.title': '권한 포인트({count})',
  'permissionMap.permCodes.desc':
    '백엔드는 “보유 여부”만 제공하며 항목별 출처는 후속 API가 필요합니다. 아래 역할과 승인된 권한 부여가 알려진 두 가지 출처입니다.',
  'permissionMap.permCodes.empty': '권한 포인트가 없습니다',

  /* ============================ 授权来源表 ============================ */
  'permissionMap.grants.title': '권한 부여 출처',
  'permissionMap.grants.subTitle': '승인된 권한 부여 총 {count}건',
  'permissionMap.grants.empty': '승인된 권한 부여가 없습니다',
  'permissionMap.column.source': '출처',
  'permissionMap.column.grantType': '권한 부여 동작',
  'permissionMap.column.resource': '리소스',
  'permissionMap.column.application': '출처 신청서',
  'permissionMap.column.expireAt': '만료 시간',
  'permissionMap.column.validity': '유효 기간 상태',
  'permissionMap.source.approval': '승인된 권한 부여',

  /* ============================ 有效期时间轴 ============================ */
  'permissionMap.timeline.title': '유효 기간 타임라인',
  'permissionMap.timeline.subTitle':
    '만료 축: 권한 부여가 저장되면 즉시 적용됩니다',
  'permissionMap.timeline.expirePrefix': '만료',
  'permissionMap.timeline.fromApplication': '출처 신청서 #{id}',
  'permissionMap.timeline.empty': '유효 기간이 있는 권한 부여가 없습니다',

  /* ============================ 授权状态分布（可视化） ============================ */
  'permissionMap.distribution.title': '권한 부여 상태 분포',
  'permissionMap.distribution.subTitle':
    '승인된 권한 부여 총 {count}건을 유효 기간 상태별로 집계',
  'permissionMap.distribution.empty':
    '승인된 권한 부여가 없어 상태 분포를 그릴 수 없습니다',
  'permissionMap.distribution.percent': '{percent}%',
  'permissionMap.validity.barTip':
    '{days}일 남음. 막대 길이는 {horizon}일을 상한으로 한 시각적 눈금입니다(백엔드가 적용 시각을 내려주지 않아 “사용 비율”은 그릴 수 없습니다)',

  /* ============================ 授权状态与剩余天数 ============================ */
  'permissionMap.grantState.active': '유효',
  'permissionMap.grantState.expiring': '만료 예정',
  'permissionMap.grantState.expired': '만료됨',
  'permissionMap.grantState.permanent': '기간 제한 없음',
  'permissionMap.remainDays': '{days}일 남음',

  /* ============================ 权限域分布（前端按前缀分组） ============================ */
  'permissionMap.permCodes.domainTitle': '권한 도메인 분포',
  'permissionMap.permCodes.domainDesc':
    '권한 포인트의 `:` 접두사로 프런트엔드에서 묶은 그룹입니다(백엔드에 “도메인” 필드가 없습니다). 막대 길이는 항목 수가 가장 많은 그룹 기준입니다.',
  'permissionMap.permCodes.domainOther': '기타',
  'permissionMap.permCodes.domainCount': '{count}개',
} as const;
