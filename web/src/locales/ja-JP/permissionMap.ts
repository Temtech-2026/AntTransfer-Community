/** 権限マップ（リソース × 主体マトリクス / 付与タイムライン）の文言。 */
export default {
  /* ============================ ページ骨格 ============================ */
  'permissionMap.page.title': '権限マップ',
  'permissionMap.page.subTitle': '自分が保有する権限ポイント・由来・有効期限',
  'permissionMap.loadFailed': '権限マップの読み込みに失敗しました',

  /* ============================ 概要カード ============================ */
  'permissionMap.stat.perm.title': '権限ポイント',
  'permissionMap.stat.perm.footer':
    'バックエンドは「保有の有無」のみ提供します',
  'permissionMap.stat.role.title': 'ロール',
  'permissionMap.stat.role.footer': '権限ポイントの既知の由来のひとつ',
  'permissionMap.stat.grant.title': '承認による付与',
  'permissionMap.stat.grant.footer': 'うち {expired} 件は期限切れ',
  'permissionMap.stat.expiring.footer': '7 日以内に期限切れ',

  /* ============================ 権限概要 ============================ */
  'permissionMap.overview.title': '権限の概要',
  'permissionMap.overview.subTitle': 'ユーザー・データ範囲・権限ポイント',
  'permissionMap.overview.userId': 'ユーザー ID',
  'permissionMap.overview.dataScope': 'データ範囲',
  'permissionMap.overview.roles': 'ロール',
  'permissionMap.overview.grants': '承認による付与',
  'permissionMap.grant.total': '全 {total} 件',
  'permissionMap.grant.expiringSuffix': '{count} 件がまもなく期限切れ',
  'permissionMap.grant.expiredSuffix': '{count} 件が期限切れ',
  'permissionMap.permCodes.title': '権限ポイント（{count}）',
  'permissionMap.permCodes.desc':
    'バックエンドは「保有の有無」のみ提供します。ポイント単位の由来は今後の API 待ちです。以下のロールと承認による付与が既知の 2 つの由来です。',
  'permissionMap.permCodes.empty': '権限ポイントはありません',

  /* ============================ 付与元テーブル ============================ */
  'permissionMap.grants.title': '付与元',
  'permissionMap.grants.subTitle': '承認による付与 全 {count} 件',
  'permissionMap.grants.empty': '承認による付与はありません',
  'permissionMap.column.source': '由来',
  'permissionMap.column.grantType': '付与アクション',
  'permissionMap.column.resource': 'リソース',
  'permissionMap.column.application': '元の申請書',
  'permissionMap.column.expireAt': '有効期限',
  'permissionMap.column.validity': '有効期間の状態',
  'permissionMap.source.approval': '承認による付与',

  /* ============================ 有効期限タイムライン ============================ */
  'permissionMap.timeline.title': '有効期限タイムライン',
  'permissionMap.timeline.subTitle': '期限軸：付与が登録された時点で有効',
  'permissionMap.timeline.expirePrefix': '期限',
  'permissionMap.timeline.fromApplication': '元の申請書 #{id}',
  'permissionMap.timeline.empty': '有効期限のある付与はありません',

  /* ============================ 付与状態の分布（可視化） ============================ */
  'permissionMap.distribution.title': '付与状態の分布',
  'permissionMap.distribution.subTitle':
    '承認による付与 全 {count} 件を有効期間の状態別に集計',
  'permissionMap.distribution.empty':
    '承認による付与がないため、状態分布を描画できません',
  'permissionMap.distribution.percent': '{percent}%',
  'permissionMap.validity.barTip':
    '残り {days} 日。バーの長さは {horizon} 日を上限とした目盛りです（バックエンドが発効時刻を返さないため「消化済みの割合」は描画できません）',

  /* ============================ 付与状態と残日数 ============================ */
  'permissionMap.grantState.active': '有効',
  'permissionMap.grantState.expiring': 'まもなく期限切れ',
  'permissionMap.grantState.expired': '期限切れ',
  'permissionMap.grantState.permanent': '無期限',
  'permissionMap.remainDays': '残り {days} 日',

  /* ============================ 権限ドメイン分布（フロントで接頭辞ごとに分類） ============================ */
  'permissionMap.permCodes.domainTitle': '権限ドメインの分布',
  'permissionMap.permCodes.domainDesc':
    '権限ポイントの `:` 接頭辞でフロント側が分類したものです（バックエンドに「ドメイン」という項目はありません）。バーの長さは件数が最多のグループに対する相対値です。',
  'permissionMap.permCodes.domainOther': 'その他',
  'permissionMap.permCodes.domainCount': '{count} 件',
} as const;
