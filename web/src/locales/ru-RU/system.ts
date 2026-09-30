/** Тексты системного управления (пользователи / роли / подразделения / группы / права на меню). */
export default {
  // Общие действия и столбцы системного домена, переиспользуемые на разных страницах
  'system.action.edit': 'Изменить',
  'system.action.delete': 'Удалить',
  'system.action.create': 'Создать',
  'system.column.action': 'Действия',
  'system.column.status': 'Статус',
  'system.column.remark': 'Примечание',
  'system.column.createTime': 'Создано',
  'system.alert.boundaryTitle': 'Границы операций',

  // Статусы пользователя
  'system.userStatus.normal': 'Активна',
  'system.userStatus.disabled': 'Отключена',
  'system.userStatus.locked': 'Заблокирована',
  'system.userStatus.unknown': 'Неизвестно',

  // Область данных
  'system.dataScope.self': 'Только свои',
  'system.dataScope.deptAndSub': 'Своё подразделение и вложенные',
  'system.dataScope.all': 'Все',
  'system.dataScope.unknown': 'Неизвестно ({scope})',

  // Измерение точки прав
  'system.permType.menu': 'Меню',
  'system.permType.action': 'Операция',
  'system.permType.dataScope': 'Область данных',
  'system.permType.unknown': 'Неизвестно ({type})',

  // Страница управления пользователями
  'system.user.title': 'Управление пользователями',
  'system.user.subtitle': 'Учётные записи, подразделения, статусы и роли',
  'system.user.alertBoundary':
    'Защищённые учётные записи нельзя отключать / удалять / менять им роли; администратор не может применить к себе отключение, сброс пароля, назначение ролей и удаление (бэкенд отклонит запрос, включая защиту от самоповышения прав). При ограниченной области данных список и выпадающий список ролей автоматически сужаются.',
  'system.user.column.keyword': 'Учётная запись / отображаемое имя',
  'system.user.column.keywordPlaceholder':
    'Учётная запись или отображаемое имя, нечёткий поиск',
  'system.user.column.username': 'Учётная запись',
  'system.user.column.nickname': 'Отображаемое имя',
  'system.user.column.dept': 'Подразделение',
  'system.user.column.deptPlaceholder': 'Все доступные подразделения',
  'system.user.column.roles': 'Роли',
  'system.user.column.lastLogin': 'Последний вход',
  'system.user.protectedTag': 'Защищённая',
  'system.user.action.assignRole': 'Назначить роли',
  'system.user.action.resetPassword': 'Сбросить пароль',
  'system.user.action.disable': 'Отключить',
  'system.user.action.enable': 'Включить',
  'system.user.action.locked': 'Заблокирована',
  'system.user.action.create': 'Создать пользователя',
  'system.user.confirm.disableTitle': 'Отключить эту учётную запись?',
  'system.user.confirm.enableTitle': 'Включить эту учётную запись?',
  'system.user.confirm.disableDesc':
    'После отключения все активные сеансы этой учётной записи сразу завершатся.',
  'system.user.confirm.deleteTitle': 'Удалить этого пользователя?',
  'system.user.confirm.deleteDesc':
    'Удаление необратимо; для защищённых или всё ещё используемых учётных записей сервер отклонит запрос.',
  'system.user.message.disabled': 'Отключено: {name}',
  'system.user.message.enabled': 'Включено: {name}',
  'system.user.message.deleted': 'Удалено: {name}',

  // Аватар (отдельный канал: применяется сразу при загрузке, не участвует в сохранении формы)
  'system.user.avatar.label': 'Аватар',
  'system.user.avatar.upload': 'Загрузить аватар',
  'system.user.avatar.hint':
    'Поддерживаются PNG / JPEG / GIF / WebP, размер не более {max}',
  'system.user.avatar.updated': 'Аватар обновлён',
  'system.user.avatar.tooLarge': 'Изображение не должно превышать {max}',
  'system.user.avatar.typeInvalid':
    'Поддерживаются только изображения PNG / JPEG / GIF / WebP',
  // Окно создания / редактирования пользователя
  'system.userForm.title.edit': 'Изменение пользователя · {name}',
  'system.userForm.title.create': 'Создание пользователя',
  'system.userForm.alert.title':
    'Имя учётной записи, статус, роли и пароль в этой форме не меняются',
  'system.userForm.alert.desc':
    'Имя учётной записи изменить нельзя; для статуса / пароля / ролей используйте соответствующие кнопки в списке. Примечание не редактируется, так как API его не возвращает.',
  'system.userForm.field.username': 'Логин',
  'system.userForm.field.password': 'Начальный пароль',
  'system.userForm.field.nickname': 'Отображаемое имя / ФИО',
  'system.userForm.field.dept': 'Подразделение',
  'system.userForm.field.email': 'Эл. почта',
  'system.userForm.field.mobile': 'Телефон',
  'system.userForm.field.roleIds': 'Начальные роли',
  'system.userForm.placeholder.username':
    '3-64 символа: буквы/цифры/подчёркивание/точка/дефис',
  'system.userForm.placeholder.password': '8-64 символа',
  'system.userForm.placeholder.dept': 'Не назначено',
  'system.userForm.placeholder.roleIds': 'Роли не назначать',
  'system.userForm.extra.deptEdit':
    'Изменение подразделения считается переводом: у пользователя будут отозваны все действующие авторизации, полученные «по согласованию»',
  'system.userForm.extra.deptCreate': 'Пусто = подразделение не назначено',
  'system.userForm.extra.emailEdit':
    'Пусто = не изменять (консервативная логика бэкенда: очистить почту нельзя)',
  'system.userForm.extra.mobileEdit': 'Пусто = не изменять',
  'system.userForm.extra.roleIds':
    'Можно не назначать. Если область данных не «Все», назначать можно только роли, которые есть у вас (требуется {perm}).',
  'system.userForm.rule.usernameRequired': 'Введите логин',
  'system.userForm.rule.usernamePattern':
    '3-64 символа: буквы/цифры/подчёркивание/точка/дефис',
  'system.userForm.rule.passwordRequired': 'Введите начальный пароль',
  'system.userForm.rule.passwordLength':
    'Длина пароля должна быть 8-64 символа',
  'system.userForm.rule.nicknameRequired': 'Введите отображаемое имя',
  'system.userForm.rule.nicknameMax': 'Не более 64 символов',
  'system.userForm.rule.emailInvalid':
    'Неверный формат адреса электронной почты',
  'system.userForm.rule.emailMax': 'Не более 128 символов',
  'system.userForm.rule.mobileMax': 'Не более 32 символов',
  'system.userForm.rule.remarkMax': 'Не более 255 символов',
  'system.userForm.message.updated': 'Данные пользователя обновлены',
  'system.userForm.message.created': 'Пользователь создан',
  'system.userForm.roleOption': '{name} ({code}·{scope})',
  // Окно сброса пароля
  'system.resetPassword.title': 'Сброс пароля · {name}',
  'system.resetPassword.ok': 'Подтвердить сброс',
  'system.resetPassword.alert.title':
    'После сброса все активные сеансы пользователя сразу завершатся',
  'system.resetPassword.alert.desc':
    'Пользователю придётся войти с новым паролем; администратор не может посмотреть прежний пароль (в базе хранится только хеш).',
  'system.resetPassword.field.newPassword': 'Новый пароль',
  'system.resetPassword.field.confirmPassword': 'Подтвердите новый пароль',
  'system.resetPassword.placeholder.password': '8-64 символа',
  'system.resetPassword.rule.newRequired': 'Введите новый пароль',
  'system.resetPassword.rule.length': 'Длина пароля должна быть 8-64 символа',
  'system.resetPassword.rule.confirmRequired': 'Введите новый пароль ещё раз',
  'system.resetPassword.rule.mismatch': 'Введённые пароли не совпадают',
  'system.resetPassword.message.done':
    'Пароль сброшен, все активные сеансы пользователя завершены',

  // Панель назначения ролей
  'system.assignRole.title': 'Назначение ролей · {name}',
  'system.assignRole.alert.protected.title': 'Защищённая учётная запись',
  'system.assignRole.alert.protected.desc':
    'Роль супер-администратора обязательна; попытку её снять сервер отклонит.',
  'system.assignRole.alert.mode.title':
    'Полная замена набора + хотя бы одна роль',
  'system.assignRole.alert.mode.desc':
    'После отправки набор ролей берётся из текущих отметок (без приращения). Бэкенд требует непустой набор ролей, поэтому нужно отметить хотя бы одну.',
  'system.assignRole.searchPlaceholder': 'Фильтр по названию роли / коду',
  'system.assignRole.empty.noOptions':
    'Нет ролей, доступных для назначения (возможно, из-за ограниченной области данных)',
  'system.assignRole.empty.noMatch': 'Совпадающих ролей нет',
  'system.assignRole.atLeastOne':
    'Отметьте хотя бы одну роль: бэкенд проверяет набор ролей на непустоту.',
  'system.assignRole.message.done': 'Роли обновлены',
  // Страница управления ролями
  'system.role.title': 'Управление ролями',
  'system.role.subtitle': 'Сами роли и матрица прав',
  'system.role.alertBoundary':
    'Встроенные роли нельзя удалять, а их область данных нельзя менять; точки прав системного управления выдаются только супер-администратору. Если область данных не «Все», при создании роли можно задать только область не шире своей, а при выдаче прав отмечать только те точки прав, которые есть у вас (на сервере есть страховка от повышения прав).',
  'system.role.column.keyword': 'Название роли / код',
  'system.role.column.keywordPlaceholder': 'Название или код, нечёткий поиск',
  'system.role.column.name': 'Название роли',
  'system.role.column.code': 'Код',
  'system.role.column.dataScope': 'Область данных',
  'system.role.column.permissionSet': 'Набор прав',
  'system.role.builtInTag': 'Встроенная',
  'system.role.lockedTag': 'Заблокирована для изменений',
  'system.role.maintainableTag': 'Изменяемая',
  'system.role.action.assignPerm': 'Выдать права',
  'system.role.action.create': 'Создать роль',
  'system.role.confirm.deleteTitle': 'Удалить эту роль?',
  'system.role.confirm.deleteDesc':
    'Для встроенных ролей, ролей со связанными правами или всё ещё назначенных пользователям сервер отклонит запрос.',
  'system.role.message.deleted': 'Роль удалена: {name}',

  // Окно создания / редактирования роли
  'system.roleForm.title.edit': 'Изменение роли · {name}',
  'system.roleForm.title.create': 'Создание роли',
  'system.roleForm.alert.title': 'Встроенная роль',
  'system.roleForm.alert.desc':
    'Код и область данных изменить нельзя, доступны только название и примечание; матрица прав ведётся в панели «Выдать права».',
  'system.roleForm.field.code': 'Код роли',
  'system.roleForm.field.name': 'Название роли',
  'system.roleForm.field.dataScope': 'Область данных',
  'system.roleForm.placeholder.code': 'Например, DEPT_ADMIN',
  'system.roleForm.extra.codeEdit':
    'Код — внешний идентификатор роли, после создания он не меняется',
  'system.roleForm.extra.dataScopeBuiltIn':
    'Область данных встроенной роли изменить нельзя',
  'system.roleForm.extra.dataScopeMax':
    'Не должна превышать вашу область данных (текущая: {scope})',
  'system.roleForm.rule.codeRequired': 'Введите код роли',
  'system.roleForm.rule.codePattern':
    'Должен начинаться с заглавной буквы и содержать только заглавные буквы/цифры/подчёркивание',
  'system.roleForm.rule.nameRequired': 'Введите название роли',
  'system.roleForm.rule.nameMax': 'Не более 64 символов',
  'system.roleForm.rule.dataScopeRequired': 'Выберите область данных',
  'system.roleForm.message.updated': 'Роль обновлена',
  'system.roleForm.message.created': 'Роль создана',
  // Панель выдачи прав роли
  'system.rolePerm.title': 'Выдача прав · {name}',
  'system.rolePerm.alert.locked.title': 'Набор прав роли аудитора заблокирован',
  'system.rolePerm.alert.locked.desc':
    'Слой сервисов отклоняет любые изменения набора прав этой роли (1021), поэтому панель работает только на чтение.',
  'system.rolePerm.alert.readOnly.title': 'Только чтение',
  'system.rolePerm.alert.readOnly.desc':
    'У вас нет точки прав на выдачу прав роли (system:role:assign-perm), доступен только просмотр текущей матрицы прав.',
  'system.rolePerm.alert.selfLock.title':
    'Защита от самоблокировки: три точки прав нельзя снять',
  'system.rolePerm.alert.selfLock.desc':
    'Нужно сохранить {codes}, иначе управлять правами станет некому; сервер отклонит запрос сразу.',
  'system.rolePerm.alert.narrow.title':
    'Защита от повышения прав: можно выдавать только свои точки прав',
  'system.rolePerm.alert.narrow.desc':
    'Ваша область данных не «Все», поэтому узлы с пометкой «Недоступно для выдачи» при отправке будут отклонены сервером.',
  'system.rolePerm.tooltip.required':
    'Защита от самоблокировки: супер-администратор обязан сохранить эту «точку входа в управление», иначе сервер отклонит её снятие',
  'system.rolePerm.tooltip.notHeld':
    'Ваша область данных не «Все», поэтому нельзя выдать точки прав, которых у вас нет (защита от повышения прав на сервере)',
  'system.rolePerm.tag.required': 'Обязательно',
  'system.rolePerm.tag.notHeld': 'Недоступно для выдачи',
  'system.rolePerm.selected': 'Выбрано {selected} / всего {total} точек прав',
  'system.rolePerm.parentNote':
    '(родительский узел учитывается = видимый вход)',
  'system.rolePerm.empty': 'Каталог точек прав пуст',
  'system.rolePerm.message.mustKeep':
    'Роль супер-администратора обязана сохранить эти точки прав: {codes}',
  'system.rolePerm.message.done': 'Права роли обновлены',
  // Каталог меню / точек прав (только чтение)
  'system.menu.title': 'Каталог меню / точек прав',
  'system.menu.subtitle': 'Текущее состояние модели прав (только чтение)',
  'system.menu.alert.title':
    'Страница только для чтения: добавление и изменение точек прав выполняется в SQL-миграциях',
  'system.menu.alert.desc':
    'В этом проекте «меню» и «операции» единообразно смоделированы как точки прав (type: 1 — меню, 2 — операция, 3 — область данных). Сейчас есть только метод чтения каталога (GET /api/v1/permission-points), API для изменения точек прав отсутствует. Чтобы отметить права для роли, перейдите в «Управление ролями → Выдать права».',
  'system.menu.column.permName': 'Название точки прав',
  'system.menu.column.permCode': 'Код права',
  'system.menu.column.type': 'Измерение',
  'system.menu.column.sortNo': 'Порядок',
  'system.menu.stat.total': 'Всего точек прав',
  'system.menu.stat.menu': 'Узлы меню',
  'system.menu.stat.action': 'Узлы операций',
  'system.menu.stat.scope': 'Узлы области данных',
  'system.menu.headerTitle': 'Дерево точек прав',
  'system.menu.searchPlaceholder': 'Фильтр по названию / коду',
  'system.menu.empty.noPerm':
    'Не хватает прав: нужны system:role:list или system:role:assign-perm',
  // Управление группами (страница-заглушка)
  'system.group.title': 'Управление группами',
  'system.group.subtitle': 'Пока недоступно',
  'system.group.alert.title':
    'API управления группами пока нет, поэтому страница служит пояснением-заглушкой',
  'system.group.alert.desc':
    'Таблицы sys_group / sys_group_member уже существуют, но на сервере нет соответствующих контроллеров управления и точек прав. Чтобы не давать входы, которые гарантированно приведут к ошибке, здесь нет операций создания, изменения и удаления, а также не отрисовываются фиктивные данные.',
  'system.group.section.current.title': 'Текущее состояние',
  'system.group.section.current.subtitle':
    'Таблицы, серверные сущности и точки прав',
  'system.group.section.endpoints.title': 'Недостающие API',
  'system.group.section.endpoints.subtitle': 'Список задач на планирование',
  'system.group.desc.table': 'Таблица',
  'system.group.desc.entity': 'Серверная сущность',
  'system.group.entity.note':
    'Используется только внутри домена совместной работы (проверка доступа), внешнего CRUD нет',
  'system.group.desc.perm': 'Точки прав',
  'system.group.perm.none':
    'Точек прав system:group:* нет (в V9 определены только system:user:* и system:role:*)',
  'system.group.desc.availability': 'Текущая доступность',
  'system.group.availability.readonly': 'Только чтение, недоступно (нет API)',
  'system.group.column.method': 'Метод',
  'system.group.column.path': 'Путь',
  'system.group.column.purpose': 'Назначение',
  'system.group.endpoint.groups.page':
    'Постраничный список групп / поиск по ключевому слову',
  'system.group.endpoint.groups.detail': 'Сведения о группе',
  'system.group.endpoint.groups.create': 'Создание группы',
  'system.group.endpoint.groups.update':
    'Изменение группы (название / примечание / ответственный)',
  'system.group.endpoint.groups.remove': 'Удаление группы',
  'system.group.endpoint.members.list': 'Список участников',
  'system.group.endpoint.members.replace': 'Полная замена состава участников',
  // Управление подразделениями (только чтение)
  'system.dept.title': 'Управление подразделениями',
  'system.dept.subtitle': 'Организационная структура (только чтение)',
  'system.dept.alert.title':
    'Страница только для чтения: API изменения подразделений пока нет',
  'system.dept.alert.desc':
    'Сейчас доступен только метод GET /api/v1/system/users/dept-options (для выпадающего списка в форме пользователя и определения области данных). Страница показывает организационную структуру как есть и не предлагает операций записи, которые не могут быть выполнены. Идентификатор подразделения используется и при «переводе пользователя», и при расчёте области данных, поэтому перед изменениями сначала оцените последствия.',
  'system.dept.column.name': 'Название подразделения',
  'system.dept.column.id': 'ID подразделения',
  'system.dept.column.parentId': 'ID родительского подразделения',
  'system.dept.column.depth': 'Уровень',
  'system.dept.column.childCount': 'Число вложенных подразделений',
  'system.dept.depthValue': 'Уровень {depth}',
  'system.dept.rootTag': 'Корень',
  'system.dept.stat.total': 'Всего подразделений',
  'system.dept.stat.roots': 'Корневые подразделения',
  'system.dept.stat.maxDepth': 'Максимальный уровень',
  'system.dept.stat.rootsFooter':
    'Верхнеуровневые узлы без родительского подразделения',
  'system.dept.suffix.count': 'шт.',
  'system.dept.suffix.level': 'уров.',
  'system.dept.headerTitle': 'Список подразделений',
  'system.dept.message.reloaded': 'Список подразделений загружен заново',
} as const;
