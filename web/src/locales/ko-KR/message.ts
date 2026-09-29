/** 메시지 센터(시스템 알림 + 할 일) 문구. */
export default {
  'message.title': '메시지 센터',
  'message.subtitle':
    '결재 할 일, 공유 및 보안 알림이 실시간으로 여기에 모입니다',
  'message.tab.notifications': '시스템 알림',
  'message.tab.todos': '할 일',
  'message.unread.badge': '읽지 않음 {count}',
  'message.unread.inbox': '시스템 알림 읽지 않음 {count}',
  'message.unread.todo': '미처리 할 일 {count}',

  'message.action.refresh': '새로 고침',
  'message.action.markAllRead': '모두 읽음 표시',
  'message.action.markRead': '읽음 표시',
  'message.action.markedRead': '읽음으로 표시했습니다',
  'message.action.allMarkedRead': '알림 {count}건을 읽음으로 표시했습니다',
  'message.action.allReadNoop': '읽지 않은 알림이 없습니다',
  'message.action.jump': '처리하러 가기',
  'message.action.markHandled': '처리 완료 표시',
  'message.action.handled': '처리 완료로 표시했습니다',

  'message.state.new': '신규',
  'message.state.unread': '읽지 않음',
  'message.state.read': '읽음',

  'message.connection.connecting': '실시간 연결을 설정하는 중…',
  'message.connection.reconnecting':
    '실시간 연결이 끊어졌습니다. 자동으로 다시 연결하는 중…',
  'message.connection.closed':
    '실시간 연결이 닫혔습니다. 새 메시지가 지연되어 도착합니다',
  'message.connection.reconnectNow': '지금 다시 연결',
  'message.connection.restored': '실시간 연결이 복구되었습니다',
  'message.connection.backfilled':
    '오프라인 메시지 {count}건을 추가로 받았습니다',
  'message.connection.offlineHint':
    '연결이 끊긴 동안의 메시지는 다시 연결되면 자동으로 받아옵니다',

  'message.empty.title': '메시지가 없습니다',
  'message.empty.desc':
    '결재, 공유 및 보안 알림이 실시간으로 여기에 표시됩니다',
  'message.empty.filteredTitle': '읽지 않은 메시지가 없습니다',
  'message.empty.filteredDesc':
    '“전체”로 전환하면 지난 알림을 다시 볼 수 있습니다',

  'message.todo.filter.pending': '미처리',
  'message.todo.filter.done': '처리 완료',
  'message.todo.filter.all': '전체',
  'message.todo.empty.title': '할 일이 없습니다',
  'message.todo.empty.desc': '현재 처리해야 할 결재나 알림이 없습니다',
  'message.todo.empty.doneTitle': '처리 완료 기록이 아직 없습니다',
  'message.todo.empty.doneDesc': '처리한 할 일이 여기에 기록됩니다',
  'message.todo.source.approval': '내 결재 대기',
  'message.todo.source.approvalResult': '결재 결과',
  'message.todo.source.transfer': '전송 완료',
  'message.todo.jumpMissing':
    '해당 페이지가 아직 열리지 않았습니다. 결재 센터에서 확인할 수 있습니다',

  'message.type.1': '내 결재 대기',
  'message.type.2': '결재 결과',
  'message.type.3': '링크 잠김',
  'message.type.4': '링크 만료',
  'message.type.5': '보안 알림',
  'message.type.8': '전송 완료',
  'message.type.9': '수신 확인',
  'message.type.unknown': '시스템 알림',
} as const;
