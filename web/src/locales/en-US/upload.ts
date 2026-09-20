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
  'upload.demo.usage.subtitle': 'Component and Hook, two ways',
  'upload.demo.usage.desc':
    'The component ships with a queue and progress display built in; to control the layout yourself on a business page, use the Hook `useChunkUpload()`, which returns `tasks` / `resumable` snapshots along with `start` / `pause` / `resume` / `retry` / `cancel` actions.',
  'upload.demo.tryRun.title': 'How to try it',
  'upload.demo.tryRun.localMock':
    'This page ships with its own local mock (`src/pages/upload/_mock.ts`; Umi only loads the `_mock.ts` inside the page directory): when started with `npm run start` (mock enabled automatically), the upload pipeline works offline and uploading the same file again hits the instant-upload path.',
  'upload.demo.tryRun.dev':
    'Starting with `npm run dev` disables the mock and proxies `/api` to `localhost:8080`; in that case the at-transfer backend endpoints must be ready.',
  'upload.demo.tryRun.auth':
    'Note: like other business pages, this page is protected by the login guard (unauthenticated visitors are redirected to `/user/login`); the login endpoint has no mock yet and requires the at-auth backend, so the mock only covers the upload pipeline.',
} as const;
