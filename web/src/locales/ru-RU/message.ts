/** Тексты центра сообщений (системные уведомления + задачи). */
export default {
  'message.title': 'Центр сообщений',
  'message.subtitle':
    'Задачи согласования, общий доступ и предупреждения безопасности собираются здесь в реальном времени',
  'message.tab.notifications': 'Системные уведомления',
  'message.tab.todos': 'Задачи',
  'message.unread.badge': 'Непрочитанных: {count}',
  'message.unread.inbox': 'Непрочитанных системных уведомлений: {count}',
  'message.unread.todo': 'Незавершённых задач: {count}',

  'message.action.refresh': 'Обновить',
  'message.action.markAllRead': 'Отметить все как прочитанные',
  'message.action.markRead': 'Отметить как прочитанное',
  'message.action.markedRead': 'Отмечено как прочитанное',
  'message.action.allMarkedRead':
    'Уведомлений отмечено как прочитанные: {count}',
  'message.action.allReadNoop': 'Нет непрочитанных уведомлений',
  'message.action.jump': 'Перейти к обработке',
  'message.action.markHandled': 'Отметить как выполненное',
  'message.action.handled': 'Отмечено как выполненное',

  'message.state.new': 'Новое',
  'message.state.unread': 'Непрочитанное',
  'message.state.read': 'Прочитанное',

  'message.connection.connecting':
    'Устанавливается соединение в реальном времени…',
  'message.connection.reconnecting':
    'Соединение в реальном времени разорвано, выполняется автоматическое переподключение…',
  'message.connection.closed':
    'Соединение в реальном времени закрыто, новые сообщения будут приходить с задержкой',
  'message.connection.reconnectNow': 'Переподключиться сейчас',
  'message.connection.restored': 'Соединение в реальном времени восстановлено',
  'message.connection.backfilled': 'Дозагружено пропущенных сообщений: {count}',
  'message.connection.offlineHint':
    'Сообщения за время обрыва связи будут автоматически дозагружены после переподключения',

  'message.empty.title': 'Сообщений пока нет',
  'message.empty.desc':
    'Согласования, общий доступ и предупреждения безопасности появляются здесь в реальном времени',
  'message.empty.filteredTitle': 'Нет непрочитанных сообщений',
  'message.empty.filteredDesc':
    'Переключитесь на «Все», чтобы просмотреть прошлые уведомления',

  'message.todo.filter.pending': 'Не выполнено',
  'message.todo.filter.done': 'Выполнено',
  'message.todo.filter.all': 'Все',
  'message.todo.empty.title': 'Задач пока нет',
  'message.todo.empty.desc':
    'Сейчас нет согласований или напоминаний, требующих вашего действия',
  'message.todo.empty.doneTitle': 'Записей о выполненных задачах пока нет',
  'message.todo.empty.doneDesc': 'Обработанные задачи сохраняются здесь',
  'message.todo.source.approval': 'Ожидают моего согласования',
  'message.todo.source.approvalResult': 'Результат согласования',
  'message.todo.source.transfer': 'Передача завершена',
  'message.todo.jumpMissing':
    'Соответствующая страница пока недоступна, данные можно посмотреть в центре согласований',

  'message.type.1': 'Ожидают моего согласования',
  'message.type.2': 'Результат согласования',
  'message.type.3': 'Ссылка заблокирована',
  'message.type.4': 'Истёк срок ссылки',
  'message.type.5': 'Предупреждение безопасности',
  'message.type.8': 'Передача завершена',
  'message.type.9': 'Подтверждение получения',
  'message.type.unknown': 'Системное уведомление',
} as const;
