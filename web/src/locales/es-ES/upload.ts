/** Textos de la página de carga por fragmentos y del diálogo de subida. */
export default {
  'upload.title': 'Subir archivos',
  'upload.titleWithFolder': 'Subir archivos (directorio n.º {folderId})',
  'upload.dropText': 'Haz clic o arrastra archivos aquí',
  'upload.dropHint':
    'Admite selección múltiple; los archivos grandes se fragmentan automáticamente (4 MiB por defecto) y se calcula su resumen; si se acierta la carga instantánea, no hay que transferir',
  'upload.instant': 'Carga instantánea',
  'upload.verifying': 'Verificando',
  'upload.chunkProgress': ' · {received}/{total} fragmentos',
  'upload.chunkTooltip': 'Fragmento {index}',
  'upload.retried': 'Reintentado automáticamente {count} veces',
  'upload.empty': 'Sin tareas de subida',
  'upload.summary':
    'En curso {uploading} · Completadas {finished} · Total {total}',

  // Estado de la tarea
  'upload.status.pending': 'En cola',
  'upload.status.hashing': 'Calculando resumen',
  'upload.status.prechecking': 'Comprobación de carga instantánea',
  'upload.status.querying': 'Consultando fragmentos',
  'upload.status.uploading': 'Subiendo',
  'upload.status.paused': 'En pausa',
  'upload.status.merging': 'Fusionando',
  'upload.status.success': 'Completada',
  'upload.status.error': 'Fallida',
  'upload.status.canceled': 'Cancelada',

  // Textos de error (se traducen al idioma actual antes de lanzarlos desde la capa de servicio, véase services/upload)
  'upload.error.generic': 'Error al subir',
  'upload.error.network':
    'Anomalía de red; comprueba la conexión e inténtalo de nuevo',
  'upload.error.timeout': 'Tiempo de espera de subida agotado',
  'upload.error.badContract':
    'La estructura de respuesta del servidor no cumple el contrato unificado',
  'upload.error.instantWithoutFileId':
    'La carga instantánea acertó pero no devolvió fileId',
  'upload.error.missWithoutUploadId':
    'La carga instantánea no acertó pero no devolvió uploadId',
  'upload.error.partHttp': 'Error al subir el fragmento (HTTP {status})',
  'upload.error.hashWorkerFailed': 'Error de ejecución del Worker de hash',
  'upload.error.hashFailed': 'Error al calcular el hash',

  // Acciones
  'upload.action.pause': 'Pausar',
  'upload.action.resume': 'Continuar',
  'upload.action.remove': 'Quitar',
  'upload.action.pauseAll': 'Pausar todo',
  'upload.action.resumeAll': 'Reanudar todo',
  'upload.action.clearFinished': 'Quitar las finalizadas',

  // Reanudación
  'upload.resumable.title': 'Se detectó una subida anterior sin completar',
  'upload.resumable.note':
    'El progreso de abajo proviene de la caché local y es solo orientativo; la posición real de reanudación se rige por la lista de fragmentos del servidor.',
  'upload.resumable.record':
    '{name} ({size}, completados {received}/{total} fragmentos)',
  'upload.resumable.ignore': 'Ignorar',
  'upload.resumable.select': 'Seleccionar el archivo para reanudar',
  'upload.resumable.hint':
    'Debe seleccionarse el mismo archivo con el mismo nombre que la vez anterior (si el nombre coincide pero el contenido ha cambiado, se detectará y se subirá de nuevo)',

  // Lista de completadas
  'upload.column.method': 'Modo',
  'upload.column.chunked': 'Carga por fragmentos',

  // Modo de subida (forma del cuerpo de la petición de fragmentos): las tarjetas de la página de demostración y el componente de subida comparten la misma denominación
  'upload.mode.title': 'Modo de subida',
  'upload.mode.subtitle':
    'Dos formas de cuerpo de petición por fragmentos; sus parámetros se guardan por separado',
  'upload.mode.active': 'En uso',
  'upload.mode.use': 'Usar este modo',
  'upload.mode.fact.request': 'Cuerpo de la petición',
  'upload.mode.fact.scene': 'Escenario de uso',
  'upload.mode.unsupportedTag': 'No compatible con el backend',
  'upload.mode.switchHint':
    'El cambio solo afecta a las tareas que se añadan después: las tareas en curso siguen usando el modo con el que empezaron, por lo que nunca se mezclan dos cuerpos de petición en una misma subida; los nuevos parámetros también surten efecto a partir de la siguiente tarea.',
  'upload.mode.multipart.title': 'Fragmento de formulario',
  'upload.mode.multipart.tag': 'multipart/form-data',
  'upload.mode.multipart.desc':
    'Cada fragmento se envía empaquetado como `FormData`; el índice y el resumen del fragmento se envían junto con los campos del formulario. Es lo más compatible y también el criterio predeterminado del backend actual.',
  'upload.mode.multipart.request':
    'Interfaz `PUT` de fragmentos, con cuerpo `FormData` (`chunk` + `index` + `hash`)',
  'upload.mode.multipart.scene':
    'El backend recibe los fragmentos con `@RequestPart` / `MultipartFile` de Spring (criterio predeterminado del contrato)',
  'upload.mode.octetStream.title': 'Flujo binario',
  'upload.mode.octetStream.tag': 'application/octet-stream',
  'upload.mode.octetStream.desc':
    'El fragmento se envía como flujo de bytes en crudo en el cuerpo de la petición; el índice del fragmento lo determina la URL, lo que elimina una capa de empaquetado de formulario y una copia en memoria.',
  'upload.mode.octetStream.request':
    'Interfaz `PUT` de fragmentos, con cuerpo de bytes en crudo (`Content-Type: application/octet-stream`, sin campo `hash`)',
  'upload.mode.octetStream.scene':
    'Escenarios de subida directa a almacenamiento de objetos, o en los que la pasarela reenvía el flujo en crudo sin analizar formularios',
  'upload.mode.octetStream.unsupported':
    'La interfaz de fragmentos de at-transfer actual solo declara `multipart/form-data`; si se elige, el envío del fragmento devolverá HTTP 415; el backend debe admitir primero la recepción de flujo en crudo (el lado del frontend ya está listo).',

  // Página de demostración (/upload). Las comillas invertidas del texto se renderizan como estilo de código en línea.
  'upload.demo.pageTitle': 'Carga por fragmentos',
  'upload.demo.pageSubtitle':
    'Carga instantánea · Reanudación · Fragmentos concurrentes',
  'upload.demo.pipeline.title': 'Cadena de subida',
  'upload.demo.pipeline.subtitle':
    'Resumen → carga instantánea → subida restante → fusión',
  'upload.demo.pipeline.desc':
    'Los archivos grandes calculan primero el resumen en local, y el servidor decide con él si se puede cargar al instante; si no acierta, solo se suben los fragmentos que faltan. En cualquier momento puedes actualizar la página y, al volver a seleccionar el mismo archivo, continuará desde la posición que el servidor ya haya recibido.',
  'upload.demo.step.hash.title': 'Calcular el valor de verificación',
  'upload.demo.step.hash.desc':
    'SHA-256 incremental dentro de un Worker, sin bloquear el hilo principal',
  'upload.demo.step.precheck.title': 'Comprobación de carga instantánea',
  'upload.demo.step.precheck.desc':
    'Si el resumen acierta, termina con 0 bytes transferidos',
  'upload.demo.step.query.title': 'Consultar los fragmentos recibidos',
  'upload.demo.step.query.desc': 'Se rige por la lista del servidor',
  'upload.demo.step.upload.title': 'Subida concurrente de fragmentos',
  'upload.demo.step.upload.desc':
    '3 concurrentes por defecto; reintento con retroceso si falla',
  'upload.demo.step.merge.title': 'Fusión y verificación',
  'upload.demo.step.merge.desc':
    'El servidor recalcula el resumen completo y luego fusiona',
  'upload.demo.chunkTitle': 'Demostración de carga por fragmentos',
  'upload.demo.finished.title': 'Archivos completados',
  'upload.demo.finished.subtitle':
    'Se conservan los últimos {count} como máximo',
  'upload.demo.usage.title': 'Formas de integración',
  'upload.demo.usage.subtitle':
    'Uso como componente o como Hook, compartiendo la misma cola',
  'upload.demo.usage.desc':
    'El componente trae su propia cola y visualización de progreso: basta con colocarlo en la página. Si en una página de negocio prefieres organizar tú el diseño, usa el Hook `useChunkUpload()` para obtener estado y acciones y dibuja tú la interfaz. Ambos solo entienden de `id`: un `id` igual es la misma cola y pueden combinarse en la misma página.',
  'upload.demo.usage.tab.component': 'Uso como componente',
  'upload.demo.usage.tab.hook': 'Uso como Hook',
  'upload.demo.usage.component.point1':
    'El `id` determina la identidad de la cola: varios componentes con el mismo id comparten una sola cola, y cambiar de página o volver a montarlos no interrumpe la transferencia.',
  'upload.demo.usage.component.point2':
    '`chunkSize` y `concurrency` se ajustan al rango del contrato al entrar en la cola (≤ 8 MiB, 1 ~ 5 concurrentes); pasar valores fuera de límite no enviará fragmentos ilegales.',
  'upload.demo.usage.component.point3':
    '`partPayloadMode` surte efecto por tarea: cambiarlo en mitad de la subida solo afecta a las tareas que se añadan después.',
  'upload.demo.usage.hook.point1':
    '`tasks` y `resumable` son instantáneas suscritas: la actualización del progreso no depende de sondeos y no escribe el progreso de alta frecuencia en el state.',
  'upload.demo.usage.hook.point2':
    '`start()` añade archivos y comienza, y devuelve el id de ese lote de tareas; pausar / reanudar / reintentar / cancelar tienen cada uno su acción.',
  'upload.demo.usage.hook.point3':
    'El Hook solo ofrece estado y acciones, no dibuja la interfaz: la lista, las barras de progreso y los botones los decide la propia página de negocio.',
  'upload.demo.tryRun.title': 'Cómo probarlo',
  'upload.demo.tryRun.localMock':
    'Esta página trae su propio mock local (`src/pages/upload/_mock.ts`; umi solo carga `_mock.ts` dentro del directorio de la página): al arrancar con `npm run start` (activa el mock automáticamente), la cadena de subida funciona sin conexión y, si vuelves a subir el mismo archivo, acierta la carga instantánea.',
  'upload.demo.tryRun.dev':
    'Arrancar con `npm run dev` desactiva el mock y redirige `/api` a `localhost:8080`; en ese caso hace falta que la interfaz at-transfer del backend esté lista.',
  'upload.demo.tryRun.auth':
    'Atención: como las demás páginas de negocio, esta está protegida por el guardián de inicio de sesión (si no has iniciado sesión, salta a `/user/login`); la interfaz de inicio de sesión aún no tiene mock y requiere que at-auth del backend esté listo, así que el mock solo cubre el tramo de la «cadena de subida».',
} as const;
