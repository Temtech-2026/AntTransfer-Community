/**
 * 文件域文案：工作台 / 列表 / 网格 / 回收站 / 预览 / 外发分享 / 移动 / 权限申请 / 上传弹窗。
 *
 * <p>`services/file` 里的展示口径函数只返回 id（保持纯函数、可单测），
 * 真正的文案全在这里，避免同一句话在服务层与组件层各写一份。</p>
 */
export default {
  /* ============================ 密级 ============================ */
  'file.level.public': '公开',
  'file.level.internal': '内部',
  'file.level.classified': '机密',
  'file.level.unknown': '未定级',
  'file.level.applyHint.classified':
    '该文件为机密级：申请将进入多级审批，且不会授予下载与外发权限，仅按需临时开放预览。',
  'file.level.applyHint.internal':
    '该文件为内部级：申请默认只授予预览与下载，外发分享需单独审批。',
  'file.level.applyHint.public':
    '该文件为公开级：审批较快，但仍需填写真实使用目的。',
  'file.level.applyHint.unknown': '该文件尚未定级：审批人可能要求先完成定级。',

  /* ============================ 安全徽标 ============================ */
  'file.security.classified.label': '机密',
  'file.security.classified.hint':
    '机密级：预览叠加水印、下载全程留痕，外发前必须先通过审批',
  'file.security.watermark.label': '水印',
  'file.security.watermark.hint':
    '预览与下载画面会叠加动态水印（含账号与时间），用于溯源泄露',
  'file.security.expiring.label': '{days} 天后失效',
  'file.security.expiring.hint':
    '该条目将在 {days} 天后失效，届时链接与授权一并作废',
  'file.security.expired.label': '已失效',
  'file.security.expired.hint':
    '该条目已过失效时间，如需继续使用请重新申请授权',

  /* ============================ 扩展名分组 ============================ */
  'file.extGroup.doc': '文档',
  'file.extGroup.image': '图片',
  'file.extGroup.video': '视频',
  'file.extGroup.audio': '音频',
  'file.extGroup.archive': '压缩包',

  /* ============================ 分享状态 ============================ */
  'file.shareStatus.active': '生效中',
  'file.shareStatus.revoked': '已撤销',
  'file.shareStatus.expired': '已失效',
  'file.shareStatus.unknown': '未知',

  /* ============================ 权限申请类型 ============================ */
  'file.applyType.access.label': '访问（预览）',
  'file.applyType.access.hint': '仅在线预览，不能下载或外发',
  'file.applyType.download.label': '下载',
  'file.applyType.download.hint': '可下载原件，使用需留痕',
  'file.applyType.edit.label': '编辑',
  'file.applyType.edit.hint': '可改名 / 移动 / 新增版本',
  'file.applyType.share.label': '外发分享',
  'file.applyType.share.hint': '可创建外发链接，风险最高',

  /* ============================ 动作 ============================ */
  'file.action.preview': '预览',
  'file.action.download': '下载',
  'file.action.share': '分享',
  'file.action.sendToChat': '发送到聊天',
  'file.action.applyPerm': '申请权限',
  'file.action.delete': '删除',
  'file.action.restore': '还原',
  'file.action.destroy': '彻底销毁',
  'file.action.move': '移动',
  'file.action.recycle': '移入回收站',
  'file.action.clearSelection': '取消选择',
  'file.action.more': '更多',
  'file.action.upload': '上传文件',
  'file.action.enterRecycle': '回收站',
  'file.action.backToFiles': '返回我的文件',
  'file.action.emptyRecycle': '清空回收站',
  'file.action.permission': '权限',
  'file.action.refresh': '刷新',

  /* ============================ 页面结构 ============================ */
  'file.title': '文件',
  'file.subtitle': '目录、密级与类型筛选',
  'file.section.myFiles': '我的文件',
  'file.section.recycle': '回收站',
  'file.breadcrumb.all': '全部文件',
  'file.folder.children': '子目录：',
  'file.folder.empty': '当前目录下没有子目录',
  'file.folder.root': '全部文件（根目录）',

  /* ============================ 表格列 ============================ */
  'file.column.name': '文件名',
  'file.column.ext': '类型',
  'file.column.level': '密级',
  'file.column.size': '大小',
  'file.column.updateTime': '更新时间',
  'file.column.recycleTime': '移入回收站',
  'file.column.action': '操作',
  'file.recycle.today': '今天',
  'file.recycle.daysAgo': '已 {days} 天',

  /* ============================ 查询与视图 ============================ */
  'file.query.name': '文件名',
  'file.query.namePlaceholder': '文件名关键字',
  'file.query.ext': '类型',
  'file.query.extAll': '全部类型',
  'file.query.level': '密级',
  'file.query.levelAll': '全部密级',
  'file.query.createTime': '创建时间',
  'file.query.submit': '查询',
  'file.query.reset': '重置',
  'file.view.list': '列表',
  'file.view.grid': '网格',
  'file.total': '共 {total} 项',
  'file.selectedCount': '已选 {count} 项',
  'file.uploadingCount': '上传中 {count}',
  'file.grid.emptyRecycle': '回收站是空的',
  'file.grid.emptyFolder': '当前目录下还没有文件，可上传或先建子目录',

  /* ============================ 下载 ============================ */
  'file.download.preparing': '正在准备下载 {name}',
  'file.download.done': '{name} 已开始下载，可在浏览器下载列表中查看',
  'file.download.failed': '下载失败',

  /* ============================ 回收站与销毁 ============================ */
  'file.recycle.confirmTitle': '把「{name}」移入回收站？',
  'file.recycle.confirmContent':
    '移入回收站后它不再出现在「我的文件」中，但可以随时还原，不会丢失数据。',
  'file.destroy.confirmTitle': '彻底销毁「{name}」？',
  'file.destroy.confirmContent':
    '文件实体与其所有分片会被永久删除，回收站不再保留，此操作无法撤销。',
  'file.restore.done': '「{name}」已还原',
  'file.empty.confirmTitle': '清空回收站？',
  'file.empty.confirmContent':
    '回收站里的全部文件将被彻底销毁，无法恢复。若只是暂时不用，建议先留在回收站。',
  'file.empty.done': '已销毁 {count} 个条目',
  'file.empty.noop': '回收站本来就是空的',
  'file.batchRecycle.confirmTitle': '把选中的 {count} 个条目移入回收站？',
  'file.batchRecycle.confirmContent':
    '移入回收站后它们不再出现在「我的文件」中，但可以随时还原，不会丢失数据。',
  'file.batchRecycle.done': '已把 {count} 个条目移入回收站',
  'file.batchRecycle.noop': '没有条目被移入回收站',
  'file.recycle.alertTitle': '回收站',
  'file.recycle.alertDescription':
    '回收站里的文件不再出现在「我的文件」中。可在此还原，或彻底销毁（不可恢复）；销毁需 file:destroy 权限。',
  'file.recycle.noFilterHint':
    '回收站不支持关键字与密级筛选：这里的条目已脱离目录，筛选结果容易让人误判',
  'file.batch.shareMultiHint': '一次只能为一个条目生成外发链接，请先只勾选一个',
  'file.batch.applyMultiHint': '权限申请一次只针对一个条目，请先只勾选一个',

  /* ============================ 预览 ============================ */
  'file.preview.title': '预览',
  'file.preview.strategy.text': '文本',
  'file.preview.strategy.pdf': 'PDF',
  'file.preview.strategy.image': '图片',
  'file.preview.strategy.downloadOnly': '仅下载',
  'file.preview.strategy.none': '不支持',
  'file.preview.failedTitle': '预览失败',
  'file.preview.loadFailed': '预览信息加载失败',
  'file.preview.empty': '暂无预览内容',
  'file.preview.truncated': '内容较长，仅展示前若干字符，完整内容请下载查看',
  'file.preview.downloadOnlyTitle': '该类型不支持在线预览',
  'file.preview.downloadOnlyDescription':
    '为降低泄露风险，此格式不做服务端转码，请下载后在本地打开。',
  'file.preview.downloadFile': '下载文件',
  'file.preview.unavailableTitle': '无法预览',
  'file.preview.unavailableDescription':
    '服务端未提供可用的预览方式，可能是格式不支持或预览能力未开启。',

  /* ============================ 移动 ============================ */
  'file.move.title': '移动到',
  'file.move.ok': '移动',
  'file.move.alertTitle': '移动只改变存放位置',
  'file.move.alertDescription':
    '密级、分享链接与已授予的权限都不会因移动而改变。',
  'file.move.placeholder': '选择目标目录',
  'file.move.pending': '待移动 {count} 项',
  'file.move.pendingNames': '：{names}',
  'file.move.etc': ' 等',
  'file.move.unchanged': '（另有 {count} 项已在目标目录，将被跳过）',
  'file.move.noop': '目标目录与当前位置相同，无需移动',
  'file.move.done': '已把 {count} 个条目移动到「{target}」',
  'file.move.failed': '{count} 个条目移动失败：{names}',

  /* ============================ 权限申请 ============================ */
  'file.apply.title': '申请文件权限',
  'file.apply.submitFailed': '提交申请失败',
  'file.apply.submittedTitle': '申请已提交',
  'file.apply.submittedSubTitle': '申请单号：{no}，可在「我的申请」中查看进度',
  'file.apply.submittedExtra':
    '审批通过后权限自动生效，无需重复提交；被驳回时可查看审批意见后补充说明再提。',
  'file.apply.field.file': '申请文件',
  'file.apply.field.level': '文件密级',
  'file.apply.levelAlertTitle': '敏感等级提示',
  'file.apply.field.applyType': '权限类型',
  'file.apply.field.applyTypeRequired': '请选择权限类型',
  'file.apply.field.purpose': '使用目的',
  'file.apply.field.purposeRequired': '请填写使用目的',
  'file.apply.field.purposeMin': '请至少填写 10 个字，便于审批人判断',
  'file.apply.field.purposeMax': '最多 500 个字',
  'file.apply.field.purposePlaceholder':
    '例如：用于季度经营分析报告的数据核对，仅本人使用，不外发',
  'file.apply.field.expireAt': '期望有效期',
  'file.apply.field.expireAtExtra':
    '留空表示申请长期权限（更难过审）；建议按实际需要填写，到期自动回收',
  'file.apply.field.expireAtPlaceholder': '选择到期时间',
  'file.apply.footnote':
    '提交后申请人身份、申请时间由服务端记录，不可代他人申请。',
  'file.apply.submit': '提交申请',

  /* ============================ 外发分享弹窗 ============================ */
  'file.share.presetDays': '{days} 天',
  'file.share.title': '外发分享',
  'file.share.titleWithName': '外发分享：{name}',
  'file.share.createFailed': '创建外发分享失败',
  'file.share.missingFileId':
    '该文件缺少物理文件 ID，无法创建外发链接，请刷新后重试',
  'file.share.copied': '链接与提取码已复制',
  'file.share.copyDenied': '浏览器拒绝访问剪贴板，请手动选中复制',
  'file.share.again': '再创建一个',
  'file.share.done': '完成',
  'file.share.generate': '生成链接',
  'file.share.resultTitle': '外发链接已生成',
  'file.share.resultSubTitle': '提取码不会再次显示，请立即复制并转达给对方',
  'file.share.field.url': '分享链接',
  'file.share.field.code': '提取码',
  'file.share.field.expireAt': '有效期至',
  'file.share.field.downloadLimit': '可下载次数',
  'file.share.times': '{count} 次',
  'file.share.copyBoth': '复制链接和提取码',
  'file.share.approvalRequiredTitle': '机密级文件：外发前需先通过管理员审批',
  'file.share.approvalRequiredDescription':
    '机密级文件的外发以「已通过的高敏感审批单」为前提，直接生成链接会被服务端拒绝（403 / 1003）。请先在列表里对该文件提交权限申请，审批通过后再回到这里。',
  'file.share.warningTitle': '外发链接等价于把文件送出内网',
  'file.share.warningDescription':
    '链接凭提取码即可免登录访问，所有下载都会留痕；密级为机密的文件需先通过外发审批，否则会被服务端拒绝（403 / 1003）。',
  'file.share.block.audience': '谁可以访问',
  'file.share.audience.link': '凭链接访问',
  'file.share.audience.linkHint':
    '任何拿到链接与提取码的人都能免登录查看，适合发给外部合作方；不做身份识别，因此更适合「一次性、限次数」的场景。',
  'file.share.audience.member': '指定接收人',
  'file.share.audience.memberHint':
    '按邮箱、手机号或组织架构精确授权，仅被授权人可见。需要服务端提供内部授权接口，当前 CE 版未提供，因此这一项不可选。',
  'file.share.block.policy': '权限与安全策略',
  'file.share.field.codeLabel': '访问密码（提取码）',
  'file.share.field.codeRequired': '请输入提取码',
  'file.share.field.codeRule': '提取码需 {min}~{max} 位字母或数字',
  'file.share.field.codeExtra':
    '服务端只保存散列值，关闭弹窗后无法再回显；忘记只能作废链接后重建',
  'file.share.field.codePlaceholder': '6~32 位字母数字',
  'file.share.random': '随机',
  'file.share.copy': '复制',
  'file.share.codeMissing': '请先生成或填写提取码',
  'file.share.codeCopied': '提取码已复制',
  'file.share.field.limitLabel': '下载次数上限',
  'file.share.field.limitRequired': '请输入下载次数上限',
  'file.share.field.limitExtra':
    '达到上限后链接自动失效；撤销链接可立即作废已签发的下载票据',
  'file.share.trace.label': '下载全程留痕',
  'file.share.trace.description':
    '强制开启：每次下载记录账号（免登录访客记 IP 与 UA）、时间与文件，可在审计日志追溯，不可关闭。',
  'file.share.watermark.label': '预览叠加动态水印',
  'file.share.watermark.description':
    '需要服务端下发水印开关与渲染能力，当前 CE 版未提供；此处不勾选即表示该文件的外发链接没有水印保护。',
  'file.share.block.expire': '有效期',
  'file.share.field.expireLabel': '链接有效时长',
  'file.share.field.expireRequired': '请选择有效期',
  'file.share.field.expireExtra':
    '按「生成时刻 + N 天」计算，上限 {max} 天，超出会被服务端拒绝',
};
