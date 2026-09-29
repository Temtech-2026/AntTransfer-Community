/** 채팅 페이지(대화 목록 + 채팅 창) 문구. */
export default {
  'chat.title': '채팅',
  'chat.subtitle': '1:1 / 그룹 대화, 실시간 송수신',

  'chat.action.refresh': '새로 고침',
  'chat.action.new': '대화 시작',
  'chat.action.send': '보내기',

  'chat.list.title': '대화',
  'chat.search.placeholder': '대화 검색',
  'chat.list.empty.title': '아직 대화가 없습니다',
  'chat.list.empty.desc':
    '“대화 시작”을 눌러 동료를 선택해 1:1 대화를 시작하거나, 그룹 ID를 입력해 그룹 대화를 시작하세요',
  'chat.list.emptyFiltered.title': '일치하는 대화가 없습니다',
  'chat.list.emptyFiltered.desc': '다른 키워드로 시도해 보세요',

  'chat.session.groupFallback': '그룹 대화 #{id}',
  'chat.session.userFallback': '사용자 #{id}',
  'chat.tag.private': '1:1',
  'chat.tag.group': '그룹',
  'chat.sender.mine': '나',

  // 읽음 표시: 말풍선 아래 읽은 사람 아바타의 접근성 문구(아이콘 정보에는 문자 대응물이 필요)
  'chat.read.by': '읽음: {names}',
  'chat.read.more': '{count}명 더 읽음',

  // 메시지 우클릭 동작: 회수(본인이 보낸 2분 이내 메시지)와 인용
  'chat.message.action.quote': '인용',
  'chat.message.action.recall': '회수',
  // 회수된 말풍선 자리 표시: “누가 회수했는지”를 씁니다.
  // 그룹 대화에서 “회수됨”만 쓰면 본인이 회수한 줄 오해합니다
  'chat.message.recalled.mine': '내가 보낸 메시지를 회수했습니다',
  'chat.message.recalled.other': '{name}님이 메시지를 회수했습니다',
  'chat.message.recall.success': '회수했습니다',
  'chat.message.recall.failed': '회수에 실패했습니다. 잠시 후 다시 시도하세요',

  // 인용 상태에서 입력창 위에 뜨는 “인용 중” 안내
  'chat.composer.quote.cancel': '인용 취소',

  // 상대방 상태: 채팅 페이지와 서랍이 같은 컴포넌트를 공유하므로 한쪽에 속하지 않습니다.
  // 세 상태 모두 글자가 필요합니다. 초록/회색/빨강 점만으로는 색각 이상 사용자에게 정보가 없습니다
  'chat.presence.online': '온라인',
  'chat.presence.offline': '오프라인',
  'chat.presence.unstable': '네트워크 상태가 좋지 않습니다',
  // 위 세 상태와 같은 줄에 표시: 상대가 입력 중이면 정적 상태보다 즉각적입니다
  'chat.typing': '상대방이 입력 중…',

  // 내 쪽 연결 품질(채팅 페이지 헤더에 항상 표시): 위의 상대방 상태와는 다른 정보입니다
  'chat.connection.open': '실시간 연결 정상',
  'chat.connection.connecting': '연결 중…',
  'chat.connection.reconnecting': '다시 연결 중…',
  'chat.connection.closed': '연결이 끊어졌습니다',
  'chat.connection.idle': '연결되지 않음',

  'chat.stream.placeholder.title': '왼쪽에서 대화를 선택해 채팅을 시작하세요',
  'chat.stream.placeholder.desc':
    '대화 기록이 실시간으로 동기화되며, 연결이 끊긴 동안의 메시지도 다시 연결되면 받아옵니다',
  'chat.stream.empty.title': '아직 메시지가 없습니다',
  'chat.stream.empty.desc': '첫 메시지로 인사를 건네 보세요',
  'chat.stream.loadMore': '이전 메시지 더 불러오기',
  'chat.stream.loadingMore': '불러오는 중…',
  'chat.stream.noMore': '더 이전 메시지가 없습니다',
  'chat.stream.loadMoreFailed':
    '이전 메시지를 불러오지 못했습니다. 다시 시도하세요',

  // 입력창 규칙: Enter 전송, Shift + Enter 줄바꿈
  'chat.composer.placeholder': '메시지 입력, Enter 전송, Shift + Enter 줄바꿈',
  'chat.composer.empty': '메시지 내용은 비워 둘 수 없습니다',
  'chat.composer.sendHint': 'Enter 전송, Shift + Enter 줄바꿈',
  'chat.composer.emoji': '이모지',
  'chat.composer.emojiPanel': '이모지 분류',
  'chat.composer.group.recent': '최근 사용',
  'chat.composer.group.smileys': '표정',
  'chat.composer.group.gestures': '손동작',
  'chat.composer.group.people': '사람과 감정',
  'chat.composer.group.animals': '동물과 자연',
  'chat.composer.group.food': '음식',
  'chat.composer.group.objects': '사물과 활동',
  'chat.composer.group.symbols': '기호',

  // @ 언급: 진입점은 그룹 대화에만 표시(1:1에는 지목 의미가 없음, ChatComposer.mentionEnabled)
  'chat.composer.mention': '멤버 언급',
  'chat.composer.mentionPanel': '언급 가능한 멤버',
  'chat.composer.mentionEmpty': '일치하는 멤버가 없습니다',
  // “나를 언급함”: 목록 요약 접두사, 배지 강조, 말풍선 표시가 같은 문구를 공유
  'chat.mention.me': '나를 언급함',

  'chat.new.title': '대화 시작',
  'chat.new.scope.label': '대화 유형',
  'chat.new.scope.private': '1:1',
  'chat.new.scope.group': '그룹',
  'chat.new.user.placeholder': '계정 또는 닉네임으로 검색',
  'chat.new.user.optionLabel': '{name}({username})',
  'chat.new.user.resolveHint':
    '상대방 로그인 계정을 입력하면 입력창을 벗어날 때 자동으로 확인합니다',
  'chat.new.user.resolved': '찾았습니다: {name}',
  'chat.new.user.notFound':
    '해당 계정에 사용할 수 있는 사용자가 없습니다. 확인 후 다시 시도하세요',
  'chat.new.target.label': '상대방 로그인 계정',
  'chat.new.target.placeholder': '상대방 로그인 계정을 입력하세요',
  'chat.new.target.required': '먼저 대화 대상을 선택하세요',
  'chat.new.target.accountRequired': '먼저 상대방 로그인 계정을 입력하세요',
  // 그룹 대화: 생성 폼(이름 + 초대 멤버)과 “내가 참여한 그룹” 진입점.
  // 기존의 “그룹 ID” 직접 입력은 제거했습니다(그룹을 만들 수도, ID를 알 수도 없던 경로)
  'chat.new.group.nameLabel': '그룹 이름',
  'chat.new.group.namePlaceholder': '그룹 이름을 입력하세요',
  'chat.new.group.nameRequired': '먼저 그룹 이름을 입력하세요',
  'chat.new.group.memberLabel': '그룹 멤버',
  'chat.new.group.memberPlaceholder': '멤버 로그인 계정 입력 후 Enter',
  'chat.new.group.memberHint': '최소 1명을 초대하세요. 본인 포함 최대 {max}명',
  'chat.new.group.memberRequired': '최소 한 명의 그룹 멤버를 초대하세요',
  'chat.new.group.memberLimit': '그룹 멤버는 최대 {max}명(본인 포함)입니다',
  'chat.new.group.firstMessageFailed':
    '그룹을 만들었지만 첫 메시지 전송에 실패했습니다. 채팅창에서 다시 보내 주세요',
  'chat.new.group.existingLabel': '내가 참여한 그룹',
  'chat.new.group.existingPlaceholder':
    '선택하면 해당 그룹으로 바로 들어갑니다',
  'chat.new.group.optionLabel': '{name}({count}명)',
  'chat.new.content.required':
    '먼저 첫 메시지를 입력하세요(대화는 전송 후 생성됩니다)',
  'chat.new.content.label': '첫 메시지',
  'chat.new.content.placeholder': '한마디 건네 보세요',
  'chat.new.submit': '시작',
  'chat.new.cancel': '취소',

  // 그룹 설정 패널(/chat 페이지와 메신저 서랍이 같은 컴포넌트를 공유).
  // 버튼 노출은 “CHAT_PERM 권한 ∧ 서버가 내려준 ability”의 결합입니다
  'chat.group.title': '그룹 설정',
  'chat.group.close': '닫기',
  'chat.group.info': '그룹 정보',
  'chat.group.name.placeholder': '그룹 이름을 입력하세요',
  'chat.group.name.required': '그룹 이름은 비워 둘 수 없습니다',
  'chat.group.name.save': '저장',
  'chat.group.name.success': '그룹 이름을 업데이트했습니다',
  'chat.group.meta': '{count}/{max}명',
  'chat.group.members.label': '그룹 멤버',
  'chat.group.emptyMembers': '멤버가 없습니다',
  'chat.group.member.unknown': '알 수 없는 멤버',
  'chat.group.member.owner': '그룹 소유자',
  'chat.group.member.admin': '관리자',
  'chat.group.member.readonly': '읽기 전용',
  'chat.group.member.joinedAt': '{time} 참여',
  'chat.group.member.remove': '내보내기',
  'chat.group.member.removeConfirmTitle': '{name}님을 그룹에서 내보낼까요?',
  'chat.group.member.removeConfirmDesc':
    '내보내면 상대방은 즉시 이 그룹의 지난 메시지를 읽을 수 없게 됩니다. 필요하면 다시 초대할 수 있습니다.',
  'chat.group.member.removed': '{name}님을 내보냈습니다',
  'chat.group.invite.label': '멤버 초대',
  'chat.group.invite.placeholder': '멤버 로그인 계정 입력 후 Enter',
  'chat.group.invite.button': '초대',
  'chat.group.invite.success': '멤버 {count}명을 초대했습니다',
  'chat.group.invite.none':
    '이미 모두 그룹에 있어 중복 초대가 필요하지 않습니다',
  'chat.group.invite.alreadyMember': '{name}님은 이미 그룹에 있습니다',
  'chat.group.invite.noCandidate': '일치하는 사용 가능한 계정이 없습니다',
  'chat.group.invite.hint': '{count}명 더 초대할 수 있습니다(상한 {max}명)',
  'chat.group.invite.full':
    '그룹 멤버가 상한({max}명)에 도달해 더 초대할 수 없습니다',
  'chat.group.invite.limit':
    '최대 {count}명 더 초대할 수 있습니다(상한 {max}명). 초대 인원을 줄여 주세요',
  'chat.group.dangerZone': '위험 작업',
  'chat.group.quit': '그룹 나가기',
  'chat.group.quitConfirmTitle': '이 그룹에서 나갈까요?',
  'chat.group.quitConfirmDesc':
    '나가면 이 그룹의 메시지를 더 이상 받지 못하고 지난 메시지도 읽을 수 없습니다. 다시 참여하려면 그룹 소유자나 관리자의 초대가 필요합니다.',
  'chat.group.quit.success': '그룹에서 나갔습니다',
  'chat.group.dissolve': '그룹 해체',
  'chat.group.dissolveConfirmTitle': '이 그룹을 해체할까요?',
  'chat.group.dissolveConfirmDesc':
    '모든 멤버가 이 그룹에 대한 접근 권한을 잃고, 지난 메시지는 서버에서 더 이상 읽을 수 없습니다.',
  'chat.group.dissolve.success': '그룹을 해체했습니다',
  'chat.group.loadFailed': '그룹 정보를 불러오지 못했습니다',

  // 상대방 정보 패널(1:1): 상대 계정 닉네임이 아니라 “내가 부르는 이름”인 비공개 메모를 바꿉니다
  'chat.peer.title': '상대방 정보',
  'chat.peer.action': '메모',
  'chat.peer.close': '닫기',
  'chat.peer.nickname.label': '닉네임: {name}',
  'chat.peer.alias.label': '메모',
  'chat.peer.alias.placeholder': '기억하기 쉬운 이름을 붙여 주세요',
  'chat.peer.alias.hint':
    '메모는 나만 볼 수 있고 상대방에게는 보이지 않으며, 상대방 계정의 닉네임도 바뀌지 않습니다.',
  'chat.peer.alias.save': '저장',
  'chat.peer.alias.clear': '메모 취소',
  'chat.peer.alias.saved': '메모를 저장했습니다',
  'chat.peer.alias.cleared': '메모를 취소했습니다',
  // 메시지 목록의 파일 카드
  'chat.fileCard.open': '파일에서 {name} 열기',

  // 첨부 용도 제한(보낸 사람이 용도 등급 / 유효 기간 / 다운로드 횟수 세 축을 설정)
  'chat.attach.policy.trigger': '용도 제한',
  'chat.attach.policy.title': '받는 사람이 이 파일을 어떻게 쓸 수 있는지',
  'chat.attach.policy.usage.label': '용도',
  'chat.attach.usage.previewOnly': '미리보기만',
  'chat.attach.usage.previewOnly.desc':
    '대화에서 온라인으로만 볼 수 있고 다운로드할 수 없습니다',
  'chat.attach.usage.downloadable': '다운로드 가능',
  'chat.attach.usage.downloadable.desc':
    '다운로드할 수 있지만 상대방의 파일에 저장되지는 않습니다',
  'chat.attach.usage.resavable': '전달·저장 가능',
  'chat.attach.usage.resavable.desc':
    '다운로드할 수 있고 상대방 자신의 파일에도 저장할 수 있습니다',
  'chat.attach.policy.expire.label': '유효 기간',
  'chat.attach.expire.days': '{days}일',
  'chat.attach.expire.never': '기간 제한 없음',
  'chat.attach.policy.limit.label': '다운로드 횟수 상한',
  'chat.attach.limit.unlimited': '횟수 제한 없음',
  'chat.attach.limit.times': '{count}회',
  'chat.attach.policy.limit.disabledHint':
    '미리보기만 할 때는 다운로드 횟수를 소모하지 않아 제한이 필요하지 않습니다',
  'chat.attach.policy.footnote':
    '철회하면 받는 사람은 즉시 더 이상 받을 수 없습니다. 이미 로컬에 내려받은 사본은 되돌릴 수 없습니다.',

  // 보낼 첨부 줄: 채팅 페이지와 서랍이 같은 컴포넌트를 공유합니다
  'chat.attach.dropHint':
    '파일 영역에서 파일을 끌어오거나, 클립을 눌러 “내 파일”에서 고르거나 이 기기의 파일을 올리세요. 파일당 최대 {size}',
  'chat.attach.remove': '보낼 파일 제거',
  'chat.attach.placeholder': '설명을 덧붙일 수 있습니다(비워 두어도 됩니다)',

  // 파일 전송 진입점(클립 → “파일 보내기” 팝업)
  'chat.attach.entry': '파일 보내기',
  'chat.attach.modalTitle': '파일 보내기',
  'chat.attach.fromDevice': '이 기기의 파일 업로드',
  'chat.attach.uploadHint':
    '이 기기의 파일은 먼저 내 파일로 올라간 뒤 파일 메시지로 전송됩니다',
  // 크기 안내: 상한만 알리고 사전 차단은 하지 않습니다(상한은 설정 가능, 거부 판정은 서버 권한)
  'chat.attach.sizeLimit': '파일당 최대 {size}',
  'chat.attach.uploadProgress': '{name} 업로드 중({percent}%)',
  'chat.attach.uploadFailed': '업로드 실패: {name}, 다시 시도할 수 있습니다',
  'chat.attach.uploadNoNode':
    '업로드는 끝났지만 이 파일의 항목을 받지 못했습니다. “내 파일”에서 확인한 뒤 다시 선택하세요',
  'chat.attach.pickerSearch': '파일 이름 검색',
  'chat.attach.pickerEmpty': '일치하는 파일이 없습니다',
  'chat.attach.pickerFailed':
    '파일 목록을 불러오지 못했습니다. 잠시 후 다시 시도하세요',
  'chat.attach.pickerInvalid':
    '이 파일은 지금 선택할 수 없습니다. 다른 파일을 선택하세요',
  'chat.attach.pickerClose': '닫기',
  // 첨부 카드(받는 사람의 무신청 수신 / 보낸 사람의 사용량 확인)
  'chat.attachCard.preview': '미리보기',
  'chat.attachCard.download': '다운로드',
  'chat.attachCard.save': '내 파일에 저장',
  'chat.attachCard.saveSuccess': '내 파일에 저장했습니다',
  'chat.attachCard.revoke': '권한 철회',
  'chat.attachCard.revokeConfirmTitle': '이 첨부의 수신 권한을 철회할까요?',
  'chat.attachCard.revokeConfirmDesc':
    '철회하면 상대방은 즉시 더 이상 받을 수 없지만, 이미 로컬에 내려받은 사본은 되돌릴 수 없습니다.',
  'chat.attachCard.revokeOk': '권한을 철회했습니다',
  'chat.attachCard.revoked': '철회됨',
  'chat.attachCard.expired': '만료됨',
  'chat.attachCard.remaining': '{count}회 남음',
  'chat.attachCard.unlimited': '횟수 제한 없음',
  'chat.attachCard.expireAt': '{date}까지 유효',
  'chat.attachCard.neverExpire': '장기 유효',
  'chat.attachCard.previewUnsupported':
    '이 형식은 온라인 미리보기를 지원하지 않습니다. 다운로드한 뒤 확인하세요',
  // 미리보기 전용 등급에는 다운로드 진입점이 없습니다: 이때는 “다운로드 후 확인”을 권할 수 없고
  // 이 경로가 막혀 있다는 사실만 정확히 알려야 합니다
  'chat.attachCard.previewUnsupportedNoDownload':
    '이 형식은 온라인 미리보기가 안 되고 보낸 사람이 다운로드도 허용하지 않았습니다. 보낸 사람에게 다른 방식으로 받을 수 있는지 문의하세요',

  // 메신저 서랍(/chat 밖의 두 번째 진입점, 페이지 제목과 서로 묶이지 않도록 문구를 분리)
  'chat.drawer.title': '메시지',
  'chat.drawer.backToList': '대화 목록으로 돌아가기',
  'chat.drawer.refresh': '대화 목록 새로 고침',
  'chat.drawer.close': '메시지 패널 닫기',
  'chat.drawer.emptyConversations': '대화가 없습니다',
  'chat.drawer.openConversation': '{name}님과의 대화 열기',
  'chat.drawer.emptyMessages':
    '아직 메시지가 없습니다. 파일을 끌어다 놓고 한마디 보내 보세요',
  'chat.drawer.mineAvatar': '나',
  'chat.drawer.fileFallback': '[파일] {content}',
  'chat.drawer.send': '보내기',
  // 그룹 채팅: 멤버 수와 알림(그룹 설정의 스위치 세 개)
  'chat.group.memberCount': '{count}명',
  'chat.composer.mentionAll': '전체',
  'chat.group.notify.title': '메시지 알림',
  'chat.group.notify.mute': '메시지 무음',
  'chat.group.notify.mention': '누군가 나를 호출하면 알림',
  'chat.group.notify.mentionAll': '관리자가 전체를 호출하면 알림',
  'chat.group.notify.muteHint':
    '이 그룹의 메시지는 소리가 나지 않습니다. 알림 여부는 아래 두 스위치로만 결정됩니다.',
  'chat.group.notify.mentionHint':
    '이 그룹의 메시지는 평소처럼 알립니다. 아래 두 항목은 무음을 켠 뒤에만 적용됩니다.',
} as const;
