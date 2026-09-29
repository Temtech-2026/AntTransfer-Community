/**
 * File domain copy: workbench / list / grid / recycle bin / preview / external share /
 * move / access request / upload modal.
 */
export default {
  /* ============================ Data level ============================ */
  'file.level.public': 'Public',
  'file.level.internal': 'Internal',
  'file.level.classified': 'Classified',
  'file.level.unknown': 'Unclassified',
  'file.level.applyHint.classified':
    'This file is Classified: the request goes through multi-level approval, no download or external-share permission is granted, and only temporary preview access is opened on demand.',
  'file.level.applyHint.internal':
    'This file is Internal: a request grants preview and download by default; external sharing requires a separate approval.',
  'file.level.applyHint.public':
    'This file is Public: approval is usually quick, but a genuine purpose is still required.',
  'file.level.applyHint.unknown':
    'This file has no data level yet; the approver may ask you to classify it first.',

  /* ============================ Security badges ============================ */
  'file.security.classified.label': 'Classified',
  'file.security.classified.hint':
    'Classified: previews carry a watermark and downloads are fully logged; external sharing requires prior approval',
  'file.security.watermark.label': 'Watermark',
  'file.security.watermark.hint':
    'Previews and downloads are overlaid with a dynamic watermark (account and time) to trace leaks',
  'file.security.expiring.label': 'Expires in {days} days',
  'file.security.expiring.hint':
    'This item expires in {days} days; the link and all grants become invalid at that time',
  'file.security.expired.label': 'Expired',
  'file.security.expired.hint':
    'This item has expired; request access again if you still need it',

  /* ============================ Extension groups ============================ */
  'file.extGroup.doc': 'Documents',
  'file.extGroup.image': 'Images',
  'file.extGroup.video': 'Video',
  'file.extGroup.audio': 'Audio',
  'file.extGroup.archive': 'Archives',

  /* ============================ Share status ============================ */
  'file.shareStatus.active': 'Active',
  'file.shareStatus.revoked': 'Revoked',
  'file.shareStatus.expired': 'Expired',
  'file.shareStatus.unknown': 'Unknown',

  /* ============================ Access request types ============================ */
  'file.applyType.access.label': 'View (preview)',
  'file.applyType.access.hint':
    'Online preview only; no download or external sharing',
  'file.applyType.download.label': 'Download',
  'file.applyType.download.hint':
    'Download the original file; every use is logged',
  'file.applyType.edit.label': 'Edit',
  'file.applyType.edit.hint': 'Rename, move and add versions',
  'file.applyType.share.label': 'External share',
  'file.applyType.share.hint': 'Create external links; highest risk',

  /* ============================ Actions ============================ */
  'file.action.preview': 'Preview',
  'file.action.download': 'Download',
  'file.action.share': 'Share',
  'file.action.sendToChat': 'Send to chat',
  'file.action.applyPerm': 'Request access',
  'file.action.delete': 'Delete',
  'file.action.restore': 'Restore',
  'file.action.destroy': 'Destroy permanently',
  'file.action.move': 'Move',
  'file.action.recycle': 'Move to recycle bin',
  'file.action.clearSelection': 'Clear selection',
  'file.action.more': 'More',
  'file.action.upload': 'Upload files',
  'file.action.enterRecycle': 'Recycle bin',
  'file.action.backToFiles': 'Back to my files',
  'file.action.emptyRecycle': 'Empty recycle bin',
  'file.action.permission': 'Access',
  'file.action.refresh': 'Refresh',

  /* ============================ Page structure ============================ */
  'file.title': 'Files',
  'file.subtitle': 'Browse by folder, level and type',
  'file.section.myFiles': 'My files',
  'file.section.recycle': 'Recycle bin',
  'file.breadcrumb.all': 'All files',
  'file.folder.children': 'Subfolders:',
  'file.folder.empty': 'No subfolders in this folder',
  'file.folder.root': 'All files (root)',

  /* ============================ Table columns ============================ */
  'file.column.name': 'Name',
  'file.column.ext': 'Type',
  'file.column.level': 'Level',
  'file.column.size': 'Size',
  'file.column.updateTime': 'Updated',
  'file.column.recycleTime': 'Recycled',
  'file.column.action': 'Actions',
  'file.recycle.today': 'Today',
  'file.recycle.daysAgo': '{days} days ago',

  /* ============================ Query and view ============================ */
  'file.query.name': 'Name',
  'file.query.namePlaceholder': 'Name keyword',
  'file.query.ext': 'Type',
  'file.query.extAll': 'All types',
  'file.query.level': 'Level',
  'file.query.levelAll': 'All levels',
  'file.query.createTime': 'Created',
  'file.query.submit': 'Search',
  'file.query.reset': 'Reset',
  'file.view.list': 'List',
  'file.view.grid': 'Grid',
  'file.total': '{total} items',
  'file.selectedCount': '{count} selected',
  'file.uploadingCount': 'Uploading {count}',
  'file.grid.emptyRecycle': 'The recycle bin is empty',
  'file.grid.emptyFolder':
    'No files yet; upload one or create a subfolder first',

  /* ============================ Download ============================ */
  'file.download.preparing': 'Preparing to download {name}',
  'file.download.done':
    '{name} download started — check your browser downloads',
  'file.download.failed': 'Download failed',

  /* ============================ Recycle bin and destroy ============================ */
  'file.recycle.confirmTitle': 'Move "{name}" to the recycle bin?',
  'file.recycle.confirmContent':
    'It will disappear from My files but can be restored at any time; no data is lost.',
  'file.destroy.confirmTitle': 'Permanently destroy "{name}"?',
  'file.destroy.confirmContent':
    'The file and all of its chunks are deleted for good and removed from the recycle bin. This cannot be undone.',
  'file.restore.done': '"{name}" restored',
  'file.empty.confirmTitle': 'Empty the recycle bin?',
  'file.empty.confirmContent':
    'Every file in the recycle bin will be permanently destroyed and cannot be recovered. If you only need a break, leave them here.',
  'file.empty.done': '{count} items destroyed',
  'file.empty.noop': 'The recycle bin is already empty',
  'file.batchRecycle.confirmTitle':
    'Move the {count} selected items to the recycle bin?',
  'file.batchRecycle.confirmContent':
    'They will disappear from My files but can be restored at any time; no data is lost.',
  'file.batchRecycle.done': 'Moved {count} items to the recycle bin',
  'file.batchRecycle.noop': 'No items were moved to the recycle bin',
  'file.recycle.alertTitle': 'Recycle bin',
  'file.recycle.alertDescription':
    'Files here no longer appear in My files. Restore them here, or destroy them permanently (irreversible); destroying requires the file:destroy permission.',
  'file.recycle.noFilterHint':
    'Keyword and level filters are unavailable in the recycle bin: these items have left their folders, so filtered results would be misleading',
  'file.batch.shareMultiHint':
    'Only one item can produce an external link at a time; select exactly one',
  'file.batch.applyMultiHint':
    'Access requests target one item at a time; select exactly one',

  /* ============================ Preview ============================ */
  'file.preview.title': 'Preview',
  'file.preview.strategy.text': 'Text',
  'file.preview.strategy.pdf': 'PDF',
  'file.preview.strategy.image': 'Image',
  'file.preview.strategy.downloadOnly': 'Download only',
  'file.preview.strategy.none': 'Unsupported',
  'file.preview.failedTitle': 'Preview failed',
  'file.preview.loadFailed': 'Failed to load preview information',
  'file.preview.empty': 'Nothing to preview',
  'file.preview.truncated':
    'The content is long; only the beginning is shown. Download it to read the rest.',
  'file.preview.downloadOnlyTitle': 'This file type cannot be previewed online',
  'file.preview.downloadOnlyDescription':
    'To reduce leak risk this format is not transcoded on the server; download it and open it locally.',
  'file.preview.downloadFile': 'Download file',
  'file.preview.unavailableTitle': 'Preview unavailable',
  'file.preview.unavailableDescription':
    'The server offers no usable preview method; the format may be unsupported or previews may be disabled.',

  /* ============================ Move ============================ */
  'file.move.title': 'Move to',
  'file.move.ok': 'Move',
  'file.move.alertTitle': 'Moving only changes the location',
  'file.move.alertDescription':
    'The data level, share links and granted permissions are unaffected by a move.',
  'file.move.placeholder': 'Select a target folder',
  'file.move.pending': '{count} items to move',
  'file.move.pendingNames': ': {names}',
  'file.move.etc': ' and others',
  'file.move.unchanged':
    ' ({count} more are already in the target folder and will be skipped)',
  'file.move.noop':
    'The target folder is the current location; nothing to move',
  'file.move.done': 'Moved {count} items to "{target}"',
  'file.move.failed': 'Failed to move {count} items: {names}',

  /* ============================ Access request ============================ */
  'file.apply.title': 'Request file access',
  'file.apply.submitFailed': 'Failed to submit the request',
  'file.apply.submittedTitle': 'Request submitted',
  'file.apply.submittedSubTitle':
    'Request number: {no}; track its progress under "My requests"',
  'file.apply.submittedExtra':
    'Access takes effect automatically once approved, so there is no need to resubmit; if rejected, read the comments and add more detail before trying again.',
  'file.apply.field.file': 'File',
  'file.apply.field.level': 'Data level',
  'file.apply.levelAlertTitle': 'Sensitivity notice',
  'file.apply.field.applyType': 'Access type',
  'file.apply.field.applyTypeRequired': 'Please choose an access type',
  'file.apply.field.purpose': 'Purpose',
  'file.apply.field.purposeRequired': 'Please describe the purpose',
  'file.apply.field.purposeMin':
    'Please write at least 10 characters so the approver can judge',
  'file.apply.field.purposeMax': 'At most 500 characters',
  'file.apply.field.purposePlaceholder':
    'e.g. Cross-checking figures for the quarterly business review; for my own use only and not shared externally',
  'file.apply.field.expireAt': 'Requested expiry',
  'file.apply.field.expireAtExtra':
    'Leave empty to request long-term access (harder to approve); fill it in based on real need and access is revoked automatically on expiry',
  'file.apply.field.expireAtPlaceholder': 'Select an expiry time',
  'file.apply.footnote':
    'The requester identity and request time are recorded by the server; you cannot request on behalf of others.',
  'file.apply.submit': 'Submit request',

  /* ============================ External share modal ============================ */
  'file.share.presetDays': '{days} days',
  'file.share.title': 'Share externally',
  'file.share.titleWithName': 'Share externally: {name}',
  'file.share.createFailed': 'Failed to create the external share',
  'file.share.missingFileId':
    'This file has no physical file ID, so an external share cannot be created. Please refresh and try again.',
  'file.share.copied': 'Link and access code copied',
  'file.share.copyDenied':
    'The browser denied clipboard access; please select and copy manually',
  'file.share.again': 'Create another',
  'file.share.done': 'Done',
  'file.share.generate': 'Generate link',
  'file.share.resultTitle': 'External link created',
  'file.share.resultSubTitle':
    'The access code is not shown again; copy it now and pass it on',
  'file.share.field.url': 'Share link',
  'file.share.field.code': 'Access code',
  'file.share.field.expireAt': 'Valid until',
  'file.share.field.downloadLimit': 'Download limit',
  'file.share.times': '{count} times',
  'file.share.copyBoth': 'Copy link and access code',
  'file.share.approvalRequiredTitle':
    'Classified file: administrator approval is required before sharing',
  'file.share.approvalRequiredDescription':
    'Sharing a classified file requires an approved high-sensitivity request; generating a link directly is rejected by the server (403 / 1003). Submit an access request for this file from the list first, then come back once it is approved.',
  'file.share.warningTitle':
    'An external link is equivalent to sending the file outside the intranet',
  'file.share.warningDescription':
    'The link is accessible without signing in as long as the access code is known, and every download is logged; classified files require prior external-share approval, otherwise the server rejects the request (403 / 1003).',
  'file.share.block.audience': 'Who can access',
  'file.share.audience.link': 'Anyone with the link',
  'file.share.audience.linkHint':
    'Anyone holding the link and access code can view it without signing in, which suits external partners; there is no identity check, so it fits one-off, limited-use scenarios best.',
  'file.share.audience.member': 'Named recipients',
  'file.share.audience.memberHint':
    'Grant precisely by email, phone number or org structure so only the named people can see it. This needs an internal authorization API that the CE edition does not provide yet, so the option is disabled.',
  'file.share.block.policy': 'Permissions and security policy',
  'file.share.field.codeLabel': 'Access code',
  'file.share.field.codeRequired': 'Please enter an access code',
  'file.share.field.codeRule':
    'The access code must be {min}~{max} letters or digits',
  'file.share.field.codeExtra':
    'The server stores only a hash, so it cannot be shown again after the dialog closes; if you forget it, revoke the link and create a new one',
  'file.share.field.codePlaceholder': '6~32 letters or digits',
  'file.share.random': 'Random',
  'file.share.copy': 'Copy',
  'file.share.codeMissing': 'Generate or enter an access code first',
  'file.share.codeCopied': 'Access code copied',
  'file.share.field.limitLabel': 'Download limit',
  'file.share.field.limitRequired': 'Please enter the download limit',
  'file.share.field.limitExtra':
    'The link expires automatically once the limit is reached; revoking the link invalidates issued download tickets immediately',
  'file.share.trace.label': 'Log every download',
  'file.share.trace.description':
    'Always on: each download records the account (IP and user agent for anonymous visitors), the time and the file, and can be traced in the audit log. It cannot be turned off.',
  'file.share.watermark.label': 'Dynamic watermark on previews',
  'file.share.watermark.description':
    'Needs the server to expose the watermark switch and rendering capability, which the CE edition does not provide yet; leaving it unchecked means this external link has no watermark protection.',
  'file.share.block.expire': 'Validity',
  'file.share.field.expireLabel': 'Link lifetime',
  'file.share.field.expireRequired': 'Please choose a validity period',
  'file.share.field.expireExtra':
    'Calculated as "creation time + N days", up to {max} days; larger values are rejected by the server',
};
