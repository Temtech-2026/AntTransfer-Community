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

  'chat.stream.placeholder.title': '选择左侧会话开始聊天',
  'chat.stream.placeholder.desc': '会话记录实时同步，断线期间的也在重连后补收',
  'chat.stream.empty.title': '还没有消息',
  'chat.stream.empty.desc': '发送第一条消息打个招呼吧',
  'chat.stream.loadMore': '加载更早消息',
  'chat.stream.loadingMore': '正在加载…',
  'chat.stream.noMore': '没有更早的消息了',
  'chat.stream.loadMoreFailed': '加载更早消息失败，请重试',

  'chat.composer.placeholder': '输入消息，Ctrl + Enter 发送',
  'chat.composer.empty': '消息内容不能为空',

  'chat.new.title': '发起会话',
  'chat.new.scope.label': '会话类型',
  'chat.new.scope.private': '单聊',
  'chat.new.scope.group': '群聊',
  'chat.new.user.placeholder': '输入账号或昵称搜索',
  'chat.new.user.noPermission': '当前账号无用户检索权限，请直接填写对方用户 ID',
  'chat.new.target.label': '对端用户 ID',
  'chat.new.target.labelGroup': '群组 ID',
  'chat.new.target.placeholder': '请输入对方用户 ID',
  'chat.new.target.placeholderGroup': '请输入群组 ID',
  'chat.new.target.required': '请先选择会话目标',
  'chat.new.content.label': '第一条消息（可选）',
  'chat.new.content.placeholder': '可以留空，创建后再输入',
  'chat.new.submit': '发起',
  'chat.new.cancel': '取消',
} as const;
