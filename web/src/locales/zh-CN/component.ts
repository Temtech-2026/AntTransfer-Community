/**
 * 公共组件文案（顶栏 / 侧栏 / 全局搜索 / 通知铃铛 / 组织切换 / 拖拽区 / 标签选择）。
 *
 * <p>这些组件挂在整个壳层上、每个页面都会渲染，任何一处硬编码中文都会让英文界面漏出中文，
 * 因此统一收在这一域。</p>
 */
export default {
  'component.langSwitch': '语言切换',

  // 标签选择
  'component.tagSelect.expand': '展开',
  'component.tagSelect.collapse': '收起',
  'component.tagSelect.all': '全部',

  // 侧栏底部入口
  'component.siderFooter.messages': '消息',
  'component.siderFooter.transfer': '传输',
  'component.siderFooter.openMessages': '打开消息面板',
  'component.siderFooter.openTransfer': '打开传输中心',

  // 顶栏全局搜索
  'component.globalSearch.placeholder': '搜索文件名 / 标签，回车定位到文件',
  'component.globalSearch.ariaLabel': '全局搜索',
  'component.globalSearch.scopeAria': '搜索范围说明',
  'component.globalSearch.scopeTitle': '搜索范围：文件名、标签（跳转文件工作台）。',
  'component.globalSearch.scopeEe': '文件内容全文检索需要内容提取与索引，属 EE 能力。',

  // 顶栏使用文档入口
  'component.docLink.title': '使用文档',

  // 顶栏历史版本入口
  'component.version.history': '历史版本',

  // 文章列表内容（模板组件）
  'component.articleList.publishedAt': '发布在',

  // 头像下拉与个人信息
  'component.avatar.profile': '个人信息',
  'component.avatar.changePassword': '修改密码',
  'component.avatar.logout': '退出登录',
  'component.avatar.account': '账号',
  'component.avatar.nickname': '昵称',
  'component.avatar.roles': '角色',

  // 个人信息弹窗里的本人头像自助更换（上传即生效，不走表单保存）
  // 预检失败的提示复用 system.user.avatar.tooLarge / typeInvalid：
  // checkAvatarFile 是按系统管理域命名的共用预检，key 不另起一套，避免同一句话两处维护
  'component.avatar.avatar.upload': '上传头像',
  'component.avatar.avatar.hint': '支持 PNG / JPEG / GIF / WebP，不超过 {max}',
  'component.avatar.avatar.updated': '头像已更新',

  // 自助改密弹窗（成功后全端吊销，必须重新登录）
  'component.avatar.changePassword.title': '修改密码',
  'component.avatar.changePassword.alert.title': '修改成功后需要重新登录',
  'component.avatar.changePassword.alert.desc':
    '为保护账号安全，修改密码会使所有设备上的登录立即失效，请使用新密码重新登录。',
  'component.avatar.changePassword.old': '当前密码',
  'component.avatar.changePassword.oldPlaceholder': '请输入当前密码',
  'component.avatar.changePassword.oldRequired': '请输入当前密码',
  'component.avatar.changePassword.new': '新密码',
  'component.avatar.changePassword.newPlaceholder': '请输入新密码',
  'component.avatar.changePassword.newRequired': '请输入新密码',
  'component.avatar.changePassword.newLength': '密码长度需为 8-64 位',
  'component.avatar.changePassword.newPattern': '密码须同时包含字母和数字，且不含空格',
  'component.avatar.changePassword.policyHint': '8-64 位，须同时包含字母和数字',
  'component.avatar.changePassword.confirm': '确认新密码',
  'component.avatar.changePassword.confirmPlaceholder': '请再次输入新密码',
  'component.avatar.changePassword.confirmRequired': '请再次输入新密码',
  'component.avatar.changePassword.confirmMismatch': '两次输入的新密码不一致',
  'component.avatar.changePassword.submit': '确认修改',
  'component.avatar.changePassword.done': '密码已修改，请使用新密码重新登录',

  // 通知铃铛
  'component.notify.title': '通知',
  'component.notify.count.inbox': '通知 {count}',
  'component.notify.count.todo': '待办 {count}',
  'component.notify.count.chat': '私信 {count}',
  'component.notify.markAllRead': '全部标记已读',
  'component.notify.markedAllRead': '已全部标记为已读',
  'component.notify.status.idle': '实时通道未启动',
  'component.notify.status.connecting': '连接中…',
  'component.notify.status.open': '实时通知已连接',
  'component.notify.status.reconnecting': '连接断开，重连中…',
  'component.notify.status.closed': '实时通道已断开',

  // 组织 / 团队切换器
  'component.org.defaultName': '默认组织',
  'component.org.current': '当前部署',
  'component.org.create': '新建组织 / 团队',
  'component.org.switch': '切换到其他组织',
  'component.org.eeHint': '组织间数据完全隔离（多组织、席位售卖）属 EE 能力；CE 版为单组织自托管部署。',
  'component.org.tooltip': '当前组织：{name}',

  // 拖拽 / 点选文件区
  'component.dropZone.title': '拖拽文件到此处，或点击选择',

  // 分片上传组件
  'component.chunkUpload.title': '文件上传',
  'component.chunkUpload.busy': '{count} 个任务进行中',
  'component.chunkUpload.resumableCount': '检测到 {count} 个未完成的上传',
  'component.chunkUpload.resumableNote':
    '为避免重复传输，请重新选择同一文件，系统将跳过服务端已收到的分片继续上传。',
  'component.chunkUpload.resumableSelect': '重新选择文件继续',
  'component.chunkUpload.instantDone': '秒传完成',
  'component.chunkUpload.instantSuccess': '秒传成功',
  'component.chunkUpload.progress.hashing': '正在计算文件校验值…',
  'component.chunkUpload.progress.prechecking': '正在检测是否可秒传…',
  'component.chunkUpload.progress.querying': '正在获取已上传分片…',
  'component.chunkUpload.progress.merging': '正在合并分片…',
  'component.chunkUpload.progress.paused': '已暂停（已完成 {received}/{total} 片）',
  'component.chunkUpload.progress.failed': '上传失败',
  'component.chunkUpload.progress.uploading': '{received}/{total} 片 · {speed}',
  'component.chunkUpload.progress.retried': ' · 已重试 {count} 次',
  'component.chunkUpload.progress.chunks': '{count} 片',
  'component.chunkUpload.retryTooltip': '网络抖动时自动指数退避重试',
  'component.chunkUpload.retryTag': '重试 {count}',
  'component.chunkUpload.draggerText': '点击或拖拽文件到此处上传',
  'component.chunkUpload.draggerHint':
    '支持大文件分片上传、秒传与断点续传；单文件失败会自动重试 {count} 次',
  'component.chunkUpload.chunkSize': '分片大小',
  'component.chunkUpload.concurrency': '并发数',
  'component.chunkUpload.tuningNote': '变更对后续分片生效',
  'component.chunkUpload.overallProgress': '整体进度',
  'component.chunkUpload.overallSummary':
    '{finished}/{total} 个文件 · {uploaded} / {totalSize}',

  // 代码块（文档区展示示例代码）
  'component.codeBlock.copy': '复制',
  'component.codeBlock.copied': '已复制',
  'component.codeBlock.copyFailed': '复制失败',

  // 传输监控悬浮窗
  'component.transfer.title': '传输中心',
  'component.transfer.expand': '展开传输中心',
  'component.transfer.collapse': '收起传输中心',
  'component.transfer.capsule': '传输中 {count}',
  'component.transfer.summary': '{active} 进行中 · {success} 完成',
  'component.transfer.summaryFailed': ' · {count} 失败',
  'component.transfer.pauseAll': '全部暂停',
  'component.transfer.resumeAll': '全部继续 / 重试失败',
  'component.transfer.clearFinished': '清空已完成 / 已取消 / 失败',
  'component.transfer.fastMode': '极速模式',
  'component.transfer.fastModeHint':
    '并发分片数提到契约上限 5；对进行中的任务同样生效。上传页自选的并发数会被本开关覆盖。',
  'component.transfer.empty': '暂无传输任务',
  'component.transfer.chartAria': '传输速度曲线',
  'component.transfer.pause': '暂停',
  'component.transfer.resumeRetry': '继续 / 重试',
  'component.transfer.pauseNamed': '暂停 {name}',
  'component.transfer.resumeNamed': '继续 {name}',
  'component.transfer.status.active': '传输中',
  'component.transfer.status.paused': '已暂停',
  'component.transfer.status.error': '失败',
  'component.transfer.status.success': '已完成',
  'component.transfer.status.canceled': '已取消',
} as const;
