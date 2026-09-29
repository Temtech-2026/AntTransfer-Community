/** Тексты карты прав (матрица «ресурс × субъект» / шкала авторизаций). */
export default {
  /* ============================ Каркас страницы ============================ */
  'permissionMap.page.title': 'Карта прав',
  'permissionMap.page.subTitle': 'Мои точки прав, их источники и срок действия',
  'permissionMap.loadFailed': 'Не удалось загрузить карту прав',

  /* ============================ Карточки обзора ============================ */
  'permissionMap.stat.perm.title': 'Точки прав',
  'permissionMap.stat.perm.footer': 'Бэкенд сообщает только наличие права',
  'permissionMap.stat.role.title': 'Роли',
  'permissionMap.stat.role.footer': 'Один из известных источников точек прав',
  'permissionMap.stat.grant.title': 'Авторизация по согласованию',
  'permissionMap.stat.grant.footer': 'Из них просрочено: {expired}',
  'permissionMap.stat.expiring.footer': 'Истекают в течение 7 дней',

  /* ============================ Обзор прав ============================ */
  'permissionMap.overview.title': 'Обзор прав',
  'permissionMap.overview.subTitle':
    'Пользователь, область данных и точки прав',
  'permissionMap.overview.userId': 'ID пользователя',
  'permissionMap.overview.dataScope': 'Область данных',
  'permissionMap.overview.roles': 'Роли',
  'permissionMap.overview.grants': 'Авторизация по согласованию',
  'permissionMap.grant.total': 'Всего: {total}',
  'permissionMap.grant.expiringSuffix': '{count} истекают скоро',
  'permissionMap.grant.expiredSuffix': '{count} просрочено',
  'permissionMap.permCodes.title': 'Точки прав ({count})',
  'permissionMap.permCodes.desc':
    'Бэкенд сообщает только наличие права, источник по каждой точке появится в следующих версиях API; ниже приведены два известных источника — роли и авторизация по согласованию.',
  'permissionMap.permCodes.empty': 'Точек прав пока нет',

  /* ============================ Таблица источников авторизации ============================ */
  'permissionMap.grants.title': 'Источники авторизации',
  'permissionMap.grants.subTitle':
    'Всего записей авторизации по согласованию: {count}',
  'permissionMap.grants.empty': 'Авторизаций по согласованию пока нет',
  'permissionMap.column.source': 'Источник',
  'permissionMap.column.grantType': 'Действие авторизации',
  'permissionMap.column.resource': 'Ресурс',
  'permissionMap.column.application': 'Исходная заявка',
  'permissionMap.column.expireAt': 'Действует до',
  'permissionMap.column.validity': 'Статус срока действия',
  'permissionMap.source.approval': 'Авторизация по согласованию',

  /* ============================ Шкала сроков действия ============================ */
  'permissionMap.timeline.title': 'Шкала сроков действия',
  'permissionMap.timeline.subTitle':
    'Ось сроков: авторизация действует с момента записи в базу',
  'permissionMap.timeline.expirePrefix': 'Истекает',
  'permissionMap.timeline.fromApplication': 'Исходная заявка №{id}',
  'permissionMap.timeline.empty': 'Нет авторизаций с ограниченным сроком',

  /* ============================ Распределение статусов авторизации (визуализация) ============================ */
  'permissionMap.distribution.title': 'Распределение по статусам авторизации',
  'permissionMap.distribution.subTitle':
    'Всего записей авторизации по согласованию: {count}, сгруппировано по статусу срока действия',
  'permissionMap.distribution.empty':
    'Авторизаций по согласованию нет, распределение построить нельзя',
  'permissionMap.distribution.percent': '{percent}%',
  'permissionMap.validity.barTip':
    'Осталось {days} дн.; длина полосы — визуальная шкала с верхней границей {horizon} дн. (бэкенд не передаёт время начала действия, поэтому долю «использованного» срока построить нельзя)',

  /* ============================ Статусы авторизации и оставшиеся дни ============================ */
  'permissionMap.grantState.active': 'Действует',
  'permissionMap.grantState.expiring': 'Скоро истекает',
  'permissionMap.grantState.expired': 'Просрочено',
  'permissionMap.grantState.permanent': 'Бессрочно',
  'permissionMap.remainDays': 'Осталось {days} дн.',

  /* ============================ Распределение по доменам прав (группировка на фронтенде по префиксу) ============================ */
  'permissionMap.permCodes.domainTitle': 'Распределение по доменам прав',
  'permissionMap.permCodes.domainDesc':
    'Группировка на стороне фронтенда по префиксу до `:` в точке прав (поля «домен» на бэкенде нет); длина полосы — относительно самой многочисленной группы.',
  'permissionMap.permCodes.domainOther': 'Прочее',
  'permissionMap.permCodes.domainCount': '{count} шт.',
} as const;
