export default {
  'app.network.offline': '오프라인 상태입니다. 일부 기능을 사용할 수 없습니다',
  'app.error.chunk.title': '페이지를 불러오지 못했습니다',
  'app.error.chunk.description.offline':
    '네트워크 연결이 끊어졌습니다. 네트워크를 확인한 뒤 다시 불러와 주세요.',
  'app.error.chunk.description.online':
    '페이지 리소스를 불러오지 못했습니다. 다시 불러와 주세요.',
  'app.error.render.title': '페이지에 오류가 발생했습니다',
  'app.error.render.description':
    '죄송합니다. 페이지에 문제가 발생했습니다. 새로 고침하거나 홈으로 돌아가 주세요.',
  'app.error.retry': '다시 시도',
  'app.error.reload': '페이지 새로 고침',
  'app.error.home': '홈으로 돌아가기',
  'app.request.offline':
    '네트워크를 사용할 수 없습니다. 연결을 확인한 뒤 다시 시도해 주세요.',
  // 拿不到响应体时的兜底文案（services/request 的 XHR 通道与全局 errorHandler 共用同一口径）
  'app.request.default':
    '네트워크 오류입니다. 네트워크를 확인한 뒤 다시 시도해 주세요',
  'app.request.http': '{message}(HTTP {status})',
  'app.request.retryLater': '{message}. 잠시 후 다시 시도해 주세요',
  'app.request.traceId': 'traceId: {traceId}',
  'app.request.failed': '요청 실패',
  'app.request.aborted': '요청이 취소되었습니다',
  'app.request.timeout':
    '요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요',
  'app.request.parseFailed': '응답 파싱 실패',
};
