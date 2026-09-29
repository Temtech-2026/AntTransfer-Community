/** 監査ログの文言。 */
export default {
  /* ============================ ページ骨格 ============================ */
  'audit.page.title': '監査ログ',
  'audit.page.subTitle': '読み取り専用の検索（書き込み側でマスキング済み）',

  /* ============================ 権限なし ============================ */
  'audit.denied.title': '監査員のみアクセスできます',
  'audit.denied.subTitle':
    'このページには audit:log:read 権限ポイントが必要です。この権限ポイントは監査員ロールにのみ付与されます。',

  /* ============================ 検索条件の注意 ============================ */
  'audit.criteria.title': '検索条件',
  'audit.criteria.operatorPrefix': '操作者は',
  'audit.criteria.operatorStrong': 'ユーザー ID の完全一致',
  'audit.criteria.operatorSuffix':
    'のみ対応です（バックエンドは表示名でのあいまい検索を提供しません）。',
  'audit.criteria.timePrefix': '時間範囲は閉区間で、イベント時刻（',
  'audit.criteria.timeSuffix': '）で絞り込みます。',
  'audit.criteria.export':
    'エクスポートは現在の検索条件を引き継ぎ、上限はサーバー側で制御されます。',

  /* ============================ ツールバーと通知 ============================ */
  'audit.toolbar.export': 'CSV をエクスポート',
  'audit.export.success': 'エクスポートのダウンロードを開始しました',

  /* ============================ フィルター ============================ */
  'audit.filter.all': 'すべて',
  'audit.filter.allActions': 'すべてのアクション',

  /* ============================ 列 ============================ */
  'audit.column.logTime': '時刻',
  'audit.column.timeRange': '時間範囲',
  'audit.column.timeRangeStart': '開始（含む）',
  'audit.column.endTime': '終了時刻',
  'audit.column.timeRangeEnd': '終了（含む）',
  'audit.column.operator': '操作者',
  'audit.column.operatorIdPlaceholder': 'ユーザー ID（完全一致）',
  'audit.column.action': '操作種別',
  'audit.column.module': '所属ドメイン',
  'audit.column.targetType': '対象種別',
  'audit.column.target': '操作対象',
  'audit.column.result': '結果',
  'audit.column.ip': 'IP',
  'audit.column.traceId': 'トレース ID',
  'audit.column.detail': '詳細',

  /* ============================ 結果 ============================ */
  'audit.result.success': '成功',
  'audit.result.failed': '失敗',
  'audit.result.unknown': '不明',

  /* ============================ 操作者のフォールバック ============================ */
  'audit.operator.deletedUser': '削除済みユーザー #{userId}',
  'audit.operator.system': 'システム / 匿名',

  /* ============================ アクションのグループ ============================ */
  'audit.actionGroup.file': 'ファイルとフォルダ',
  'audit.actionGroup.share': '外部共有',
  'audit.actionGroup.userRole': 'ユーザーとロール',
  'audit.actionGroup.approval': '承認と付与',

  /* ============================ アクション名（バックエンド定数のミラー） ============================ */
  'audit.action.FILE_UPLOAD': 'ファイルをアップロード',
  'audit.action.FILE_DOWNLOAD': 'ファイルをダウンロード',
  'audit.action.FILE_PREVIEW': 'ファイルをプレビュー',
  'audit.action.FILE_RENAME': 'ファイル名を変更',
  'audit.action.FILE_MOVE': 'ファイルを移動',
  'audit.action.FILE_COPY': 'ファイルをコピー',
  'audit.action.FILE_DELETE': 'ゴミ箱へ移動',
  'audit.action.FILE_RESTORE': 'ゴミ箱から復元',
  'audit.action.FILE_DESTROY': '完全に削除',
  'audit.action.RECYCLE_PURGE': 'ゴミ箱の期限切れ整理',
  'audit.action.FILE_TICKET_ISSUE': 'ダウンロードチケットの発行',
  'audit.action.FOLDER_CREATE': 'フォルダを作成',
  'audit.action.FOLDER_RENAME': 'フォルダ名を変更',
  'audit.action.FOLDER_MOVE': 'フォルダを移動',
  'audit.action.FOLDER_DELETE': 'フォルダを削除',
  'audit.action.FILE_TAG': 'タグの付与 / 解除',
  'audit.action.VERSION_ROLLBACK': '過去バージョンへロールバック',
  'audit.action.VERSION_CREATE': '新バージョンをアップロード',
  'audit.action.VERSION_PRUNE': 'バージョンの整理',
  'audit.action.PACK_CREATE': '一括パッケージングを開始',
  'audit.action.PACK_DOWNLOAD': 'パッケージ成果物をダウンロード',
  'audit.action.SHARE_CREATE': '共有を作成',
  'audit.action.SHARE_REVOKE': '共有を取り消し',
  'audit.action.SHARE_DOWNLOAD': 'ゲストのダウンロード',
  'audit.action.SHARE_PREVIEW': 'ゲストのプレビュー',
  'audit.action.SHARE_BLOCKED': '外部共有のブロック',
  'audit.action.SHARE_CODE_LOCKED': '抽出コードのロック',
  'audit.action.USER_CREATE': 'ユーザーを作成',
  'audit.action.USER_UPDATE': 'ユーザーを変更',
  'audit.action.USER_DELETE': 'ユーザーを削除',
  'audit.action.USER_STATUS': 'ユーザーの有効 / 無効',
  'audit.action.USER_PASSWORD_RESET': 'パスワードを再設定',
  'audit.action.USER_ROLE_ASSIGN': 'ユーザーのロールを変更',
  'audit.action.ROLE_CREATE': 'ロールを作成',
  'audit.action.ROLE_UPDATE': 'ロールを変更',
  'audit.action.ROLE_DELETE': 'ロールを削除',
  'audit.action.ROLE_PERM_ASSIGN': 'ロール権限の調整',
  'audit.action.APPLY': '申請を提出',
  'audit.action.APPROVE': '承認',
  'audit.action.REJECT': '却下',
  'audit.action.TRANSFER': '承認の転送',
  'audit.action.GRANT': '付与の反映',
  'audit.action.REVOKE': '付与の回収',
  'audit.action.GRANT_EXPIRE': '有効期限による付与の回収',

  /* ============================ 所属ドメイン ============================ */
  'audit.module.AUTH': '認証',
  'audit.module.PERMISSION': '権限とシステム管理',
  'audit.module.TRANSFER': '転送',
  'audit.module.FILE': 'ファイル',
  'audit.module.COLLABORATION': 'コラボレーション',
  'audit.module.COMMON': '共通',

  /* ============================ 操作対象の種別 ============================ */
  'audit.target.SHARE': '外部共有リンク',
  'audit.target.FILE': 'ファイル項目',
  'audit.target.FOLDER': 'フォルダ',
  'audit.target.TAG': 'タグ',
  'audit.target.PACK_TASK': 'パッケージタスク',
  'audit.target.USER': 'ユーザーアカウント',
  'audit.target.ROLE': 'ロール',
  'audit.target.PERMISSION': '権限ポイント',
  'audit.target.APPLICATION': '権限申請書',
  'audit.target.GRANT': '付与レコード',
  'audit.target.SYSTEM': 'システムタスク',
} as const;
