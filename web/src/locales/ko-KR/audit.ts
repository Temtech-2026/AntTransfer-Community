/** 감사 로그 문구. */
export default {
  /* ============================ 页面骨架 ============================ */
  'audit.page.title': '감사 로그',
  'audit.page.subTitle': '읽기 전용 조회(쓰기 측은 이미 마스킹됨)',

  /* ============================ 无权限 ============================ */
  'audit.denied.title': '감사자만 접근할 수 있습니다',
  'audit.denied.subTitle':
    '이 페이지는 audit:log:read 권한이 필요하며, 해당 권한은 감사자 역할에만 부여됩니다.',

  /* ============================ 检索口径提示 ============================ */
  'audit.criteria.title': '조회 기준',
  'audit.criteria.operatorPrefix': '작업자는 ',
  'audit.criteria.operatorStrong': '사용자 ID 정확 일치',
  'audit.criteria.operatorSuffix':
    '만 지원합니다(백엔드가 표시 이름 부분 검색을 제공하지 않습니다). ',
  'audit.criteria.timePrefix': '시간 구간은 폐구간이며 이벤트 시간(',
  'audit.criteria.timeSuffix': ')을 기준으로 필터링합니다. ',
  'audit.criteria.export':
    '내보내기는 현재 조회 조건을 따르며 상한은 서버에서 제어합니다.',

  /* ============================ 工具栏与提示 ============================ */
  'audit.toolbar.export': 'CSV 내보내기',
  'audit.export.success': '내보내기 다운로드가 시작되었습니다',

  /* ============================ 筛选器 ============================ */
  'audit.filter.all': '전체',
  'audit.filter.allActions': '전체 동작',

  /* ============================ 列 ============================ */
  'audit.column.logTime': '시간',
  'audit.column.timeRange': '시간 구간',
  'audit.column.timeRangeStart': '시작(포함)',
  'audit.column.endTime': '종료 시간',
  'audit.column.timeRangeEnd': '종료(포함)',
  'audit.column.operator': '작업자',
  'audit.column.operatorIdPlaceholder': '사용자 ID(정확 일치)',
  'audit.column.action': '동작 유형',
  'audit.column.module': '소속 도메인',
  'audit.column.targetType': '객체 유형',
  'audit.column.target': '작업 대상',
  'audit.column.result': '결과',
  'audit.column.ip': 'IP',
  'audit.column.traceId': '트레이스 ID',
  'audit.column.detail': '상세',

  /* ============================ 结果 ============================ */
  'audit.result.success': '성공',
  'audit.result.failed': '실패',
  'audit.result.unknown': '알 수 없음',

  /* ============================ 操作人兜底 ============================ */
  'audit.operator.deletedUser': '탈퇴한 사용자 #{userId}',
  'audit.operator.system': '시스템 / 익명',

  /* ============================ 动作分组 ============================ */
  'audit.actionGroup.file': '파일 및 디렉터리',
  'audit.actionGroup.share': '외부 공유',
  'audit.actionGroup.userRole': '사용자 및 역할',
  'audit.actionGroup.approval': '결재 및 권한',

  /* ============================ 动作名（镜像后端常量） ============================ */
  'audit.action.FILE_UPLOAD': '파일 업로드',
  'audit.action.FILE_DOWNLOAD': '파일 다운로드',
  'audit.action.FILE_PREVIEW': '파일 미리보기',
  'audit.action.FILE_RENAME': '파일 이름 변경',
  'audit.action.FILE_MOVE': '파일 이동',
  'audit.action.FILE_COPY': '파일 복사',
  'audit.action.FILE_DELETE': '휴지통으로 이동',
  'audit.action.FILE_RESTORE': '휴지통에서 복원',
  'audit.action.FILE_DESTROY': '완전 삭제',
  'audit.action.RECYCLE_PURGE': '휴지통 만료 정리',
  'audit.action.FILE_TICKET_ISSUE': '다운로드 티켓 발급',
  'audit.action.FOLDER_CREATE': '디렉터리 생성',
  'audit.action.FOLDER_RENAME': '디렉터리 이름 변경',
  'audit.action.FOLDER_MOVE': '디렉터리 이동',
  'audit.action.FOLDER_DELETE': '디렉터리 삭제',
  'audit.action.FILE_TAG': '태그 지정 / 해제',
  'audit.action.VERSION_ROLLBACK': '이전 버전으로 되돌리기',
  'audit.action.VERSION_CREATE': '새 버전 업로드',
  'audit.action.VERSION_PRUNE': '버전 정리',
  'audit.action.PACK_CREATE': '일괄 압축 시작',
  'audit.action.PACK_DOWNLOAD': '압축 결과 다운로드',
  'audit.action.SHARE_CREATE': '공유 생성',
  'audit.action.SHARE_REVOKE': '공유 취소',
  'audit.action.SHARE_DOWNLOAD': '방문자 다운로드',
  'audit.action.SHARE_PREVIEW': '방문자 미리보기',
  'audit.action.SHARE_BLOCKED': '외부 전송 차단',
  'audit.action.SHARE_CODE_LOCKED': '추출 코드 잠김',
  'audit.action.USER_CREATE': '사용자 생성',
  'audit.action.USER_UPDATE': '사용자 수정',
  'audit.action.USER_DELETE': '사용자 삭제',
  'audit.action.USER_STATUS': '사용자 활성/비활성',
  'audit.action.USER_PASSWORD_RESET': '비밀번호 재설정',
  'audit.action.USER_ROLE_ASSIGN': '사용자 역할 변경',
  'audit.action.ROLE_CREATE': '역할 생성',
  'audit.action.ROLE_UPDATE': '역할 수정',
  'audit.action.ROLE_DELETE': '역할 삭제',
  'audit.action.ROLE_PERM_ASSIGN': '역할 권한 조정',
  'audit.action.APPLY': '신청 제출',
  'audit.action.APPROVE': '결재 승인',
  'audit.action.REJECT': '결재 반려',
  'audit.action.TRANSFER': '결재 전결',
  'audit.action.GRANT': '권한 부여 적용',
  'audit.action.REVOKE': '권한 회수',
  'audit.action.GRANT_EXPIRE': '권한 만료 회수',

  /* ============================ 所属域 ============================ */
  'audit.module.AUTH': '인증',
  'audit.module.PERMISSION': '권한 및 시스템 관리',
  'audit.module.TRANSFER': '전송',
  'audit.module.FILE': '파일',
  'audit.module.COLLABORATION': '협업',
  'audit.module.COMMON': '공통',

  /* ============================ 操作对象类型 ============================ */
  'audit.target.SHARE': '외부 공유 링크',
  'audit.target.FILE': '파일 항목',
  'audit.target.FOLDER': '디렉터리',
  'audit.target.TAG': '태그',
  'audit.target.PACK_TASK': '압축 작업',
  'audit.target.USER': '사용자 계정',
  'audit.target.ROLE': '역할',
  'audit.target.PERMISSION': '권한 포인트',
  'audit.target.APPLICATION': '권한 신청서',
  'audit.target.GRANT': '권한 부여 기록',
  'audit.target.SYSTEM': '시스템 작업',
} as const;
