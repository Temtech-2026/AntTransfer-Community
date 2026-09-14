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
  'common.upload.queue.unknown': 'Upload queue',
  'common.upload.status.working': 'Uploading',
  'common.upload.status.paused': 'Paused',
  'common.upload.status.success': 'Completed',
  'common.upload.status.error': 'Failed',
  'common.upload.status.canceled': 'Canceled',
  'common.upload.status.instant': 'Instant upload',
} as const;
