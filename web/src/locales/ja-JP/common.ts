/**
 * グローバル共通文言（スケルトン / 空状態 / 危険操作の確認 / アップロード進捗）。
 *
 * <p>`locales` に置くのは、共通体験コンポーネントが言語切替時に取り残されないため——
 * これらのコンポーネントは各業務ページから再利用されるので、どこか一箇所でも
 * 日本語をハードコードすると他言語の画面に日本語が漏れ出す。
 */
export default {
  // 空状態
  'common.empty.noData': 'データがありません',
  'common.empty.noResult.title': '一致する結果がありません',
  'common.empty.noResult.desc':
    '絞り込み条件を調整するか、キーワードをクリアして再検索してください',
  'common.empty.error.title': '読み込みに失敗しました',
  'common.empty.error.desc':
    'ネットワークまたはサービスで異常が発生しました。しばらくしてから再試行してください',
  'common.empty.error.action': '再読み込み',
  'common.empty.denied.title': 'アクセス権限がありません',
  'common.empty.denied.desc':
    '現在のアカウントにはこの権限がありません。必要な場合は管理者に連絡してください',

  // 危険操作の二次確認
  'common.danger.title': '操作の確認',
  'common.danger.irreversible':
    'この操作は取り消せません。確認のうえ続行してください。',
  'common.danger.ok': '実行する',
  'common.danger.cancel': 'キャンセル',

  // モジュール横断で再利用する操作と連結記号
  'common.action.cancel': 'キャンセル',
  'common.action.confirm': '確定',
  'common.action.ok': 'OK',
  'common.action.gotIt': '了解しました',
  'common.action.close': '閉じる',
  'common.action.submit': '送信',
  'common.action.save': '保存',
  'common.action.retry': '再試行',
  'common.action.copy': 'コピー',
  'common.action.copied': 'コピーしました',
  'common.action.selectAll': 'すべて選択',
  'common.action.clear': 'クリア',
  'common.action.refresh': '更新',
  'common.listSeparator': '、',
  'common.etcCount': 'ほか {count} 件',

  // グローバルなアップロード進捗
  'common.upload.title': 'アップロードタスク',
  'common.upload.summary': '{active} 件アップロード中 · 全 {total} 件',
  'common.upload.idle': '進行中のアップロードはありません',
  'common.upload.failed': '{count} 件失敗',
  'common.upload.percent': '全体の進捗 {percent}%',
  'common.upload.openPage': 'アップロードページを開く',
  'common.upload.viewQueue': '確認する',
  'common.upload.queue.default': '分割アップロード',
  'common.upload.queue.file-workbench': 'ファイルワークベンチ',
  'common.upload.queue.chat-send': 'チャットでファイル送信',
  'common.upload.queue.chat-send-drawer': 'チャットでファイル送信',
  'common.upload.queue.unknown': 'アップロードタスク',
  'common.upload.status.working': 'アップロード中',
  'common.upload.status.paused': '一時停止中',
  'common.upload.status.success': '完了',
  'common.upload.status.error': '失敗',
  'common.upload.status.canceled': 'キャンセル済み',
  'common.upload.status.instant': '秒速アップロード完了',
} as const;
