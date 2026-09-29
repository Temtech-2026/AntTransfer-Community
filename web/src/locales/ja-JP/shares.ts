/** 共有管理ページと外部共有作成ダイアログの文言。 */
export default {
  /* ============================ ページ ============================ */
  'shares.page.title': '共有管理',
  'shares.page.subtitle':
    '自分が作成した外部共有リンク。抽出コードは再表示されず、取り消すと復元できません',
  'shares.denied':
    '現在のアカウントには外部共有の権限（file:share）がありません。管理者に連絡して付与してください',
  'shares.table.title': '自分の共有',

  /* ============================ アクション ============================ */
  'shares.action.create': '共有を作成',
  'shares.action.copy': 'リンクをコピー',
  'shares.action.revoke': '共有を取り消し',

  /* ============================ コピー ============================ */
  'shares.copy.success':
    'リンクをコピーしました。抽出コードは再表示されないため、作成時のコードをご利用ください',
  'shares.copy.manualTitle': 'リンクを手動でコピーしてください',
  'shares.copy.disabled': '有効な共有のみコピーできます',

  /* ============================ 取り消し ============================ */
  'shares.revoke.success': '共有を取り消しました。リンクは直ちに無効になります',
  'shares.revoke.confirmTitle': 'この共有リンクを取り消しますか？',
  'shares.revoke.confirmContent':
    '取り消すとリンクは直ちに無効になり、相手に送信済みの抽出コードも失効します。再度外部共有する場合は、新しく作成して新しいリンクを発行するしかありません。',
  'shares.revoke.confirmOk': '共有の取り消しを確定',

  /* ==================== 一括失効（行チェックボックス / 全件） ==================== */
  'shares.action.revokeSelected': '選択分を失効',
  'shares.action.revokeSelectedCount': '選択分を失効（{count}）',
  'shares.action.revokeAll': 'すべて失効',
  'shares.revokeBatch.success': '{count} 件の共有リンクを失効しました',
  'shares.revoke.none': '有効な共有リンクはありません',
  'shares.revokeSelected.confirmTitle':
    '選択した {count} 件の共有を失効しますか？',
  'shares.revokeSelected.confirmContent':
    '選択したリンクは直ちに無効になり、相手に送信済みの抽出コードも失効します。失効は終端状態で、復元できません。',
  'shares.revokeSelected.confirmOk': '選択分の失効を確定',
  'shares.revokeAll.confirmTitle': '有効な共有をすべて失効しますか？',
  'shares.revokeAll.confirmContent':
    '現在のアカウント配下の「有効な」リンクをすべて失効します（このページ以外も含む）。相手に送信済みのリンクと抽出コードは直ちに失効します。失効は終端状態で、復元できません。',
  'shares.revokeAll.confirmOk': 'すべての失効を確定',

  /* ============================ 作成成功 ============================ */
  'shares.created.title': '共有を作成しました',
  'shares.created.ok': '了解しました',
  'shares.created.code': '抽出コード：',
  'shares.created.note':
    'サーバーは抽出コードのハッシュのみを保存します。このウィンドウを閉じると再表示できないため、直ちに相手へ伝えてください。',

  /* ============================ テーブルの列 ============================ */
  'shares.column.deletedFile': '（ファイルは削除済み）',
  'shares.column.status': 'ステータス',
  'shares.column.expireAt': '有効期限',
  'shares.column.used': '使用回数',
  'shares.column.unlimited': '無制限',
  'shares.column.remaining': '残り回数',
  'shares.column.extractCode': '抽出コード',
  'shares.column.extractOn': '有効',
  'shares.column.extractOff': '無効',
  'shares.column.createTime': '作成日時',

  /* ============================ 作成ダイアログ ============================ */
  'shares.create.title': '外部共有を作成',
  'shares.create.file': '共有するファイル',
  'shares.create.filePlaceholder': 'ファイル名で検索',
  'shares.create.fileRequired': '共有するファイルを選択してください',
  'shares.create.fileNotFound': '一致するファイルがありません',
  'shares.create.expire': '有効期限',
  'shares.create.expireRequired': '有効期限を選択してください',
  'shares.create.expireExtra':
    '最長 {days} 日。期限切れ後はリンクが自動的に無効になります',
  'shares.create.downloadLimit': 'ダウンロード回数の上限',
  'shares.create.downloadLimitRequired':
    'ダウンロード回数の上限を入力してください',
  'shares.create.downloadLimitExtra':
    '1〜{max} 回。使い切るとリンクは自動的に無効になります',
  'shares.create.extractCode': '抽出コード',
  'shares.create.extractCodeRequired': '抽出コードを入力してください',
  'shares.create.extractCodeRule':
    '抽出コードは {min}〜{max} 桁の英数字で入力してください',
  'shares.create.extractCodeExtra':
    'サーバーはハッシュのみを保存します。作成後は直ちに相手へ伝えてください。以降は再表示できません',

  /* ==================== ゲスト受取ページ（/share/:token、ログイン不要） ==================== */
  'shares.visit.subtitle':
    'AntTransfer 経由でファイルが送信されました。抽出コードを入力すると受け取れます',
  'shares.visit.invalidLink':
    'リンクが不完全です：共有トークンがありません。完全なリンクをコピーしたか確認してください',
  'shares.visit.code.label': '抽出コード',
  'shares.visit.code.placeholder':
    'メールやチャットで受け取った抽出コードを入力してください',
  'shares.visit.code.prefilled':
    'リンク内の抽出コードを自動入力しました。確認して「ファイルを受け取る」をクリックしてください',
  'shares.visit.code.required': '抽出コードを入力してください',
  'shares.visit.submit': 'ファイルを受け取る',
  'shares.visit.redeemed':
    '受け取りに成功しました。下のボタンからダウンロードしてください',
  'shares.visit.ticketTtl':
    'ダウンロード URL の有効期限は {minutes} 分です。期限切れ後は再度受け取りが必要で、受取回数も 1 回消費します',
  'shares.visit.unknownFile': '（ファイル名を取得できませんでした）',
  'shares.visit.download': 'ファイルをダウンロード',
  'shares.visit.footer':
    'このリンクは抽出コードを持つ人だけが受け取れます。無関係な人に転送しないでください',
} as const;
