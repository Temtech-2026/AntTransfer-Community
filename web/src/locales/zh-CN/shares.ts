/** 分享管理页与创建外发分享弹窗文案。 */
export default {
  /* ============================ 页面 ============================ */
  'shares.page.title': '分享管理',
  'shares.page.subtitle': '我创建的外发链接；提取码不回显，取消后不可恢复',
  'shares.denied': '当前账号没有外发分享权限（file:share），请联系管理员开通',
  'shares.table.title': '我的分享',

  /* ============================ 动作 ============================ */
  'shares.action.create': '创建分享',
  'shares.action.copy': '复制链接',
  'shares.action.revoke': '取消分享',

  /* ============================ 复制 ============================ */
  'shares.copy.success': '链接已复制；提取码不会回显，请沿用创建时的提取码',
  'shares.copy.manualTitle': '请手动复制链接',
  'shares.copy.disabled': '仅生效中的分享可复制',

  /* ============================ 撤销 ============================ */
  'shares.revoke.success': '分享已取消，链接立即失效',
  'shares.revoke.confirmTitle': '取消这个分享链接？',
  'shares.revoke.confirmContent':
    '取消后链接立即失效，已发给对方的提取码一并作废。如需再次外发，只能重新创建并生成新链接。',
  'shares.revoke.confirmOk': '确认取消分享',

  /* ==================== 批量失效（行复选框 / 一键全部） ==================== */
  'shares.action.revokeSelected': '失效所选',
  'shares.action.revokeSelectedCount': '失效所选（{count}）',
  'shares.action.revokeAll': '失效全部',
  'shares.revokeBatch.success': '已失效 {count} 条分享链接',
  'shares.revoke.none': '没有生效中的分享链接',
  'shares.revokeSelected.confirmTitle': '失效选中的 {count} 条分享？',
  'shares.revokeSelected.confirmContent':
    '选中的链接立即失效，已发给对方的提取码一并作废。失效是终态，不可恢复。',
  'shares.revokeSelected.confirmOk': '确认失效所选',
  'shares.revokeAll.confirmTitle': '失效全部生效中的分享？',
  'shares.revokeAll.confirmContent':
    '将失效当前账号下所有「生效中」的链接（不止本页），已发给对方的链接与提取码会立即作废。失效是终态，不可恢复。',
  'shares.revokeAll.confirmOk': '确认全部失效',

  /* ============================ 创建成功 ============================ */
  'shares.created.title': '分享已创建',
  'shares.created.ok': '我知道了',
  'shares.created.code': '提取码：',
  'shares.created.note':
    '服务端只保存提取码散列，关闭本窗口后无法再次查看，请立即转达给对方。',

  /* ============================ 表格列 ============================ */
  'shares.column.deletedFile': '（文件已删除）',
  'shares.column.status': '状态',
  'shares.column.expireAt': '有效期至',
  'shares.column.used': '已用次数',
  'shares.column.unlimited': '不限',
  'shares.column.remaining': '剩余次数',
  'shares.column.extractCode': '提取码',
  'shares.column.extractOn': '已开启',
  'shares.column.extractOff': '未开启',
  'shares.column.createTime': '创建时间',

  /* ============================ 创建弹窗 ============================ */
  'shares.create.title': '创建外发分享',
  'shares.create.file': '外发文件',
  'shares.create.filePlaceholder': '输入文件名搜索',
  'shares.create.fileRequired': '请选择要外发的文件',
  'shares.create.fileNotFound': '没有匹配的文件',
  'shares.create.expire': '有效期',
  'shares.create.expireRequired': '请选择有效期',
  'shares.create.expireExtra': '最长 {days} 天，到期后链接自动失效',
  'shares.create.downloadLimit': '下载次数上限',
  'shares.create.downloadLimitRequired': '请输入下载次数上限',
  'shares.create.downloadLimitExtra': '1 ~ {max} 次，用完后链接自动失效',
  'shares.create.extractCode': '提取码',
  'shares.create.extractCodeRequired': '请输入提取码',
  'shares.create.extractCodeRule': '提取码需为 {min}~{max} 位字母或数字',
  'shares.create.extractCodeExtra':
    '服务端只保存散列，创建成功后请立即转达给对方，之后无法再次查看',

  /* ==================== 访客取件页（/share/:token，免登录） ==================== */
  'shares.visit.subtitle': '有人通过 AntTransfer 向你发送了文件，输入提取码即可取件',
  'shares.visit.invalidLink': '链接不完整：缺少分享令牌，请确认复制的是完整链接',
  'shares.visit.code.label': '提取码',
  'shares.visit.code.placeholder': '请输入邮件或聊天里收到的提取码',
  'shares.visit.code.prefilled': '已自动填入链接里的提取码，确认后点击「提取文件」',
  'shares.visit.code.required': '请输入提取码',
  'shares.visit.submit': '提取文件',
  'shares.visit.redeemed': '提取成功，点击下方按钮下载',
  'shares.visit.ticketTtl':
    '下载地址在 {minutes} 分钟内有效；过期后需重新提取，并会再消耗一次取件次数',
  'shares.visit.unknownFile': '（未获取到文件名）',
  'shares.visit.download': '下载文件',
  'shares.visit.footer': '链接仅限持有提取码的人取件，请勿转发给无关人员',
} as const;
