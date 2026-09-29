/** 외부 공유(공유 관리 / 생성 / 방문자 수신) 문구. */
export default {
  /* ============================ 分享管理页 ============================ */
  'shares.page.title': '공유 관리',
  'shares.page.subtitle':
    '내가 만든 외부 공유 링크. 추출 코드는 다시 표시되지 않으며, 취소 후에는 복구할 수 없습니다',
  'shares.denied':
    '현재 계정에 외부 공유 권한(file:share)이 없습니다. 관리자에게 문의하세요',
  'shares.table.title': '내 공유',

  /* ============================ 行内操作 ============================ */
  'shares.action.create': '공유 만들기',
  'shares.action.copy': '링크 복사',
  'shares.action.revoke': '공유 취소',
  'shares.copy.success':
    '링크를 복사했습니다. 추출 코드는 다시 표시되지 않으니 생성 시의 코드를 사용하세요',
  'shares.copy.manualTitle': '링크를 직접 복사하세요',
  'shares.copy.disabled': '유효한 공유만 복사할 수 있습니다',
  'shares.revoke.success': '공유를 취소했습니다. 링크가 즉시 무효화됩니다',
  'shares.revoke.confirmTitle': '이 공유 링크를 취소할까요?',
  'shares.revoke.confirmContent':
    '취소하면 링크가 즉시 무효화되고, 상대방에게 전달한 추출 코드도 함께 무효가 됩니다. 다시 외부로 보내려면 새로 만들어 새 링크를 발급해야 합니다.',
  'shares.revoke.confirmOk': '공유 취소 확인',

  /* ============================ 批量失效 ============================ */
  'shares.action.revokeSelected': '선택 항목 무효화',
  'shares.action.revokeSelectedCount': '선택 항목 무효화({count})',
  'shares.action.revokeAll': '전체 무효화',
  'shares.revokeBatch.success': '공유 링크 {count}건을 무효화했습니다',
  'shares.revoke.none': '유효한 공유 링크가 없습니다',
  'shares.revokeSelected.confirmTitle': '선택한 공유 {count}건을 무효화할까요?',
  'shares.revokeSelected.confirmContent':
    '선택한 링크가 즉시 무효화되고, 상대방에게 전달한 추출 코드도 함께 무효가 됩니다. 무효화는 최종 상태이며 되돌릴 수 없습니다.',
  'shares.revokeSelected.confirmOk': '선택 항목 무효화 확인',
  'shares.revokeAll.confirmTitle': '유효한 공유를 모두 무효화할까요?',
  'shares.revokeAll.confirmContent':
    '현재 계정의 모든 “유효” 링크(이 페이지뿐 아니라 전체)를 무효화합니다. 상대방에게 전달한 링크와 추출 코드가 즉시 무효가 됩니다. 무효화는 최종 상태이며 되돌릴 수 없습니다.',
  'shares.revokeAll.confirmOk': '전체 무효화 확인',

  /* ============================ 创建成功回执（提取码只此一次） ============================ */
  'shares.created.title': '공유가 생성되었습니다',
  'shares.created.ok': '알겠습니다',
  'shares.created.code': '추출 코드:',
  'shares.created.note':
    '서버는 추출 코드의 해시만 저장하므로 이 창을 닫으면 다시 볼 수 없습니다. 지금 바로 상대방에게 전달하세요.',

  /* ============================ 列表列 ============================ */
  'shares.column.deletedFile': '(파일이 삭제됨)',
  'shares.column.status': '상태',
  'shares.column.expireAt': '유효 기간',
  'shares.column.used': '사용 횟수',
  'shares.column.unlimited': '제한 없음',
  'shares.column.remaining': '남은 횟수',
  'shares.column.extractCode': '추출 코드',
  'shares.column.extractOn': '사용',
  'shares.column.extractOff': '미사용',
  'shares.column.createTime': '생성 시간',

  /* ============================ 创建弹窗 ============================ */
  'shares.create.title': '외부 공유 만들기',
  'shares.create.file': '외부 전송 파일',
  'shares.create.filePlaceholder': '파일 이름으로 검색',
  'shares.create.fileRequired': '외부로 보낼 파일을 선택하세요',
  'shares.create.fileNotFound': '일치하는 파일이 없습니다',
  'shares.create.expire': '유효 기간',
  'shares.create.expireRequired': '유효 기간을 선택하세요',
  'shares.create.expireExtra':
    '최대 {days}일, 만료 후 링크가 자동으로 무효화됩니다',
  'shares.create.downloadLimit': '다운로드 횟수 상한',
  'shares.create.downloadLimitRequired': '다운로드 횟수 상한을 입력하세요',
  'shares.create.downloadLimitExtra':
    '1~{max}회, 모두 사용하면 링크가 자동으로 무효화됩니다',
  'shares.create.extractCode': '추출 코드',
  'shares.create.extractCodeRequired': '추출 코드를 입력하세요',
  'shares.create.extractCodeRule':
    '추출 코드는 {min}~{max}자리의 영문 또는 숫자여야 합니다',
  'shares.create.extractCodeExtra':
    '서버는 해시만 저장하므로 생성 후 즉시 상대방에게 전달하세요. 이후에는 다시 볼 수 없습니다',

  /* ============================ 访客收件页 ============================ */
  'shares.visit.subtitle':
    '누군가 AntTransfer로 파일을 보냈습니다. 추출 코드를 입력하면 받을 수 있습니다',
  'shares.visit.invalidLink':
    '링크가 불완전합니다. 공유 토큰이 없습니다. 전체 링크를 복사했는지 확인하세요',
  'shares.visit.code.label': '추출 코드',
  'shares.visit.code.placeholder':
    '메일이나 채팅으로 받은 추출 코드를 입력하세요',
  'shares.visit.code.prefilled':
    '링크의 추출 코드를 자동으로 채웠습니다. 확인 후 “파일 받기”를 클릭하세요',
  'shares.visit.code.required': '추출 코드를 입력하세요',
  'shares.visit.submit': '파일 받기',
  'shares.visit.redeemed': '수신 성공! 아래 버튼을 눌러 다운로드하세요',
  'shares.visit.ticketTtl':
    '다운로드 주소는 {minutes}분 동안 유효합니다. 만료되면 다시 받아야 하며 수신 횟수가 한 번 더 차감됩니다',
  'shares.visit.unknownFile': '(파일 이름을 가져오지 못했습니다)',
  'shares.visit.download': '파일 다운로드',
  'shares.visit.footer':
    '이 링크는 추출 코드를 가진 사람만 받을 수 있습니다. 관계없는 사람에게 전달하지 마세요',
} as const;
