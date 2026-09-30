/**
 * Shared copy for shell-level components (header, sider, global search,
 * notification bell, org switcher, drop zone, tag select).
 */
export default {
  'component.langSwitch': 'Switch language',

  // Tag select
  'component.tagSelect.expand': 'Expand',
  'component.tagSelect.collapse': 'Collapse',
  'component.tagSelect.all': 'All',

  // Sider footer entries
  'component.siderFooter.messages': 'Messages',
  'component.siderFooter.transfer': 'Transfers',
  'component.siderFooter.openMessages': 'Open message panel',
  'component.siderFooter.openTransfer': 'Open transfer center',

  // Header global search
  'component.globalSearch.placeholder':
    'Search file name / tag, press Enter to locate',
  'component.globalSearch.ariaLabel': 'Global search',
  'component.globalSearch.scopeAria': 'Search scope',
  'component.globalSearch.scopeTitle':
    'Scope: file names and tags (jumps to the file workspace).',

  // Header docs entry
  'component.docLink.title': 'Documentation',

  // Article list content (template component)
  'component.articleList.publishedAt': 'published at',

  // Avatar dropdown and profile
  'component.avatar.profile': 'Profile',
  'component.avatar.changePassword': 'Change password',
  'component.avatar.logout': 'Sign out',
  'component.avatar.account': 'Account',
  'component.avatar.nickname': 'Nickname',
  'component.avatar.roles': 'Roles',

  // Self-service avatar change in the profile dialog (takes effect on upload)
  // Pre-check failures reuse system.user.avatar.tooLarge / typeInvalid: checkAvatarFile is a
  // shared pre-check named after the system domain, so its keys are not duplicated here
  'component.avatar.avatar.upload': 'Upload avatar',
  'component.avatar.avatar.hint': 'PNG / JPEG / GIF / WebP, up to {max}',
  'component.avatar.avatar.updated': 'Avatar updated',

  // Self-service password change dialog (signs out every session on success)
  'component.avatar.changePassword.title': 'Change password',
  'component.avatar.changePassword.alert.title':
    'You will be signed out after changing',
  'component.avatar.changePassword.alert.desc':
    'For your security, changing the password immediately signs out every device. Please sign in again with the new password.',
  'component.avatar.changePassword.old': 'Current password',
  'component.avatar.changePassword.oldPlaceholder':
    'Enter your current password',
  'component.avatar.changePassword.oldRequired':
    'Please enter your current password',
  'component.avatar.changePassword.new': 'New password',
  'component.avatar.changePassword.newPlaceholder': 'Enter a new password',
  'component.avatar.changePassword.newRequired': 'Please enter a new password',
  'component.avatar.changePassword.newLength':
    'Password must be 8-64 characters long',
  'component.avatar.changePassword.newPattern':
    'Password must contain both letters and digits, with no spaces',
  'component.avatar.changePassword.policyHint':
    '8-64 characters, must include letters and digits',
  'component.avatar.changePassword.confirm': 'Confirm new password',
  'component.avatar.changePassword.confirmPlaceholder':
    'Enter the new password again',
  'component.avatar.changePassword.confirmRequired':
    'Please enter the new password again',
  'component.avatar.changePassword.confirmMismatch':
    'The two new passwords do not match',
  'component.avatar.changePassword.submit': 'Change password',
  'component.avatar.changePassword.done':
    'Password changed, please sign in with the new password',

  // Notification bell
  'component.notify.title': 'Notifications',
  'component.notify.count.inbox': 'Notifications {count}',
  'component.notify.count.todo': 'To-do {count}',
  'component.notify.count.chat': 'Messages {count}',
  'component.notify.markAllRead': 'Mark all as read',
  'component.notify.markedAllRead': 'All marked as read',
  'component.notify.status.idle': 'Realtime channel not started',
  'component.notify.status.connecting': 'Connecting…',
  'component.notify.status.open': 'Realtime notifications connected',
  'component.notify.status.reconnecting': 'Disconnected, reconnecting…',
  'component.notify.status.closed': 'Realtime channel closed',

  // Org / team switcher
  'component.org.defaultName': 'Default organization',
  'component.org.current': 'Current deployment',
  'component.org.create': 'New organization / team',
  'component.org.switch': 'Switch to another organization',
  'component.org.tooltip': 'Current organization: {name}',

  // Drop / click file zone
  'component.dropZone.title': 'Drag files here, or click to select',

  // Chunked upload component
  'component.chunkUpload.title': 'File upload',
  'component.chunkUpload.busy': '{count} task(s) in progress',
  'component.chunkUpload.resumableCount':
    '{count} unfinished upload(s) detected',
  'component.chunkUpload.resumableNote':
    'To avoid transferring the same data twice, select the same file again; chunks already received by the server will be skipped.',
  'component.chunkUpload.resumableSelect': 'Select file to resume',
  'component.chunkUpload.instantDone': 'Instant upload done',
  'component.chunkUpload.instantSuccess': 'Instant upload',
  'component.chunkUpload.progress.hashing': 'Computing file checksum…',
  'component.chunkUpload.progress.prechecking':
    'Checking instant-upload eligibility…',
  'component.chunkUpload.progress.querying': 'Fetching uploaded chunks…',
  'component.chunkUpload.progress.merging': 'Merging chunks…',
  'component.chunkUpload.progress.paused':
    'Paused ({received}/{total} chunks done)',
  'component.chunkUpload.progress.failed': 'Upload failed',
  'component.chunkUpload.progress.uploading':
    '{received}/{total} chunks · {speed}',
  'component.chunkUpload.progress.retried': ' · retried {count} time(s)',
  'component.chunkUpload.progress.chunks': '{count} chunks',
  'component.chunkUpload.retryTooltip':
    'Automatically retried with exponential backoff on network jitter',
  'component.chunkUpload.retryTag': 'Retry {count}',
  'component.chunkUpload.draggerText': 'Click or drag files here to upload',
  'component.chunkUpload.draggerHint':
    'Supports chunked upload for large files, instant upload and resume; a failed file is retried up to {count} time(s)',
  'component.chunkUpload.chunkSize': 'Chunk size',
  'component.chunkUpload.concurrency': 'Concurrency',
  'component.chunkUpload.tuningNote': 'Changes apply to subsequent chunks',
  'component.chunkUpload.overallProgress': 'Overall progress',
  'component.chunkUpload.overallSummary':
    '{finished}/{total} files · {uploaded} / {totalSize}',

  // Code block (sample code shown in documentation areas)
  'component.codeBlock.copy': 'Copy',
  'component.codeBlock.copied': 'Copied',
  'component.codeBlock.copyFailed': 'Copy failed',

  // Transfer monitor panel
  'component.transfer.title': 'Transfer center',
  'component.transfer.expand': 'Expand transfer center',
  'component.transfer.collapse': 'Collapse transfer center',
  'component.transfer.capsule': 'Transferring {count}',
  'component.transfer.summary': '{active} in progress · {success} done',
  'component.transfer.summaryFailed': ' · {count} failed',
  'component.transfer.pauseAll': 'Pause all',
  'component.transfer.resumeAll': 'Resume all / retry failed',
  'component.transfer.clearFinished': 'Clear completed / canceled / failed',
  'component.transfer.fastMode': 'Turbo mode',
  'component.transfer.fastModeHint':
    'Raises concurrent chunks to the contract limit of 5; it also applies to tasks already running and overrides the concurrency chosen on the upload page.',
  'component.transfer.empty': 'No transfer tasks',
  'component.transfer.chartAria': 'Transfer speed chart',
  'component.transfer.pause': 'Pause',
  'component.transfer.resumeRetry': 'Resume / retry',
  'component.transfer.pauseNamed': 'Pause {name}',
  'component.transfer.resumeNamed': 'Resume {name}',
  'component.transfer.status.active': 'Transferring',
  'component.transfer.status.paused': 'Paused',
  'component.transfer.status.error': 'Failed',
  'component.transfer.status.success': 'Completed',
  'component.transfer.status.canceled': 'Canceled',
  // New-message sound (shown inside the profile panel; presets and switches share this prefix)
  'component.avatar.notifySound.title': 'New message sound',
  'component.avatar.notifySound.enabled': 'Play a sound on new messages',
  'component.avatar.notifySound.presetLabel': 'Sound',
  'component.avatar.notifySound.preset.default': 'Default',
  'component.avatar.notifySound.preset.chime': 'Chime',
  'component.avatar.notifySound.preset.bubble': 'Bubble',
  'component.avatar.notifySound.preset.custom': 'Custom',
  'component.avatar.notifySound.upload': 'Upload audio',
  'component.avatar.notifySound.replace': 'Replace audio',
  'component.avatar.notifySound.clear': 'Delete',
  'component.avatar.notifySound.preview': 'Preview',
  'component.avatar.notifySound.uploaded': 'Uploaded; sound switched to custom',
  'component.avatar.notifySound.cleared': 'Custom sound deleted',
  'component.avatar.notifySound.loadFailed': 'Failed to load sound settings',
  'component.avatar.notifySound.typeInvalid':
    'Only MP3 / WAV / OGG audio is supported',
  'component.avatar.notifySound.tooLarge': 'Audio must not exceed {max}',
  'component.avatar.notifySound.previewBlocked':
    'The browser blocked autoplay. Click anywhere on the page and try again.',
  'component.avatar.notifySound.customEmpty': 'No custom audio uploaded yet',
  'component.avatar.notifySound.customMeta':
    'Current audio: {name} ({size}, {duration})',
  'component.avatar.notifySound.hint':
    'Supports MP3 / WAV / OGG, up to {maxSize} and {maxDuration} long',
} as const;
