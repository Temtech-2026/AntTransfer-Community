/** 分割アップロードページとアップロードダイアログの文言。 */
export default {
  'upload.title': 'ファイルをアップロード',
  'upload.titleWithFolder': 'ファイルをアップロード（フォルダ #{folderId}）',
  'upload.dropText': 'クリックまたはファイルをここにドラッグ',
  'upload.dropHint':
    '複数選択に対応。大容量ファイルは自動で分割（既定 4 MiB）し、ダイジェストを計算して秒速アップロードに該当すれば転送は不要です',
  'upload.instant': '秒速',
  'upload.verifying': '検証中',
  'upload.chunkProgress': ' · {received}/{total} 分割',
  'upload.chunkTooltip': '分割 {index}',
  'upload.retried': '{count} 回自動再試行しました',
  'upload.empty': 'アップロードタスクはありません',
  'upload.summary': '進行中 {uploading} · 完了 {finished} · 全 {total}',

  // タスクの状態
  'upload.status.pending': '待機中',
  'upload.status.hashing': 'ダイジェスト計算',
  'upload.status.prechecking': '秒速アップロードの事前確認',
  'upload.status.querying': '分割の照会',
  'upload.status.uploading': 'アップロード中',
  'upload.status.paused': '一時停止中',
  'upload.status.merging': '結合中',
  'upload.status.success': '完了',
  'upload.status.error': '失敗',
  'upload.status.canceled': 'キャンセル済み',

  // エラー文言（サービス層が投げる前に現在の言語へ翻訳する。services/upload を参照）
  'upload.error.generic': 'アップロードに失敗しました',
  'upload.error.network':
    'ネットワーク異常です。接続を確認して再試行してください',
  'upload.error.timeout': 'アップロードがタイムアウトしました',
  'upload.error.badContract': 'サーバー応答の構造が統一契約に準拠していません',
  'upload.error.instantWithoutFileId':
    '秒速アップロードに該当しましたが fileId が返りません',
  'upload.error.missWithoutUploadId':
    '秒速アップロードに該当せず、uploadId も返りません',
  'upload.error.partHttp': '分割アップロードに失敗しました（HTTP {status}）',
  'upload.error.hashWorkerFailed': 'ハッシュ Worker の実行に失敗しました',
  'upload.error.hashFailed': 'ハッシュの計算に失敗しました',

  // アクション
  'upload.action.pause': '一時停止',
  'upload.action.resume': '再開',
  'upload.action.remove': '削除',
  'upload.action.pauseAll': 'すべて一時停止',
  'upload.action.resumeAll': 'すべて再開',
  'upload.action.clearFinished': '終了分をクリア',

  // レジューム
  'upload.resumable.title': '前回未完了のアップロードを検出しました',
  'upload.resumable.note':
    '以下の進捗はローカルキャッシュ由来で参考値です。実際の再開位置はサーバー側の分割一覧に従います。',
  'upload.resumable.record': '{name}（{size}、{received}/{total} 分割完了）',
  'upload.resumable.ignore': '無視',
  'upload.resumable.select': 'ファイルを選んで再開',
  'upload.resumable.hint':
    '前回と同じ名前の同一ファイルを選択してください（同名でも内容が変わっていれば検出され、再アップロードされます）',

  // 完了リスト
  'upload.column.method': '方式',
  'upload.column.chunked': '分割アップロード',

  // アップロード方式（分割リクエストボディの形態）——デモページのカードとアップロードコンポーネントで同じ呼称を使う
  'upload.mode.title': 'アップロード方式',
  'upload.mode.subtitle':
    '2 種類の分割リクエストボディ形態。パラメータはそれぞれ独立に保存されます',
  'upload.mode.active': '現在使用中',
  'upload.mode.use': 'この方式を使用',
  'upload.mode.fact.request': 'リクエストボディ',
  'upload.mode.fact.scene': '適したシーン',
  'upload.mode.unsupportedTag': 'バックエンド未対応',
  'upload.mode.switchHint':
    '切り替えは以降に追加されるタスクにのみ影響します。進行中のタスクは開始時の方式を使い続けるため、同一アップロードで 2 種類のリクエストボディが混在することはありません。新しいパラメータも次のタスクから有効です。',
  'upload.mode.multipart.title': 'フォーム分割',
  'upload.mode.multipart.tag': 'multipart/form-data',
  'upload.mode.multipart.desc':
    '各分割を `FormData` に包んで送信し、分割番号とダイジェストをフォーム項目として一緒に送ります。互換性が最も高く、現行バックエンドの既定の方式です。',
  'upload.mode.multipart.request':
    '`PUT` 分割 API。リクエストボディは `FormData`（`chunk` + `index` + `hash`）',
  'upload.mode.multipart.scene':
    'バックエンドが Spring の `@RequestPart` / `MultipartFile` で分割を受け取る場合（契約の既定方式）',
  'upload.mode.octetStream.title': 'バイナリストリーム',
  'upload.mode.octetStream.tag': 'application/octet-stream',
  'upload.mode.octetStream.desc':
    '分割を生のバイトストリームとしてそのままリクエストボディに載せ、分割番号は URL で決まります。フォームのラップとメモリコピーを 1 段ずつ削減できます。',
  'upload.mode.octetStream.request':
    '`PUT` 分割 API。リクエストボディは生のバイトストリーム（`Content-Type: application/octet-stream`、`hash` 項目なし）',
  'upload.mode.octetStream.scene':
    'オブジェクトストレージへの直接転送、またはゲートウェイが生ストリームをそのまま透過しフォーム解析を行わないシーン',
  'upload.mode.octetStream.unsupported':
    '現在の at-transfer の分割 API は `multipart/form-data` のみを宣言しているため、これを選ぶと分割送信時に HTTP 415 になります。バックエンドが生ストリーム受信に対応する必要があります（フロント側は対応済み）。',

  // デモページ（/upload）。文言中のバッククォートはページがインラインコード風に描画します。
  'upload.demo.pageTitle': '分割アップロード',
  'upload.demo.pageSubtitle': '秒速アップロード · レジューム · 並列分割',
  'upload.demo.pipeline.title': 'アップロードの流れ',
  'upload.demo.pipeline.subtitle': 'ダイジェスト → 秒速 → 差分転送 → 結合',
  'upload.demo.pipeline.desc':
    '大容量ファイルはまず端末側でダイジェストを計算し、サーバーがそれに基づいて秒速アップロードの可否を判定します。該当しなければ不足している分割のみを送信します。いつページを更新しても、同じファイルを選び直せばサーバーが受信済みの位置から再開できます。',
  'upload.demo.step.hash.title': 'チェックサムを計算',
  'upload.demo.step.hash.desc':
    'Worker 内で増分 SHA-256。メインスレッドを止めません',
  'upload.demo.step.precheck.title': '秒速アップロードの事前確認',
  'upload.demo.step.precheck.desc':
    'ダイジェストが一致すれば完了、転送は 0 バイト',
  'upload.demo.step.query.title': '受信済み分割を照会',
  'upload.demo.step.query.desc': 'サーバー側の一覧を正とします',
  'upload.demo.step.upload.title': '分割を並列で差分送信',
  'upload.demo.step.upload.desc': '既定 3 並列、失敗時はバックオフ再試行',
  'upload.demo.step.merge.title': '結合と検証',
  'upload.demo.step.merge.desc':
    'サーバーが全体のダイジェストを再計算してから結合',
  'upload.demo.chunkTitle': '分割アップロードのデモ',
  'upload.demo.finished.title': '完了したファイル',
  'upload.demo.finished.subtitle': '直近 {count} 件まで保持',
  'upload.demo.usage.title': '組み込み方',
  'upload.demo.usage.subtitle':
    'コンポーネントと Hook の 2 通り。同じ 1 本のキューを共有します',
  'upload.demo.usage.desc':
    'コンポーネントはキューと進捗表示を内蔵しており、ページに置くだけで使えます。業務ページでレイアウトを自分で組みたい場合は Hook `useChunkUpload()` で状態とアクションを取得し、画面は自作してください。両者は `id` だけで同一性を判定します。`id` が同じなら同じキューなので、同一ページで混在させられます。',
  'upload.demo.usage.tab.component': 'コンポーネントでの利用',
  'upload.demo.usage.tab.hook': 'Hook での利用',
  'upload.demo.usage.component.point1':
    '`id` がキューの同一性を決めます。同じ id の複数コンポーネントは 1 本のキューを共有し、ページ切替や再マウントでも転送は中断しません。',
  'upload.demo.usage.component.point2':
    '`chunkSize` と `concurrency` はキュー投入時に契約範囲（≤ 8 MiB、1〜5 並列）へ収束させます。上限を超える値を渡しても不正な分割が送信されることはありません。',
  'upload.demo.usage.component.point3':
    '`partPayloadMode` はタスク単位で有効です。アップロード中に切り替えても、以降に追加されたタスクにのみ影響します。',
  'upload.demo.usage.hook.point1':
    '`tasks` と `resumable` は購読によるスナップショットです。進捗の更新はポーリングに頼らず、高頻度の進捗を state に書き込むこともありません。',
  'upload.demo.usage.hook.point2':
    '`start()` はファイルを投入すると即座に開始し、これらタスクの id を返します。一時停止 / 再開 / 再試行 / キャンセルはそれぞれ対応するアクションがあります。',
  'upload.demo.usage.hook.point3':
    'Hook は状態とアクションのみを提供し画面は描画しません。リスト、進捗バー、ボタンはすべて業務ページ側で決められます。',
  'upload.demo.tryRun.title': '試し方',
  'upload.demo.tryRun.localMock':
    'このページはローカル mock を同梱しています（`src/pages/upload/_mock.ts`。umi はページフォルダ配下の `_mock.ts` のみを読み込みます）。`npm run start` で起動する（mock が自動で有効になります）と、アップロード経路をオフラインで通せます。同じファイルをもう一度送れば秒速アップロードに該当します。',
  'upload.demo.tryRun.dev':
    '`npm run dev` で起動すると mock が無効になり、`/api` は `localhost:8080` へプロキシされます。この場合はバックエンド at-transfer の API が利用可能である必要があります。',
  'upload.demo.tryRun.auth':
    '注意：他の業務ページと同様、このページはログインガードで保護されています（未ログインは `/user/login` へ遷移します）。ログイン API に mock はなく at-auth が必要なため、mock がカバーするのは「アップロード経路」の部分のみです。',
} as const;
