/** Тексты страницы чата (список диалогов + окно чата). */
export default {
  'chat.title': 'Чат',
  'chat.subtitle': 'Личные и групповые диалоги, обмен в реальном времени',

  'chat.action.refresh': 'Обновить',
  'chat.action.new': 'Начать диалог',
  'chat.action.send': 'Отправить',

  'chat.list.title': 'Диалоги',
  'chat.search.placeholder': 'Поиск диалогов',
  'chat.list.empty.title': 'Диалогов пока нет',
  'chat.list.empty.desc':
    'Нажмите «Начать диалог», чтобы выбрать коллегу для личного чата, или укажите ID группы, чтобы создать групповой чат',
  'chat.list.emptyFiltered.title': 'Совпадающих диалогов нет',
  'chat.list.emptyFiltered.desc': 'Попробуйте другое ключевое слово',

  'chat.session.groupFallback': 'Групповой чат #{id}',
  'chat.session.userFallback': 'Пользователь #{id}',
  'chat.tag.private': 'Личный чат',
  'chat.tag.group': 'Групповой чат',
  'chat.sender.mine': 'Я',

  // Подтверждение о прочтении: текстовая альтернатива к ряду аватаров читателей
  // под сообщением (чисто иконочная информация обязана иметь текстовый эквивалент)
  'chat.read.by': 'Прочитали: {names}',
  'chat.read.more': 'Ещё прочитали: {count}',

  // Действия по правому клику на сообщении: отзыв (только для своих сообщений
  // не старше 2 минут) и цитирование (ответ на конкретное сообщение)
  'chat.message.action.quote': 'Цитировать',
  'chat.message.action.recall': 'Отозвать',
  // Заглушка вместо отозванного сообщения: указываем, кто отозвал, а не просто
  // «сообщение отозвано» — в групповом чате второе читается так, будто отозвали вы
  'chat.message.recalled.mine': 'Вы отозвали сообщение',
  'chat.message.recalled.other': '{name} отозвал(а) сообщение',
  'chat.message.recall.success': 'Сообщение отозвано',
  'chat.message.recall.failed': 'Не удалось отозвать, повторите попытку позже',

  // Подсказка «цитируется» над полем ввода
  'chat.composer.quote.cancel': 'Отменить цитирование',

  // Статус собеседника: страница чата и панель используют один и тот же компонент,
  // поэтому текст не принадлежит какой-либо одной стороне.
  // Три состояния обязаны сопровождаться текстом: только зелёная/серая/красная
  // точка для людей с нарушениями цветовосприятия и в режиме высокой контрастности
  // не несёт информации
  'chat.presence.online': 'В сети',
  'chat.presence.offline': 'Не в сети',
  'chat.presence.unstable': 'Нестабильная сеть',
  // В той же строке, что и три состояния выше: когда собеседник печатает,
  // эта информация актуальнее статичного статуса
  'chat.typing': 'Собеседник печатает…',

  // Качество нашего собственного соединения (постоянно видно в шапке страницы чата):
  // это не то же самое, что присутствие собеседника выше
  'chat.connection.open': 'Соединение в норме',
  'chat.connection.connecting': 'Подключение…',
  'chat.connection.reconnecting': 'Переподключение…',
  'chat.connection.closed': 'Соединение закрыто',
  'chat.connection.idle': 'Нет соединения',

  'chat.stream.placeholder.title':
    'Выберите диалог слева, чтобы начать переписку',
  'chat.stream.placeholder.desc':
    'История диалога синхронизируется в реальном времени; сообщения за время обрыва связи дозагружаются после переподключения',
  'chat.stream.empty.title': 'Сообщений пока нет',
  'chat.stream.empty.desc': 'Отправьте первое сообщение и поздоровайтесь',
  'chat.stream.loadMore': 'Загрузить более ранние сообщения',
  'chat.stream.loadingMore': 'Загрузка…',
  'chat.stream.noMore': 'Более ранних сообщений нет',
  'chat.stream.loadMoreFailed':
    'Не удалось загрузить более ранние сообщения, повторите попытку',

  // Управление вводом как в WeChat: Enter — отправка, Shift + Enter — перенос строки
  'chat.composer.placeholder':
    'Введите сообщение: Enter — отправить, Shift + Enter — новая строка',
  'chat.composer.empty': 'Сообщение не может быть пустым',
  'chat.composer.sendHint': 'Enter — отправить, Shift + Enter — новая строка',
  'chat.composer.emoji': 'Смайлы',
  'chat.composer.emojiPanel': 'Категории смайлов',
  'chat.composer.group.recent': 'Недавние',
  'chat.composer.group.smileys': 'Смайлы',
  'chat.composer.group.gestures': 'Жесты',
  'chat.composer.group.people': 'Люди и эмоции',
  'chat.composer.group.animals': 'Животные и природа',
  'chat.composer.group.food': 'Еда',
  'chat.composer.group.objects': 'Предметы и занятия',
  'chat.composer.group.symbols': 'Символы',

  // Упоминания (@): вход есть только в групповом чате
  // (в личном чате нет семантики адресного обращения, см. ChatComposer.mentionEnabled)
  'chat.composer.mention': 'Упомянуть участника',
  'chat.composer.mentionPanel': 'Кого можно упомянуть',
  'chat.composer.mentionEmpty': 'Совпадающих участников нет',
  // «Вас упомянули»: один и тот же текст служит префиксом в списке диалогов,
  // акцентом на бейдже и пометкой на сообщении
  'chat.mention.me': 'Вас упомянули',

  'chat.new.title': 'Начать диалог',
  'chat.new.scope.label': 'Тип диалога',
  'chat.new.scope.private': 'Личный чат',
  'chat.new.scope.group': 'Групповой чат',
  'chat.new.user.placeholder':
    'Введите учётную запись или отображаемое имя для поиска',
  'chat.new.user.optionLabel': '{name} ({username})',
  'chat.new.user.resolveHint':
    'Укажите логин собеседника — он будет автоматически проверен после выхода из поля',
  'chat.new.user.resolved': 'Найден: {name}',
  'chat.new.user.notFound':
    'Пользователь с такой учётной записью не найден, проверьте данные и повторите попытку',
  'chat.new.target.label': 'Логин собеседника',
  'chat.new.target.placeholder': 'Введите логин собеседника',
  'chat.new.target.required': 'Сначала выберите собеседника',
  'chat.new.target.accountRequired': 'Сначала укажите логин собеседника',
  // Групповой чат: форма создания группы (название + приглашённые участники)
  // и вход «Группы, в которых я состою».
  // Прежнее поле для ручного ввода «ID группы» убрано: группы до этого нельзя было
  // создать, а ID узнать было негде — такой вход не работал ни у кого
  'chat.new.group.nameLabel': 'Название группового чата',
  'chat.new.group.namePlaceholder': 'Введите название группового чата',
  'chat.new.group.nameRequired': 'Сначала укажите название группового чата',
  'chat.new.group.memberLabel': 'Участники группы',
  'chat.new.group.memberPlaceholder':
    'Введите логин участника и нажмите Enter, чтобы добавить',
  'chat.new.group.memberHint':
    'Пригласите хотя бы 1 участника; вместе с вами — не более {max} человек',
  'chat.new.group.memberRequired':
    'Сначала пригласите хотя бы одного участника',
  'chat.new.group.memberLimit': 'В группе не более {max} человек (включая вас)',
  'chat.new.group.firstMessageFailed':
    'Групповой чат создан, но первое сообщение отправить не удалось — отправьте его повторно в окне чата',
  'chat.new.group.existingLabel': 'Группы, в которых я состою',
  'chat.new.group.existingPlaceholder':
    'Выберите, чтобы сразу перейти в группу',
  'chat.new.group.optionLabel': '{name} ({count} чел.)',
  'chat.new.content.required':
    'Сначала введите первое сообщение (диалог создаётся после отправки)',
  'chat.new.content.label': 'Первое сообщение',
  'chat.new.content.placeholder': 'Напишите что-нибудь для начала',
  'chat.new.submit': 'Начать',
  'chat.new.cancel': 'Отмена',

  // Панель настроек группы (страница /chat и панель обмена сообщениями используют
  // один и тот же компонент, текст не принадлежит одной стороне).
  // Видимость кнопок — конъюнкция «точка прав CHAT_PERM ∧ ability с сервера»,
  // см. components/ChatGroupPanel
  'chat.group.title': 'Настройки группы',
  'chat.group.close': 'Закрыть',
  'chat.group.info': 'Сведения о группе',
  'chat.group.name.placeholder': 'Введите название группы',
  'chat.group.name.required': 'Название группы не может быть пустым',
  'chat.group.name.save': 'Сохранить',
  'chat.group.name.success': 'Название группы обновлено',
  'chat.group.meta': '{count}/{max} чел.',
  'chat.group.members.label': 'Участники группы',
  'chat.group.emptyMembers': 'Участников нет',
  'chat.group.member.unknown': 'Неизвестный участник',
  'chat.group.member.owner': 'Владелец группы',
  'chat.group.member.admin': 'Администратор',
  'chat.group.member.readonly': 'Только чтение',
  'chat.group.member.joinedAt': 'Вступил(а) {time}',
  'chat.group.member.remove': 'Удалить',
  'chat.group.member.removeConfirmTitle': 'Удалить {name} из группового чата?',
  'chat.group.member.removeConfirmDesc':
    'После удаления участник сразу теряет доступ к истории сообщений группы; при необходимости его можно пригласить снова.',
  'chat.group.member.removed': 'Удалён(а): {name}',
  'chat.group.invite.label': 'Пригласить участников',
  'chat.group.invite.placeholder':
    'Введите логин участника и нажмите Enter, чтобы добавить',
  'chat.group.invite.button': 'Пригласить',
  'chat.group.invite.success': 'Приглашено участников: {count}',
  'chat.group.invite.none':
    'Все эти участники уже в группе, повторно приглашать не нужно',
  'chat.group.invite.alreadyMember': '{name} уже в группе',
  'chat.group.invite.noCandidate': 'Совпадающих доступных учётных записей нет',
  'chat.group.invite.hint':
    'Можно пригласить ещё {count} человек (лимит — {max})',
  'chat.group.invite.full':
    'Достигнут лимит участников группы ({max}), приглашать больше нельзя',
  'chat.group.invite.limit':
    'Можно пригласить не более {count} человек (лимит — {max}); уменьшите число приглашаемых',
  'chat.group.dangerZone': 'Опасные действия',
  'chat.group.quit': 'Покинуть групповой чат',
  'chat.group.quitConfirmTitle': 'Покинуть этот групповой чат?',
  'chat.group.quitConfirmDesc':
    'После выхода сообщения группы перестанут приходить, а история станет недоступна; для повторного вступления потребуется приглашение владельца группы или администратора.',
  'chat.group.quit.success': 'Вы покинули групповой чат',
  'chat.group.dissolve': 'Распустить групповой чат',
  'chat.group.dissolveConfirmTitle': 'Распустить этот групповой чат?',
  'chat.group.dissolveConfirmDesc':
    'Все участники потеряют доступ к этой группе, и история сообщений станет недоступна для чтения на сервере.',
  'chat.group.dissolve.success': 'Групповой чат распущен',
  'chat.group.loadFailed': 'Не удалось загрузить сведения о группе',
  // Панель сведений о собеседнике (личный чат): здесь меняется личная заметка
  // о том, как вы называете его, а не ник в его учётной записи.
  // Страница и панель используют один и тот же компонент, текст не принадлежит одной стороне
  'chat.peer.title': 'Сведения о собеседнике',
  'chat.peer.action': 'Заметка',
  'chat.peer.close': 'Закрыть',
  'chat.peer.nickname.label': 'Имя: {name}',
  'chat.peer.alias.label': 'Заметка',
  'chat.peer.alias.placeholder': 'Дайте этому человеку запоминающееся вам имя',
  'chat.peer.alias.hint':
    'Заметка видна только вам: собеседник её не увидит, а ник в его учётной записи не изменится.',
  'chat.peer.alias.save': 'Сохранить',
  'chat.peer.alias.clear': 'Убрать заметку',
  'chat.peer.alias.saved': 'Заметка сохранена',
  'chat.peer.alias.cleared': 'Заметка убрана',

  // Карточка файла в ленте сообщений: страница чата и панель используют один
  // и тот же компонент, текст не принадлежит одной стороне
  'chat.fileCard.open': 'Открыть {name} в файлах',

  // Ограничения использования вложения (отправитель задаёт три параметра:
  // режим использования / срок действия / лимит скачиваний)
  'chat.attach.policy.trigger': 'Ограничения использования',
  'chat.attach.policy.title': 'Как получатель может распорядиться этим файлом',
  'chat.attach.policy.usage.label': 'Использование',
  'chat.attach.usage.previewOnly': 'Только просмотр',
  'chat.attach.usage.previewOnly.desc':
    'Можно смотреть в диалоге онлайн, скачивание недоступно',
  'chat.attach.usage.downloadable': 'Можно скачать',
  'chat.attach.usage.downloadable.desc':
    'Скачать можно, но в файлы получателя он не попадёт',
  'chat.attach.usage.resavable': 'Можно переслать и сохранить',
  'chat.attach.usage.resavable.desc':
    'Можно скачать и сохранить в собственные файлы получателя',
  'chat.attach.policy.expire.label': 'Срок действия',
  'chat.attach.expire.days': '{days} дн.',
  'chat.attach.expire.never': 'Без срока',
  'chat.attach.policy.limit.label': 'Лимит скачиваний',
  'chat.attach.limit.unlimited': 'Без ограничений',
  'chat.attach.limit.times': '{count} раз',
  'chat.attach.policy.limit.disabledHint':
    'Режим «только просмотр» не расходует скачивания, лимит не нужен',
  'chat.attach.policy.footnote':
    'После отзыва получатель сразу теряет доступ к файлу; уже скачанные локальные копии вернуть нельзя.',
  // Строка готового к отправке вложения: страница чата и панель используют один
  // и тот же компонент, текст не принадлежит одной стороне
  'chat.attach.dropHint':
    'Перетащите файл из раздела файлов либо нажмите скрепку, чтобы выбрать файл из «Моих файлов» или загрузить локальный; максимум {size} на файл',
  'chat.attach.remove': 'Убрать файл из отправки',
  'chat.attach.placeholder': 'Можно добавить пояснение (необязательно)',

  // Вход для передачи файлов (скрепка → окно «Отправить файл»): страница и панель
  // используют его совместно, текст не принадлежит одной стороне
  'chat.attach.entry': 'Отправить файл',
  'chat.attach.modalTitle': 'Отправить файл',
  'chat.attach.fromDevice': 'Загрузить локальный файл',
  'chat.attach.uploadHint':
    'Локальный файл сначала попадёт в ваши файлы, а затем будет отправлен как сообщение с файлом',
  // Подсказка о размере: только сообщает лимит и не блокирует заранее
  // (лимит настраивается, окончательное решение об отказе принимает сервер)
  'chat.attach.sizeLimit': 'Максимум {size} на файл',
  'chat.attach.uploadProgress': 'Загрузка {name} ({percent}%)',
  'chat.attach.uploadFailed': 'Не удалось загрузить: {name}, можно повторить',
  'chat.attach.uploadNoNode':
    'Загрузка завершена, но запись об этом файле не получена; проверьте «Мои файлы» и выберите файл ещё раз',
  'chat.attach.pickerSearch': 'Поиск по имени файла',
  'chat.attach.pickerEmpty': 'Совпадающих файлов нет',
  'chat.attach.pickerFailed':
    'Не удалось загрузить список файлов, повторите попытку позже',
  'chat.attach.pickerInvalid': 'Этот файл пока выбрать нельзя, выберите другой',
  'chat.attach.pickerClose': 'Закрыть',

  // Карточка вложения (получатель забирает файл без заявки / отправитель
  // смотрит расход лимита)
  'chat.attachCard.preview': 'Просмотр',
  'chat.attachCard.download': 'Скачать',
  'chat.attachCard.save': 'Сохранить в мои файлы',
  'chat.attachCard.saveSuccess': 'Сохранено в ваши файлы',
  'chat.attachCard.revoke': 'Отозвать доступ',
  'chat.attachCard.revokeConfirmTitle': 'Отозвать доступ к этому вложению?',
  'chat.attachCard.revokeConfirmDesc':
    'После отзыва получатель сразу теряет доступ к файлу, но уже скачанные локальные копии вернуть нельзя.',
  'chat.attachCard.revokeOk': 'Доступ отозван',
  'chat.attachCard.revoked': 'Отозвано',
  'chat.attachCard.expired': 'Срок истёк',
  'chat.attachCard.remaining': 'Осталось {count} раз',
  'chat.attachCard.unlimited': 'Без ограничений',
  'chat.attachCard.expireAt': 'Действует до {date}',
  'chat.attachCard.neverExpire': 'Бессрочно',
  'chat.attachCard.previewUnsupported':
    'Этот тип не поддерживает онлайн-просмотр, скачайте файл и откройте его локально',
  // В режиме «только просмотр» входа для скачивания нет: советовать «скачайте
  // и посмотрите» здесь нельзя, нужно честно сказать, что этот путь закрыт
  'chat.attachCard.previewUnsupportedNoDownload':
    'Этот тип нельзя просмотреть онлайн, а отправитель не разрешил скачивание; попросите его прислать файл иным способом',

  // Панель обмена сообщениями (второй вход помимо /chat; текст независимый,
  // чтобы не конфликтовать с заголовком страницы)
  'chat.drawer.title': 'Сообщения',
  'chat.drawer.backToList': 'Вернуться к списку диалогов',
  'chat.drawer.refresh': 'Обновить список диалогов',
  'chat.drawer.close': 'Закрыть панель сообщений',
  'chat.drawer.emptyConversations': 'Диалогов нет',
  'chat.drawer.openConversation': 'Открыть диалог с {name}',
  'chat.drawer.emptyMessages':
    'Сообщений пока нет — перетащите файл и напишите пару слов',
  'chat.drawer.mineAvatar': 'Я',
  'chat.drawer.fileFallback': '[Файл] {content}',
  'chat.drawer.send': 'Отправить',
  // Групповой чат: число участников и уведомления (три переключателя в панели группы)
  'chat.group.memberCount': '{count} участников',
  'chat.composer.mentionAll': 'Все',
  'chat.group.notify.title': 'Уведомления о сообщениях',
  'chat.group.notify.mute': 'Отключить звук в группе',
  'chat.group.notify.mention': 'Уведомлять, когда меня упоминают',
  'chat.group.notify.mentionAll': 'Уведомлять, когда владелец упоминает всех',
  'chat.group.notify.muteHint':
    'Сообщения этой группы больше не звучат; уведомлять ли вас, решают два переключателя ниже.',
  'chat.group.notify.mentionHint':
    'Сообщения этой группы уведомляют как обычно; два переключателя ниже действуют только при включённом отключении звука.',
} as const;
