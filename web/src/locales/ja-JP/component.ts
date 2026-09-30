/**
 * 共通コンポーネントの文言（トップバー / サイドバー / 全体検索 / 通知ベル / 組織切替 / ドロップ領域 / タグ選択）。
 *
 * <p>これらはシェル全体に常駐し全ページで描画されるため、どこか一箇所でも
 * 日本語をハードコードすると他言語の画面に日本語が漏れ出します。そのため本ドメインに集約しています。
 */
export default {
  'component.langSwitch': '言語切替',

  // タグ選択
  'component.tagSelect.expand': '展開',
  'component.tagSelect.collapse': '折りたたむ',
  'component.tagSelect.all': 'すべて',

  // サイドバー下部の入口
  'component.siderFooter.messages': 'メッセージ',
  'component.siderFooter.transfer': '転送',
  'component.siderFooter.openMessages': 'メッセージパネルを開く',
  'component.siderFooter.openTransfer': '転送センターを開く',

  // トップバーの全体検索
  'component.globalSearch.placeholder':
    'ファイル名 / タグで検索し、Enter でファイルへ移動',
  'component.globalSearch.ariaLabel': '全体検索',
  'component.globalSearch.scopeAria': '検索範囲の説明',
  'component.globalSearch.scopeTitle':
    '検索範囲：ファイル名、タグ（ファイルワークベンチへ移動します）。',

  // トップバーのドキュメント入口
  'component.docLink.title': 'ドキュメント',

  // 記事リストの内容（テンプレートコンポーネント）
  'component.articleList.publishedAt': '公開日',

  // アバタードロップダウンと個人情報
  'component.avatar.profile': '個人情報',
  'component.avatar.changePassword': 'パスワードを変更',
  'component.avatar.logout': 'ログアウト',
  'component.avatar.account': 'アカウント',
  'component.avatar.nickname': 'ニックネーム',
  'component.avatar.roles': 'ロール',

  // 個人情報ダイアログでのアバター変更（アップロードで即時反映、フォーム保存を経由しない）
  // 事前チェック失敗時のメッセージは system.user.avatar.tooLarge / typeInvalid を再利用する
  'component.avatar.avatar.upload': 'アバターをアップロード',
  'component.avatar.avatar.hint': 'PNG / JPEG / GIF / WebP に対応、{max} 以下',
  'component.avatar.avatar.updated': 'アバターを更新しました',

  // セルフサービス改密ダイアログ（成功後は全端末で失効し、再ログインが必要）
  'component.avatar.changePassword.title': 'パスワードを変更',
  'component.avatar.changePassword.alert.title': '変更後は再ログインが必要です',
  'component.avatar.changePassword.alert.desc':
    'アカウントの安全のため、パスワードを変更するとすべての端末のログインが直ちに無効になります。新しいパスワードで再ログインしてください。',
  'component.avatar.changePassword.old': '現在のパスワード',
  'component.avatar.changePassword.oldPlaceholder':
    '現在のパスワードを入力してください',
  'component.avatar.changePassword.oldRequired':
    '現在のパスワードを入力してください',
  'component.avatar.changePassword.new': '新しいパスワード',
  'component.avatar.changePassword.newPlaceholder':
    '新しいパスワードを入力してください',
  'component.avatar.changePassword.newRequired':
    '新しいパスワードを入力してください',
  'component.avatar.changePassword.newLength':
    'パスワードは 8〜64 文字で入力してください',
  'component.avatar.changePassword.newPattern':
    'パスワードは英字と数字を同時に含み、空白を含まない必要があります',
  'component.avatar.changePassword.policyHint':
    '8〜64 文字、英字と数字を同時に含むこと',
  'component.avatar.changePassword.confirm': '新しいパスワードの確認',
  'component.avatar.changePassword.confirmPlaceholder':
    '新しいパスワードをもう一度入力してください',
  'component.avatar.changePassword.confirmRequired':
    '新しいパスワードをもう一度入力してください',
  'component.avatar.changePassword.confirmMismatch':
    '入力した新しいパスワードが一致しません',
  'component.avatar.changePassword.submit': '変更を確定',
  'component.avatar.changePassword.done':
    'パスワードを変更しました。新しいパスワードで再ログインしてください',

  // 通知ベル
  'component.notify.title': '通知',
  'component.notify.count.inbox': '通知 {count}',
  'component.notify.count.todo': 'タスク {count}',
  'component.notify.count.chat': 'ダイレクトメッセージ {count}',
  'component.notify.markAllRead': 'すべて既読にする',
  'component.notify.markedAllRead': 'すべて既読にしました',
  'component.notify.status.idle': 'リアルタイムチャネル未起動',
  'component.notify.status.connecting': '接続中…',
  'component.notify.status.open': 'リアルタイム通知に接続済み',
  'component.notify.status.reconnecting': '接続が切断され、再接続中…',
  'component.notify.status.closed': 'リアルタイムチャネルが切断されました',

  // 組織 / チーム切替
  'component.org.defaultName': 'デフォルト組織',
  'component.org.current': '現在のデプロイ',
  'component.org.create': '組織 / チームを作成',
  'component.org.switch': '他の組織に切り替え',
  'component.org.tooltip': '現在の組織：{name}',

  // ドラッグ / クリックでファイルを選択する領域
  'component.dropZone.title':
    'ここにファイルをドラッグ、またはクリックして選択',

  // 分割アップロードコンポーネント
  'component.chunkUpload.title': 'ファイルアップロード',
  'component.chunkUpload.busy': '{count} 件のタスクが進行中',
  'component.chunkUpload.resumableCount':
    '未完了のアップロードを {count} 件検出しました',
  'component.chunkUpload.resumableNote':
    '重複転送を避けるため、同じファイルを再度選択してください。サーバーが受信済みの分割はスキップして続行します。',
  'component.chunkUpload.resumableSelect': 'ファイルを選び直して続行',
  'component.chunkUpload.instantDone': '秒速アップロード完了',
  'component.chunkUpload.instantSuccess': '秒速アップロード成功',
  'component.chunkUpload.progress.hashing':
    'ファイルのチェックサムを計算しています…',
  'component.chunkUpload.progress.prechecking':
    '秒速アップロードの可否を確認しています…',
  'component.chunkUpload.progress.querying':
    'アップロード済みの分割を取得しています…',
  'component.chunkUpload.progress.merging': '分割を結合しています…',
  'component.chunkUpload.progress.paused':
    '一時停止中（{received}/{total} 分割完了）',
  'component.chunkUpload.progress.failed': 'アップロードに失敗しました',
  'component.chunkUpload.progress.uploading':
    '{received}/{total} 分割 · {speed}',
  'component.chunkUpload.progress.retried': ' · {count} 回再試行済み',
  'component.chunkUpload.progress.chunks': '{count} 分割',
  'component.chunkUpload.retryTooltip':
    'ネットワークの揺らぎに対して指数バックオフで自動再試行します',
  'component.chunkUpload.retryTag': '再試行 {count}',
  'component.chunkUpload.draggerText':
    'クリックまたはファイルをここにドラッグしてアップロード',
  'component.chunkUpload.draggerHint':
    '大容量ファイルの分割アップロード、秒速アップロード、レジュームに対応。1 ファイルの失敗は {count} 回まで自動再試行します',
  'component.chunkUpload.chunkSize': '分割サイズ',
  'component.chunkUpload.concurrency': '同時実行数',
  'component.chunkUpload.tuningNote': '変更は以降の分割から有効になります',
  'component.chunkUpload.overallProgress': '全体の進捗',
  'component.chunkUpload.overallSummary':
    '{finished}/{total} ファイル · {uploaded} / {totalSize}',

  // コードブロック（ドキュメント領域でサンプルコードを表示）
  'component.codeBlock.copy': 'コピー',
  'component.codeBlock.copied': 'コピーしました',
  'component.codeBlock.copyFailed': 'コピーに失敗しました',

  // 転送モニターのフローティングウィンドウ
  'component.transfer.title': '転送センター',
  'component.transfer.expand': '転送センターを展開',
  'component.transfer.collapse': '転送センターを折りたたむ',
  'component.transfer.capsule': '転送中 {count}',
  'component.transfer.summary': '{active} 進行中 · {success} 完了',
  'component.transfer.summaryFailed': ' · {count} 失敗',
  'component.transfer.pauseAll': 'すべて一時停止',
  'component.transfer.resumeAll': 'すべて再開 / 失敗を再試行',
  'component.transfer.clearFinished': '完了 / キャンセル / 失敗をクリア',
  'component.transfer.fastMode': '高速モード',
  'component.transfer.fastModeHint':
    '同時分割数を契約上限の 5 まで引き上げます。進行中のタスクにも適用されます。アップロードページで個別に選んだ同時実行数はこのスイッチで上書きされます。',
  'component.transfer.empty': '転送タスクはありません',
  'component.transfer.chartAria': '転送速度のグラフ',
  'component.transfer.pause': '一時停止',
  'component.transfer.resumeRetry': '再開 / 再試行',
  'component.transfer.pauseNamed': '{name} を一時停止',
  'component.transfer.resumeNamed': '{name} を再開',
  'component.transfer.status.active': '転送中',
  'component.transfer.status.paused': '一時停止中',
  'component.transfer.status.error': '失敗',
  'component.transfer.status.success': '完了',
  'component.transfer.status.canceled': 'キャンセル済み',
  // 新着メッセージの通知音（プロフィール内。音色とスイッチで同じ接頭辞を共有）
  'component.avatar.notifySound.title': '新着メッセージの通知音',
  'component.avatar.notifySound.enabled': '新着メッセージで通知音を鳴らす',
  'component.avatar.notifySound.presetLabel': '音色',
  'component.avatar.notifySound.preset.default': 'デフォルト',
  'component.avatar.notifySound.preset.chime': 'チャイム',
  'component.avatar.notifySound.preset.bubble': 'バブル',
  'component.avatar.notifySound.preset.custom': 'カスタム',
  'component.avatar.notifySound.upload': '音声をアップロード',
  'component.avatar.notifySound.replace': '音声を差し替え',
  'component.avatar.notifySound.clear': '削除',
  'component.avatar.notifySound.preview': '試聴',
  'component.avatar.notifySound.uploaded':
    'アップロード済み。音色をカスタムに切り替えました',
  'component.avatar.notifySound.cleared': 'カスタム通知音を削除しました',
  'component.avatar.notifySound.loadFailed':
    '通知音の設定を読み込めませんでした',
  'component.avatar.notifySound.typeInvalid':
    'MP3 / WAV / OGG 形式の音声のみ対応しています',
  'component.avatar.notifySound.tooLarge': '音声は {max} 以下にしてください',
  'component.avatar.notifySound.previewBlocked':
    'ブラウザが自動再生をブロックしました。ページ内を一度クリックしてから再度お試しください',
  'component.avatar.notifySound.customEmpty': 'カスタム音声はまだありません',
  'component.avatar.notifySound.customMeta':
    '現在の音声：{name}（{size}、{duration}）',
  'component.avatar.notifySound.hint':
    'MP3 / WAV / OGG に対応。{maxSize} 以内、長さ {maxDuration} 以内',
} as const;
