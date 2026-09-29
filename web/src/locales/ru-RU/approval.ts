/** Тексты центра согласований (задачи / завершённые / детали / решение). */
export default {
  // Страница
  'approval.title': 'Центр согласований',
  'approval.subtitle':
    'Ожидают моего согласования и поданные мной заявки на права',
  'approval.tab.pending': 'Ожидают меня',
  'approval.tab.mine': 'Мои заявки',
  'approval.slaNotice':
    'SLA рассчитывается по уровню конфиденциальности (открытый — 24 ч / внутренний — 12 ч / конфиденциальный — 4 ч); просрочка только напоминает и не приводит к автоматическому согласованию или выдаче прав.',
  'approval.decisionSubmitted': 'Результат согласования отправлен',
  'approval.longTerm': 'Бессрочно',

  // Столбцы списка
  'approval.column.applicationNo': 'Номер заявки',
  'approval.column.applyAction': 'Запрошенное действие',
  'approval.column.level': 'Уровень конфиденциальности',
  'approval.column.resource': 'Ресурс',
  'approval.column.applicant': 'Заявитель',
  'approval.column.purpose': 'Цель использования',
  'approval.column.desiredExpireAt': 'Желаемый срок',
  'approval.column.sla': 'SLA',
  'approval.column.status': 'Статус',
  'approval.column.opinion': 'Решение согласующего',
  'approval.column.createdAt': 'Время подачи',
  'approval.column.actions': 'Действия',

  // Действия в строке
  'approval.rowAction.detail': 'Подробнее',
  'approval.rowAction.approve': 'Согласовать',
  'approval.rowAction.reject': 'Отклонить',

  // Статусы заявки
  'approval.status.pending': 'Ожидает согласования',
  'approval.status.approved': 'Согласовано',
  'approval.status.rejected': 'Отклонено',
  'approval.status.transferred': 'Передано другому согласующему',
  'approval.status.cancelled': 'Отозвано',
  'approval.status.unknown': 'Неизвестно',

  // Действия авторизации
  'approval.grantAction.access': 'Доступ (просмотр)',
  'approval.grantAction.download': 'Скачивание',
  'approval.grantAction.edit': 'Редактирование',
  'approval.grantAction.share': 'Внешний общий доступ',
  'approval.grantAction.unknown': 'Неизвестное действие',

  // SLA (обратный отсчёт и предельный срок)
  'approval.sla.noDeadline': '--',
  'approval.sla.overdue.days': 'Просрочено на {days} дн. {hours} ч.',
  'approval.sla.overdue.hours': 'Просрочено на {hours} ч. {minutes} мин.',
  'approval.sla.overdue.minutes': 'Просрочено на {minutes} мин.',
  'approval.sla.tooltip':
    'Обработать до {deadline} (просрочка только напоминает, права автоматически не выдаются)',

  // Панель деталей
  'approval.detail.title': 'Детали заявки',
  'approval.detail.slaDeadline': 'Срок: {deadline}',
  'approval.detail.timeline': 'История обработки',
  'approval.timeline.submit': 'Заявка подана',
  'approval.timeline.purpose': 'Цель: {purpose}',
  'approval.timeline.approved': 'Согласовано',
  'approval.timeline.rejected': 'Отклонено',
  'approval.timeline.transferred': 'Передано другому согласующему',
  'approval.timeline.cancelled': 'Отозвано заявителем',
  'approval.timeline.pending': 'Ожидает согласования',

  // Окно решения
  'approval.modal.approveTitle': 'Согласовать',
  'approval.modal.rejectTitle': 'Отклонить заявку',
  'approval.modal.approveOk': 'Подтвердить согласование',
  'approval.modal.rejectOk': 'Подтвердить отклонение',
  'approval.modal.applicationNo': 'Номер заявки: {no}',
  'approval.modal.applyScope': 'Запрошено: {action}',
  'approval.modal.desiredExpireAt': 'Желаемый срок: {at}',
  'approval.modal.grantScope':
    'Объём авторизации (можно только сузить, превысить заявку нельзя)',
  'approval.modal.grantScopeDownscoped':
    'Уже, чем запрошенное действие «{action}» — авторизация будет выдана в меньшем объёме',
  'approval.modal.grantScopeSame': 'Совпадает с объёмом заявки',
  'approval.modal.grantScopePlaceholder': 'Выберите действие авторизации',
  'approval.modal.expireAt':
    'Срок авторизации (можно только сократить, превысить значение заявки нельзя)',
  'approval.modal.expireCapped':
    'Выбранное время позже желаемого заявителем — будет сокращено до {expireAt}',
  'approval.modal.expireKeep': 'Пусто — бессрочно',
  'approval.modal.expirePlaceholder': 'Пусто — бессрочно',
  'approval.modal.opinionApprove': 'Комментарий согласующего (необязательно)',
  'approval.modal.opinionReject': 'Причина отклонения (обязательно)',
  'approval.modal.opinionMax': 'Не более {max} символов',
  'approval.modal.opinionRequired': 'Укажите причину отклонения',
  'approval.modal.opinionPlaceholderApprove':
    'Можно пояснить условия авторизации',
  'approval.modal.opinionPlaceholderReject':
    'Опишите причину отклонения — она будет передана заявителю',
  'approval.modal.notice':
    'После согласования авторизация действует сразу: объём и срок нельзя расширить, для расширения заявитель должен подать новую заявку.',
  'approval.modal.approved': 'Заявка согласована',
  'approval.modal.rejected': 'Заявка отклонена',
  'approval.modal.approveFailed': 'Не удалось согласовать',
  'approval.modal.rejectFailed': 'Не удалось отклонить',
} as const;
