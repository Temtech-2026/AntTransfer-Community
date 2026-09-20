/**
 * 全局通用文案（骨架屏 / 空状态 / 危险操作确认 / 上传进度）。
 *
 * <p>放在 `locales` 而不是写在组件里，是为了让「统一体验组件」在切换语言时不掉队——
 * 这几个组件会被各业务页复用，任何一处硬编码中文都会让英文界面漏出中文。
 */
export default {
  // 空状态
  'common.empty.noData': '暂无数据',
  'common.empty.noResult.title': '没有匹配的结果',
  'common.empty.noResult.desc': '试试调整筛选条件，或清空关键词后重新查询',
  'common.empty.error.title': '加载失败',
  'common.empty.error.desc': '网络或服务异常，请稍后重试',
  'common.empty.error.action': '重新加载',
  'common.empty.denied.title': '无访问权限',
  'common.empty.denied.desc': '当前账号没有该项权限，如有需要请联系管理员',

  // 危险操作二次确认
  'common.danger.title': '请确认操作',
  'common.danger.irreversible': '该操作不可撤销，请确认后继续。',
  'common.danger.ok': '确认执行',
  'common.danger.cancel': '取消',

  // 跨模块复用动作与连接符（避免每个模块各写一遍，导致英文界面漏出中文）
  'common.action.cancel': '取消',
  'common.action.confirm': '确定',
  'common.action.ok': '好的',
  'common.action.gotIt': '知道了',
  'common.action.close': '关闭',
  'common.action.submit': '提交',
  'common.action.save': '保存',
  'common.action.retry': '重试',
  'common.action.copy': '复制',
  'common.action.copied': '已复制',
  'common.action.selectAll': '全选',
  'common.action.clear': '清空',
  'common.action.refresh': '刷新',
  'common.listSeparator': '、',
  'common.etcCount': '等 {count} 项',

  // 全局上传进度
  'common.upload.title': '上传任务',
  'common.upload.summary': '{active} 个上传中 · 共 {total} 个',
  'common.upload.idle': '没有进行中的上传',
  'common.upload.failed': '{count} 个失败',
  'common.upload.percent': '总进度 {percent}%',
  'common.upload.openPage': '打开上传页',
  'common.upload.viewQueue': '去查看',
  'common.upload.queue.default': '分片上传',
  'common.upload.queue.file-workbench': '文件工作台',
  'common.upload.queue.unknown': '上传任务',
  'common.upload.status.working': '上传中',
  'common.upload.status.paused': '已暂停',
  'common.upload.status.success': '已完成',
  'common.upload.status.error': '失败',
  'common.upload.status.canceled': '已取消',
  'common.upload.status.instant': '秒传完成',
} as const;
