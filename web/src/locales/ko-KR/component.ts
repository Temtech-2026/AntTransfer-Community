/**
 * 전역 공용 컴포넌트 문구(상단 바 / 사이드 바 / 전역 검색 / 알림 벨 / 조직 전환 / 드롭 영역 / 태그 선택).
 *
 * <p>이 컴포넌트들은 셸 전체에 붙어 모든 페이지에서 렌더링되므로, 한 곳이라도 하드코딩된
 * 문구가 있으면 다른 언어 화면에 그대로 새어 나옵니다. 그래서 한 도메인에 모아 둡니다.</p>
 */
export default {
  'component.langSwitch': '언어 전환',

  // 태그 선택
  'component.tagSelect.expand': '펼치기',
  'component.tagSelect.collapse': '접기',
  'component.tagSelect.all': '전체',

  // 사이드 바 하단 진입점
  'component.siderFooter.messages': '메시지',
  'component.siderFooter.transfer': '전송',
  'component.siderFooter.openMessages': '메시지 패널 열기',
  'component.siderFooter.openTransfer': '전송 센터 열기',

  // 상단 바 전역 검색
  'component.globalSearch.placeholder':
    '파일 이름 / 태그 검색, Enter로 파일로 이동',
  'component.globalSearch.ariaLabel': '전역 검색',
  'component.globalSearch.scopeAria': '검색 범위 설명',
  'component.globalSearch.scopeTitle':
    '검색 범위: 파일 이름, 태그(파일 워크벤치로 이동).',
  'component.globalSearch.scopeEe':
    '파일 내용 전문 검색은 콘텐츠 추출과 색인이 필요하며 EE 기능입니다.',

  // 상단 바 사용 문서 진입점
  'component.docLink.title': '사용 문서',

  // 상단 바 이전 버전 진입점
  'component.version.history': '이전 버전',

  // 글 목록(템플릿 컴포넌트)
  'component.articleList.publishedAt': '게시 위치',

  // 프로필 드롭다운과 개인 정보
  'component.avatar.profile': '개인 정보',
  'component.avatar.changePassword': '비밀번호 변경',
  'component.avatar.logout': '로그아웃',
  'component.avatar.account': '계정',
  'component.avatar.nickname': '닉네임',
  'component.avatar.roles': '역할',

  // 개인 정보 팝업에서 본인 프로필 사진 직접 교체(업로드 즉시 적용, 폼 저장을 거치지 않음)
  // 사전 검증 실패 안내는 system.user.avatar.tooLarge / typeInvalid를 재사용합니다:
  // checkAvatarFile은 시스템 관리 도메인 이름을 딴 공용 사전 검증이라 key를 따로 두지 않습니다
  'component.avatar.avatar.upload': '프로필 사진 업로드',
  'component.avatar.avatar.hint': 'PNG / JPEG / GIF / WebP 지원, {max} 이하',
  'component.avatar.avatar.updated': '프로필 사진이 업데이트되었습니다',

  // 셀프 비밀번호 변경 팝업(성공 시 모든 세션 무효화, 반드시 다시 로그인)
  'component.avatar.changePassword.title': '비밀번호 변경',
  'component.avatar.changePassword.alert.title':
    '변경 후에는 다시 로그인해야 합니다',
  'component.avatar.changePassword.alert.desc':
    '계정 보안을 위해 비밀번호를 변경하면 모든 기기의 로그인이 즉시 무효화됩니다. 새 비밀번호로 다시 로그인하세요.',
  'component.avatar.changePassword.old': '현재 비밀번호',
  'component.avatar.changePassword.oldPlaceholder':
    '현재 비밀번호를 입력하세요',
  'component.avatar.changePassword.oldRequired': '현재 비밀번호를 입력하세요',
  'component.avatar.changePassword.new': '새 비밀번호',
  'component.avatar.changePassword.newPlaceholder': '새 비밀번호를 입력하세요',
  'component.avatar.changePassword.newRequired': '새 비밀번호를 입력하세요',
  'component.avatar.changePassword.newLength': '비밀번호는 8-64자여야 합니다',
  'component.avatar.changePassword.newPattern':
    '비밀번호는 영문과 숫자를 모두 포함해야 하며 공백을 포함할 수 없습니다',
  'component.avatar.changePassword.policyHint':
    '8-64자, 영문과 숫자를 모두 포함',
  'component.avatar.changePassword.confirm': '새 비밀번호 확인',
  'component.avatar.changePassword.confirmPlaceholder':
    '새 비밀번호를 다시 입력하세요',
  'component.avatar.changePassword.confirmRequired':
    '새 비밀번호를 다시 입력하세요',
  'component.avatar.changePassword.confirmMismatch':
    '두 번 입력한 새 비밀번호가 일치하지 않습니다',
  'component.avatar.changePassword.submit': '변경 확인',
  'component.avatar.changePassword.done':
    '비밀번호를 변경했습니다. 새 비밀번호로 다시 로그인하세요',

  // 알림 벨
  'component.notify.title': '알림',
  'component.notify.count.inbox': '알림 {count}',
  'component.notify.count.todo': '할 일 {count}',
  'component.notify.count.chat': '쪽지 {count}',
  'component.notify.markAllRead': '모두 읽음 표시',
  'component.notify.markedAllRead': '모두 읽음으로 표시했습니다',
  'component.notify.status.idle': '실시간 채널이 시작되지 않았습니다',
  'component.notify.status.connecting': '연결 중…',
  'component.notify.status.open': '실시간 알림이 연결되었습니다',
  'component.notify.status.reconnecting': '연결이 끊어졌습니다. 다시 연결 중…',
  'component.notify.status.closed': '실시간 채널이 닫혔습니다',

  // 조직 / 팀 전환기
  'component.org.defaultName': '기본 조직',
  'component.org.current': '현재 배포',
  'component.org.create': '조직 / 팀 만들기',
  'component.org.switch': '다른 조직으로 전환',
  'component.org.eeHint':
    '조직 간 데이터 완전 격리(다중 조직, 좌석 판매)는 EE 기능입니다. CE 버전은 단일 조직 자체 호스팅 배포입니다.',
  'component.org.tooltip': '현재 조직: {name}',

  // 드래그 / 클릭 파일 영역
  'component.dropZone.title': '파일을 여기로 끌어오거나 클릭하여 선택하세요',

  // 청크 업로드 컴포넌트
  'component.chunkUpload.title': '파일 업로드',
  'component.chunkUpload.busy': '{count}개 작업 진행 중',
  'component.chunkUpload.resumableCount':
    '완료되지 않은 업로드 {count}건을 찾았습니다',
  'component.chunkUpload.resumableNote':
    '중복 전송을 피하려면 같은 파일을 다시 선택하세요. 서버가 이미 받은 청크는 건너뛰고 이어서 업로드합니다.',
  'component.chunkUpload.resumableSelect': '파일을 다시 선택하여 이어올리기',
  'component.chunkUpload.instantDone': '즉시 전송 완료',
  'component.chunkUpload.instantSuccess': '즉시 전송 성공',
  'component.chunkUpload.progress.hashing': '파일 검증 값을 계산하는 중…',
  'component.chunkUpload.progress.prechecking':
    '즉시 전송 가능 여부를 확인하는 중…',
  'component.chunkUpload.progress.querying': '업로드된 청크를 조회하는 중…',
  'component.chunkUpload.progress.merging': '청크를 병합하는 중…',
  'component.chunkUpload.progress.paused':
    '일시 중지됨(완료 {received}/{total} 청크)',
  'component.chunkUpload.progress.failed': '업로드 실패',
  'component.chunkUpload.progress.uploading':
    '{received}/{total} 청크 · {speed}',
  'component.chunkUpload.progress.retried': ' · {count}회 재시도함',
  'component.chunkUpload.progress.chunks': '{count} 청크',
  'component.chunkUpload.retryTooltip':
    '네트워크가 불안정하면 지수 백오프로 자동 재시도합니다',
  'component.chunkUpload.retryTag': '재시도 {count}',
  'component.chunkUpload.draggerText':
    '클릭하거나 파일을 여기로 끌어 업로드하세요',
  'component.chunkUpload.draggerHint':
    '대용량 파일 청크 업로드, 즉시 전송, 이어올리기를 지원하며 파일별 실패 시 {count}회 자동 재시도합니다',
  'component.chunkUpload.chunkSize': '청크 크기',
  'component.chunkUpload.concurrency': '동시 실행 수',
  'component.chunkUpload.tuningNote': '변경 사항은 이후 청크부터 적용됩니다',
  'component.chunkUpload.overallProgress': '전체 진행률',
  'component.chunkUpload.overallSummary':
    '{finished}/{total}개 파일 · {uploaded} / {totalSize}',

  // 코드 블록(문서 영역의 예제 코드)
  'component.codeBlock.copy': '복사',
  'component.codeBlock.copied': '복사됨',
  'component.codeBlock.copyFailed': '복사 실패',

  // 전송 모니터 플로팅 창
  'component.transfer.title': '전송 센터',
  'component.transfer.expand': '전송 센터 펼치기',
  'component.transfer.collapse': '전송 센터 접기',
  'component.transfer.capsule': '전송 중 {count}',
  'component.transfer.summary': '{active} 진행 중 · {success} 완료',
  'component.transfer.summaryFailed': ' · {count} 실패',
  'component.transfer.pauseAll': '모두 일시 중지',
  'component.transfer.resumeAll': '모두 계속 / 실패 재시도',
  'component.transfer.clearFinished': '완료 / 취소 / 실패 항목 비우기',
  'component.transfer.fastMode': '터보 모드',
  'component.transfer.fastModeHint':
    '동시 청크 수를 계약 상한인 5로 올립니다. 진행 중인 작업에도 동일하게 적용되며, 업로드 페이지에서 고른 동시 실행 수는 이 스위치가 덮어씁니다.',
  'component.transfer.empty': '전송 작업이 없습니다',
  'component.transfer.chartAria': '전송 속도 그래프',
  'component.transfer.pause': '일시 중지',
  'component.transfer.resumeRetry': '계속 / 재시도',
  'component.transfer.pauseNamed': '{name} 일시 중지',
  'component.transfer.resumeNamed': '{name} 계속',
  'component.transfer.status.active': '전송 중',
  'component.transfer.status.paused': '일시 중지됨',
  'component.transfer.status.error': '실패',
  'component.transfer.status.success': '완료됨',
  'component.transfer.status.canceled': '취소됨',
  // 새 메시지 알림음(프로필 안; 음색과 스위치가 같은 접두사를 공유)
  'component.avatar.notifySound.title': '새 메시지 알림음',
  'component.avatar.notifySound.enabled': '새 메시지가 오면 알림음을 재생',
  'component.avatar.notifySound.presetLabel': '음색',
  'component.avatar.notifySound.preset.default': '기본',
  'component.avatar.notifySound.preset.chime': '차임',
  'component.avatar.notifySound.preset.bubble': '버블',
  'component.avatar.notifySound.preset.custom': '사용자 지정',
  'component.avatar.notifySound.upload': '오디오 업로드',
  'component.avatar.notifySound.replace': '오디오 교체',
  'component.avatar.notifySound.clear': '삭제',
  'component.avatar.notifySound.preview': '미리 듣기',
  'component.avatar.notifySound.uploaded':
    '업로드했습니다. 음색을 사용자 지정으로 전환했습니다',
  'component.avatar.notifySound.cleared': '사용자 지정 알림음을 삭제했습니다',
  'component.avatar.notifySound.loadFailed':
    '알림음 설정을 불러오지 못했습니다',
  'component.avatar.notifySound.typeInvalid':
    'MP3 / WAV / OGG 형식의 오디오만 지원합니다',
  'component.avatar.notifySound.tooLarge': '오디오는 {max}를 넘을 수 없습니다',
  'component.avatar.notifySound.previewBlocked':
    '브라우저가 자동 재생을 차단했습니다. 페이지를 한 번 클릭한 뒤 다시 시도해 주세요',
  'component.avatar.notifySound.customEmpty': '아직 업로드한 오디오가 없습니다',
  'component.avatar.notifySound.customMeta':
    '현재 오디오: {name}({size}, {duration})',
  'component.avatar.notifySound.hint':
    'MP3 / WAV / OGG 지원, {maxSize} 이하, 길이 {maxDuration} 이하',
} as const;
