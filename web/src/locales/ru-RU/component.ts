/**
 * Тексты общих компонентов (верхняя панель / боковая панель / глобальный поиск / колокольчик
 * уведомлений / переключатель организации / зона перетаскивания / выбор тегов).
 *
 * <p>Эти компоненты висят на всей оболочке и рендерятся на каждой странице, поэтому любая
 * захардкоженная строка вылезет на экране с другим языком — все тексты собраны в этом домене.</p>
 */
export default {
  'component.langSwitch': 'Переключение языка',

  // Выбор тегов
  'component.tagSelect.expand': 'Развернуть',
  'component.tagSelect.collapse': 'Свернуть',
  'component.tagSelect.all': 'Все',

  // Входы в нижней части боковой панели
  'component.siderFooter.messages': 'Сообщения',
  'component.siderFooter.transfer': 'Передача',
  'component.siderFooter.openMessages': 'Открыть панель сообщений',
  'component.siderFooter.openTransfer': 'Открыть центр передачи',

  // Глобальный поиск в верхней панели
  'component.globalSearch.placeholder':
    'Поиск по имени файла / тегу, Enter — переход к файлу',
  'component.globalSearch.ariaLabel': 'Глобальный поиск',
  'component.globalSearch.scopeAria': 'Описание области поиска',
  'component.globalSearch.scopeTitle':
    'Область поиска: имя файла, теги (переход в рабочую среду файлов).',
  'component.globalSearch.scopeEe':
    'Полнотекстовый поиск по содержимому файлов требует его извлечения и индексации и относится к возможностям EE.',

  // Вход в документацию в верхней панели
  'component.docLink.title': 'Документация',

  // Вход в историю версий в верхней панели
  'component.version.history': 'История версий',

  // Содержимое списка статей (шаблонный компонент)
  'component.articleList.publishedAt': 'Опубликовано',

  // Выпадающее меню аватара и личные данные
  'component.avatar.profile': 'Личные данные',
  'component.avatar.changePassword': 'Сменить пароль',
  'component.avatar.logout': 'Выйти',
  'component.avatar.account': 'Учётная запись',
  'component.avatar.nickname': 'Отображаемое имя',
  'component.avatar.roles': 'Роли',

  // Самостоятельная смена своего аватара в окне личных данных
  // (загрузка применяется сразу, без сохранения формы)
  // Тексты неудачной предварительной проверки переиспользуют system.user.avatar.tooLarge / typeInvalid:
  // checkAvatarFile — общая предварительная проверка с именованием по системному домену,
  // отдельный key не заводим, чтобы одна фраза не поддерживалась в двух местах
  'component.avatar.avatar.upload': 'Загрузить аватар',
  'component.avatar.avatar.hint':
    'Поддерживаются PNG / JPEG / GIF / WebP, размер не более {max}',
  'component.avatar.avatar.updated': 'Аватар обновлён',

  // Окно самостоятельной смены пароля (после успеха все сеансы сбрасываются, нужен повторный вход)
  'component.avatar.changePassword.title': 'Сменить пароль',
  'component.avatar.changePassword.alert.title':
    'После смены потребуется войти заново',
  'component.avatar.changePassword.alert.desc':
    'Для защиты учётной записи смена пароля немедленно завершает все сеансы на всех устройствах; войдите с новым паролем.',
  'component.avatar.changePassword.old': 'Текущий пароль',
  'component.avatar.changePassword.oldPlaceholder': 'Введите текущий пароль',
  'component.avatar.changePassword.oldRequired': 'Введите текущий пароль',
  'component.avatar.changePassword.new': 'Новый пароль',
  'component.avatar.changePassword.newPlaceholder': 'Введите новый пароль',
  'component.avatar.changePassword.newRequired': 'Введите новый пароль',
  'component.avatar.changePassword.newLength':
    'Длина пароля должна быть 8-64 символа',
  'component.avatar.changePassword.newPattern':
    'Пароль должен содержать буквы и цифры и не содержать пробелов',
  'component.avatar.changePassword.policyHint':
    '8-64 символа, обязательно буквы и цифры',
  'component.avatar.changePassword.confirm': 'Подтвердите новый пароль',
  'component.avatar.changePassword.confirmPlaceholder':
    'Введите новый пароль ещё раз',
  'component.avatar.changePassword.confirmRequired':
    'Введите новый пароль ещё раз',
  'component.avatar.changePassword.confirmMismatch':
    'Введённые пароли не совпадают',
  'component.avatar.changePassword.submit': 'Подтвердить изменение',
  'component.avatar.changePassword.done':
    'Пароль изменён, войдите с новым паролем',

  // Колокольчик уведомлений
  'component.notify.title': 'Уведомления',
  'component.notify.count.inbox': 'Уведомления: {count}',
  'component.notify.count.todo': 'Задачи: {count}',
  'component.notify.count.chat': 'Личные сообщения: {count}',
  'component.notify.markAllRead': 'Отметить все как прочитанные',
  'component.notify.markedAllRead': 'Все отмечены как прочитанные',
  'component.notify.status.idle': 'Канал реального времени не запущен',
  'component.notify.status.connecting': 'Подключение…',
  'component.notify.status.open': 'Уведомления в реальном времени подключены',
  'component.notify.status.reconnecting':
    'Соединение разорвано, идёт переподключение…',
  'component.notify.status.closed': 'Канал реального времени разорван',

  // Переключатель организации / команды
  'component.org.defaultName': 'Организация по умолчанию',
  'component.org.current': 'Текущее развёртывание',
  'component.org.create': 'Создать организацию / команду',
  'component.org.switch': 'Перейти в другую организацию',
  'component.org.eeHint':
    'Полная изоляция данных между организациями (несколько организаций, продажа лицензий на места) относится к возможностям EE; CE — это самостоятельное развёртывание с одной организацией.',
  'component.org.tooltip': 'Текущая организация: {name}',

  // Зона перетаскивания / выбора файлов
  'component.dropZone.title':
    'Перетащите файлы сюда или нажмите, чтобы выбрать',

  // Компонент загрузки по частям
  'component.chunkUpload.title': 'Загрузка файлов',
  'component.chunkUpload.busy': 'Активных задач: {count}',
  'component.chunkUpload.resumableCount':
    'Обнаружено незавершённых загрузок: {count}',
  'component.chunkUpload.resumableNote':
    'Чтобы не передавать данные повторно, выберите тот же файл заново: система пропустит уже полученные сервером части и продолжит загрузку.',
  'component.chunkUpload.resumableSelect': 'Выбрать файл заново и продолжить',
  'component.chunkUpload.instantDone': 'Мгновенная передача завершена',
  'component.chunkUpload.instantSuccess': 'Мгновенная передача выполнена',
  'component.chunkUpload.progress.hashing':
    'Вычисляется контрольная сумма файла…',
  'component.chunkUpload.progress.prechecking':
    'Проверяется возможность мгновенной передачи…',
  'component.chunkUpload.progress.querying': 'Запрашиваются загруженные части…',
  'component.chunkUpload.progress.merging': 'Части объединяются…',
  'component.chunkUpload.progress.paused':
    'Приостановлено (загружено {received}/{total} частей)',
  'component.chunkUpload.progress.failed': 'Загрузка не удалась',
  'component.chunkUpload.progress.uploading':
    '{received}/{total} частей · {speed}',
  'component.chunkUpload.progress.retried': ' · повторов: {count}',
  'component.chunkUpload.progress.chunks': '{count} частей',
  'component.chunkUpload.retryTooltip':
    'При сбоях сети повтор выполняется автоматически с экспоненциальной задержкой',
  'component.chunkUpload.retryTag': 'Повтор {count}',
  'component.chunkUpload.draggerText':
    'Нажмите или перетащите файлы сюда для загрузки',
  'component.chunkUpload.draggerHint':
    'Поддерживаются загрузка больших файлов по частям, мгновенная передача и догрузка с места обрыва; при сбое одного файла выполняется {count} автоматических повторов',
  'component.chunkUpload.chunkSize': 'Размер части',
  'component.chunkUpload.concurrency': 'Число параллельных загрузок',
  'component.chunkUpload.tuningNote':
    'Изменения применяются к последующим частям',
  'component.chunkUpload.overallProgress': 'Общий прогресс',
  'component.chunkUpload.overallSummary':
    'Файлов: {finished}/{total} · {uploaded} / {totalSize}',

  // Блок кода (примеры кода в разделе документации)
  'component.codeBlock.copy': 'Копировать',
  'component.codeBlock.copied': 'Скопировано',
  'component.codeBlock.copyFailed': 'Не удалось скопировать',

  // Плавающее окно монитора передачи
  'component.transfer.title': 'Центр передачи',
  'component.transfer.expand': 'Развернуть центр передачи',
  'component.transfer.collapse': 'Свернуть центр передачи',
  'component.transfer.capsule': 'Передача: {count}',
  'component.transfer.summary': 'В работе: {active} · завершено: {success}',
  'component.transfer.summaryFailed': ' · ошибок: {count}',
  'component.transfer.pauseAll': 'Приостановить все',
  'component.transfer.resumeAll': 'Продолжить все / повторить неудачные',
  'component.transfer.clearFinished':
    'Очистить завершённые / отменённые / неудачные',
  'component.transfer.fastMode': 'Ускоренный режим',
  'component.transfer.fastModeHint':
    'Число параллельных частей поднимается до контрактного максимума 5; действует и на текущие задачи. Значение, выбранное на странице загрузки, перекрывается этим переключателем.',
  'component.transfer.empty': 'Задач передачи нет',
  'component.transfer.chartAria': 'График скорости передачи',
  'component.transfer.pause': 'Приостановить',
  'component.transfer.resumeRetry': 'Продолжить / повторить',
  'component.transfer.pauseNamed': 'Приостановить {name}',
  'component.transfer.resumeNamed': 'Продолжить {name}',
  'component.transfer.status.active': 'Передача',
  'component.transfer.status.paused': 'Приостановлено',
  'component.transfer.status.error': 'Ошибка',
  'component.transfer.status.success': 'Завершено',
  'component.transfer.status.canceled': 'Отменено',
  // Звук нового сообщения (в профиле; тембры и переключатели используют один префикс)
  'component.avatar.notifySound.title': 'Звук нового сообщения',
  'component.avatar.notifySound.enabled':
    'Воспроизводить звук при новом сообщении',
  'component.avatar.notifySound.presetLabel': 'Тембр',
  'component.avatar.notifySound.preset.default': 'По умолчанию',
  'component.avatar.notifySound.preset.chime': 'Перезвон',
  'component.avatar.notifySound.preset.bubble': 'Пузырёк',
  'component.avatar.notifySound.preset.custom': 'Свой звук',
  'component.avatar.notifySound.upload': 'Загрузить аудио',
  'component.avatar.notifySound.replace': 'Заменить аудио',
  'component.avatar.notifySound.clear': 'Удалить',
  'component.avatar.notifySound.preview': 'Прослушать',
  'component.avatar.notifySound.uploaded':
    'Загружено; тембр переключён на свой звук',
  'component.avatar.notifySound.cleared': 'Свой звук удалён',
  'component.avatar.notifySound.loadFailed':
    'Не удалось загрузить настройки звука',
  'component.avatar.notifySound.typeInvalid':
    'Поддерживаются только аудио MP3 / WAV / OGG',
  'component.avatar.notifySound.tooLarge': 'Размер аудио не больше {max}',
  'component.avatar.notifySound.previewBlocked':
    'Браузер заблокировал автовоспроизведение. Щёлкните в любом месте страницы и повторите',
  'component.avatar.notifySound.customEmpty': 'Своё аудио ещё не загружено',
  'component.avatar.notifySound.customMeta':
    'Текущее аудио: {name} ({size}, {duration})',
  'component.avatar.notifySound.hint':
    'Поддерживаются MP3 / WAV / OGG, не больше {maxSize} и {maxDuration} по длительности',
} as const;
