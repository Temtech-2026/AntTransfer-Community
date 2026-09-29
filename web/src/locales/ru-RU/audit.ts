/** Тексты журнала аудита. */
export default {
  /* ============================ Каркас страницы ============================ */
  'audit.page.title': 'Журнал аудита',
  'audit.page.subTitle':
    'Поиск только для чтения (при записи данные уже обезличены)',

  /* ============================ Нет прав ============================ */
  'audit.denied.title': 'Доступен только аудитору',
  'audit.denied.subTitle':
    'Для этой страницы нужна точка прав audit:log:read, которая выдаётся только роли аудитора.',

  /* ============================ Подсказка о правилах поиска ============================ */
  'audit.criteria.title': 'Правила поиска',
  'audit.criteria.operatorPrefix': 'Оператор ищется только по ',
  'audit.criteria.operatorStrong': 'точному совпадению ID пользователя',
  'audit.criteria.operatorSuffix':
    ' (нечёткий поиск по отображаемому имени бэкенд не поддерживает); ',
  'audit.criteria.timePrefix':
    'Интервал времени задаётся включительно и фильтруется по времени события (',
  'audit.criteria.timeSuffix': '); ',
  'audit.criteria.export':
    'Экспорт использует текущие условия поиска, верхнюю границу задаёт сервер.',

  /* ============================ Панель инструментов и подсказки ============================ */
  'audit.toolbar.export': 'Экспорт CSV',
  'audit.export.success': 'Экспорт начал скачиваться',

  /* ============================ Фильтры ============================ */
  'audit.filter.all': 'Все',
  'audit.filter.allActions': 'Все действия',

  /* ============================ Столбцы ============================ */
  'audit.column.logTime': 'Время',
  'audit.column.timeRange': 'Интервал времени',
  'audit.column.timeRangeStart': 'С (включительно)',
  'audit.column.endTime': 'Время окончания',
  'audit.column.timeRangeEnd': 'По (включительно)',
  'audit.column.operator': 'Оператор',
  'audit.column.operatorIdPlaceholder': 'ID пользователя (точное совпадение)',
  'audit.column.action': 'Тип операции',
  'audit.column.module': 'Домен',
  'audit.column.targetType': 'Тип объекта',
  'audit.column.target': 'Объект операции',
  'audit.column.result': 'Результат',
  'audit.column.ip': 'IP',
  'audit.column.traceId': 'ID трассировки',
  'audit.column.detail': 'Подробности',

  /* ============================ Результат ============================ */
  'audit.result.success': 'Успешно',
  'audit.result.failed': 'Ошибка',
  'audit.result.unknown': 'Неизвестно',

  /* ============================ Подстановка для оператора ============================ */
  'audit.operator.deletedUser': 'Удалённый пользователь #{userId}',
  'audit.operator.system': 'Система / аноним',
  /* ============================ Группы действий ============================ */
  'audit.actionGroup.file': 'Файлы и каталоги',
  'audit.actionGroup.share': 'Внешний общий доступ',
  'audit.actionGroup.userRole': 'Пользователи и роли',
  'audit.actionGroup.approval': 'Согласование и авторизация',

  /* ==================== Названия действий (зеркало серверных констант) ==================== */
  'audit.action.FILE_UPLOAD': 'Загрузка файла',
  'audit.action.FILE_DOWNLOAD': 'Скачивание файла',
  'audit.action.FILE_PREVIEW': 'Просмотр файла',
  'audit.action.FILE_RENAME': 'Переименование файла',
  'audit.action.FILE_MOVE': 'Перемещение файла',
  'audit.action.FILE_COPY': 'Копирование файла',
  'audit.action.FILE_DELETE': 'Перемещение в корзину',
  'audit.action.FILE_RESTORE': 'Восстановление из корзины',
  'audit.action.FILE_DESTROY': 'Полное уничтожение',
  'audit.action.RECYCLE_PURGE': 'Очистка корзины по истечении срока',
  'audit.action.FILE_TICKET_ISSUE': 'Выдача билета на скачивание',
  'audit.action.FOLDER_CREATE': 'Создание каталога',
  'audit.action.FOLDER_RENAME': 'Переименование каталога',
  'audit.action.FOLDER_MOVE': 'Перемещение каталога',
  'audit.action.FOLDER_DELETE': 'Удаление каталога',
  'audit.action.FILE_TAG': 'Простановка / снятие тега',
  'audit.action.VERSION_ROLLBACK': 'Откат к прошлой версии',
  'audit.action.VERSION_CREATE': 'Загрузка новой версии',
  'audit.action.VERSION_PRUNE': 'Сокращение числа версий',
  'audit.action.PACK_CREATE': 'Запуск пакетной упаковки',
  'audit.action.PACK_DOWNLOAD': 'Скачивание упакованного архива',
  'audit.action.SHARE_CREATE': 'Создание ссылки общего доступа',
  'audit.action.SHARE_REVOKE': 'Отзыв ссылки общего доступа',
  'audit.action.SHARE_DOWNLOAD': 'Скачивание гостем',
  'audit.action.SHARE_PREVIEW': 'Просмотр гостем',
  'audit.action.SHARE_BLOCKED': 'Блокировка внешней передачи',
  'audit.action.SHARE_CODE_LOCKED': 'Блокировка по коду извлечения',
  'audit.action.USER_CREATE': 'Создание пользователя',
  'audit.action.USER_UPDATE': 'Изменение пользователя',
  'audit.action.USER_DELETE': 'Удаление пользователя',
  'audit.action.USER_STATUS': 'Включение / отключение пользователя',
  'audit.action.USER_PASSWORD_RESET': 'Сброс пароля',
  'audit.action.USER_ROLE_ASSIGN': 'Изменение ролей пользователя',
  'audit.action.ROLE_CREATE': 'Создание роли',
  'audit.action.ROLE_UPDATE': 'Изменение роли',
  'audit.action.ROLE_DELETE': 'Удаление роли',
  'audit.action.ROLE_PERM_ASSIGN': 'Изменение прав роли',
  'audit.action.APPLY': 'Подача заявки',
  'audit.action.APPROVE': 'Согласование',
  'audit.action.REJECT': 'Отклонение',
  'audit.action.TRANSFER': 'Передача согласования',
  'audit.action.GRANT': 'Выдача авторизации',
  'audit.action.REVOKE': 'Отзыв авторизации',
  'audit.action.GRANT_EXPIRE': 'Отзыв авторизации по истечении срока',

  /* ============================ Домен ============================ */
  'audit.module.AUTH': 'Аутентификация',
  'audit.module.PERMISSION': 'Права и системное управление',
  'audit.module.TRANSFER': 'Передача',
  'audit.module.FILE': 'Файлы',
  'audit.module.COLLABORATION': 'Совместная работа',
  'audit.module.COMMON': 'Общее',

  /* ============================ Тип объекта операции ============================ */
  'audit.target.SHARE': 'Внешняя ссылка',
  'audit.target.FILE': 'Запись файла',
  'audit.target.FOLDER': 'Каталог',
  'audit.target.TAG': 'Тег',
  'audit.target.PACK_TASK': 'Задача упаковки',
  'audit.target.USER': 'Учётная запись пользователя',
  'audit.target.ROLE': 'Роль',
  'audit.target.PERMISSION': 'Точка прав',
  'audit.target.APPLICATION': 'Заявка на права',
  'audit.target.GRANT': 'Запись авторизации',
  'audit.target.SYSTEM': 'Системная задача',
} as const;
