/** 分片上传页与上传弹窗文案。 */
export default {
  'upload.title': '上传文件',
  'upload.titleWithFolder': '上传文件（目录 #{folderId}）',
  'upload.dropText': '点击或拖拽文件到此处',
  'upload.dropHint':
    '支持多选；大文件自动分片（默认 4 MiB）并计算摘要，命中秒传时无需传输',
  'upload.instant': '秒传',
  'upload.verifying': '校验中',
  'upload.chunkProgress': ' · {received}/{total} 片',
  'upload.chunkTooltip': '分片 {index}',
  'upload.retried': '已自动重试 {count} 次',
  'upload.empty': '暂无上传任务',
  'upload.summary': '进行中 {uploading} · 已完成 {finished} · 共 {total}',

  // 任务状态
  'upload.status.pending': '排队中',
  'upload.status.hashing': '计算摘要',
  'upload.status.prechecking': '秒传预检',
  'upload.status.querying': '查询分片',
  'upload.status.uploading': '上传中',
  'upload.status.paused': '已暂停',
  'upload.status.merging': '合并中',
  'upload.status.success': '已完成',
  'upload.status.error': '失败',
  'upload.status.canceled': '已取消',

  // 错误文案（服务层抛出前按当前语言翻译，见 services/upload）
  'upload.error.generic': '上传失败',
  'upload.error.network': '网络异常，请检查网络后重试',
  'upload.error.timeout': '上传超时',
  'upload.error.badContract': '服务端响应结构不符合统一契约',
  'upload.error.instantWithoutFileId': '秒传命中但未返回 fileId',
  'upload.error.missWithoutUploadId': '秒传未命中但未返回 uploadId',
  'upload.error.partHttp': '分片上传失败（HTTP {status}）',
  'upload.error.hashWorkerFailed': '哈希 Worker 执行失败',
  'upload.error.hashFailed': '哈希计算失败',

  // 动作
  'upload.action.pause': '暂停',
  'upload.action.resume': '继续',
  'upload.action.remove': '移除',
  'upload.action.pauseAll': '全部暂停',
  'upload.action.resumeAll': '全部继续',
  'upload.action.clearFinished': '清除已结束',

  // 续传
  'upload.resumable.title': '检测到上次未完成的上传',
  'upload.resumable.note':
    '下面进度来自本地缓存，仅供参考；实际续传位置以服务端分片清单为准。',
  'upload.resumable.record': '{name}（{size}，已完成 {received}/{total} 片）',
  'upload.resumable.ignore': '忽略',
  'upload.resumable.select': '选择文件续传',
  'upload.resumable.hint':
    '需选择与上次同名的同一文件（同名但内容已变会被识别并重新上传）',

  // 已完成列表
  'upload.column.method': '方式',
  'upload.column.chunked': '分片上传',

  // 演示页（/upload）。文案里的反引号由页面渲染为行内代码样式。
  'upload.demo.pageTitle': '分片上传',
  'upload.demo.pageSubtitle': '秒传 · 断点续传 · 并发分片',
  'upload.demo.pipeline.title': '上传链路',
  'upload.demo.pipeline.subtitle': '摘要 → 秒传 → 补传 → 合并',
  'upload.demo.pipeline.desc':
    '大文件先在本机算出摘要，服务端据此判定能否秒传；未命中则只补传缺失分片，任意时刻刷新页面，重新选择同一文件即可从服务端已收位置继续。',
  'upload.demo.step.hash.title': '计算校验值',
  'upload.demo.step.hash.desc': 'Worker 内增量 SHA-256，主线程不卡',
  'upload.demo.step.precheck.title': '秒传预检',
  'upload.demo.step.precheck.desc': '摘要命中即完成，0 字节传输',
  'upload.demo.step.query.title': '查询已收分片',
  'upload.demo.step.query.desc': '以服务端清单为准',
  'upload.demo.step.upload.title': '并发补传分片',
  'upload.demo.step.upload.desc': '默认 3 并发，失败退避重试',
  'upload.demo.step.merge.title': '合并校验',
  'upload.demo.step.merge.desc': '服务端整件重算摘要后合并',
  'upload.demo.chunkTitle': '分片上传演示',
  'upload.demo.finished.title': '已完成文件',
  'upload.demo.finished.subtitle': '最多保留最近 {count} 条',
  'upload.demo.usage.title': '接入方式',
  'upload.demo.usage.subtitle': '组件与 Hook 两种用法',
  'upload.demo.usage.desc':
    '组件已内置队列与进度展示；若要在业务页自己控制布局，可直接用 Hook `useChunkUpload()`，它返回 `tasks` / `resumable` 快照与 `start` / `pause` / `resume` / `retry` / `cancel` 等动作。',
  'upload.demo.tryRun.title': '如何试跑',
  'upload.demo.tryRun.localMock':
    '本页自带本地 mock（`src/pages/upload/_mock.ts`，umi 只加载页面目录下的 `_mock.ts`）：用 `npm run start` 启动（自动开启 mock）时，上传链路可离线走通，同一文件再传一次即命中秒传。',
  'upload.demo.tryRun.dev':
    '用 `npm run dev` 启动会关闭 mock，并把 `/api` 代理到 `localhost:8080`，此时需要后端 at-transfer 的接口已就绪。',
  'upload.demo.tryRun.auth':
    '注意：与其它业务页一样，本页受登录守卫保护（未登录会跳到 `/user/login`）；登录接口目前没有 mock，需后端 at-auth 就绪，因此 mock 只覆盖「上传链路」这一段。',
} as const;
