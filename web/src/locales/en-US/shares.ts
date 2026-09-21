/** 分享管理页与创建外发分享弹窗文案。 */
export default {
  /* ============================ Page ============================ */
  'shares.page.title': 'Share management',
  'shares.page.subtitle':
    'External links I created; extract codes are never shown again and cannot be recovered after revoking',
  'shares.denied':
    'This account has no external share permission (file:share). Contact an administrator to enable it.',
  'shares.table.title': 'My shares',

  /* ============================ Actions ============================ */
  'shares.action.create': 'Create share',
  'shares.action.copy': 'Copy link',
  'shares.action.revoke': 'Revoke',

  /* ============================ Copy ============================ */
  'shares.copy.success':
    'Link copied; the extract code is not shown again, so reuse the one from creation',
  'shares.copy.manualTitle': 'Please copy the link manually',
  'shares.copy.disabled': 'Only active shares can be copied',

  /* ============================ Revoke ============================ */
  'shares.revoke.success': 'Share revoked; the link is invalid immediately',
  'shares.revoke.confirmTitle': 'Revoke this share link?',
  'shares.revoke.confirmContent':
    'Once revoked, the link becomes invalid immediately and the extract code already sent to the recipient is void. To share externally again, create a new link.',
  'shares.revoke.confirmOk': 'Revoke share',

  /* ==================== Bulk revoke (row selection / all) ==================== */
  'shares.action.revokeSelected': 'Revoke selected',
  'shares.action.revokeSelectedCount': 'Revoke selected ({count})',
  'shares.action.revokeAll': 'Revoke all',
  'shares.revokeBatch.success': '{count} share link(s) revoked',
  'shares.revoke.none': 'No active share links to revoke',
  'shares.revokeSelected.confirmTitle': 'Revoke the {count} selected shares?',
  'shares.revokeSelected.confirmContent':
    'The selected links become invalid immediately and the extract codes already sent to recipients are void. Revoking is final and cannot be undone.',
  'shares.revokeSelected.confirmOk': 'Revoke selected',
  'shares.revokeAll.confirmTitle': 'Revoke all active shares?',
  'shares.revokeAll.confirmContent':
    'Every active link in this account (not only this page) is revoked immediately, along with the extract codes already sent out. Revoking is final and cannot be undone.',
  'shares.revokeAll.confirmOk': 'Revoke all',

  /* ============================ Created ============================ */
  'shares.created.title': 'Share created',
  'shares.created.ok': 'Got it',
  'shares.created.code': 'Extract code:',
  'shares.created.note':
    'Only the extract code hash is stored on the server, so it cannot be viewed again after this window closes. Relay it to the recipient now.',

  /* ============================ Table columns ============================ */
  'shares.column.deletedFile': '(file deleted)',
  'shares.column.status': 'Status',
  'shares.column.expireAt': 'Expires at',
  'shares.column.used': 'Used',
  'shares.column.unlimited': 'Unlimited',
  'shares.column.remaining': 'Remaining',
  'shares.column.extractCode': 'Extract code',
  'shares.column.extractOn': 'Enabled',
  'shares.column.extractOff': 'Disabled',
  'shares.column.createTime': 'Created at',

  /* ============================ Create modal ============================ */
  'shares.create.title': 'Create external share',
  'shares.create.file': 'File to share',
  'shares.create.filePlaceholder': 'Type a file name to search',
  'shares.create.fileRequired': 'Select the file to share',
  'shares.create.fileNotFound': 'No matching files',
  'shares.create.expire': 'Validity',
  'shares.create.expireRequired': 'Select a validity period',
  'shares.create.expireExtra':
    'Up to {days} days; the link expires automatically afterwards',
  'shares.create.downloadLimit': 'Download limit',
  'shares.create.downloadLimitRequired': 'Enter the download limit',
  'shares.create.downloadLimitExtra':
    '1 ~ {max} times; the link expires automatically once used up',
  'shares.create.extractCode': 'Extract code',
  'shares.create.extractCodeRequired': 'Enter the extract code',
  'shares.create.extractCodeRule':
    'The extract code must be {min}~{max} letters or digits',
  'shares.create.extractCodeExtra':
    'Only the hash is stored on the server; relay the code to the recipient right after creation, as it cannot be viewed again',

  /* ================ Visitor pickup page (/share/:token, no sign-in) ================ */
  'shares.visit.subtitle':
    'Someone sent you a file via AntTransfer. Enter the extract code to pick it up.',
  'shares.visit.invalidLink':
    'Incomplete link: the share token is missing. Make sure you copied the whole link.',
  'shares.visit.code.label': 'Extract code',
  'shares.visit.code.placeholder': 'Enter the code you received by email or chat',
  'shares.visit.code.prefilled':
    'The extract code was filled in from the link — click the button to continue',
  'shares.visit.code.required': 'Enter the extract code',
  'shares.visit.submit': 'Get the file',
  'shares.visit.redeemed': 'Ready — use the button below to download',
  'shares.visit.ticketTtl':
    'The download link stays valid for {minutes} minutes. After it expires you must request the file again, which uses another download.',
  'shares.visit.unknownFile': '(file name unavailable)',
  'shares.visit.download': 'Download file',
  'shares.visit.footer':
    'Anyone with the extract code can pick this file up — do not forward the link to others.',
} as const;
