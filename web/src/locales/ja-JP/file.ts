/**
 * ファイルドメインの文言：ワークベンチ / 一覧 / グリッド / ゴミ箱 / プレビュー / 外部共有 / 移動 / 権限申請 / アップロードダイアログ。
 *
 * <p>`services/file` の表示用関数は id のみを返します（純関数として単体テスト可能に保つ）。
 * 実際の文言はすべてここに置き、同じ一文がサービス層とコンポーネント層で二重管理されるのを避けます。</p>
 */
export default {
  /* ============================ 機密レベル ============================ */
  'file.level.public': '公開',
  'file.level.internal': '社内',
  'file.level.classified': '機密',
  'file.level.unknown': '未設定',
  'file.level.applyHint.classified':
    'このファイルは機密レベルです：申請は多段承認となり、ダウンロードと外部共有の権限は付与されません。必要に応じてプレビューのみ一時的に開放されます。',
  'file.level.applyHint.internal':
    'このファイルは社内レベルです：申請では既定でプレビューとダウンロードのみが付与され、外部共有には別途承認が必要です。',
  'file.level.applyHint.public':
    'このファイルは公開レベルです：承認は比較的速やかですが、実際の利用目的の記入は必要です。',
  'file.level.applyHint.unknown':
    'このファイルはまだレベル未設定です：承認者が先にレベル設定を求める場合があります。',

  /* ============================ セキュリティバッジ ============================ */
  'file.security.classified.label': '機密',
  'file.security.classified.hint':
    '機密レベル：プレビューにウォーターマークを重ね、ダウンロードはすべて記録され、外部共有の前に承認が必要です',
  'file.security.watermark.label': 'ウォーターマーク',
  'file.security.watermark.hint':
    'プレビューとダウンロードの画面に動的ウォーターマーク（アカウントと時刻を含む）を重ね、漏えいの追跡に用います',
  'file.security.expiring.label': '{days} 日後に失効',
  'file.security.expiring.hint':
    'この項目は {days} 日後に失効し、その時点でリンクと付与もまとめて無効になります',
  'file.security.expired.label': '失効済み',
  'file.security.expired.hint':
    'この項目は失効時刻を過ぎています。引き続き利用する場合は権限を再申請してください',

  /* ============================ 拡張子のグループ ============================ */
  'file.extGroup.doc': 'ドキュメント',
  'file.extGroup.image': '画像',
  'file.extGroup.video': '動画',
  'file.extGroup.audio': '音声',
  'file.extGroup.archive': 'アーカイブ',

  /* ============================ 共有のステータス ============================ */
  'file.shareStatus.active': '有効',
  'file.shareStatus.revoked': '取り消し済み',
  'file.shareStatus.expired': '失効済み',
  'file.shareStatus.unknown': '不明',

  /* ============================ 権限申請の種別 ============================ */
  'file.applyType.access.label': 'アクセス（プレビュー）',
  'file.applyType.access.hint':
    'オンラインプレビューのみ。ダウンロードや外部共有はできません',
  'file.applyType.download.label': 'ダウンロード',
  'file.applyType.download.hint':
    '原本をダウンロードできます。利用は記録されます',
  'file.applyType.edit.label': '編集',
  'file.applyType.edit.hint': '名前変更 / 移動 / 新バージョン追加が可能',
  'file.applyType.share.label': '外部共有',
  'file.applyType.share.hint':
    '外部共有リンクを作成できます。最もリスクが高い権限です',

  /* ============================ アクション ============================ */
  'file.action.preview': 'プレビュー',
  'file.action.download': 'ダウンロード',
  'file.action.share': '共有',
  'file.action.sendToChat': 'チャットへ送信',
  'file.action.applyPerm': '権限を申請',
  'file.action.delete': '削除',
  'file.action.restore': '復元',
  'file.action.destroy': '完全に削除',
  'file.action.move': '移動',
  'file.action.recycle': 'ゴミ箱へ移動',
  'file.action.clearSelection': '選択を解除',
  'file.action.more': 'その他',
  'file.action.upload': 'ファイルをアップロード',
  'file.action.enterRecycle': 'ゴミ箱',
  'file.action.backToFiles': 'マイファイルへ戻る',
  'file.action.emptyRecycle': 'ゴミ箱を空にする',
  'file.action.permission': '権限',
  'file.action.refresh': '更新',

  /* ============================ ページ構造 ============================ */
  'file.title': 'ファイル',
  'file.subtitle': 'フォルダ・機密レベル・種別で絞り込み',
  'file.section.myFiles': 'マイファイル',
  'file.section.recycle': 'ゴミ箱',
  'file.breadcrumb.all': 'すべてのファイル',
  'file.folder.children': 'サブフォルダ：',
  'file.folder.empty': '現在のフォルダにサブフォルダはありません',
  'file.folder.root': 'すべてのファイル（ルート）',

  /* ============================ テーブルの列 ============================ */
  'file.column.name': 'ファイル名',
  'file.column.ext': '種別',
  'file.column.level': '機密レベル',
  'file.column.size': 'サイズ',
  'file.column.updateTime': '更新日時',
  'file.column.recycleTime': 'ゴミ箱へ移動',
  'file.column.action': '操作',
  'file.recycle.today': '今日',
  'file.recycle.daysAgo': '{days} 日経過',

  /* ============================ 検索と表示 ============================ */
  'file.query.name': 'ファイル名',
  'file.query.namePlaceholder': 'ファイル名のキーワード',
  'file.query.ext': '種別',
  'file.query.extAll': 'すべての種別',
  'file.query.level': '機密レベル',
  'file.query.levelAll': 'すべての機密レベル',
  'file.query.createTime': '作成日時',
  'file.query.submit': '検索',
  'file.query.reset': 'リセット',
  'file.view.list': 'リスト',
  'file.view.grid': 'グリッド',
  'file.total': '全 {total} 件',
  'file.selectedCount': '{count} 件選択中',
  'file.uploadingCount': 'アップロード中 {count}',
  'file.grid.emptyRecycle': 'ゴミ箱は空です',
  'file.grid.emptyFolder':
    '現在のフォルダにはまだファイルがありません。アップロードするか、先にサブフォルダを作成してください',

  /* ============================ ダウンロード ============================ */
  'file.download.preparing': '{name} のダウンロードを準備しています',
  'file.download.done':
    '{name} のダウンロードを開始しました。ブラウザのダウンロード一覧で確認できます',
  'file.download.failed': 'ダウンロードに失敗しました',

  /* ============================ ゴミ箱と完全削除 ============================ */
  'file.recycle.confirmTitle': '「{name}」をゴミ箱へ移動しますか？',
  'file.recycle.confirmContent':
    'ゴミ箱へ移動すると「マイファイル」には表示されなくなりますが、いつでも復元でき、データは失われません。',
  'file.destroy.confirmTitle': '「{name}」を完全に削除しますか？',
  'file.destroy.confirmContent':
    'ファイルの実体とすべての分割が永久に削除され、ゴミ箱にも残りません。この操作は取り消せません。',
  'file.restore.done': '「{name}」を復元しました',
  'file.empty.confirmTitle': 'ゴミ箱を空にしますか？',
  'file.empty.confirmContent':
    'ゴミ箱内のすべてのファイルが完全に削除され、復元できません。一時的に使わないだけなら、ゴミ箱に残しておくことをおすすめします。',
  'file.empty.done': '{count} 件を完全に削除しました',
  'file.empty.noop': 'ゴミ箱はもともと空です',
  'file.batchRecycle.confirmTitle':
    '選択した {count} 件をゴミ箱へ移動しますか？',
  'file.batchRecycle.confirmContent':
    'ゴミ箱へ移動すると「マイファイル」には表示されなくなりますが、いつでも復元でき、データは失われません。',
  'file.batchRecycle.done': '{count} 件をゴミ箱へ移動しました',
  'file.batchRecycle.noop': 'ゴミ箱へ移動された項目はありません',
  'file.recycle.alertTitle': 'ゴミ箱',
  'file.recycle.alertDescription':
    'ゴミ箱内のファイルは「マイファイル」には表示されません。ここで復元するか、完全に削除（復元不可）できます。削除には file:destroy 権限が必要です。',
  'file.recycle.noFilterHint':
    'ゴミ箱はキーワードと機密レベルの絞り込みに対応していません：ここの項目はすでにフォルダから外れており、絞り込み結果が誤解を招きやすいためです',
  'file.batch.shareMultiHint':
    '外部共有リンクは 1 件ずつしか生成できません。まず 1 件だけ選択してください',
  'file.batch.applyMultiHint':
    '権限申請は 1 件ずつです。まず 1 件だけ選択してください',

  /* ============================ プレビュー ============================ */
  'file.preview.title': 'プレビュー',
  'file.preview.strategy.text': 'テキスト',
  'file.preview.strategy.pdf': 'PDF',
  'file.preview.strategy.image': '画像',
  'file.preview.strategy.downloadOnly': 'ダウンロードのみ',
  'file.preview.strategy.none': '非対応',
  'file.preview.failedTitle': 'プレビューに失敗しました',
  'file.preview.loadFailed': 'プレビュー情報の読み込みに失敗しました',
  'file.preview.empty': 'プレビューできる内容がありません',
  'file.preview.truncated':
    '内容が長いため先頭の数文字のみ表示しています。全文はダウンロードしてご確認ください',
  'file.preview.downloadOnlyTitle':
    'この種別はオンラインプレビューに対応していません',
  'file.preview.downloadOnlyDescription':
    '漏えいリスクを下げるため、この形式はサーバー側で変換しません。ダウンロードしてローカルで開いてください。',
  'file.preview.downloadFile': 'ファイルをダウンロード',
  'file.preview.unavailableTitle': 'プレビューできません',
  'file.preview.unavailableDescription':
    'サーバーが利用可能なプレビュー方法を提供していません。形式が非対応か、プレビュー機能が有効になっていない可能性があります。',

  /* ============================ 移動 ============================ */
  'file.move.title': '移動先',
  'file.move.ok': '移動',
  'file.move.alertTitle': '移動は保存場所だけを変えます',
  'file.move.alertDescription':
    '機密レベル・共有リンク・すでに付与された権限は、移動によって変わりません。',
  'file.move.placeholder': '移動先のフォルダを選択',
  'file.move.pending': '{count} 件を移動します',
  'file.move.pendingNames': '：{names}',
  'file.move.etc': ' ほか',
  'file.move.unchanged':
    '（ほか {count} 件はすでに移動先にあり、スキップされます）',
  'file.move.noop': '移動先が現在の場所と同じため、移動の必要はありません',
  'file.move.done': '{count} 件を「{target}」へ移動しました',
  'file.move.failed': '{count} 件の移動に失敗しました：{names}',

  /* ============================ 権限申請 ============================ */
  'file.apply.title': 'ファイル権限を申請',
  'file.apply.submitFailed': '申請の送信に失敗しました',
  'file.apply.submittedTitle': '申請を送信しました',
  'file.apply.submittedSubTitle':
    '申請番号：{no}。「自分の申請」で進捗を確認できます',
  'file.apply.submittedExtra':
    '承認されると権限は自動的に有効になり、再提出は不要です。却下された場合は承認コメントを確認し、補足説明を加えて再提出できます。',
  'file.apply.field.file': '申請するファイル',
  'file.apply.field.level': 'ファイルの機密レベル',
  'file.apply.levelAlertTitle': '機密レベルの確認',
  'file.apply.field.applyType': '権限の種別',
  'file.apply.field.applyTypeRequired': '権限の種別を選択してください',
  'file.apply.field.purpose': '利用目的',
  'file.apply.field.purposeRequired': '利用目的を入力してください',
  'file.apply.field.purposeMin':
    '承認者が判断できるよう、10 文字以上で入力してください',
  'file.apply.field.purposeMax': '最大 500 文字',
  'file.apply.field.purposePlaceholder':
    '例：四半期の経営分析レポートの数値確認に使用。本人のみが利用し、外部へは共有しません',
  'file.apply.field.expireAt': '希望する有効期限',
  'file.apply.field.expireAtExtra':
    '空欄は長期権限の申請を意味します（承認されにくくなります）。実際の必要に応じて入力することをおすすめします。期限が来ると自動で回収されます',
  'file.apply.field.expireAtPlaceholder': '期限日時を選択',
  'file.apply.footnote':
    '送信後、申請者の識別情報と申請時刻はサーバーが記録します。他人を代理して申請することはできません。',
  'file.apply.submit': '申請を送信',

  /* ============================ 外部共有ダイアログ ============================ */
  'file.share.presetDays': '{days} 日',
  'file.share.title': '外部共有',
  'file.share.titleWithName': '外部共有：{name}',
  'file.share.createFailed': '外部共有の作成に失敗しました',
  'file.share.missingFileId':
    'このファイルには物理ファイル ID がないため、外部共有リンクを作成できません。更新してから再試行してください',
  'file.share.copied': 'リンクと抽出コードをコピーしました',
  'file.share.copyDenied':
    'ブラウザがクリップボードへのアクセスを拒否しました。手動で選択してコピーしてください',
  'file.share.again': 'もう 1 つ作成',
  'file.share.done': '完了',
  'file.share.generate': 'リンクを生成',
  'file.share.resultTitle': '外部共有リンクを生成しました',
  'file.share.resultSubTitle':
    '抽出コードは再表示されません。直ちにコピーして相手へ伝えてください',
  'file.share.field.url': '共有リンク',
  'file.share.field.code': '抽出コード',
  'file.share.field.expireAt': '有効期限',
  'file.share.field.downloadLimit': 'ダウンロード可能回数',
  'file.share.times': '{count} 回',
  'file.share.copyBoth': 'リンクと抽出コードをコピー',
  'file.share.approvalRequiredTitle':
    '機密ファイル：外部共有の前に管理者の承認が必要です',
  'file.share.approvalRequiredDescription':
    '機密ファイルの外部共有は「承認済みの高機密申請」を前提とし、直接リンクを生成するとサーバーに拒否されます（403 / 1003）。まず一覧でこのファイルの権限を申請し、承認後にここへ戻ってください。',
  'file.share.warningTitle':
    '外部共有リンクはファイルを社外へ出すことと同義です',
  'file.share.warningDescription':
    'リンクは抽出コードがあればログイン不要でアクセスでき、すべてのダウンロードが記録されます。機密レベルのファイルは事前に外部共有の承認が必要で、そうでなければサーバーに拒否されます（403 / 1003）。',
  'file.share.block.audience': 'アクセスできる相手',
  'file.share.audience.link': 'リンクを知る人がアクセス',
  'file.share.audience.linkHint':
    'リンクと抽出コードを入手した人は誰でもログイン不要で閲覧できます。外部の取引先へ送るのに適していますが、本人確認を行わないため「一度きり・回数制限あり」のシーンに向きます。',
  'file.share.audience.member': '受取人を指定',
  'file.share.audience.memberHint':
    'メールアドレス・電話番号・組織図で受取人を正確に指定し、許可された人だけが閲覧できます。サーバー側に内部の権限付与 API が必要ですが、現在の CE 版にはないため、この項目は選択できません。',
  'file.share.block.policy': '権限とセキュリティポリシー',
  'file.share.field.codeLabel': 'アクセスパスワード（抽出コード）',
  'file.share.field.codeRequired': '抽出コードを入力してください',
  'file.share.field.codeRule':
    '抽出コードは {min}〜{max} 桁の英数字で入力してください',
  'file.share.field.codeExtra':
    'サーバーはハッシュ値のみを保存するため、ダイアログを閉じると再表示できません。忘れた場合はリンクを無効化して作り直すしかありません',
  'file.share.field.codePlaceholder': '6〜32 桁の英数字',
  'file.share.random': 'ランダム',
  'file.share.copy': 'コピー',
  'file.share.codeMissing': 'まず抽出コードを生成するか入力してください',
  'file.share.codeCopied': '抽出コードをコピーしました',
  'file.share.field.limitLabel': 'ダウンロード回数の上限',
  'file.share.field.limitRequired': 'ダウンロード回数の上限を入力してください',
  'file.share.field.limitExtra':
    '上限に達するとリンクは自動的に無効になります。リンクを取り消せば、発行済みのダウンロードチケットも直ちに無効になります',
  'file.share.trace.label': 'ダウンロードをすべて記録',
  'file.share.trace.description':
    '強制有効：ダウンロードごとにアカウント（未ログインのゲストは IP と UA）、時刻、ファイルを記録し、監査ログで追跡できます。無効にはできません。',
  'file.share.watermark.label': 'プレビューに動的ウォーターマークを重ねる',
  'file.share.watermark.description':
    'サーバーによるウォーターマークの有効化と描画機能が必要ですが、現在の CE 版にはありません。ここをチェックしない場合、このファイルの外部共有リンクにウォーターマーク保護はありません。',
  'file.share.block.expire': '有効期間',
  'file.share.field.expireLabel': 'リンクの有効期間',
  'file.share.field.expireRequired': '有効期間を選択してください',
  'file.share.field.expireExtra':
    '「生成時刻 + N 日」で計算し、上限は {max} 日です。超えるとサーバーに拒否されます',
};
