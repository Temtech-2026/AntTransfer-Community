/** 承認センター（タスク / 申請一覧 / 詳細 / 判断）の文言。 */
export default {
  // ページ
  'approval.title': '承認センター',
  'approval.subtitle': '自分の承認待ちと、自分が起票した権限申請',
  'approval.tab.pending': '承認待ち',
  'approval.tab.mine': '自分の申請',
  'approval.slaNotice':
    'SLA は機密レベルから算出します（公開 24h / 社内 12h / 機密 4h）。超過はあくまで通知であり、自動承認や権限の開放は行いません。',
  'approval.decisionSubmitted': '承認結果を送信しました',
  'approval.longTerm': '無期限',

  // 一覧の列
  'approval.column.applicationNo': '申請番号',
  'approval.column.applyAction': '申請アクション',
  'approval.column.level': '機密レベル',
  'approval.column.resource': 'リソース',
  'approval.column.applicant': '申請者',
  'approval.column.purpose': '利用目的',
  'approval.column.desiredExpireAt': '希望期限',
  'approval.column.sla': 'SLA',
  'approval.column.status': 'ステータス',
  'approval.column.opinion': '承認コメント',
  'approval.column.createdAt': '申請日時',
  'approval.column.actions': '操作',

  // 行内操作
  'approval.rowAction.detail': '詳細',
  'approval.rowAction.approve': '承認',
  'approval.rowAction.reject': '却下',

  // 承認票のステータス
  'approval.status.pending': '承認待ち',
  'approval.status.approved': '承認済み',
  'approval.status.rejected': '却下済み',
  'approval.status.transferred': '転送済み',
  'approval.status.cancelled': '取り消し済み',
  'approval.status.unknown': '不明',

  // 付与アクション
  'approval.grantAction.access': 'アクセス（プレビュー）',
  'approval.grantAction.download': 'ダウンロード',
  'approval.grantAction.edit': '編集',
  'approval.grantAction.share': '外部共有',
  'approval.grantAction.unknown': '不明なアクション',

  // SLA（カウントダウンと期限時刻）
  'approval.sla.noDeadline': '--',
  'approval.sla.overdue.days': '{days} 日 {hours} 時間超過',
  'approval.sla.overdue.hours': '{hours} 時間 {minutes} 分超過',
  'approval.sla.overdue.minutes': '{minutes} 分超過',
  'approval.sla.tooltip':
    '{deadline} までに対応してください（超過は通知のみで、自動開放は行いません）',

  // 詳細ドロワー
  'approval.detail.title': '承認票の詳細',
  'approval.detail.slaDeadline': '期限 {deadline}',
  'approval.detail.timeline': '履歴',
  'approval.timeline.submit': '申請を提出',
  'approval.timeline.purpose': '利用目的：{purpose}',
  'approval.timeline.approved': '承認',
  'approval.timeline.rejected': '却下',
  'approval.timeline.transferred': '他者へ転送',
  'approval.timeline.cancelled': '申請者が取り消し',
  'approval.timeline.pending': '承認待ち',

  // 判断ダイアログ
  'approval.modal.approveTitle': '承認する',
  'approval.modal.rejectTitle': '申請を却下',
  'approval.modal.approveOk': '承認を確定',
  'approval.modal.rejectOk': '却下を確定',
  'approval.modal.applicationNo': '申請番号：{no}',
  'approval.modal.applyScope': '申請：{action}',
  'approval.modal.desiredExpireAt': '希望期限：{at}',
  'approval.modal.grantScope':
    '付与範囲（絞ることはできても、申請範囲は超えられません）',
  'approval.modal.grantScopeDownscoped':
    '申請アクション「{action}」より小さい範囲です。より狭い範囲で付与されます',
  'approval.modal.grantScopeSame': '申請範囲と同一',
  'approval.modal.grantScopePlaceholder': '付与アクションを選択',
  'approval.modal.expireAt':
    '付与の有効期限（短縮はできても、申請値を超えられません）',
  'approval.modal.expireCapped':
    '選択した時刻は申請者の希望より後です。{expireAt} に収束します',
  'approval.modal.expireKeep': '空欄の場合は無期限',
  'approval.modal.expirePlaceholder': '空欄 = 無期限',
  'approval.modal.opinionApprove': '承認コメント（任意）',
  'approval.modal.opinionReject': '却下理由（必須）',
  'approval.modal.opinionMax': '{max} 文字以内',
  'approval.modal.opinionRequired': '却下理由を入力してください',
  'approval.modal.opinionPlaceholderApprove': '付与条件を補足できます',
  'approval.modal.opinionPlaceholderReject':
    '却下理由を記入してください。申請者にも共有されます',
  'approval.modal.notice':
    '承認すると即時有効になります。付与範囲と有効期限は緩められません。緩める必要がある場合は申請者が再提出してください。',
  'approval.modal.approved': 'この申請を承認しました',
  'approval.modal.rejected': 'この申請を却下しました',
  'approval.modal.approveFailed': '承認に失敗しました',
  'approval.modal.rejectFailed': '却下に失敗しました',
} as const;
