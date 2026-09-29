/** メッセージセンター（システム通知 + タスク）の文言。 */
export default {
  'message.title': 'メッセージセンター',
  'message.subtitle':
    '承認タスク・共有・セキュリティの通知がここにリアルタイムで集約されます',
  'message.tab.notifications': 'システム通知',
  'message.tab.todos': 'タスク',
  'message.unread.badge': '未読 {count}',
  'message.unread.inbox': 'システム通知の未読 {count}',
  'message.unread.todo': '未処理タスク {count}',

  'message.action.refresh': '更新',
  'message.action.markAllRead': 'すべて既読にする',
  'message.action.markRead': '既読にする',
  'message.action.markedRead': '既読にしました',
  'message.action.allMarkedRead': '{count} 件の通知を既読にしました',
  'message.action.allReadNoop': '未読の通知はありません',
  'message.action.jump': '対応する',
  'message.action.markHandled': '処理済みにする',
  'message.action.handled': '処理済みにしました',

  'message.state.new': '新着',
  'message.state.unread': '未読',
  'message.state.read': '既読',

  'message.connection.connecting': 'リアルタイム接続を確立しています…',
  'message.connection.reconnecting':
    'リアルタイム接続が切断され、自動再接続中です…',
  'message.connection.closed':
    'リアルタイム接続が閉じられました。新着メッセージの到着が遅れる可能性があります',
  'message.connection.reconnectNow': '今すぐ再接続',
  'message.connection.restored': 'リアルタイム接続が復旧しました',
  'message.connection.backfilled':
    'オフライン中のメッセージ {count} 件を取り込みました',
  'message.connection.offlineHint':
    '切断中のメッセージは再接続後に自動で取り込まれます',

  'message.empty.title': 'メッセージはありません',
  'message.empty.desc':
    '承認・共有・セキュリティの通知がここにリアルタイムで表示されます',
  'message.empty.filteredTitle': '未読メッセージはありません',
  'message.empty.filteredDesc':
    '「すべて」に切り替えると過去の通知を確認できます',

  'message.todo.filter.pending': '未処理',
  'message.todo.filter.done': '処理済み',
  'message.todo.filter.all': 'すべて',
  'message.todo.empty.title': 'タスクはありません',
  'message.todo.empty.desc': '現在、対応が必要な承認やリマインダーはありません',
  'message.todo.empty.doneTitle': '処理済みの記録はまだありません',
  'message.todo.empty.doneDesc': '対応済みのタスクはここに記録されます',
  'message.todo.source.approval': '承認待ち',
  'message.todo.source.approvalResult': '承認結果',
  'message.todo.source.transfer': '転送完了',
  'message.todo.jumpMissing':
    '該当ページは未公開です。まず承認センターで確認してください',

  'message.type.1': '承認待ち',
  'message.type.2': '承認結果',
  'message.type.3': 'リンクロック',
  'message.type.4': 'リンク期限切れ',
  'message.type.5': 'セキュリティ通知',
  'message.type.8': '転送完了',
  'message.type.9': '受取確認',
  'message.type.unknown': 'システム通知',
} as const;
