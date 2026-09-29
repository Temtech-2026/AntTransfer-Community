/** システム管理（ユーザー / ロール / 部門 / グループ / メニュー権限）の文言。 */
export default {
  // ページ横断で再利用するシステムドメインのアクション / 列名
  'system.action.edit': '編集',
  'system.action.delete': '削除',
  'system.action.create': '作成',
  'system.column.action': '操作',
  'system.column.status': 'ステータス',
  'system.column.remark': '備考',
  'system.column.createTime': '作成日時',
  'system.alert.boundaryTitle': '操作の境界',

  // ユーザーステータス
  'system.userStatus.normal': '正常',
  'system.userStatus.disabled': '無効',
  'system.userStatus.locked': 'ロック',
  'system.userStatus.unknown': '不明',

  // データ範囲
  'system.dataScope.self': '本人のみ',
  'system.dataScope.deptAndSub': '自部門および配下',
  'system.dataScope.all': 'すべて',
  'system.dataScope.unknown': '不明({scope})',

  // 権限ポイントの次元
  'system.permType.menu': 'メニュー',
  'system.permType.action': '操作',
  'system.permType.dataScope': 'データ範囲',
  'system.permType.unknown': '不明({type})',

  // ユーザー管理ページ
  'system.user.title': 'ユーザー管理',
  'system.user.subtitle': 'アカウント・部門・ステータス・ロールの所属',
  'system.user.alertBoundary':
    '保護アカウントは無効化 / 削除 / ロール変更ができません。管理者は自分自身に対して無効化・パスワード再設定・ロール割当・削除を行えません（バックエンドが拒否し、自己権限昇格も防ぎます）。データ範囲が制限されている場合、一覧とロールのドロップダウンは自動的に絞り込まれます。',
  'system.user.column.keyword': 'アカウント / ニックネーム',
  'system.user.column.keywordPlaceholder':
    'アカウントまたはニックネームの部分一致',
  'system.user.column.username': 'アカウント',
  'system.user.column.nickname': 'ニックネーム',
  'system.user.column.dept': '部門',
  'system.user.column.deptPlaceholder': '閲覧可能なすべての部門',
  'system.user.column.roles': 'ロール',
  'system.user.column.lastLogin': '最終ログイン',
  'system.user.protectedTag': '保護対象',
  'system.user.action.assignRole': 'ロールを割り当て',
  'system.user.action.resetPassword': 'パスワードを再設定',
  'system.user.action.disable': '無効化',
  'system.user.action.enable': '有効化',
  'system.user.action.locked': 'ロック中',
  'system.user.action.create': 'ユーザーを作成',
  'system.user.confirm.disableTitle': 'このアカウントを無効化しますか？',
  'system.user.confirm.enableTitle': 'このアカウントを有効化しますか？',
  'system.user.confirm.disableDesc':
    '無効化すると、このアカウントのすべての進行中セッションが直ちに無効になります。',
  'system.user.confirm.deleteTitle': 'このユーザーを削除しますか？',
  'system.user.confirm.deleteDesc':
    '削除すると復元できません。保護アカウントや他から参照されているアカウントはサーバーに拒否されます。',
  'system.user.message.disabled': '{name} を無効化しました',
  'system.user.message.enabled': '{name} を有効化しました',
  'system.user.message.deleted': '{name} を削除しました',

  // アバター（専用経路：アップロードで即時反映し、編集フォームの保存には関与しない）
  'system.user.avatar.label': 'アバター',
  'system.user.avatar.upload': 'アバターをアップロード',
  'system.user.avatar.hint': 'PNG / JPEG / GIF / WebP に対応、{max} 以下',
  'system.user.avatar.updated': 'アバターを更新しました',
  'system.user.avatar.tooLarge': '画像は {max} 以下にしてください',
  'system.user.avatar.typeInvalid':
    'PNG / JPEG / GIF / WebP の画像のみ対応しています',

  // ユーザーの新規作成 / 編集ダイアログ
  'system.userForm.title.edit': 'ユーザーを編集 · {name}',
  'system.userForm.title.create': 'ユーザーを作成',
  'system.userForm.alert.title':
    'アカウント名・ステータス・ロール・パスワードはこのフォームには含まれません',
  'system.userForm.alert.desc':
    'アカウント名は変更できません。ステータス / パスワード / ロールは一覧の該当ボタンから操作してください。備考は API が返さないため、編集機能は提供していません。',
  'system.userForm.field.username': 'ログインアカウント',
  'system.userForm.field.password': '初期パスワード',
  'system.userForm.field.nickname': 'ニックネーム / 氏名',
  'system.userForm.field.dept': '所属部門',
  'system.userForm.field.email': 'メールアドレス',
  'system.userForm.field.mobile': '携帯番号',
  'system.userForm.field.roleIds': '初期ロール',
  'system.userForm.placeholder.username':
    '3〜64 桁の英数字 / アンダースコア / ピリオド / ハイフン',
  'system.userForm.placeholder.password': '8〜64 桁',
  'system.userForm.placeholder.dept': '未割当',
  'system.userForm.placeholder.roleIds': 'ロールを割り当てない',
  'system.userForm.extra.deptEdit':
    '部門の変更は異動とみなします：このユーザーの「承認により取得した」有効な権限をすべて回収します',
  'system.userForm.extra.deptCreate': '空欄 = 部門未割当',
  'system.userForm.extra.emailEdit':
    '空欄 = 変更しない（バックエンドの保守的方針により、メールアドレスは空にできません）',
  'system.userForm.extra.mobileEdit': '空欄 = 変更しない',
  'system.userForm.extra.roleIds':
    '割り当てなくても構いません。データ範囲が「すべて」でない場合、自分が保有するロールしか割り当てられません（{perm} が必要）。',
  'system.userForm.rule.usernameRequired':
    'ログインアカウントを入力してください',
  'system.userForm.rule.usernamePattern':
    '3〜64 桁の英数字 / アンダースコア / ピリオド / ハイフンである必要があります',
  'system.userForm.rule.passwordRequired': '初期パスワードを入力してください',
  'system.userForm.rule.passwordLength':
    'パスワードは 8〜64 桁である必要があります',
  'system.userForm.rule.nicknameRequired': 'ニックネームを入力してください',
  'system.userForm.rule.nicknameMax': '64 文字以内',
  'system.userForm.rule.emailInvalid': 'メールアドレスの形式が正しくありません',
  'system.userForm.rule.emailMax': '128 文字以内',
  'system.userForm.rule.mobileMax': '32 文字以内',
  'system.userForm.rule.remarkMax': '255 文字以内',
  'system.userForm.message.updated': 'ユーザー情報を更新しました',
  'system.userForm.message.created': 'ユーザーを作成しました',
  'system.userForm.roleOption': '{name}（{code}·{scope}）',

  // パスワード再設定ダイアログ
  'system.resetPassword.title': 'パスワードを再設定 · {name}',
  'system.resetPassword.ok': '再設定を確定',
  'system.resetPassword.alert.title':
    '再設定後、このユーザーのすべての進行中セッションが直ちに無効になります',
  'system.resetPassword.alert.desc':
    'ユーザーは新しいパスワードで再ログインする必要があります。管理者は元のパスワードを閲覧できません（DB にはハッシュのみ保存されます）。',
  'system.resetPassword.field.newPassword': '新しいパスワード',
  'system.resetPassword.field.confirmPassword': '新しいパスワードの確認',
  'system.resetPassword.placeholder.password': '8〜64 桁',
  'system.resetPassword.rule.newRequired': '新しいパスワードを入力してください',
  'system.resetPassword.rule.length':
    'パスワードは 8〜64 桁である必要があります',
  'system.resetPassword.rule.confirmRequired':
    '新しいパスワードをもう一度入力してください',
  'system.resetPassword.rule.mismatch': '入力したパスワードが一致しません',
  'system.resetPassword.message.done':
    'パスワードを再設定しました。このユーザーのすべての進行中セッションは無効になりました',

  // ロール割当ドロワー
  'system.assignRole.title': 'ロールを割り当て · {name}',
  'system.assignRole.alert.protected.title': '保護アカウント',
  'system.assignRole.alert.protected.desc':
    'スーパー管理者ロールは必ず保持する必要があります。外すとサーバーに拒否されます。',
  'system.assignRole.alert.mode.title':
    '集合ごと置換 + 最低 1 つのロールを保持',
  'system.assignRole.alert.mode.desc':
    '送信後は今回のチェック内容が正となります（差分ではありません）。バックエンドはロール集合が空でないことを要求するため、少なくとも 1 つチェックしてください。',
  'system.assignRole.searchPlaceholder': 'ロール名 / コードで絞り込み',
  'system.assignRole.empty.noOptions':
    '割り当て可能なロールがありません（データ範囲の制限が原因の場合があります）',
  'system.assignRole.empty.noMatch': '一致するロールがありません',
  'system.assignRole.atLeastOne':
    '少なくとも 1 つのロールをチェックしてください：バックエンドがロール集合に非空チェックを行います。',
  'system.assignRole.message.done': 'ロールを更新しました',

  // ロール管理ページ
  'system.role.title': 'ロール管理',
  'system.role.subtitle': 'ロール本体と権限マトリクス',
  'system.role.alertBoundary':
    '組み込みロールは削除できず、データ範囲も変更できません。システム管理面の権限ポイントはスーパー管理者にのみ付与されます。データ範囲が「すべて」でない場合、新規作成するロールには自身を超えないデータ範囲しか付与できず、権限の割当ても自分が保有する権限ポイントしかチェックできません（サーバー側の権限昇格防止が最終的な防御です）。',
  'system.role.column.keyword': 'ロール名 / コード',
  'system.role.column.keywordPlaceholder': '名称またはコードの部分一致',
  'system.role.column.name': 'ロール名',
  'system.role.column.code': 'コード',
  'system.role.column.dataScope': 'データ範囲',
  'system.role.column.permissionSet': '権限セット',
  'system.role.builtInTag': '組み込み',
  'system.role.lockedTag': 'ロック（読み取り専用）',
  'system.role.maintainableTag': '保守可能',
  'system.role.action.assignPerm': '権限を割り当て',
  'system.role.action.create': 'ロールを作成',
  'system.role.confirm.deleteTitle': 'このロールを削除しますか？',
  'system.role.confirm.deleteDesc':
    '組み込みロール、関連する権限が残っているロール、ユーザーが保持しているロールはサーバーに拒否されます。',
  'system.role.message.deleted': 'ロール {name} を削除しました',

  // ロールの新規作成 / 編集ダイアログ
  'system.roleForm.title.edit': 'ロールを編集 · {name}',
  'system.roleForm.title.create': 'ロールを作成',
  'system.roleForm.alert.title': '組み込みロール',
  'system.roleForm.alert.desc':
    'コードとデータ範囲は変更できず、名称と備考のみ調整できます。権限マトリクスは「権限を割り当て」ドロワーで管理します。',
  'system.roleForm.field.code': 'ロールコード',
  'system.roleForm.field.name': 'ロール名',
  'system.roleForm.field.dataScope': 'データ範囲',
  'system.roleForm.placeholder.code': '例：DEPT_ADMIN',
  'system.roleForm.extra.codeEdit':
    'コードはロールの対外的な識別子です。作成後は変更できません',
  'system.roleForm.extra.dataScopeBuiltIn':
    '組み込みロールのデータ範囲は変更できません',
  'system.roleForm.extra.dataScopeMax':
    'あなた自身のデータ範囲を超えることはできません（現在：{scope}）',
  'system.roleForm.rule.codeRequired': 'ロールコードを入力してください',
  'system.roleForm.rule.codePattern':
    '大文字で始まり、大文字 / 数字 / アンダースコアのみを含む必要があります',
  'system.roleForm.rule.nameRequired': 'ロール名を入力してください',
  'system.roleForm.rule.nameMax': '64 文字以内',
  'system.roleForm.rule.dataScopeRequired': 'データ範囲を選択してください',
  'system.roleForm.message.updated': 'ロールを更新しました',
  'system.roleForm.message.created': 'ロールを作成しました',

  // ロール権限ドロワー
  'system.rolePerm.title': '権限を割り当て · {name}',
  'system.rolePerm.alert.locked.title':
    '監査員ロールの権限セットはロックされています',
  'system.rolePerm.alert.locked.desc':
    'サービス層がこのロールの権限セットへのいかなる変更も拒否します（1021）。このドロワーは読み取り専用です。',
  'system.rolePerm.alert.readOnly.title': '読み取り専用',
  'system.rolePerm.alert.readOnly.desc':
    'ロール権限の付与権限ポイント（system:role:assign-perm）がないため、現在の権限マトリクスの閲覧のみ可能です。',
  'system.rolePerm.alert.selfLock.title':
    '自己ロック防止：3 つの権限ポイントは外せません',
  'system.rolePerm.alert.selfLock.desc':
    '{codes} は必ず保持する必要があります。そうでなければ誰も権限を管理できなくなるため、サーバーが直接拒否します。',
  'system.rolePerm.alert.narrow.title':
    '権限昇格防止：自分が保有する権限ポイントしか付与できません',
  'system.rolePerm.alert.narrow.desc':
    'あなたのデータ範囲は「すべて」ではないため、「付与不可」と表示されたノードは送信するとサーバーに拒否されます。',
  'system.rolePerm.tooltip.required':
    '自己ロック防止：スーパー管理者はこの「管理能力への入口」を必ず保持する必要があり、サーバーが外す操作を拒否します',
  'system.rolePerm.tooltip.notHeld':
    'あなたのデータ範囲は「すべて」ではないため、自分が保有していない権限ポイントは付与できません（サーバー側の権限昇格防止）',
  'system.rolePerm.tag.required': '必須',
  'system.rolePerm.tag.notHeld': '付与不可',
  'system.rolePerm.selected':
    '{selected} / 全 {total} 個の権限ポイントを選択中',
  'system.rolePerm.parentNote': '（親ノードのチェック = 入口が見える）',
  'system.rolePerm.empty': '権限ポイントのカタログが空です',
  'system.rolePerm.message.mustKeep':
    'スーパー管理者ロールはこれらの権限ポイントを必ず保持する必要があります：{codes}',
  'system.rolePerm.message.done': 'ロール権限を更新しました',

  // メニュー / 権限ポイントのカタログ（読み取り専用）
  'system.menu.title': 'メニュー / 権限ポイントのカタログ',
  'system.menu.subtitle': '権限モデルの現状（読み取り専用）',
  'system.menu.alert.title':
    '読み取り専用ページ：権限ポイントの追加・変更・削除は SQL マイグレーションで管理します',
  'system.menu.alert.desc':
    '本プロジェクトは「メニュー」と「操作」を権限ポイントとして統一的にモデリングしています（type：1 メニュー / 2 操作 / 3 データ範囲）。現在はカタログの読み取りエンドポイント（GET /api/v1/permission-points）のみで、権限ポイントの保守 API はありません。特定のロールに権限を付与する場合は「ロール管理 → 権限を割り当て」へ進んでください。',
  'system.menu.column.permName': '権限ポイント名',
  'system.menu.column.permCode': '権限コード',
  'system.menu.column.type': '次元',
  'system.menu.column.sortNo': '並び順',
  'system.menu.stat.total': '権限ポイント総数',
  'system.menu.stat.menu': 'メニューノード',
  'system.menu.stat.action': '操作ノード',
  'system.menu.stat.scope': 'データ範囲ノード',
  'system.menu.headerTitle': '権限ポイントツリー',
  'system.menu.searchPlaceholder': '名称 / コードで絞り込み',
  'system.menu.empty.noPerm':
    '権限がありません：system:role:list または system:role:assign-perm が必要です',

  // グループ管理（プレースホルダーの説明）
  'system.group.title': 'グループ管理',
  'system.group.subtitle': '未公開',
  'system.group.alert.title':
    'CE 版にはグループ管理 API がないため、本ページはプレースホルダーの説明です',
  'system.group.alert.desc':
    'データテーブル sys_group / sys_group_member は存在しますが、サーバー側に対応する管理コントローラと権限ポイントがありません。「押せば必ず失敗する」入口を出さないため、ここでは追加・変更・削除の操作を提供せず、模擬データも描画しません。',
  'system.group.section.current.title': '現状',
  'system.group.section.current.subtitle':
    'データテーブル・サーバー側エンティティ・権限ポイント',
  'system.group.section.endpoints.title': '補完に必要なインターフェース',
  'system.group.section.endpoints.subtitle': '対応予定の一覧',
  'system.group.desc.table': 'データテーブル',
  'system.group.desc.entity': 'サーバー側エンティティ',
  'system.group.entity.note':
    'コラボレーションドメイン内部でのみ使用（アクセス判定）。対外的な CRUD はありません',
  'system.group.desc.perm': '権限ポイント',
  'system.group.perm.none':
    'system:group:* 権限ポイントはありません（V9 では system:user:* と system:role:* のみ定義）',
  'system.group.desc.availability': '現在の可用性',
  'system.group.availability.readonly': '読み取り専用で利用不可（API なし）',
  'system.group.column.method': 'メソッド',
  'system.group.column.path': 'パス',
  'system.group.column.purpose': '用途',
  'system.group.endpoint.groups.page': 'グループのページング / キーワード検索',
  'system.group.endpoint.groups.detail': 'グループの詳細',
  'system.group.endpoint.groups.create': 'グループを作成',
  'system.group.endpoint.groups.update':
    'グループを編集（名称 / 備考 / 責任者）',
  'system.group.endpoint.groups.remove': 'グループを削除',
  'system.group.endpoint.members.list': 'メンバー一覧',
  'system.group.endpoint.members.replace': 'メンバーを集合ごと置換',

  // 部門管理（読み取り専用）
  'system.dept.title': '部門管理',
  'system.dept.subtitle': '組織図（読み取り専用）',
  'system.dept.alert.title':
    '読み取り専用ページ：CE 版には部門の追加・変更・削除 API がありません',
  'system.dept.alert.desc':
    '現在利用できる部門エンドポイントは GET /api/v1/system/users/dept-options のみです（ユーザーフォームのドロップダウンとデータ範囲の判定に使用）。本ページは組織図を正確に表示し、実現できない書き込み操作は提供しません。部門 ID は「ユーザーの異動」とデータ範囲の計算にも使われるため、変更前に影響範囲を確認してください。',
  'system.dept.column.name': '部門名',
  'system.dept.column.id': '部門 ID',
  'system.dept.column.parentId': '上位部門 ID',
  'system.dept.column.depth': '階層',
  'system.dept.column.childCount': '下位部門数',
  'system.dept.depthValue': '第 {depth} 階層',
  'system.dept.rootTag': 'ルート',
  'system.dept.stat.total': '部門総数',
  'system.dept.stat.roots': 'ルート部門',
  'system.dept.stat.maxDepth': '最大階層',
  'system.dept.stat.rootsFooter': '上位部門を持たない最上位ノード',
  'system.dept.suffix.count': '件',
  'system.dept.suffix.level': '階層',
  'system.dept.headerTitle': '部門一覧',
  'system.dept.message.reloaded': '部門一覧を再取得しました',
} as const;
