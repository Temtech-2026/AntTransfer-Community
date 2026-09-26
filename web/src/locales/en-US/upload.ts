/** 分片上传页与上传弹窗文案。 */
export default {
  'upload.title': 'Upload files',
  'upload.titleWithFolder': 'Upload files (folder #{folderId})',
  'upload.dropText': 'Click or drag files here',
  'upload.dropHint':
    'Multiple selection supported; large files are chunked automatically (4 MiB by default) and hashed, so instant-upload hits need no transfer',
  'upload.instant': 'Instant',
  'upload.verifying': 'Verifying',
  'upload.chunkProgress': ' · {received}/{total} chunks',
  'upload.chunkTooltip': 'Chunk {index}',
  'upload.retried': 'Automatically retried {count} times',
  'upload.empty': 'No upload tasks',
  'upload.summary': 'In progress {uploading} · Completed {finished} · Total {total}',

  // Task status
  'upload.status.pending': 'Queued',
  'upload.status.hashing': 'Hashing',
  'upload.status.prechecking': 'Pre-checking',
  'upload.status.querying': 'Querying chunks',
  'upload.status.uploading': 'Uploading',
  'upload.status.paused': 'Paused',
  'upload.status.merging': 'Merging',
  'upload.status.success': 'Completed',
  'upload.status.error': 'Failed',
  'upload.status.canceled': 'Canceled',

  // Error copy (the service layer translates it before throwing; see services/upload)
  'upload.error.generic': 'Upload failed.',
  'upload.error.network':
    'Network error. Please check your connection and try again.',
  'upload.error.timeout': 'Upload timed out.',
  'upload.error.badContract':
    'The server response does not match the unified contract.',
  'upload.error.instantWithoutFileId':
    'Instant upload hit but no fileId was returned.',
  'upload.error.missWithoutUploadId':
    'Instant upload missed but no uploadId was returned.',
  'upload.error.partHttp': 'Chunk upload failed (HTTP {status})',
  'upload.error.hashWorkerFailed': 'The hashing worker failed.',
  'upload.error.hashFailed': 'Hashing failed.',

  // Actions
  'upload.action.pause': 'Pause',
  'upload.action.resume': 'Resume',
  'upload.action.remove': 'Remove',
  'upload.action.pauseAll': 'Pause all',
  'upload.action.resumeAll': 'Resume all',
  'upload.action.clearFinished': 'Clear finished',

  // Resume
  'upload.resumable.title': 'Unfinished uploads detected',
  'upload.resumable.note':
    'The progress below comes from the local cache and is for reference only; the actual resume position is determined by the server chunk list.',
  'upload.resumable.record':
    '{name} ({size}, {received}/{total} chunks completed)',
  'upload.resumable.ignore': 'Ignore',
  'upload.resumable.select': 'Select file to resume',
  'upload.resumable.hint':
    'Select the same file as before (a same-named file with different content will be detected and re-uploaded)',

  // Finished list
  'upload.column.method': 'Method',
  'upload.column.chunked': 'Chunked upload',

  // Upload method (chunk request body form) — shared by the demo cards and the upload component
  'upload.mode.title': 'Upload method',
  'upload.mode.subtitle':
    'Two chunk request body forms, each with its own saved parameters',
  'upload.mode.active': 'In use',
  'upload.mode.use': 'Use this method',
  'upload.mode.fact.request': 'Request body',
  'upload.mode.fact.scene': 'Best for',
  'upload.mode.unsupportedTag': 'Backend unsupported',
  'upload.mode.switchHint':
    'Switching only affects tasks added afterwards: a running task keeps the method it started with, so one upload never mixes the two request body forms. New parameters also apply from the next task on.',
  'upload.mode.multipart.title': 'Form chunks',
  'upload.mode.multipart.tag': 'multipart/form-data',
  'upload.mode.multipart.desc':
    'Each chunk is wrapped in `FormData`, with the chunk index and digest submitted as form fields; the most compatible option and the current backend default.',
  'upload.mode.multipart.request':
    '`PUT` chunk endpoint, body is `FormData` (`chunk` + `index` + `hash`)',
  'upload.mode.multipart.scene':
    'The backend receives chunks via Spring `@RequestPart` / `MultipartFile` (the contract default)',
  'upload.mode.octetStream.title': 'Raw binary stream',
  'upload.mode.octetStream.tag': 'application/octet-stream',
  'upload.mode.octetStream.desc':
    'The chunk itself is the raw request body and the index comes from the URL, saving one layer of form wrapping and a memory copy.',
  'upload.mode.octetStream.request':
    '`PUT` chunk endpoint, body is the raw byte stream (`Content-Type: application/octet-stream`, no `hash` field)',
  'upload.mode.octetStream.scene':
    'Direct-to-object-storage uploads, or gateways that pass the raw stream through without parsing a form',
  'upload.mode.octetStream.unsupported':
    'The at-transfer chunk endpoint currently only declares `multipart/form-data`, so choosing this makes chunk uploads fail with HTTP 415; the backend must support raw streams first (the frontend side is ready).',

  // Demo page (/upload). Backticks in the text are rendered as inline code by the page.
  'upload.demo.pageTitle': 'Chunked upload',
  'upload.demo.pageSubtitle': 'Instant upload · Resume · Concurrent chunks',
  'upload.demo.pipeline.title': 'Upload pipeline',
  'upload.demo.pipeline.subtitle': 'Hash → Instant → Fill gaps → Merge',
  'upload.demo.pipeline.desc':
    'Large files are hashed locally first, and the server uses the digest to decide whether an instant upload is possible; on a miss only the missing chunks are sent, so you can refresh at any time, pick the same file again and resume from the position the server has already received.',
  'upload.demo.step.hash.title': 'Compute checksum',
  'upload.demo.step.hash.desc':
    'Incremental SHA-256 inside a Worker keeps the main thread free',
  'upload.demo.step.precheck.title': 'Instant-upload pre-check',
  'upload.demo.step.precheck.desc':
    'A digest hit finishes the task with zero bytes transferred',
  'upload.demo.step.query.title': 'Query received chunks',
  'upload.demo.step.query.desc': 'The server chunk list is authoritative',
  'upload.demo.step.upload.title': 'Upload missing chunks',
  'upload.demo.step.upload.desc':
    '3 concurrent chunks by default, with backoff retry on failure',
  'upload.demo.step.merge.title': 'Merge and verify',
  'upload.demo.step.merge.desc':
    'The server re-hashes the whole file before merging',
  'upload.demo.chunkTitle': 'Chunked upload demo',
  'upload.demo.finished.title': 'Completed files',
  'upload.demo.finished.subtitle': 'Keeps the latest {count} at most',
  'upload.demo.usage.title': 'How to integrate',
  'upload.demo.usage.subtitle': 'Component or Hook, sharing one upload queue',
  'upload.demo.usage.desc':
    'The component brings its own queue and progress display, so it works as soon as it is on the page. To lay things out yourself on a business page, use the `useChunkUpload()` Hook for state and actions and render your own UI. Both only care about `id`: the same `id` means the same queue, so the two can be mixed on one page.',
  'upload.demo.usage.tab.component': 'Component',
  'upload.demo.usage.tab.hook': 'Hook',
  'upload.demo.usage.component.point1':
    '`id` defines the queue identity: components sharing an id share one queue, and navigation or remounting never interrupts a transfer.',
  'upload.demo.usage.component.point2':
    '`chunkSize` and `concurrency` are normalized to the contract range on enqueue (≤ 8 MiB, 1-5 in parallel), so an out-of-range value never puts illegal chunks on the wire.',
  'upload.demo.usage.component.point3':
    '`partPayloadMode` is per task: switching while uploading only affects tasks added afterwards.',
  'upload.demo.usage.hook.point1':
    '`tasks` and `resumable` are subscribed snapshots: progress is not polled, and high-frequency progress never goes into state.',
  'upload.demo.usage.hook.point2':
    '`start()` enqueues and begins immediately, returning the ids of that batch; pause / resume / retry / cancel each have their own action.',
  'upload.demo.usage.hook.point3':
    'The Hook gives state and actions but draws nothing: list, progress bar and buttons are all up to the business page.',
  'upload.demo.tryRun.title': 'How to try it',
  'upload.demo.tryRun.localMock':
    'This page ships with its own local mock (`src/pages/upload/_mock.ts`; Umi only loads the `_mock.ts` inside the page directory): when started with `npm run start` (mock enabled automatically), the upload pipeline works offline and uploading the same file again hits the instant-upload path.',
  'upload.demo.tryRun.dev':
    'Starting with `npm run dev` disables the mock and proxies `/api` to `localhost:8080`; in that case the at-transfer backend endpoints must be ready.',
  'upload.demo.tryRun.auth':
    'Note: like other business pages, this page is protected by the login guard (unauthenticated visitors are redirected to `/user/login`); the login endpoint has no mock yet and requires the at-auth backend, so the mock only covers the upload pipeline.',
} as const;
