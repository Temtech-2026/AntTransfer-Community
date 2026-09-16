/** Chat page (conversation list + chat pane) copy. */
export default {
  'chat.title': 'Chat',
  'chat.subtitle': 'Direct and group conversations, delivered in real time',

  'chat.action.refresh': 'Refresh',
  'chat.action.new': 'New conversation',
  'chat.action.send': 'Send',

  'chat.list.title': 'Conversations',
  'chat.search.placeholder': 'Search conversations',
  'chat.list.empty.title': 'No conversations yet',
  'chat.list.empty.desc':
    'Pick a colleague to start a direct chat, or enter a group ID for a group chat',
  'chat.list.emptyFiltered.title': 'No matching conversations',
  'chat.list.emptyFiltered.desc': 'Try another keyword',

  'chat.session.groupFallback': 'Group #{id}',
  'chat.session.userFallback': 'User #{id}',
  'chat.tag.private': 'Direct',
  'chat.tag.group': 'Group',
  'chat.sender.mine': 'Me',

  'chat.stream.placeholder.title': 'Select a conversation to start chatting',
  'chat.stream.placeholder.desc':
    'Messages sync in real time; ones missed while offline are backfilled on reconnect',
  'chat.stream.empty.title': 'No messages yet',
  'chat.stream.empty.desc': 'Send the first message to say hello',
  'chat.stream.loadMore': 'Load earlier messages',
  'chat.stream.loadingMore': 'Loading…',
  'chat.stream.noMore': 'No earlier messages',
  'chat.stream.loadMoreFailed': 'Failed to load earlier messages, please retry',

  'chat.composer.placeholder': 'Type a message, Ctrl + Enter to send',
  'chat.composer.empty': 'Message cannot be empty',

  'chat.new.title': 'New conversation',
  'chat.new.scope.label': 'Conversation type',
  'chat.new.scope.private': 'Direct',
  'chat.new.scope.group': 'Group',
  'chat.new.user.placeholder': 'Search by username or nickname',
  'chat.new.user.noPermission':
    'Your account cannot search users; enter the recipient user ID directly',
  'chat.new.target.label': 'Recipient user ID',
  'chat.new.target.labelGroup': 'Group ID',
  'chat.new.target.placeholder': 'Enter the recipient user ID',
  'chat.new.target.placeholderGroup': 'Enter the group ID',
  'chat.new.target.required': 'Please choose a target first',
  'chat.new.content.label': 'First message (optional)',
  'chat.new.content.placeholder': 'Leave empty and type later',
  'chat.new.submit': 'Start',
  'chat.new.cancel': 'Cancel',
} as const;
