/** Shared copy for skeletons, empty states, danger confirmation and upload progress. */
export default {
  // Empty state
  'common.empty.noData': 'No data',
  'common.empty.noResult.title': 'No matching results',
  'common.empty.noResult.desc': 'Try adjusting the filters or clearing the keyword',
  'common.empty.error.title': 'Failed to load',
  'common.empty.error.desc': 'Network or service error, please retry later',
  'common.empty.error.action': 'Reload',
  'common.empty.denied.title': 'Access denied',
  'common.empty.denied.desc': 'Your account lacks this permission, contact an administrator',

  // Danger confirmation
  'common.danger.title': 'Please confirm',
  'common.danger.irreversible': 'This action cannot be undone.',
  'common.danger.ok': 'Confirm',
  'common.danger.cancel': 'Cancel',

  // Actions and joiners reused across modules
  'common.action.cancel': 'Cancel',
  'common.action.confirm': 'OK',
  'common.action.ok': 'OK',
  'common.action.gotIt': 'Got it',
  'common.action.close': 'Close',
  'common.action.submit': 'Submit',
  'common.action.save': 'Save',
  'common.action.retry': 'Retry',
  'common.action.copy': 'Copy',
  'common.action.copied': 'Copied',
  'common.action.selectAll': 'Select all',
  'common.action.clear': 'Clear',
  'common.action.refresh': 'Refresh',
  'common.listSeparator': ', ',
  'common.etcCount': 'and {count} more',

  // Global upload progress
  'common.upload.title': 'Uploads',
  'common.upload.summary': '{active} uploading · {total} total',
  'common.upload.idle': 'No active uploads',
  'common.upload.failed': '{count} failed',
  'common.upload.percent': '{percent}% overall',
  'common.upload.openPage': 'Open upload page',
  'common.upload.viewQueue': 'View',
  'common.upload.queue.default': 'Chunked upload',
  'common.upload.queue.file-workbench': 'File workspace',
  // Uploading from within chat: the page and the drawer each own a queue, but they are the
  // same activity to the user, so both labels read the same
  'common.upload.queue.chat-send': 'Send in chat',
  'common.upload.queue.chat-send-drawer': 'Send in chat',
  'common.upload.queue.unknown': 'Upload queue',
  'common.upload.status.working': 'Uploading',
  'common.upload.status.paused': 'Paused',
  'common.upload.status.success': 'Completed',
  'common.upload.status.error': 'Failed',
  'common.upload.status.canceled': 'Canceled',
  'common.upload.status.instant': 'Instant upload',
} as const;
