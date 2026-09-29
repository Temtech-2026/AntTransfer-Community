export default {
  'pages.layouts.userLayout.title':
    'Ant Design は西湖区で最も影響力のある Web デザインガイドラインです',
  'pages.login.accountLogin.tab': 'アカウント／パスワードログイン',
  'pages.login.accountLogin.errorMessage':
    'ユーザー名またはパスワードが正しくありません（admin/ant.design）',
  'pages.login.failure': 'ログインに失敗しました。再試行してください。',
  'pages.login.success': 'ログインに成功しました。',
  'pages.login.username.placeholder': 'ユーザー名：admin または user',
  'pages.login.username.required': 'ユーザー名は必須です。',
  'pages.login.password.placeholder': 'パスワード：ant.design',
  'pages.login.password.required': 'パスワードは必須です。',
  'pages.login.phoneLogin.tab': '電話番号ログイン',
  'pages.login.phoneLogin.errorMessage': '認証コードが正しくありません',
  'pages.login.phoneNumber.placeholder': '電話番号を入力してください。',
  'pages.login.phoneNumber.required': '電話番号は必須です。',
  'pages.login.phoneNumber.invalid': '電話番号の形式が正しくありません。',
  'pages.login.captcha.placeholder': '認証コードを入力してください。',
  'pages.login.captcha.required': '認証コードは必須です。',
  'pages.login.phoneLogin.getVerificationCode': '認証コードを取得',
  'pages.getCaptchaSecondText': '秒後に再取得',
  'pages.login.rememberMe': '自動ログイン',
  'pages.login.forgotPassword': 'パスワードをお忘れですか？',
  'pages.login.submit': 'ログイン',
  'pages.login.loginWith': 'その他のログイン方法：',
  'pages.login.registerAccount': 'アカウント登録',
  'pages.welcome.link': 'ようこそ',
  'pages.welcome.celebrationTitle': 'AntTransfer Community Edition へようこそ',
  'pages.welcome.alertMessage':
    'より高速で強力なコンポーネント群を公開しました。',
  'pages.welcome.infoCard.umi.title': 'umi について',
  'pages.welcome.infoCard.umi.desc':
    'umi は拡張可能なエンタープライズ向けフロントエンドアプリケーションフレームワークです。ルーティングを基盤とし、設定ベースと規約ベースの両方のルーティングをサポートします。',
  'pages.welcome.infoCard.antd.title': 'Ant Design について',
  'pages.welcome.infoCard.antd.desc':
    'antd は Ant Design デザインシステムに基づく React UI コンポーネントライブラリで、主にエンタープライズ向けの管理画面開発に用いられます。',
  'pages.welcome.infoCard.procomponents.title': 'Pro Components について',
  'pages.welcome.infoCard.procomponents.desc':
    'ProComponents は Ant Design をベースにした高抽象度のテンプレートコンポーネント群で、「1 コンポーネント = 1 ページ」を開発コンセプトとしています。',
  /* ============================ ウェルカムページ（pages/Welcome.tsx） ============================ */
  'pages.welcome.header.title': 'AntTransfer CE',
  'pages.welcome.header.subTitle':
    'オープンソースのファイル安全転送とコラボレーション共有',
  'pages.welcome.hero.title': 'AntTransfer Community Edition',
  'pages.welcome.hero.desc':
    'オープンソースのコンテンツ／ファイル安全転送・コラボレーション共有ソリューション：Spring Boot 3 のモジュラーモノリスバックエンド + Umi Max / React 19 のフロントエンド。すぐに使えて、二次開発も容易です。',
  'pages.welcome.feature.transfer.title': '安全なファイル転送',
  'pages.welcome.feature.transfer.desc':
    'レジューム、進捗の可視化、秒速アップロード検証に対応し、大容量ファイルの転送に適しています（at-transfer / at-file）。',
  'pages.welcome.feature.collaboration.title': 'コラボレーション共有',
  'pages.welcome.feature.collaboration.desc':
    'コラボレーションスペースと共有リンクにより、複数人が同じファイル群に安全にアクセスできます（at-collaboration）。',
  'pages.welcome.feature.permission.title': '権限と監査',
  'pages.welcome.feature.permission.desc':
    'RBAC 権限ポイントと全経路の TraceId により、監査と追跡が可能です（at-permission / at-gateway）。',
  'pages.welcome.quickStart.title': 'クイックスタート',
  'pages.welcome.quickStart.subTitle': 'ローカル連携と今後の接続',
  /* 先頭の断片にはインラインコード（/api、http://localhost:8080）を含むため 3 分割して連結する。コード部分は翻訳しない */
  'pages.welcome.quickStart.proxyPrefix':
    'フロントエンドとバックエンドの連携：本プロジェクトは',
  'pages.welcome.quickStart.proxyMiddle': 'をバックエンドへプロキシ済みです',
  'pages.welcome.quickStart.proxySuffix': '（config/proxy.ts を参照）。',
  'pages.welcome.quickStart.domainHint':
    'ドメイン画面（転送 / ファイル / コラボレーション / 権限）は、バックエンド API の実装に合わせて順次接続されます。',
  'pages.404.subTitle': '申し訳ありません、アクセスしたページは存在しません。',
  'pages.404.buttonText': 'ホームへ戻る',
  'pages.admin.subPage.title': 'このページは admin 権限でのみ閲覧できます',
  'pages.admin.subPage.alertMessage':
    'umi ui を公開しました。npm run ui で起動してお試しください。',
  'pages.searchTable.createForm.newRule': 'ルールを作成',
  'pages.searchTable.updateForm.ruleConfig': 'ルール設定',
  'pages.searchTable.updateForm.basicConfig': '基本情報',
  'pages.searchTable.updateForm.ruleName.nameLabel': 'ルール名',
  'pages.searchTable.updateForm.ruleName.nameRules':
    'ルール名を入力してください。',
  'pages.searchTable.updateForm.ruleDesc.descLabel': 'ルールの説明',
  'pages.searchTable.updateForm.ruleDesc.descPlaceholder':
    '5 文字以上で入力してください',
  'pages.searchTable.updateForm.ruleDesc.descRules':
    '5 文字以上のルール説明を入力してください。',
  'pages.searchTable.updateForm.ruleProps.title': 'ルール属性の設定',
  'pages.searchTable.updateForm.object': '監視対象',
  'pages.searchTable.updateForm.ruleProps.templateLabel': 'ルールテンプレート',
  'pages.searchTable.updateForm.ruleProps.typeLabel': 'ルール種別',
  'pages.searchTable.updateForm.schedulingPeriod.title':
    'スケジュール周期の設定',
  'pages.searchTable.updateForm.schedulingPeriod.timeLabel': '開始時刻',
  'pages.searchTable.updateForm.schedulingPeriod.timeRules':
    '開始時刻を選択してください。',
  'pages.searchTable.titleDesc': '説明',
  'pages.searchTable.ruleName': 'ルール名は必須です',
  'pages.searchTable.titleCallNo': 'サービス呼び出し回数',
  'pages.searchTable.titleStatus': 'ステータス',
  'pages.searchTable.nameStatus.default': '停止',
  'pages.searchTable.nameStatus.running': '実行中',
  'pages.searchTable.nameStatus.online': '公開済み',
  'pages.searchTable.nameStatus.abnormal': '異常',
  'pages.searchTable.titleUpdatedAt': '前回の実行時刻',
  'pages.searchTable.exception': '異常の原因を入力してください。',
  'pages.searchTable.titleOption': '操作',
  'pages.searchTable.config': '設定',
  'pages.searchTable.subscribeAlert': 'アラートを購読',
  'pages.searchTable.title': '検索テーブル',
  'pages.searchTable.new': '新規作成',
  'pages.searchTable.chosen': '選択済み',
  'pages.searchTable.item': '件',
  'pages.searchTable.totalServiceCalls': 'サービス呼び出し回数の合計',
  'pages.searchTable.tenThousand': '万',
  'pages.searchTable.batchDeletion': '一括削除',
  'pages.searchTable.batchApproval': '一括承認',
};
