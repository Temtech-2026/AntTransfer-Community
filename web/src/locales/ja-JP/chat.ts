/** チャットページ（会話一覧 + チャットウィンドウ）の文言。 */
export default {
  'chat.title': 'チャット',
  'chat.subtitle': '1 対 1 / グループチャット、リアルタイム送受信',

  'chat.action.refresh': '更新',
  'chat.action.new': '会話を開始',
  'chat.action.send': '送信',

  'chat.list.title': '会話',
  'chat.search.placeholder': '会話を検索',
  'chat.list.empty.title': '会話はまだありません',
  'chat.list.empty.desc':
    '「会話を開始」から同僚を選んで 1 対 1 を始めるか、グループ ID を入力してグループチャットを始めてください',
  'chat.list.emptyFiltered.title': '一致する会話がありません',
  'chat.list.emptyFiltered.desc': '別のキーワードを試してください',

  'chat.session.groupFallback': 'グループチャット #{id}',
  'chat.session.userFallback': 'ユーザー #{id}',
  'chat.tag.private': '1 対 1',
  'chat.tag.group': 'グループ',
  'chat.sender.mine': '自分',

  // 既読レシート：吹き出し下の読者アバター行のアクセシビリティ文言（アイコンのみの情報には文字の等価物が必要）
  'chat.read.by': '既読：{names}',
  'chat.read.more': 'ほか {count} 人が既読',

  // メッセージの右クリック操作：取り消し（自分の送信かつ 2 分以内のみ）と引用（特定メッセージへの返信）
  'chat.message.action.quote': '引用',
  'chat.message.action.recall': '取り消し',
  // 取り消し後の吹き出しプレースホルダー：「誰が取り消したか」を書く（グループチャットでは
  // 単に「取り消されました」だと自分が取り消したと誤解される）
  'chat.message.recalled.mine': 'あなたがメッセージを取り消しました',
  'chat.message.recalled.other': '{name} がメッセージを取り消しました',
  'chat.message.recall.success': '取り消しました',
  'chat.message.recall.failed':
    '取り消しに失敗しました。しばらくしてから再試行してください',

  // 引用状態の入力欄の上に出す「引用中」の案内
  'chat.composer.quote.cancel': '引用を解除',

  // 相手のプレゼンス状態：チャットページとドロワーが同一コンポーネントを共有するため、どちらか一方に帰属しない文言
  // 3 状態には必ず文字を添える：緑 / 灰 / 赤のドットだけでは、色覚特性のある利用者やハイコントラストモードで情報が伝わらない
  'chat.presence.online': 'オンライン',
  'chat.presence.offline': 'オフライン',
  'chat.presence.unstable': 'ネットワーク状態が不安定',
  // 上記 3 状態と同じ行に並べる：相手が入力中なら、この情報のほうが静的状態より即時的
  'chat.typing': '相手が入力中…',

  // 自端の接続品質（チャットページのヘッダーに常時表示）：上の相手側プレゼンスとは別物
  'chat.connection.open': 'リアルタイム接続は正常',
  'chat.connection.connecting': '接続中…',
  'chat.connection.reconnecting': '再接続中…',
  'chat.connection.closed': '接続が切断されました',
  'chat.connection.idle': '未接続',

  'chat.stream.placeholder.title': '左の会話を選んでチャットを開始',
  'chat.stream.placeholder.desc':
    '会話履歴はリアルタイムに同期され、切断中の分も再接続後に取り込まれます',
  'chat.stream.empty.title': 'メッセージはまだありません',
  'chat.stream.empty.desc': '最初のメッセージを送って挨拶しましょう',
  'chat.stream.loadMore': 'さらに前のメッセージを読み込む',
  'chat.stream.loadingMore': '読み込み中…',
  'chat.stream.noMore': 'これより前のメッセージはありません',
  'chat.stream.loadMoreFailed':
    '過去のメッセージの読み込みに失敗しました。再試行してください',

  // 入力欄の仕様は WeChat に合わせる：Enter で送信、Shift + Enter で改行
  'chat.composer.placeholder':
    'メッセージを入力。Enter で送信、Shift + Enter で改行',
  'chat.composer.empty': 'メッセージ内容を入力してください',
  'chat.composer.sendHint': 'Enter で送信、Shift + Enter で改行',
  'chat.composer.emoji': '絵文字',
  'chat.composer.emojiPanel': '絵文字のカテゴリ',
  'chat.composer.group.recent': '最近使用したもの',
  'chat.composer.group.smileys': '顔文字',
  'chat.composer.group.gestures': 'ジェスチャー',
  'chat.composer.group.people': '人と感情',
  'chat.composer.group.animals': '動物と自然',
  'chat.composer.group.food': '食べ物',
  'chat.composer.group.objects': '物と活動',
  'chat.composer.group.symbols': '記号',

  // @ メンション：入口はグループチャットにのみ表示（1 対 1 には指名の意味がない。ChatComposer.mentionEnabled を参照）
  'chat.composer.mention': 'メンバーをメンション',
  'chat.composer.mentionPanel': 'メンション可能なメンバー',
  'chat.composer.mentionEmpty': '一致するメンバーがありません',
  // 「自分への @」：会話一覧のプレビュー接頭辞・バッジの強調・メッセージ吹き出しのマークで同じ文言を共有
  'chat.mention.me': '自分への @ があります',

  'chat.new.title': '会話を開始',
  'chat.new.scope.label': '会話タイプ',
  'chat.new.scope.private': '1 対 1',
  'chat.new.scope.group': 'グループ',
  'chat.new.user.placeholder': 'アカウントまたはニックネームで検索',
  'chat.new.user.optionLabel': '{name}（{username}）',
  'chat.new.user.resolveHint':
    '相手のログインアカウントを入力してください。入力欄を離れると自動で照合します',
  'chat.new.user.resolved': '見つかりました：{name}',
  'chat.new.user.notFound':
    'このアカウントに対応する利用可能なユーザーが見つかりません。確認して再試行してください',
  'chat.new.target.label': '相手のログインアカウント',
  'chat.new.target.placeholder': '相手のログインアカウントを入力してください',
  'chat.new.target.required': 'まず会話の相手を選択してください',
  'chat.new.target.accountRequired':
    'まず相手のログインアカウントを入力してください',

  // グループチャット：作成フォーム（グループ名 + 招待メンバー）と「参加中のグループ」入口。
  // 以前の「グループ ID」手入力は削除した——グループは作成できず ID も知りようがなく、あの入口は誰にも通じなかった
  'chat.new.group.nameLabel': 'グループ名',
  'chat.new.group.namePlaceholder': 'グループ名を入力してください',
  'chat.new.group.nameRequired': 'まずグループ名を入力してください',
  'chat.new.group.memberLabel': 'グループメンバー',
  'chat.new.group.memberPlaceholder':
    'メンバーのログインアカウントを入力し、Enter で追加',
  'chat.new.group.memberHint':
    '少なくとも 1 名の招待が必要です。自分を含めて最大 {max} 名',
  'chat.new.group.memberRequired':
    '少なくとも 1 名のグループメンバーを招待してください',
  'chat.new.group.memberLimit': 'グループメンバーは最大 {max} 名（自分を含む）',
  'chat.new.group.firstMessageFailed':
    'グループチャットは作成されましたが、最初のメッセージ送信に失敗しました。チャット欄から再送してください',
  'chat.new.group.existingLabel': '参加中のグループ',
  'chat.new.group.existingPlaceholder': '選択するとそのグループに入ります',
  'chat.new.group.optionLabel': '{name}（{count} 名）',
  'chat.new.content.required':
    'まず最初のメッセージを入力してください（会話は送信後に作成されます）',
  'chat.new.content.label': '最初のメッセージ',
  'chat.new.content.placeholder': '一言挨拶を送りましょう',
  'chat.new.submit': '開始',
  'chat.new.cancel': 'キャンセル',

  // グループ設定パネル（/chat ページと IM ドロワーが同一コンポーネントを共有するため、どちらか一方に帰属しない文言）。
  // ボタンの表示可否は「権限ポイント CHAT_PERM ∧ サーバーが下す ability」の論理積。components/ChatGroupPanel を参照
  'chat.group.title': 'グループ設定',
  'chat.group.close': '閉じる',
  'chat.group.info': 'グループ情報',
  'chat.group.name.placeholder': 'グループ名を入力してください',
  'chat.group.name.required': 'グループ名を入力してください',
  'chat.group.name.save': '保存',
  'chat.group.name.success': 'グループ名を更新しました',
  'chat.group.meta': '{count}/{max} 名',
  'chat.group.members.label': 'グループメンバー',
  'chat.group.emptyMembers': 'メンバーがいません',
  'chat.group.member.unknown': '不明なメンバー',
  'chat.group.member.owner': 'グループ作成者',
  'chat.group.member.admin': '管理者',
  'chat.group.member.readonly': '読み取り専用',
  'chat.group.member.joinedAt': '{time} に参加',
  'chat.group.member.remove': '削除',
  'chat.group.member.removeConfirmTitle': '{name} をグループから外しますか？',
  'chat.group.member.removeConfirmDesc':
    '外すと相手は直ちにこのグループの過去メッセージを読めなくなります。必要になったら再度招待できます。',
  'chat.group.member.removed': '{name} を外しました',
  'chat.group.invite.label': 'メンバーを招待',
  'chat.group.invite.placeholder':
    'メンバーのログインアカウントを入力し、Enter で追加',
  'chat.group.invite.button': '招待',
  'chat.group.invite.success': '{count} 名のメンバーを招待しました',
  'chat.group.invite.none':
    'これらのメンバーはすでにグループにいます。重複して招待する必要はありません',
  'chat.group.invite.alreadyMember': '{name} はすでにグループにいます',
  'chat.group.invite.noCandidate': '一致する利用可能なアカウントがありません',
  'chat.group.invite.hint': 'あと {count} 名招待できます（上限 {max} 名）',
  'chat.group.invite.full':
    'グループメンバーが上限（{max} 名）に達したため、これ以上招待できません',
  'chat.group.invite.limit':
    '招待できるのは最大あと {count} 名です（上限 {max} 名）。招待人数を減らしてください',
  'chat.group.dangerZone': '危険な操作',
  'chat.group.quit': 'グループを退出',
  'chat.group.quitConfirmTitle': 'このグループから退出しますか？',
  'chat.group.quitConfirmDesc':
    '退出するとこのグループのメッセージを受け取れなくなり、過去のメッセージも読めなくなります。再参加にはグループ作成者か管理者の招待が必要です。',
  'chat.group.quit.success': 'グループから退出しました',
  'chat.group.dissolve': 'グループを解散',
  'chat.group.dissolveConfirmTitle': 'このグループを解散しますか？',
  'chat.group.dissolveConfirmDesc':
    '全メンバーがこのグループにアクセスできなくなり、過去のメッセージもサーバー側で読めなくなります。',
  'chat.group.dissolve.success': 'グループを解散しました',
  'chat.group.loadFailed': 'グループ情報を読み込めませんでした',

  // 相手プロフィールパネル（1 対 1）：変更するのは「自分側での呼び方」という私的なメモであり、相手アカウントのニックネームではない。
  // ページとドロワーが同一コンポーネントを共有するため、どちらか一方に帰属しない文言
  'chat.peer.title': '相手のプロフィール',
  'chat.peer.action': 'メモ',
  'chat.peer.close': '閉じる',
  'chat.peer.nickname.label': 'ニックネーム：{name}',
  'chat.peer.alias.label': 'メモ',
  'chat.peer.alias.placeholder': '自分が覚えやすい名前を付けましょう',
  'chat.peer.alias.hint':
    'メモは自分のみに表示され、相手には見えません。相手アカウントのニックネームも変更しません。',
  'chat.peer.alias.save': '保存',
  'chat.peer.alias.clear': 'メモを解除',
  'chat.peer.alias.saved': 'メモを保存しました',
  'chat.peer.alias.cleared': 'メモを解除しました',

  // メッセージ内のファイルカード：チャットページとドロワーが同一コンポーネントを共有するため、どちらか一方に帰属しない文言
  'chat.fileCard.open': '{name} をファイルで開く',

  // 添付の用途制限（送信者が 3 軸を設定：用途ランク / 有効期限 / ダウンロード回数）
  'chat.attach.policy.trigger': '用途の制限',
  'chat.attach.policy.title': '受け取り側がこのファイルをどう使えるか',
  'chat.attach.policy.usage.label': '用途',
  'chat.attach.usage.previewOnly': 'プレビューのみ',
  'chat.attach.usage.previewOnly.desc':
    '会話内でオンライン閲覧のみ可能で、ダウンロードはできません',
  'chat.attach.usage.downloadable': 'ダウンロード可',
  'chat.attach.usage.downloadable.desc':
    'ダウンロードできますが、相手のファイルには保存されません',
  'chat.attach.usage.resavable': '転送・保存可',
  'chat.attach.usage.resavable.desc':
    'ダウンロードでき、相手自身のファイルに保存もできます',
  'chat.attach.policy.expire.label': '有効期限',
  'chat.attach.expire.days': '{days} 日',
  'chat.attach.expire.never': '無期限',
  'chat.attach.policy.limit.label': 'ダウンロード回数の上限',
  'chat.attach.limit.unlimited': '回数無制限',
  'chat.attach.limit.times': '{count} 回',
  'chat.attach.policy.limit.disabledHint':
    'プレビューのみならダウンロード回数を消費しないため、制限は不要です',
  'chat.attach.policy.footnote':
    '取り消すと受け取り側は直ちに取得できなくなりますが、すでに端末へダウンロードされた複製は追い戻せません。',

  // 送信待ち添付バー：チャットページとドロワーが同一コンポーネントを共有するため、どちらか一方に帰属しない文言
  'chat.attach.dropHint':
    'ファイル領域からここへファイルをドラッグするか、クリップをクリックして「マイファイル」から選ぶ / 本機のファイルをアップロードしてください。1 ファイル最大 {size}',
  'chat.attach.remove': '送信待ちのファイルを削除',
  'chat.attach.placeholder': 'ひとこと説明を添えられます（空欄可）',

  // ファイル送信の入口（クリップ → 「ファイルを送信」ダイアログ）：ページとドロワーが共有するため、どちらか一方に帰属しない文言
  'chat.attach.entry': 'ファイルを送信',
  'chat.attach.modalTitle': 'ファイルを送信',
  'chat.attach.fromDevice': '本機のファイルをアップロード',
  'chat.attach.uploadHint':
    '本機のファイルはまずあなたのファイル領域へ送られ、その後ファイルメッセージとして送信されます',
  // サイズの案内：上限を示すのみで事前ブロックはしない（上限は設定可能で、拒否の権威判定はサーバー側）
  'chat.attach.sizeLimit': '1 ファイル最大 {size}',
  'chat.attach.uploadProgress': '{name} をアップロード中（{percent}%）',
  'chat.attach.uploadFailed':
    'アップロードに失敗しました：{name}。もう一度試せます',
  'chat.attach.uploadNoNode':
    'アップロードは完了しましたが、このファイルの項目を取得できませんでした。「マイファイル」で確認してから選び直してください',
  'chat.attach.pickerSearch': 'ファイル名で検索',
  'chat.attach.pickerEmpty': '一致するファイルがありません',
  'chat.attach.pickerFailed':
    'ファイル一覧を読み込めませんでした。しばらくしてから再試行してください',
  'chat.attach.pickerInvalid':
    'このファイルは現在選択できません。別のものを選んでください',
  'chat.attach.pickerClose': '閉じる',

  // 添付カード（受け取り側は申請不要で取得 / 送信側は使用量を確認）
  'chat.attachCard.preview': 'プレビュー',
  'chat.attachCard.download': 'ダウンロード',
  'chat.attachCard.save': 'マイファイルに保存',
  'chat.attachCard.saveSuccess': 'あなたのファイルに保存しました',
  'chat.attachCard.revoke': '付与を取り消し',
  'chat.attachCard.revokeConfirmTitle': 'この添付の取得権限を取り消しますか？',
  'chat.attachCard.revokeConfirmDesc':
    '取り消すと相手は直ちに取得できなくなりますが、すでに端末へダウンロードされた複製は追い戻せません。',
  'chat.attachCard.revokeOk': '付与を取り消しました',
  'chat.attachCard.revoked': '取り消し済み',
  'chat.attachCard.expired': '失効済み',
  'chat.attachCard.remaining': '残り {count} 回',
  'chat.attachCard.unlimited': '回数無制限',
  'chat.attachCard.expireAt': '{date} まで有効',
  'chat.attachCard.neverExpire': '無期限',
  'chat.attachCard.previewUnsupported':
    'この形式はオンラインプレビューに対応していません。ダウンロードしてご確認ください',
  // プレビューのみのランクではダウンロード入口がない。この場合は「ダウンロードして確認」と促せず、その経路がないことを正直に伝える
  'chat.attachCard.previewUnsupportedNoDownload':
    'この形式はオンラインでプレビューできず、送信者はダウンロードも許可していません。送信者に連絡して別の方法で受け取ってください',

  // IM ドロワー（/chat 以外の第 2 の入口。文言は独立させ、ページタイトルと互いに縛られないようにする）
  'chat.drawer.title': 'メッセージ',
  'chat.drawer.backToList': '会話一覧へ戻る',
  'chat.drawer.refresh': '会話一覧を更新',
  'chat.drawer.close': 'メッセージパネルを閉じる',
  'chat.drawer.emptyConversations': '会話がありません',
  'chat.drawer.openConversation': '{name} との会話を開く',
  'chat.drawer.emptyMessages':
    'メッセージはまだありません。ファイルをドラッグして一言送りましょう',
  'chat.drawer.mineAvatar': '自分',
  'chat.drawer.fileFallback': '［ファイル］{content}',
  'chat.drawer.send': '送信',
  // グループチャット：メンバー数と通知（グループ設定の3つのスイッチ）
  'chat.group.memberCount': '{count} 人',
  'chat.composer.mentionAll': '全員',
  'chat.group.notify.title': 'メッセージ通知',
  'chat.group.notify.mute': 'ミュート',
  'chat.group.notify.mention': '自分が呼ばれたら通知',
  'chat.group.notify.mentionAll': '管理者が全員を呼んだら通知',
  'chat.group.notify.muteHint':
    'このグループのメッセージは音が鳴りません。通知するかは下の2つだけで決まります。',
  'chat.group.notify.mentionHint':
    'このグループのメッセージは通常どおり通知されます。下の2つはミュートをオンにしたときだけ効きます。',
} as const;
