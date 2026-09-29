export default {
  'app.network.offline':
    'Нет подключения к сети, часть функций может быть недоступна',
  'app.error.chunk.title': 'Не удалось загрузить страницу',
  'app.error.chunk.description.offline':
    'Сетевое соединение потеряно. Проверьте сеть и перезагрузите страницу.',
  'app.error.chunk.description.online':
    'Не удалось загрузить ресурсы страницы. Перезагрузите её и повторите попытку.',
  'app.error.render.title': 'На странице произошла ошибка',
  'app.error.render.description':
    'Извините, на странице возникла проблема. Обновите страницу или вернитесь на главную.',
  'app.error.retry': 'Повторить',
  'app.error.reload': 'Обновить страницу',
  'app.error.home': 'На главную',
  'app.request.offline':
    'Сеть недоступна. Проверьте соединение и повторите попытку.',
  // Текст-подстраховка на случай, когда тело ответа получить не удалось
  // (единый источник для XHR-канала services/request и глобального errorHandler)
  'app.request.default':
    'Ошибка сети. Проверьте соединение и повторите попытку',
  'app.request.http': '{message} (HTTP {status})',
  'app.request.retryLater': '{message}. Повторите попытку позже',
  'app.request.traceId': 'traceId: {traceId}',
  'app.request.failed': 'Запрос не выполнен',
  'app.request.aborted': 'Запрос отменён',
  'app.request.timeout':
    'Превышено время ожидания запроса, повторите попытку позже',
  'app.request.parseFailed': 'Не удалось разобрать ответ',
};
