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

  // Read receipts: text equivalents for the avatar row under a bubble
  'chat.read.by': 'Read by {names}',
  'chat.read.more': '{count} more read',

  // Message context menu: recall (own messages, within 2 minutes) and quote (reply to one message)
  'chat.message.action.quote': 'Quote',
  'chat.message.action.recall': 'Recall',
  // Recalled-message placeholder: names who recalled it, since a bare "Recalled"
  // in a group reads as if the reader recalled it themselves
  'chat.message.recalled.mine': 'You recalled a message',
  'chat.message.recalled.other': '{name} recalled a message',
  'chat.message.recall.success': 'Message recalled',
  'chat.message.recall.failed': 'Could not recall the message, please retry',

  // The "replying to" strip above the composer body
  'chat.composer.quote.cancel': 'Cancel quote',

  // Peer presence, shared by the chat page and the messenger drawer.
  // The three states always ship with text: colour-only dots are no information
  // at all for colour-blind users or in high-contrast mode.
  'chat.presence.online': 'Online',
  'chat.presence.offline': 'Offline',
  'chat.presence.unstable': 'Poor connection',
  // Replaces the status text on the same line: while the peer types,
  // that fact outranks the static status
  'chat.typing': 'Typing…',

  'chat.stream.placeholder.title': 'Select a conversation to start chatting',
  'chat.stream.placeholder.desc':
    'Messages sync in real time; ones missed while offline are backfilled on reconnect',
  'chat.stream.empty.title': 'No messages yet',
  'chat.stream.empty.desc': 'Send the first message to say hello',
  'chat.stream.loadMore': 'Load earlier messages',
  'chat.stream.loadingMore': 'Loading…',
  'chat.stream.noMore': 'No earlier messages',
  'chat.stream.loadMoreFailed': 'Failed to load earlier messages, please retry',

  // Composer matches WeChat: Enter sends, Shift + Enter adds a line break
  'chat.composer.placeholder': 'Type a message — Enter to send, Shift + Enter for a new line',
  'chat.composer.empty': 'Message cannot be empty',
  'chat.composer.sendHint': 'Enter to send, Shift + Enter for a new line',
  'chat.composer.emoji': 'Emoji',
  'chat.composer.emojiPanel': 'Emoji categories',
  'chat.composer.group.recent': 'Recently used',
  'chat.composer.group.smileys': 'Smileys',
  'chat.composer.group.gestures': 'Gestures',
  'chat.composer.group.people': 'People and moods',
  'chat.composer.group.animals': 'Animals and nature',
  'chat.composer.group.food': 'Food',
  'chat.composer.group.objects': 'Objects and activities',
  'chat.composer.group.symbols': 'Symbols',

  'chat.new.title': 'New conversation',
  'chat.new.scope.label': 'Conversation type',
  'chat.new.scope.private': 'Direct',
  'chat.new.scope.group': 'Group',
  'chat.new.user.placeholder': 'Search by username or nickname',
  'chat.new.user.optionLabel': '{name} ({username})',
  'chat.new.user.resolveHint':
    'Enter the recipient login name; it is checked when you leave the field',
  'chat.new.user.resolved': 'Found: {name}',
  'chat.new.user.notFound':
    'No active user matches this login name; please check and retry',
  'chat.new.target.label': 'Recipient login name',
  'chat.new.target.placeholder': 'Enter the recipient login name',
  'chat.new.target.required': 'Please choose a target first',
  'chat.new.target.accountRequired': 'Please enter the recipient login name',

  // Group chat: creation form (name + invitees) and the "groups I joined" entry.
  'chat.new.group.nameLabel': 'Group name',
  'chat.new.group.namePlaceholder': 'Enter a group name',
  'chat.new.group.nameRequired': 'Enter a group name first',
  'chat.new.group.memberLabel': 'Members',
  'chat.new.group.memberPlaceholder':
    'Enter a member login name, press Enter to add',
  'chat.new.group.memberHint':
    'Invite at least 1 member; at most {max} including you',
  'chat.new.group.memberRequired': 'Invite at least one member',
  'chat.new.group.memberLimit':
    'A group can have at most {max} members, including you',
  'chat.new.group.firstMessageFailed':
    'Group created, but the first message failed to send; please resend it in the chat box',
  'chat.new.group.existingLabel': 'Groups I joined',
  'chat.new.group.existingPlaceholder': 'Pick one to open the conversation',
  'chat.new.group.optionLabel': '{name} ({count} members)',
  'chat.new.content.label': 'First message',
  'chat.new.content.placeholder': 'Say hello in the first message',
  'chat.new.content.required':
    'Enter the first message; the conversation is created once it is sent',
  'chat.new.submit': 'Start',
  'chat.new.cancel': 'Cancel',

  // Group settings panel: shared by /chat and the drawer, so the copy belongs to neither side.
  // A button shows only when "permission point CHAT_PERM AND server-provided ability" both hold;
  // see components/ChatGroupPanel.
  'chat.group.title': 'Group settings',
  'chat.group.close': 'Close',
  'chat.group.info': 'Group profile',
  'chat.group.name.placeholder': 'Enter a group name',
  'chat.group.name.required': 'Group name is required',
  'chat.group.name.save': 'Save',
  'chat.group.name.success': 'Group name updated',
  'chat.group.meta': '{count}/{max} members',
  'chat.group.members.label': 'Members',
  'chat.group.emptyMembers': 'No members',
  'chat.group.member.unknown': 'Unknown member',
  'chat.group.member.owner': 'Owner',
  'chat.group.member.admin': 'Admin',
  'chat.group.member.readonly': 'Read-only',
  'chat.group.member.joinedAt': 'Joined {time}',
  'chat.group.member.remove': 'Remove',
  'chat.group.member.removeConfirmTitle': 'Remove {name} from this group?',
  'chat.group.member.removeConfirmDesc':
    'They lose access to this group history immediately; you can invite them again later.',
  'chat.group.member.removed': 'Removed {name}',
  'chat.group.invite.label': 'Invite members',
  'chat.group.invite.placeholder': 'Type a login account and press Enter',
  'chat.group.invite.button': 'Invite',
  'chat.group.invite.success': 'Invited {count} member(s)',
  'chat.group.invite.none': 'Everyone selected is already in this group',
  'chat.group.invite.alreadyMember': '{name} is already in this group',
  'chat.group.invite.noCandidate': 'No matching active account',
  'chat.group.invite.hint': 'You can invite {count} more (limit {max})',
  'chat.group.invite.full': 'This group is full ({max} members)',
  'chat.group.invite.limit':
    'At most {count} more can join (limit {max}); please invite fewer people',
  'chat.group.dangerZone': 'Danger zone',
  'chat.group.quit': 'Leave group',
  'chat.group.quitConfirmTitle': 'Leave this group?',
  'chat.group.quitConfirmDesc':
    'You stop receiving its messages and can no longer read its history; rejoining requires an invite from the owner or an admin.',
  'chat.group.quit.success': 'You left the group',
  'chat.group.dissolve': 'Dissolve group',
  'chat.group.dissolveConfirmTitle': 'Dissolve this group?',
  'chat.group.dissolveConfirmDesc':
    'Every member loses access to this group and its history is no longer readable on the server.',
  'chat.group.dissolve.success': 'Group dissolved',
  'chat.group.loadFailed': 'Could not load the group info',

  // File card in the message stream: shared by /chat and the drawer
  'chat.fileCard.open': 'Open {name} in Files',

  // Attachment usage limits (sender sets three axes: usage / expiry / download cap)
  'chat.attach.policy.trigger': 'Usage limits',
  'chat.attach.policy.title': 'How the recipient may use this file',
  'chat.attach.policy.usage.label': 'Usage',
  'chat.attach.usage.previewOnly': 'Preview only',
  'chat.attach.usage.previewOnly.desc': 'View inline in chat, no download',
  'chat.attach.usage.downloadable': 'Downloadable',
  'chat.attach.usage.downloadable.desc':
    'Downloadable, but not saved into their files',
  'chat.attach.usage.resavable': 'Download and save',
  'chat.attach.usage.resavable.desc':
    'Downloadable, and can be saved into their own files',
  'chat.attach.policy.expire.label': 'Valid for',
  'chat.attach.expire.days': '{days} days',
  'chat.attach.expire.never': 'No expiry',
  'chat.attach.policy.limit.label': 'Download cap',
  'chat.attach.limit.unlimited': 'Unlimited',
  'chat.attach.limit.times': '{count} times',
  'chat.attach.policy.limit.disabledHint':
    'Preview-only attachments do not consume downloads, so no cap is needed',
  'chat.attach.policy.footnote':
    'Revoking takes effect immediately; copies already downloaded cannot be recalled.',

  // Pending attachment bar: /chat and the drawer share one component, so these belong to neither
  'chat.attach.dropHint':
    'Drag a file from the file area, or use the paperclip to pick from My files / upload from this device; up to {size} per file',
  'chat.attach.remove': 'Remove pending file',
  'chat.attach.placeholder': 'Optionally add a note (can be empty)',

  // File transfer entry (paperclip → "Send a file" dialog): shared by /chat and the drawer
  'chat.attach.entry': 'Send a file',
  'chat.attach.modalTitle': 'Send a file',
  'chat.attach.fromDevice': 'Upload from this device',
  'chat.attach.uploadHint':
    'Files from this device are uploaded into your own files first, then sent as a file message',
  // Size hint: states the cap only, no pre-check (the cap is configurable; the server is authoritative)
  'chat.attach.sizeLimit': 'Up to {size} per file',
  'chat.attach.uploadProgress': 'Uploading {name} ({percent}%)',
  'chat.attach.uploadFailed': 'Upload failed: {name} — you can try again',
  'chat.attach.uploadNoNode':
    'The upload finished but no file entry came back; check My files and pick it again',
  'chat.attach.pickerSearch': 'Search file name',
  'chat.attach.pickerEmpty': 'No matching files',
  'chat.attach.pickerFailed': "Couldn't load your files, please retry later",
  'chat.attach.pickerInvalid':
    'That file cannot be picked right now, try another one',
  'chat.attach.pickerClose': 'Close',

  // Attachment card (recipient pickup without approval / sender usage view)
  'chat.attachCard.preview': 'Preview',
  'chat.attachCard.download': 'Download',
  'chat.attachCard.save': 'Save to my files',
  'chat.attachCard.saveSuccess': 'Saved to your files',
  'chat.attachCard.revoke': 'Revoke access',
  'chat.attachCard.revokeConfirmTitle': 'Revoke access to this attachment?',
  'chat.attachCard.revokeConfirmDesc':
    'The recipient loses access immediately, but copies already downloaded cannot be recalled.',
  'chat.attachCard.revokeOk': 'Access revoked',
  'chat.attachCard.revoked': 'Revoked',
  'chat.attachCard.expired': 'Expired',
  'chat.attachCard.remaining': '{count} left',
  'chat.attachCard.unlimited': 'Unlimited',
  'chat.attachCard.expireAt': 'Valid until {date}',
  'chat.attachCard.neverExpire': 'No expiry',
  'chat.attachCard.previewUnsupported':
    'This file type cannot be previewed inline — download it instead',
  // With preview-only access there is no download entry, so "download it instead" would be
  // advice the recipient cannot act on
  'chat.attachCard.previewUnsupportedNoDownload':
    'This file type cannot be previewed inline and the sender did not allow downloading — ask the sender for another way',

  // Instant-messaging drawer (a second entry point besides /chat)
  'chat.drawer.title': 'Messages',
  'chat.drawer.backToList': 'Back to conversation list',
  'chat.drawer.refresh': 'Refresh conversation list',
  'chat.drawer.close': 'Close message panel',
  'chat.drawer.emptyConversations': 'No conversations yet',
  'chat.drawer.openConversation': 'Open conversation with {name}',
  'chat.drawer.emptyMessages': 'No messages yet — drag a file in and say hello',
  'chat.drawer.mineAvatar': 'Me',
  'chat.drawer.fileFallback': '[File] {content}',
  'chat.drawer.send': 'Send',
} as const;
