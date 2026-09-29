/** 聊天页（会话列表 + 聊天窗）文案。 */
export default {
  'chat.title': '聊天',
  'chat.subtitle': '单聊 / 群聊会话，实时收发',

  'chat.action.refresh': '刷新',
  'chat.action.new': '发起会话',
  'chat.action.send': '发送',

  'chat.list.title': '会话',
  'chat.search.placeholder': '搜索会话',
  'chat.list.empty.title': '还没有会话',
  'chat.list.empty.desc':
    '点「发起会话」选择同事开始单聊，或输入群组 ID 发起群聊',
  'chat.list.emptyFiltered.title': '没有匹配的会话',
  'chat.list.emptyFiltered.desc': '换个关键词试试',

  'chat.session.groupFallback': '群聊 #{id}',
  'chat.session.userFallback': '用户 #{id}',
  'chat.tag.private': '单聊',
  'chat.tag.group': '群聊',
  'chat.sender.mine': '我',

  // 已读回执：气泡下那排读者头像的无障碍文案（纯图标信息必须给出文字等价物）
  'chat.read.by': '已读：{names}',
  'chat.read.more': '还有 {count} 人已读',

  // 消息条右键操作：撤回（仅自己发的、2 分钟内的）与引用（针对某条消息回复）
  'chat.message.action.quote': '引用',
  'chat.message.action.recall': '撤回',
  // 撤回后的气泡占位：写「谁撤的」而不是只写「已撤回」，
  // 群聊里后者会让人以为是自己撤的
  'chat.message.recalled.mine': '你撤回了一条消息',
  'chat.message.recalled.other': '{name} 撤回了一条消息',
  'chat.message.recall.success': '已撤回',
  'chat.message.recall.failed': '撤回失败，请稍后重试',

  // 引用态输入框上方那条「正在引用」的提示
  'chat.composer.quote.cancel': '取消引用',

  // 会话对端状态：聊天页与抽屉共用同一个组件，文案不归属于任何一侧
  // 三态必须配文字：只靠绿/灰/红圆点，色盲用户与高对比度模式下等于没有信息
  'chat.presence.online': '在线',
  'chat.presence.offline': '离线',
  'chat.presence.unstable': '网络状态不佳',
  // 与上面三态共用同一行：对方正在打字时，这条信息比静态状态更即时
  'chat.typing': '对方正在输入…',

  'chat.stream.placeholder.title': '选择左侧会话开始聊天',
  'chat.stream.placeholder.desc': '会话记录实时同步，断线期间的也在重连后补收',
  'chat.stream.empty.title': '还没有消息',
  'chat.stream.empty.desc': '发送第一条消息打个招呼吧',
  'chat.stream.loadMore': '加载更早消息',
  'chat.stream.loadingMore': '正在加载…',
  'chat.stream.noMore': '没有更早的消息了',
  'chat.stream.loadMoreFailed': '加载更早消息失败，请重试',

  // 输入框口径对齐微信：Enter 发送、Shift + Enter 换行
  'chat.composer.placeholder': '输入消息，Enter 发送，Shift + Enter 换行',
  'chat.composer.empty': '消息内容不能为空',
  'chat.composer.sendHint': 'Enter 发送，Shift + Enter 换行',
  'chat.composer.emoji': '表情',
  'chat.composer.emojiPanel': '表情分类',
  'chat.composer.group.recent': '最近使用',
  'chat.composer.group.smileys': '表情',
  'chat.composer.group.gestures': '手势',
  'chat.composer.group.people': '人物与心情',
  'chat.composer.group.animals': '动物与自然',
  'chat.composer.group.food': '食物',
  'chat.composer.group.objects': '物品与活动',
  'chat.composer.group.symbols': '符号',

  // @ 提及：入口只在群聊出现（单聊没有点名语义，见 ChatComposer.mentionEnabled）
  'chat.composer.mention': '提及成员',
  'chat.composer.mentionPanel': '可提及的成员',
  'chat.composer.mentionEmpty': '没有匹配的成员',
  // 「有人@我」：会话列表的摘要前缀与角标强调、消息气泡上的标记共用一句
  'chat.mention.me': '有人@我',

  'chat.new.title': '发起会话',
  'chat.new.scope.label': '会话类型',
  'chat.new.scope.private': '单聊',
  'chat.new.scope.group': '群聊',
  'chat.new.user.placeholder': '输入账号或昵称搜索',
  'chat.new.user.optionLabel': '{name}（{username}）',
  'chat.new.user.resolveHint': '填写对方登录账号，离开输入框后自动核对',
  'chat.new.user.resolved': '已找到：{name}',
  'chat.new.user.notFound': '没找到该账号对应的可用用户，请核对后再试',
  'chat.new.target.label': '对方登录账号',
  'chat.new.target.placeholder': '请输入对方登录账号',
  'chat.new.target.required': '请先选择会话目标',
  'chat.new.target.accountRequired': '请先填写对方登录账号',

  // 群聊：建群表单（群名 + 受邀成员）与「我加入的群」入口。
  // 原「群组 ID」手填项已去掉——群组此前既建不出来、ID 也无从得知，那个入口对谁都走不通
  'chat.new.group.nameLabel': '群聊名称',
  'chat.new.group.namePlaceholder': '请输入群聊名称',
  'chat.new.group.nameRequired': '请先填写群聊名称',
  'chat.new.group.memberLabel': '群成员',
  'chat.new.group.memberPlaceholder': '输入成员登录账号，回车加入',
  'chat.new.group.memberHint': '至少邀请 1 位成员；含自己在内最多 {max} 人',
  'chat.new.group.memberRequired': '请先邀请至少一位群成员',
  'chat.new.group.memberLimit': '群成员最多 {max} 人（含自己）',
  'chat.new.group.firstMessageFailed':
    '群聊已创建，但第一条消息发送失败，请在聊天框里重发',
  'chat.new.group.existingLabel': '我加入的群',
  'chat.new.group.existingPlaceholder': '选择后直接进入该群',
  'chat.new.group.optionLabel': '{name}（{count} 人）',
  'chat.new.content.required': '请先输入第一条消息（会话在发送后创建）',
  'chat.new.content.label': '第一条消息',
  'chat.new.content.placeholder': '输入一句打个招呼吧',
  'chat.new.submit': '发起',
  'chat.new.cancel': '取消',

  // 群设置面板（/chat 页与即时通讯抽屉共用同一个组件，文案不归属于任何一侧）。
  // 按钮显隐是「权限点 CHAT_PERM ∧ 服务端下发的 ability」的合取，见 components/ChatGroupPanel
  'chat.group.title': '群设置',
  'chat.group.close': '关闭',
  'chat.group.info': '群资料',
  'chat.group.name.placeholder': '请输入群名称',
  'chat.group.name.required': '群名称不能为空',
  'chat.group.name.save': '保存',
  'chat.group.name.success': '群名称已更新',
  'chat.group.meta': '{count}/{max} 人',
  'chat.group.members.label': '群成员',
  'chat.group.emptyMembers': '暂无成员',
  'chat.group.member.unknown': '未知成员',
  'chat.group.member.owner': '群主',
  'chat.group.member.admin': '管理员',
  'chat.group.member.readonly': '只读',
  'chat.group.member.joinedAt': '{time} 入群',
  'chat.group.member.remove': '移除',
  'chat.group.member.removeConfirmTitle': '把 {name} 移出群聊？',
  'chat.group.member.removeConfirmDesc':
    '移除后对方立即失去该群历史消息的读取权限；需要时可以再次邀请。',
  'chat.group.member.removed': '已移除 {name}',
  'chat.group.invite.label': '邀请成员',
  'chat.group.invite.placeholder': '输入成员登录账号，回车加入',
  'chat.group.invite.button': '邀请',
  'chat.group.invite.success': '已邀请 {count} 位成员',
  'chat.group.invite.none': '这些成员都已在群里，无需重复邀请',
  'chat.group.invite.alreadyMember': '{name} 已在群里',
  'chat.group.invite.noCandidate': '没有匹配的可用账号',
  'chat.group.invite.hint': '还可邀请 {count} 人（上限 {max} 人）',
  'chat.group.invite.full': '群成员已达上限（{max} 人），不能再邀请',
  'chat.group.invite.limit': '最多再邀请 {count} 人（上限 {max} 人），请减少邀请人数',
  'chat.group.dangerZone': '危险操作',
  'chat.group.quit': '退出群聊',
  'chat.group.quitConfirmTitle': '退出该群聊？',
  'chat.group.quitConfirmDesc':
    '退出后不再接收该群消息，历史消息也无法再读取；重新加入需要群主或管理员邀请。',
  'chat.group.quit.success': '已退出群聊',
  'chat.group.dissolve': '解散群聊',
  'chat.group.dissolveConfirmTitle': '解散该群聊？',
  'chat.group.dissolveConfirmDesc':
    '全部成员都会失去该群的访问权，历史消息在服务端不再可读。',
  'chat.group.dissolve.success': '群聊已解散',
  'chat.group.loadFailed': '群信息没加载出来',

  // 对端资料面板（单聊）：改的是「我这边怎么称呼他」的私有备注，不是对方账号昵称。
  // 页与抽屉共用同一个组件，文案不归属于任何一侧
  'chat.peer.title': '对端资料',
  'chat.peer.action': '备注',
  'chat.peer.close': '关闭',
  'chat.peer.nickname.label': '昵称：{name}',
  'chat.peer.alias.label': '备注',
  'chat.peer.alias.placeholder': '给这个人起个你记得住的名字',
  'chat.peer.alias.hint':
    '备注只对你自己可见，对方不会看到，也不会改变对方账号上的昵称。',
  'chat.peer.alias.save': '保存',
  'chat.peer.alias.clear': '取消备注',
  'chat.peer.alias.saved': '备注已保存',
  'chat.peer.alias.cleared': '备注已取消',

  // 消息流里的文件卡片：聊天页与抽屉共用同一个组件，文案不归属于任何一侧
  'chat.fileCard.open': '在文件中打开 {name}',

  // 附件用途限制（发送方设定三轴：用途档位 / 有效期 / 下载次数）
  'chat.attach.policy.trigger': '用途限制',
  'chat.attach.policy.title': '接收方可以怎么用这份文件',
  'chat.attach.policy.usage.label': '用途',
  'chat.attach.usage.previewOnly': '仅预览',
  'chat.attach.usage.previewOnly.desc': '只能在会话里在线看，不能下载',
  'chat.attach.usage.downloadable': '可下载',
  'chat.attach.usage.downloadable.desc': '可下载，但不会存进对方的文件',
  'chat.attach.usage.resavable': '可转发转存',
  'chat.attach.usage.resavable.desc': '可下载，也可存进对方自己的文件',
  'chat.attach.policy.expire.label': '有效期',
  'chat.attach.expire.days': '{days} 天',
  'chat.attach.expire.never': '不限期',
  'chat.attach.policy.limit.label': '下载次数上限',
  'chat.attach.limit.unlimited': '不限次',
  'chat.attach.limit.times': '{count} 次',
  'chat.attach.policy.limit.disabledHint': '仅预览不消耗下载次数，无需限制',
  'chat.attach.policy.footnote':
    '撤销后接收方立即无法再取件；已下载到本地的副本无法追回。',

  // 待发附件条：聊天页与抽屉共用同一个组件，文案不归属于任何一侧
  'chat.attach.dropHint':
    '从文件区拖一个文件进来，或点回形针从「我的文件」里挑 / 传一份本机文件；单个文件最大 {size}',
  'chat.attach.remove': '移除待发送文件',
  'chat.attach.placeholder': '可附加一句说明（可留空）',

  // 文件传输入口（回形针 → 「发送文件」弹窗）：页与抽屉共用，文案不归属于任何一侧
  'chat.attach.entry': '发送文件',
  'chat.attach.modalTitle': '发送文件',
  'chat.attach.fromDevice': '上传本机文件',
  'chat.attach.uploadHint': '本机文件会先传进你的文件里，再作为文件消息发出去',
  // 大小提示：只说明上限，不做前置拦截（上限可配，拒绝的权威判定在服务端）
  'chat.attach.sizeLimit': '单个文件最大 {size}',
  'chat.attach.uploadProgress': '正在上传 {name}（{percent}%）',
  'chat.attach.uploadFailed': '上传失败：{name}，可以再试一次',
  'chat.attach.uploadNoNode':
    '上传完成了，但没拿到这份文件的条目；请到「我的文件」确认后再选一次',
  'chat.attach.pickerSearch': '搜索文件名',
  'chat.attach.pickerEmpty': '没有匹配的文件',
  'chat.attach.pickerFailed': '文件列表没加载出来，请稍后重试',
  'chat.attach.pickerInvalid': '这份文件暂时选不了，请换一个',
  'chat.attach.pickerClose': '关闭',

  // 附件卡片（接收方免申请取件 / 发送方查看用量）
  'chat.attachCard.preview': '预览',
  'chat.attachCard.download': '下载',
  'chat.attachCard.save': '保存到我的文件',
  'chat.attachCard.saveSuccess': '已保存到你的文件',
  'chat.attachCard.revoke': '撤销授权',
  'chat.attachCard.revokeConfirmTitle': '撤销这份附件的取件授权？',
  'chat.attachCard.revokeConfirmDesc':
    '撤销后对方立即无法再取件，但已下载到本地的副本无法追回。',
  'chat.attachCard.revokeOk': '已撤销授权',
  'chat.attachCard.revoked': '已撤销',
  'chat.attachCard.expired': '已失效',
  'chat.attachCard.remaining': '剩余 {count} 次',
  'chat.attachCard.unlimited': '不限次',
  'chat.attachCard.expireAt': '{date} 前有效',
  'chat.attachCard.neverExpire': '长期有效',
  'chat.attachCard.previewUnsupported': '该类型不支持在线预览，请下载后查看',
  // 仅预览档位下没有下载入口：此时不能再劝用户「下载后查看」，只能如实说明这条路走不通
  'chat.attachCard.previewUnsupportedNoDownload':
    '该类型无法在线预览，而发送方未允许下载，请联系发送方换一种方式给你',

  // 即时通讯抽屉（/chat 之外的第二入口，文案独立，避免与页面标题互相牵制）
  'chat.drawer.title': '消息',
  'chat.drawer.backToList': '返回会话列表',
  'chat.drawer.refresh': '刷新会话列表',
  'chat.drawer.close': '关闭消息面板',
  'chat.drawer.emptyConversations': '暂无会话',
  'chat.drawer.openConversation': '打开与 {name} 的会话',
  'chat.drawer.emptyMessages': '还没有消息，拖一个文件进来说句话',
  'chat.drawer.mineAvatar': '我',
  'chat.drawer.fileFallback': '[文件] {content}',
  'chat.drawer.send': '发送',
} as const;
