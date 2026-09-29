/** ログインページの文言。 */
export default {
  /* ============================ ブランド ============================ */
  'auth.login.brand.subtitle':
    '企業向けファイル転送・コラボレーションプラットフォーム',

  /* ============================ ロック通知 ============================ */
  'auth.login.locked.title': 'アカウントがロックされています',
  'auth.login.locked.fallback': 'ログイン失敗回数が上限を超えました',
  'auth.login.locked.desc': '{message}（残り {countdown}）',

  /* ============================ アカウント ============================ */
  'auth.login.username.label': 'アカウント',
  'auth.login.username.placeholder': 'アカウントを入力してください',
  'auth.login.username.required': 'アカウントを入力してください',

  /* ============================ パスワード ============================ */
  'auth.login.password.label': 'パスワード',
  'auth.login.password.placeholder': 'パスワードを入力してください',
  'auth.login.password.required': 'パスワードを入力してください',

  /* ============================ 画像認証コード（UI のみ） ============================ */
  'auth.login.captcha.label': '画像認証コード',
  'auth.login.captcha.tooltip':
    '画像認証コードサービスは未接続のため、現在ログイン時の検証は行いません（UI のみ）',
  'auth.login.captcha.placeholder': 'サービス接続後に有効化',
  'auth.login.captcha.button': '認証コード',

  /* ============================ ログイン状態の保持 / 送信 ============================ */
  'auth.login.remember':
    'ログイン状態を保持（アカウントのみ記憶し、パスワードは保存しません）',
  'auth.login.submit': 'ログイン',
  'auth.login.submitLocked': '{countdown} 後に再試行してください',

  /* ============================ フッター説明 ============================ */
  'auth.login.footerHint':
    'アカウントは管理者が一括発行します。発行が必要な場合は管理者に連絡してください',
} as const;
