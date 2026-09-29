/**
 * 파일 도메인 문구: 워크벤치 / 목록 / 그리드 / 휴지통 / 미리보기 / 외부 공유 / 이동 / 권한 신청 / 업로드 팝업.
 *
 * <p>`services/file`의 표시용 함수는 id만 반환하고(순수 함수, 단위 테스트 가능),
 * 실제 문구는 모두 여기에 둡니다. 같은 문장을 서비스 계층과 컴포넌트 계층에 중복해 두지 않기 위함입니다.</p>
 */
export default {
  /* ============================ 등급 ============================ */
  'file.level.public': '공개',
  'file.level.internal': '내부',
  'file.level.classified': '기밀',
  'file.level.unknown': '미분류',
  'file.level.applyHint.classified':
    '이 파일은 기밀 등급입니다. 신청은 다단계 결재로 진행되며 다운로드와 외부 전송 권한은 부여되지 않고 필요 시에만 미리보기가 임시로 열립니다.',
  'file.level.applyHint.internal':
    '이 파일은 내부 등급입니다. 신청은 기본적으로 미리보기와 다운로드만 부여하며 외부 공유는 별도 결재가 필요합니다.',
  'file.level.applyHint.public':
    '이 파일은 공개 등급입니다. 결재가 비교적 빠르지만 실제 사용 목적은 반드시 작성해야 합니다.',
  'file.level.applyHint.unknown':
    '이 파일은 아직 기밀 등급이 없습니다. 결재자가 먼저 기밀 등급 지정을 요구할 수 있습니다.',

  /* ============================ 보안 배지 ============================ */
  'file.security.classified.label': '기밀',
  'file.security.classified.hint':
    '기밀 등급: 미리보기에 워터마크가 겹쳐지고 다운로드가 전부 기록되며, 외부 전송 전에 반드시 결재를 통과해야 합니다',
  'file.security.watermark.label': '워터마크',
  'file.security.watermark.hint':
    '미리보기와 다운로드 화면에 동적 워터마크(계정과 시간 포함)가 겹쳐져 유출 추적에 사용됩니다',
  'file.security.expiring.label': '{days}일 후 만료',
  'file.security.expiring.hint':
    '이 항목은 {days}일 후 만료되며, 그때 링크와 권한이 함께 무효화됩니다',
  'file.security.expired.label': '만료됨',
  'file.security.expired.hint':
    '이 항목은 만료 시간이 지났습니다. 계속 사용하려면 권한을 다시 신청하세요',

  /* ============================ 확장자 그룹 ============================ */
  'file.extGroup.doc': '문서',
  'file.extGroup.image': '이미지',
  'file.extGroup.video': '동영상',
  'file.extGroup.audio': '오디오',
  'file.extGroup.archive': '압축 파일',

  /* ============================ 공유 상태 ============================ */
  'file.shareStatus.active': '유효',
  'file.shareStatus.revoked': '철회됨',
  'file.shareStatus.expired': '만료됨',
  'file.shareStatus.unknown': '알 수 없음',

  /* ============================ 권한 신청 유형 ============================ */
  'file.applyType.access.label': '접근(미리보기)',
  'file.applyType.access.hint':
    '온라인 미리보기만 가능하며 다운로드나 외부 전송은 불가',
  'file.applyType.download.label': '다운로드',
  'file.applyType.download.hint':
    '원본을 내려받을 수 있으며 사용 기록이 남습니다',
  'file.applyType.edit.label': '편집',
  'file.applyType.edit.hint': '이름 변경 / 이동 / 새 버전 추가 가능',
  'file.applyType.share.label': '외부 공유',
  'file.applyType.share.hint': '외부 링크를 만들 수 있으며 위험이 가장 큽니다',

  /* ============================ 동작 ============================ */
  'file.action.preview': '미리보기',
  'file.action.download': '다운로드',
  'file.action.share': '공유',
  'file.action.sendToChat': '채팅으로 보내기',
  'file.action.applyPerm': '권한 신청',
  'file.action.delete': '삭제',
  'file.action.restore': '복원',
  'file.action.destroy': '완전 삭제',
  'file.action.move': '이동',
  'file.action.recycle': '휴지통으로 이동',
  'file.action.clearSelection': '선택 해제',
  'file.action.more': '더보기',
  'file.action.upload': '파일 업로드',
  'file.action.enterRecycle': '휴지통',
  'file.action.backToFiles': '내 파일로 돌아가기',
  'file.action.emptyRecycle': '휴지통 비우기',
  'file.action.permission': '권한',
  'file.action.refresh': '새로 고침',

  /* ============================ 페이지 구조 ============================ */
  'file.title': '파일',
  'file.subtitle': '디렉터리, 기밀 등급 및 유형 필터',
  'file.section.myFiles': '내 파일',
  'file.section.recycle': '휴지통',
  'file.breadcrumb.all': '전체 파일',
  'file.folder.children': '하위 디렉터리:',
  'file.folder.empty': '현재 디렉터리에 하위 디렉터리가 없습니다',
  'file.folder.root': '전체 파일(루트 디렉터리)',

  /* ============================ 표 열 ============================ */
  'file.column.name': '파일 이름',
  'file.column.ext': '유형',
  'file.column.level': '기밀 등급',
  'file.column.size': '크기',
  'file.column.updateTime': '업데이트 시간',
  'file.column.recycleTime': '휴지통 이동',
  'file.column.action': '작업',
  'file.recycle.today': '오늘',
  'file.recycle.daysAgo': '{days}일 경과',

  /* ============================ 조회와 보기 ============================ */
  'file.query.name': '파일 이름',
  'file.query.namePlaceholder': '파일 이름 키워드',
  'file.query.ext': '유형',
  'file.query.extAll': '전체 유형',
  'file.query.level': '기밀 등급',
  'file.query.levelAll': '전체 기밀 등급',
  'file.query.createTime': '생성 시간',
  'file.query.submit': '조회',
  'file.query.reset': '초기화',
  'file.view.list': '목록',
  'file.view.grid': '그리드',
  'file.total': '총 {total}건',
  'file.selectedCount': '{count}건 선택됨',
  'file.uploadingCount': '업로드 중 {count}',
  'file.grid.emptyRecycle': '휴지통이 비어 있습니다',
  'file.grid.emptyFolder':
    '현재 디렉터리에 파일이 없습니다. 업로드하거나 하위 디렉터리를 먼저 만드세요',
  /* ============================ 다운로드 ============================ */
  'file.download.preparing': '{name} 다운로드를 준비하는 중',
  'file.download.done':
    '{name} 다운로드가 시작되었습니다. 브라우저 다운로드 목록에서 확인하세요',
  'file.download.failed': '다운로드 실패',

  /* ============================ 휴지통과 완전 삭제 ============================ */
  'file.recycle.confirmTitle': '“{name}”을 휴지통으로 옮길까요?',
  'file.recycle.confirmContent':
    '휴지통으로 옮기면 “내 파일”에 더 이상 표시되지 않지만 언제든 복원할 수 있고 데이터는 사라지지 않습니다.',
  'file.destroy.confirmTitle': '“{name}”을 완전히 삭제할까요?',
  'file.destroy.confirmContent':
    '파일 실체와 모든 청크가 영구 삭제되고 휴지통에도 남지 않으며, 이 작업은 되돌릴 수 없습니다.',
  'file.restore.done': '“{name}”을 복원했습니다',
  'file.empty.confirmTitle': '휴지통을 비울까요?',
  'file.empty.confirmContent':
    '휴지통의 모든 파일이 완전히 삭제되어 복구할 수 없습니다. 잠시 쓰지 않는 것뿐이라면 휴지통에 두는 편이 좋습니다.',
  'file.empty.done': '{count}개 항목을 삭제했습니다',
  'file.empty.noop': '휴지통은 이미 비어 있습니다',
  'file.batchRecycle.confirmTitle':
    '선택한 {count}개 항목을 휴지통으로 옮길까요?',
  'file.batchRecycle.confirmContent':
    '휴지통으로 옮기면 “내 파일”에 더 이상 표시되지 않지만 언제든 복원할 수 있고 데이터는 사라지지 않습니다.',
  'file.batchRecycle.done': '{count}개 항목을 휴지통으로 옮겼습니다',
  'file.batchRecycle.noop': '휴지통으로 옮겨진 항목이 없습니다',
  'file.recycle.alertTitle': '휴지통',
  'file.recycle.alertDescription':
    '휴지통의 파일은 “내 파일”에 더 이상 표시되지 않습니다. 여기서 복원하거나 완전히 삭제할 수 있습니다(복구 불가). 완전 삭제에는 file:destroy 권한이 필요합니다.',
  'file.recycle.noFilterHint':
    '휴지통은 키워드와 기밀 등급 필터를 지원하지 않습니다. 여기 항목은 이미 디렉터리에서 벗어나 있어 필터 결과가 오해를 부를 수 있습니다',
  'file.batch.shareMultiHint':
    '외부 링크는 한 번에 하나의 항목에만 만들 수 있습니다. 먼저 하나만 선택하세요',
  'file.batch.applyMultiHint':
    '권한 신청은 한 번에 하나의 항목에만 가능합니다. 먼저 하나만 선택하세요',

  /* ============================ 미리보기 ============================ */
  'file.preview.title': '미리보기',
  'file.preview.strategy.text': '텍스트',
  'file.preview.strategy.pdf': 'PDF',
  'file.preview.strategy.image': '이미지',
  'file.preview.strategy.downloadOnly': '다운로드만',
  'file.preview.strategy.none': '지원 안 함',
  'file.preview.failedTitle': '미리보기 실패',
  'file.preview.loadFailed': '미리보기 정보를 불러오지 못했습니다',
  'file.preview.empty': '미리보기 내용이 없습니다',
  'file.preview.truncated':
    '내용이 길어 앞부분 일부만 표시합니다. 전체 내용은 다운로드해 확인하세요',
  'file.preview.downloadOnlyTitle':
    '이 형식은 온라인 미리보기를 지원하지 않습니다',
  'file.preview.downloadOnlyDescription':
    '유출 위험을 줄이기 위해 이 형식은 서버에서 변환하지 않습니다. 다운로드한 뒤 로컬에서 여세요.',
  'file.preview.downloadFile': '파일 다운로드',
  'file.preview.unavailableTitle': '미리보기 불가',
  'file.preview.unavailableDescription':
    '서버가 사용할 수 있는 미리보기 방식을 제공하지 않았습니다. 형식이 지원되지 않거나 미리보기 기능이 꺼져 있을 수 있습니다.',

  /* ============================ 이동 ============================ */
  'file.move.title': '이동 위치',
  'file.move.ok': '이동',
  'file.move.alertTitle': '이동은 보관 위치만 바꿉니다',
  'file.move.alertDescription':
    '기밀 등급, 공유 링크, 이미 부여된 권한은 이동해도 바뀌지 않습니다.',
  'file.move.placeholder': '대상 디렉터리 선택',
  'file.move.pending': '이동할 항목 {count}개',
  'file.move.pendingNames': ': {names}',
  'file.move.etc': ' 외',
  'file.move.unchanged':
    '(그 외 {count}개 항목은 이미 대상 디렉터리에 있어 건너뜁니다)',
  'file.move.noop': '대상 디렉터리가 현재 위치와 같아 이동할 필요가 없습니다',
  'file.move.done': '{count}개 항목을 “{target}”으로 옮겼습니다',
  'file.move.failed': '{count}개 항목 이동 실패: {names}',
  /* ============================ 권한 신청 ============================ */
  'file.apply.title': '파일 권한 신청',
  'file.apply.submitFailed': '신청 제출 실패',
  'file.apply.submittedTitle': '신청을 제출했습니다',
  'file.apply.submittedSubTitle':
    '신청 번호: {no}, “내 신청”에서 진행 상황을 확인할 수 있습니다',
  'file.apply.submittedExtra':
    '승인되면 권한이 자동으로 적용되므로 다시 제출할 필요가 없습니다. 반려된 경우 결재 의견을 확인한 뒤 보충 설명을 더해 다시 제출하세요.',
  'file.apply.field.file': '신청 파일',
  'file.apply.field.level': '파일 기밀 등급',
  'file.apply.levelAlertTitle': '민감 등급 안내',
  'file.apply.field.applyType': '권한 유형',
  'file.apply.field.applyTypeRequired': '권한 유형을 선택하세요',
  'file.apply.field.purpose': '사용 목적',
  'file.apply.field.purposeRequired': '사용 목적을 입력하세요',
  'file.apply.field.purposeMin':
    '결재자가 판단할 수 있도록 최소 10자 이상 입력하세요',
  'file.apply.field.purposeMax': '최대 500자',
  'file.apply.field.purposePlaceholder':
    '예: 분기 경영 분석 보고서의 데이터 검증에 사용하며 본인만 사용하고 외부로 보내지 않습니다',
  'file.apply.field.expireAt': '희망 유효 기간',
  'file.apply.field.expireAtExtra':
    '비워 두면 장기 권한 신청으로 간주되어 승인이 더 어렵습니다. 실제 필요에 맞게 입력하면 만료 시 자동으로 회수됩니다',
  'file.apply.field.expireAtPlaceholder': '만료 시간 선택',
  'file.apply.footnote':
    '제출 후 신청자 신원과 신청 시간은 서버가 기록하며, 다른 사람을 대신해 신청할 수 없습니다.',
  'file.apply.submit': '신청 제출',

  /* ============================ 외부 공유 팝업 ============================ */
  'file.share.presetDays': '{days}일',
  'file.share.title': '외부 공유',
  'file.share.titleWithName': '외부 공유: {name}',
  'file.share.createFailed': '외부 공유 생성 실패',
  'file.share.missingFileId':
    '이 파일에 물리 파일 ID가 없어 외부 링크를 만들 수 없습니다. 새로 고침 후 다시 시도하세요',
  'file.share.copied': '링크와 추출 코드를 복사했습니다',
  'file.share.copyDenied':
    '브라우저가 클립보드 접근을 거부했습니다. 직접 선택해 복사하세요',
  'file.share.again': '하나 더 만들기',
  'file.share.done': '완료',
  'file.share.generate': '링크 생성',
  'file.share.resultTitle': '외부 링크가 생성되었습니다',
  'file.share.resultSubTitle':
    '추출 코드는 다시 표시되지 않습니다. 지금 복사해 상대방에게 전달하세요',
  'file.share.field.url': '공유 링크',
  'file.share.field.code': '추출 코드',
  'file.share.field.expireAt': '유효 기간 만료',
  'file.share.field.downloadLimit': '다운로드 가능 횟수',
  'file.share.times': '{count}회',
  'file.share.copyBoth': '링크와 추출 코드 복사',
  'file.share.approvalRequiredTitle':
    '기밀 등급 파일: 외부 전송 전에 관리자 승인이 필요합니다',
  'file.share.approvalRequiredDescription':
    '기밀 등급 파일의 외부 전송은 “승인된 고민감도 결재 건”을 전제로 하며, 링크를 바로 만들면 서버가 거부합니다(403 / 1003). 먼저 목록에서 해당 파일의 권한을 신청하고, 승인된 뒤에 다시 이곳으로 오세요.',
  'file.share.warningTitle':
    '외부 링크는 파일을 사내망 밖으로 내보내는 것과 같습니다',
  'file.share.warningDescription':
    '링크는 추출 코드만 있으면 로그인 없이 접근할 수 있고 모든 다운로드가 기록됩니다. 기밀 등급 파일은 외부 전송 결재를 먼저 통과해야 하며, 그렇지 않으면 서버가 거부합니다(403 / 1003).',
  'file.share.block.audience': '누가 접근할 수 있는지',
  'file.share.audience.link': '링크를 가진 사람',
  'file.share.audience.linkHint':
    '링크와 추출 코드를 가진 사람은 누구나 로그인 없이 볼 수 있어 외부 협력사에 보내기 적합합니다. 신원 확인을 하지 않으므로 “일회성, 횟수 제한” 상황에 더 알맞습니다.',
  'file.share.audience.member': '지정 수신자',
  'file.share.audience.memberHint':
    '이메일, 휴대폰 번호 또는 조직도 기준으로 정확히 권한을 부여하고 지정된 사람만 볼 수 있습니다. 서버의 내부 권한 부여 API가 필요하지만 현재 CE 버전에는 없어 선택할 수 없습니다.',
  'file.share.block.policy': '권한 및 보안 정책',
  'file.share.field.codeLabel': '접근 비밀번호(추출 코드)',
  'file.share.field.codeRequired': '추출 코드를 입력하세요',
  'file.share.field.codeRule':
    '추출 코드는 {min}~{max}자리의 영문 또는 숫자여야 합니다',
  'file.share.field.codeExtra':
    '서버는 해시 값만 저장하므로 팝업을 닫으면 다시 볼 수 없습니다. 잊으면 링크를 무효화하고 다시 만들어야 합니다',
  'file.share.field.codePlaceholder': '6~32자리 영문·숫자',
  'file.share.random': '무작위',
  'file.share.copy': '복사',
  'file.share.codeMissing': '먼저 추출 코드를 생성하거나 입력하세요',
  'file.share.codeCopied': '추출 코드를 복사했습니다',
  'file.share.field.limitLabel': '다운로드 횟수 상한',
  'file.share.field.limitRequired': '다운로드 횟수 상한을 입력하세요',
  'file.share.field.limitExtra':
    '상한에 도달하면 링크가 자동으로 무효화됩니다. 링크를 철회하면 이미 발급된 다운로드 티켓도 즉시 무효가 됩니다',
  'file.share.trace.label': '다운로드 전 과정 기록',
  'file.share.trace.description':
    '강제 적용: 다운로드마다 계정(비로그인 방문자는 IP와 UA), 시간, 파일을 기록하며 감사 로그에서 추적할 수 있고 끌 수 없습니다.',
  'file.share.watermark.label': '미리보기에 동적 워터마크',
  'file.share.watermark.description':
    '서버가 워터마크 스위치와 렌더링 기능을 제공해야 하며 현재 CE 버전에는 없습니다. 여기서 선택하지 않으면 해당 파일의 외부 링크에는 워터마크 보호가 없다는 뜻입니다.',
  'file.share.block.expire': '유효 기간',
  'file.share.field.expireLabel': '링크 유효 기간',
  'file.share.field.expireRequired': '유효 기간을 선택하세요',
  'file.share.field.expireExtra':
    '“생성 시각 + N일”로 계산하며 상한은 {max}일이고, 초과하면 서버가 거부합니다',
};
