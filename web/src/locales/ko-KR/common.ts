/**
 * 전역 공통 문구（骨架屏 / 空状态 / 危险操作确认 / 上传进度）。
 *
 * <p>放在 `locales` 而不是写在组件里，是为了让「统一体验组件」在切换语言时不掉队——
 * 这几个组件会被各业务页复用，任何一处硬编码中文都会让英文界面漏出中文。
 */
export default {
  // 空状态
  'common.empty.noData': '데이터가 없습니다',
  'common.empty.noResult.title': '일치하는 결과가 없습니다',
  'common.empty.noResult.desc':
    '필터 조건을 조정하거나 키워드를 지우고 다시 조회해 보세요',
  'common.empty.error.title': '불러오기 실패',
  'common.empty.error.desc':
    '네트워크 또는 서비스 오류입니다. 잠시 후 다시 시도해 주세요',
  'common.empty.error.action': '다시 불러오기',
  'common.empty.denied.title': '접근 권한 없음',
  'common.empty.denied.desc':
    '현재 계정에 이 권한이 없습니다. 필요하면 관리자에게 문의하세요',

  // 위험 작업 재확인
  'common.danger.title': '작업을 확인해 주세요',
  'common.danger.irreversible':
    '이 작업은 되돌릴 수 없습니다. 확인 후 계속해 주세요.',
  'common.danger.ok': '실행 확인',
  'common.danger.cancel': '취소',

  // 跨模块复用动作与连接符（避免每个模块各写一遍，导致界面漏出中文）
  'common.action.cancel': '취소',
  'common.action.confirm': '확인',
  'common.action.ok': '확인',
  'common.action.gotIt': '알겠습니다',
  'common.action.close': '닫기',
  'common.action.submit': '제출',
  'common.action.save': '저장',
  'common.action.retry': '다시 시도',
  'common.action.copy': '복사',
  'common.action.copied': '복사됨',
  'common.action.selectAll': '전체 선택',
  'common.action.clear': '비우기',
  'common.action.refresh': '새로 고침',
  'common.listSeparator': ', ',
  'common.etcCount': '외 {count}건',

  // 전역 업로드 진행률
  'common.upload.title': '업로드 작업',
  'common.upload.summary': '업로드 중 {active}건 · 총 {total}건',
  'common.upload.idle': '진행 중인 업로드가 없습니다',
  'common.upload.failed': '{count}건 실패',
  'common.upload.percent': '전체 진행률 {percent}%',
  'common.upload.openPage': '업로드 페이지 열기',
  'common.upload.viewQueue': '보러 가기',
  'common.upload.queue.default': '청크 업로드',
  'common.upload.queue.file-workbench': '파일 워크벤치',
  // 聊天里的「上传本机文件」：页与抽屉各用一条队列（见 ChatAttachmentPicker 文件头，
  // 同 id 会让两者的完成回调互相串），但分组名是同一件事，文案不做区分
  'common.upload.queue.chat-send': '채팅 파일 전송',
  'common.upload.queue.chat-send-drawer': '채팅 파일 전송',
  'common.upload.queue.unknown': '업로드 작업',
  'common.upload.status.working': '업로드 중',
  'common.upload.status.paused': '일시 중지됨',
  'common.upload.status.success': '완료됨',
  'common.upload.status.error': '실패',
  'common.upload.status.canceled': '취소됨',
  'common.upload.status.instant': '즉시 전송 완료',
} as const;
