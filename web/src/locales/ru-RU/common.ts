/**
 * Общие тексты интерфейса (скелетоны / пустые состояния / подтверждение опасных действий / прогресс загрузки).
 *
 * <p>Они лежат в `locales`, а не в компонентах, чтобы «единые компоненты опыта» не отставали
 * при смене языка: эти компоненты переиспользуются на бизнес-страницах, и любая
 * захардкоженная строка вылезет на экране с другим языком.
 */
export default {
  // Пустые состояния
  'common.empty.noData': 'Нет данных',
  'common.empty.noResult.title': 'Нет совпадающих результатов',
  'common.empty.noResult.desc':
    'Попробуйте изменить условия фильтра или очистить ключевые слова и выполнить поиск заново',
  'common.empty.error.title': 'Не удалось загрузить',
  'common.empty.error.desc': 'Ошибка сети или сервиса, повторите попытку позже',
  'common.empty.error.action': 'Перезагрузить',
  'common.empty.denied.title': 'Нет прав доступа',
  'common.empty.denied.desc':
    'У текущей учётной записи нет этого права; при необходимости обратитесь к администратору',

  // Подтверждение опасных действий
  'common.danger.title': 'Подтвердите действие',
  'common.danger.irreversible':
    'Это действие необратимо. Подтвердите, чтобы продолжить.',
  'common.danger.ok': 'Выполнить',
  'common.danger.cancel': 'Отмена',

  // Общие действия и разделитель для всех модулей
  // (чтобы не дублировать строки и не «протекал» исходный язык интерфейса)
  'common.action.cancel': 'Отмена',
  'common.action.confirm': 'Подтвердить',
  'common.action.ok': 'Хорошо',
  'common.action.gotIt': 'Понятно',
  'common.action.close': 'Закрыть',
  'common.action.submit': 'Отправить',
  'common.action.save': 'Сохранить',
  'common.action.retry': 'Повторить',
  'common.action.copy': 'Копировать',
  'common.action.copied': 'Скопировано',
  'common.action.selectAll': 'Выбрать все',
  'common.action.clear': 'Очистить',
  'common.action.refresh': 'Обновить',
  'common.listSeparator': ', ',
  'common.etcCount': 'и ещё {count}',

  // Глобальный прогресс загрузки
  'common.upload.title': 'Задачи загрузки',
  'common.upload.summary': 'Загружается: {active} · всего: {total}',
  'common.upload.idle': 'Активных загрузок нет',
  'common.upload.failed': 'Не удалось: {count}',
  'common.upload.percent': 'Общий прогресс {percent}%',
  'common.upload.openPage': 'Открыть страницу загрузки',
  'common.upload.viewQueue': 'Посмотреть',
  'common.upload.queue.default': 'Загрузка по частям',
  'common.upload.queue.file-workbench': 'Рабочая среда файлов',
  // «Загрузить локальный файл» в чате: страница и панель используют каждая свою
  // очередь (см. заголовок ChatAttachmentPicker — одинаковый id связал бы их
  // колбэки завершения), но группа описывает одно и то же, поэтому текст общий
  'common.upload.queue.chat-send': 'Отправка файла в чате',
  'common.upload.queue.chat-send-drawer': 'Отправка файла в чате',
  'common.upload.queue.unknown': 'Задача загрузки',
  'common.upload.status.working': 'Загрузка',
  'common.upload.status.paused': 'Приостановлено',
  'common.upload.status.success': 'Завершено',
  'common.upload.status.error': 'Ошибка',
  'common.upload.status.canceled': 'Отменено',
  'common.upload.status.instant': 'Мгновенная передача завершена',
} as const;
