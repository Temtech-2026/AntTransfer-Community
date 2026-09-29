/** Тексты страницы загрузки по частям и окна загрузки. */
export default {
  'upload.title': 'Загрузка файлов',
  'upload.titleWithFolder': 'Загрузка файлов (каталог #{folderId})',
  'upload.dropText': 'Нажмите или перетащите файлы сюда',
  'upload.dropHint':
    'Поддерживается выбор нескольких файлов; большие файлы автоматически делятся на части (по умолчанию 4 MiB) с вычислением хеша, а при мгновенной передаче файл повторно не отправляется',
  'upload.instant': 'Мгновенная передача',
  'upload.verifying': 'Проверка',
  'upload.chunkProgress': ' · {received}/{total} частей',
  'upload.chunkTooltip': 'Часть {index}',
  'upload.retried': 'Автоматических повторов: {count}',
  'upload.empty': 'Задач загрузки нет',
  'upload.summary':
    'В работе: {uploading} · завершено: {finished} · всего: {total}',

  // Статусы задач
  'upload.status.pending': 'В очереди',
  'upload.status.hashing': 'Вычисление хеша',
  'upload.status.prechecking': 'Проверка мгновенной передачи',
  'upload.status.querying': 'Запрос частей',
  'upload.status.uploading': 'Загрузка',
  'upload.status.paused': 'Приостановлено',
  'upload.status.merging': 'Объединение',
  'upload.status.success': 'Завершено',
  'upload.status.error': 'Ошибка',
  'upload.status.canceled': 'Отменено',

  // Тексты ошибок (переводятся на текущий язык до того, как слой сервисов
  // бросит исключение, см. services/upload)
  'upload.error.generic': 'Не удалось загрузить',
  'upload.error.network':
    'Ошибка сети, проверьте соединение и повторите попытку',
  'upload.error.timeout': 'Превышено время ожидания загрузки',
  'upload.error.badContract':
    'Структура ответа сервера не соответствует единому контракту',
  'upload.error.instantWithoutFileId':
    'Мгновенная передача сработала, но fileId не возвращён',
  'upload.error.missWithoutUploadId':
    'Мгновенная передача не сработала, но uploadId не возвращён',
  'upload.error.partHttp': 'Не удалось загрузить часть (HTTP {status})',
  'upload.error.hashWorkerFailed': 'Ошибка выполнения воркера хеширования',
  'upload.error.hashFailed': 'Не удалось вычислить хеш',

  // Действия
  'upload.action.pause': 'Приостановить',
  'upload.action.resume': 'Продолжить',
  'upload.action.remove': 'Убрать',
  'upload.action.pauseAll': 'Приостановить все',
  'upload.action.resumeAll': 'Продолжить все',
  'upload.action.clearFinished': 'Очистить завершённые',

  // Догрузка с места обрыва
  'upload.resumable.title': 'Обнаружена незавершённая загрузка',
  'upload.resumable.note':
    'Приведённый ниже прогресс взят из локального кеша и носит справочный характер; фактическое место продолжения определяется списком частей на сервере.',
  'upload.resumable.record':
    '{name} ({size}, загружено {received}/{total} частей)',
  'upload.resumable.ignore': 'Пропустить',
  'upload.resumable.select': 'Выбрать файл и продолжить',
  'upload.resumable.hint':
    'Нужно выбрать тот же файл с прежним именем (если содержимое изменилось, это будет распознано и файл загрузится заново)',

  // Список завершённых
  'upload.column.method': 'Способ',
  'upload.column.chunked': 'Загрузка по частям',
  // Способы загрузки (форма тела запроса для частей) —
  // карточки демонстрационной страницы и компонент загрузки используют одни и те же названия
  'upload.mode.title': 'Способ загрузки',
  'upload.mode.subtitle':
    'Две формы тела запроса для частей; параметры хранятся раздельно',
  'upload.mode.active': 'Используется сейчас',
  'upload.mode.use': 'Использовать этот способ',
  'upload.mode.fact.request': 'Тело запроса',
  'upload.mode.fact.scene': 'Когда применять',
  'upload.mode.unsupportedTag': 'Бэкенд не поддерживает',
  'upload.mode.switchHint':
    'Переключение влияет только на задачи, добавленные после него: текущие продолжают использовать способ, с которым были начаты, поэтому одна загрузка не смешивает две формы тела запроса; новые параметры также вступают в силу со следующей задачи.',
  'upload.mode.multipart.title': 'Части в форме',
  'upload.mode.multipart.tag': 'multipart/form-data',
  'upload.mode.multipart.desc':
    'Каждая часть отправляется как `FormData`, номер части и хеш передаются вместе с полями формы: наилучшая совместимость и текущее значение по умолчанию на бэкенде.',
  'upload.mode.multipart.request':
    '`PUT`-метод API частей, тело запроса — `FormData` (`chunk` + `index` + `hash`)',
  'upload.mode.multipart.scene':
    'Бэкенд принимает части через Spring `@RequestPart` / `MultipartFile` (значение по умолчанию в контракте)',
  'upload.mode.octetStream.title': 'Двоичный поток',
  'upload.mode.octetStream.tag': 'application/octet-stream',
  'upload.mode.octetStream.desc':
    'Часть отправляется как необработанный поток байтов, её номер определяется URL — на один слой формы и одно копирование в памяти меньше.',
  'upload.mode.octetStream.request':
    '`PUT`-метод API частей, тело запроса — необработанный поток байтов (`Content-Type: application/octet-stream`, без поля `hash`)',
  'upload.mode.octetStream.scene':
    'Прямая загрузка в объектное хранилище либо сквозная передача потока через шлюз без разбора формы',
  'upload.mode.octetStream.unsupported':
    'Сейчас API частей в at-transfer поддерживает только `multipart/form-data`: при выборе этого способа отправка части вернёт HTTP 415. Сначала бэкенд должен научиться принимать необработанный поток (со стороны фронтенда всё готово).',
  // Демонстрационная страница (/upload).
  // Обратные кавычки в текстах страница отображает как инлайн-код.
  'upload.demo.pageTitle': 'Загрузка по частям',
  'upload.demo.pageSubtitle':
    'Мгновенная передача · догрузка с места обрыва · параллельные части',
  'upload.demo.pipeline.title': 'Цепочка загрузки',
  'upload.demo.pipeline.subtitle':
    'Хеш → мгновенная передача → догрузка → объединение',
  'upload.demo.pipeline.desc':
    'Для большого файла хеш сначала вычисляется на клиенте, и сервер по нему решает, возможна ли мгновенная передача; если нет — передаются только недостающие части. В любой момент можно обновить страницу и выбрать тот же файл заново: загрузка продолжится с места, уже полученного сервером.',
  'upload.demo.step.hash.title': 'Вычисление контрольной суммы',
  'upload.demo.step.hash.desc':
    'Инкрементальный SHA-256 в Worker, главный поток не блокируется',
  'upload.demo.step.precheck.title': 'Проверка мгновенной передачи',
  'upload.demo.step.precheck.desc':
    'При совпадении хеша загрузка сразу завершается, передаётся 0 байт',
  'upload.demo.step.query.title': 'Запрос полученных частей',
  'upload.demo.step.query.desc': 'Источник истины — список на сервере',
  'upload.demo.step.upload.title': 'Параллельная догрузка частей',
  'upload.demo.step.upload.desc':
    'По умолчанию 3 параллельно, повтор с задержкой при сбое',
  'upload.demo.step.merge.title': 'Объединение и проверка',
  'upload.demo.step.merge.desc':
    'Сервер пересчитывает хеш целого файла и объединяет части',
  'upload.demo.chunkTitle': 'Демонстрация загрузки по частям',
  'upload.demo.finished.title': 'Загруженные файлы',
  'upload.demo.finished.subtitle':
    'Хранятся последние записи: не более {count}',
  'upload.demo.usage.title': 'Способы интеграции',
  'upload.demo.usage.subtitle':
    'Компонент и Hook: две формы использования с одной общей очередью',
  'upload.demo.usage.desc':
    'Компонент идёт вместе с очередью и отображением прогресса — достаточно вставить его на страницу; если на бизнес-странице нужна своя вёрстка, используйте Hook `useChunkUpload()`, который отдаёт состояние и действия, а интерфейс рисуйте сами. Оба варианта опознают очередь только по `id`: одинаковый `id` — одна и та же очередь, поэтому их можно смешивать на одной странице.',
  'upload.demo.usage.tab.component': 'Использование компонента',
  'upload.demo.usage.tab.hook': 'Использование Hook',
  'upload.demo.usage.component.point1':
    '`id` определяет очередь: несколько компонентов с одним id используют общую очередь, и переход на другую страницу или повторное монтирование не прерывают передачу.',
  'upload.demo.usage.component.point2':
    '`chunkSize` и `concurrency` при постановке в очередь приводятся в соответствие с ограничениями контракта (≤ 8 MiB, 1-5 параллельно), поэтому завышенные значения не приведут к отправке недопустимых частей.',
  'upload.demo.usage.component.point3':
    '`partPayloadMode` действует на задачу: если переключить его во время загрузки, это затронет только задачи, добавленные позже.',
  'upload.demo.usage.hook.point1':
    '`tasks` и `resumable` — это снимки из подписки: прогресс обновляется без опроса, и частые обновления не пишутся в state.',
  'upload.demo.usage.hook.point2':
    '`start()` добавляет файлы и сразу начинает загрузку, возвращая id этих задач; для паузы / продолжения / повтора / отмены есть отдельные действия.',
  'upload.demo.usage.hook.point3':
    'Hook отдаёт только состояние и действия и не рисует интерфейс: список, полосы прогресса и кнопки полностью определяет бизнес-страница.',
  'upload.demo.tryRun.title': 'Как запустить',
  'upload.demo.tryRun.localMock':
    'На этой странице есть локальный mock (`src/pages/upload/_mock.ts`; umi загружает `_mock.ts` только из каталогов страниц): при запуске через `npm run start` (mock включается автоматически) цепочку загрузки можно пройти офлайн, а повторная загрузка того же файла сработает как мгновенная передача.',
  'upload.demo.tryRun.dev':
    'При запуске через `npm run dev` mock отключается, а `/api` проксируется на `localhost:8080`; в этом случае API бэкенда at-transfer должен быть уже готов.',
  'upload.demo.tryRun.auth':
    'Обратите внимание: как и другие бизнес-страницы, эта страница защищена проверкой входа (без входа происходит переход на `/user/login`); для API входа mock пока нет, нужен готовый бэкенд at-auth, поэтому mock покрывает только «цепочку загрузки».',
} as const;
