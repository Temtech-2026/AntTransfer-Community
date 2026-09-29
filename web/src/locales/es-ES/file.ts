/**
 * Textos del dominio de archivos: espacio de trabajo / lista / cuadrícula / papelera / vista previa / uso compartido externo / movimiento / solicitud de permiso / diálogo de subida.
 *
 * <p>Las funciones de presentación de `services/file` solo devuelven ids (se mantienen puras y comprobables),
 * mientras que el texto real está todo aquí, para evitar escribir la misma frase una vez en la capa de servicio
 * y otra en la de componentes.</p>
 */
export default {
  /* ============================ Nivel de confidencialidad ============================ */
  'file.level.public': 'Público',
  'file.level.internal': 'Interno',
  'file.level.classified': 'Confidencial',
  'file.level.unknown': 'Sin clasificar',
  'file.level.applyHint.classified':
    'Este archivo es de nivel confidencial: la solicitud pasa a aprobación multinivel y no concede permiso de descarga ni de uso compartido externo; solo abre la vista previa de forma temporal según necesidad.',
  'file.level.applyHint.internal':
    'Este archivo es de nivel interno: la solicitud concede por defecto solo vista previa y descarga; el uso compartido externo requiere una aprobación aparte.',
  'file.level.applyHint.public':
    'Este archivo es de nivel público: la aprobación es más rápida, pero aún hay que indicar un uso real.',
  'file.level.applyHint.unknown':
    'Este archivo aún no está clasificado: es posible que el aprobador pida completar primero la clasificación.',

  /* ============================ Insignias de seguridad ============================ */
  'file.security.classified.label': 'Confidencial',
  'file.security.classified.hint':
    'Nivel confidencial: la vista previa lleva marca de agua y la descarga deja rastro en todo momento; antes de compartirlo al exterior debe superar una aprobación',
  'file.security.watermark.label': 'Marca de agua',
  'file.security.watermark.hint':
    'La vista previa y la descarga se superponen con una marca de agua dinámica (con cuenta y hora) para rastrear filtraciones',
  'file.security.expiring.label': 'Caduca en {days} días',
  'file.security.expiring.hint':
    'Este elemento caducará en {days} días; entonces el enlace y la autorización quedarán invalidados a la vez',
  'file.security.expired.label': 'Caducado',
  'file.security.expired.hint':
    'Este elemento ha superado su fecha de caducidad; si necesitas seguir usándolo, solicita de nuevo la autorización',

  /* ============================ Grupos de extensión ============================ */
  'file.extGroup.doc': 'Documento',
  'file.extGroup.image': 'Imagen',
  'file.extGroup.video': 'Vídeo',
  'file.extGroup.audio': 'Audio',
  'file.extGroup.archive': 'Comprimido',

  /* ============================ Estado del uso compartido ============================ */
  'file.shareStatus.active': 'Vigente',
  'file.shareStatus.revoked': 'Revocado',
  'file.shareStatus.expired': 'Caducado',
  'file.shareStatus.unknown': 'Desconocido',

  /* ============================ Tipos de solicitud de permiso ============================ */
  'file.applyType.access.label': 'Acceso (vista previa)',
  'file.applyType.access.hint':
    'Solo vista previa en línea; no permite descargar ni compartir al exterior',
  'file.applyType.download.label': 'Descarga',
  'file.applyType.download.hint':
    'Permite descargar el original dejando rastro de uso',
  'file.applyType.edit.label': 'Edición',
  'file.applyType.edit.hint': 'Permite renombrar / mover / añadir versiones',
  'file.applyType.share.label': 'Uso compartido externo',
  'file.applyType.share.hint':
    'Permite crear enlaces externos; es lo de mayor riesgo',

  /* ============================ Acciones ============================ */
  'file.action.preview': 'Vista previa',
  'file.action.download': 'Descargar',
  'file.action.share': 'Compartir',
  'file.action.sendToChat': 'Enviar al chat',
  'file.action.applyPerm': 'Solicitar permiso',
  'file.action.delete': 'Eliminar',
  'file.action.restore': 'Restaurar',
  'file.action.destroy': 'Destruir por completo',
  'file.action.move': 'Mover',
  'file.action.recycle': 'Mover a la papelera',
  'file.action.clearSelection': 'Cancelar selección',
  'file.action.more': 'Más',
  'file.action.upload': 'Subir archivos',
  'file.action.enterRecycle': 'Papelera',
  'file.action.backToFiles': 'Volver a mis archivos',
  'file.action.emptyRecycle': 'Vaciar la papelera',
  'file.action.permission': 'Permisos',
  'file.action.refresh': 'Actualizar',
  /* ============================ Estructura de página ============================ */
  'file.title': 'Archivos',
  'file.subtitle': 'Filtra por directorio, nivel de confidencialidad y tipo',
  'file.section.myFiles': 'Mis archivos',
  'file.section.recycle': 'Papelera',
  'file.breadcrumb.all': 'Todos los archivos',
  'file.folder.children': 'Subdirectorios:',
  'file.folder.empty': 'No hay subdirectorios en el directorio actual',
  'file.folder.root': 'Todos los archivos (directorio raíz)',

  /* ============================ Columnas de la tabla ============================ */
  'file.column.name': 'Nombre del archivo',
  'file.column.ext': 'Tipo',
  'file.column.level': 'Nivel de confidencialidad',
  'file.column.size': 'Tamaño',
  'file.column.updateTime': 'Fecha de actualización',
  'file.column.recycleTime': 'Movido a la papelera',
  'file.column.action': 'Acciones',
  'file.recycle.today': 'Hoy',
  'file.recycle.daysAgo': 'Hace {days} días',

  /* ============================ Consulta y vistas ============================ */
  'file.query.name': 'Nombre del archivo',
  'file.query.namePlaceholder': 'Palabra clave del nombre',
  'file.query.ext': 'Tipo',
  'file.query.extAll': 'Todos los tipos',
  'file.query.level': 'Nivel de confidencialidad',
  'file.query.levelAll': 'Todos los niveles',
  'file.query.createTime': 'Fecha de creación',
  'file.query.submit': 'Buscar',
  'file.query.reset': 'Restablecer',
  'file.view.list': 'Lista',
  'file.view.grid': 'Cuadrícula',
  'file.total': '{total} en total',
  'file.selectedCount': '{count} seleccionados',
  'file.uploadingCount': '{count} subiendo',
  'file.grid.emptyRecycle': 'La papelera está vacía',
  'file.grid.emptyFolder':
    'Aún no hay archivos en el directorio actual; puedes subirlos o crear antes un subdirectorio',

  /* ============================ Descarga ============================ */
  'file.download.preparing': 'Preparando la descarga de {name}',
  'file.download.done':
    '{name} ha comenzado a descargarse; puedes verlo en la lista de descargas del navegador',
  'file.download.failed': 'Error al descargar',

  /* ============================ Papelera y destrucción ============================ */
  'file.recycle.confirmTitle': '¿Mover «{name}» a la papelera?',
  'file.recycle.confirmContent':
    'Tras moverlo a la papelera dejará de aparecer en «Mis archivos», pero se puede restaurar en cualquier momento sin perder datos.',
  'file.destroy.confirmTitle': '¿Destruir «{name}» por completo?',
  'file.destroy.confirmContent':
    'El archivo físico y todos sus fragmentos se eliminarán de forma permanente; la papelera deja de conservarlo y esta operación no se puede deshacer.',
  'file.restore.done': '«{name}» restaurado',
  'file.empty.confirmTitle': '¿Vaciar la papelera?',
  'file.empty.confirmContent':
    'Todos los archivos de la papelera se destruirán por completo y no se podrán recuperar. Si solo los necesitas más tarde, es mejor dejarlos en la papelera.',
  'file.empty.done': 'Se destruyeron {count} elementos',
  'file.empty.noop': 'La papelera ya estaba vacía',
  'file.batchRecycle.confirmTitle':
    '¿Mover los {count} elementos seleccionados a la papelera?',
  'file.batchRecycle.confirmContent':
    'Tras moverlos a la papelera dejarán de aparecer en «Mis archivos», pero se pueden restaurar en cualquier momento sin perder datos.',
  'file.batchRecycle.done': 'Se movieron {count} elementos a la papelera',
  'file.batchRecycle.noop': 'No se movió ningún elemento a la papelera',
  'file.recycle.alertTitle': 'Papelera',
  'file.recycle.alertDescription':
    'Los archivos de la papelera ya no aparecen en «Mis archivos». Aquí puedes restaurarlos o destruirlos por completo (sin recuperación); destruir requiere el permiso file:destroy.',
  'file.recycle.noFilterHint':
    'La papelera no admite filtros por palabra clave ni por nivel de confidencialidad: los elementos ya han salido del directorio y un filtrado podría inducir a error',
  'file.batch.shareMultiHint':
    'Solo se puede generar un enlace externo para un elemento a la vez; marca primero uno solo',
  'file.batch.applyMultiHint':
    'La solicitud de permiso se refiere a un elemento a la vez; marca primero uno solo',
  /* ============================ Vista previa ============================ */
  'file.preview.title': 'Vista previa',
  'file.preview.strategy.text': 'Texto',
  'file.preview.strategy.pdf': 'PDF',
  'file.preview.strategy.image': 'Imagen',
  'file.preview.strategy.downloadOnly': 'Solo descarga',
  'file.preview.strategy.none': 'No compatible',
  'file.preview.failedTitle': 'Error en la vista previa',
  'file.preview.loadFailed': 'Error al cargar la información de vista previa',
  'file.preview.empty': 'Aún no hay contenido de vista previa',
  'file.preview.truncated':
    'El contenido es largo; solo se muestran los primeros caracteres. Descarga el archivo para verlo completo',
  'file.preview.downloadOnlyTitle': 'Este tipo no admite vista previa en línea',
  'file.preview.downloadOnlyDescription':
    'Para reducir el riesgo de filtración, este formato no se transcodifica en el servidor; descárgalo y ábrelo en local.',
  'file.preview.downloadFile': 'Descargar archivo',
  'file.preview.unavailableTitle': 'No se puede previsualizar',
  'file.preview.unavailableDescription':
    'El servidor no ofrece un método de vista previa disponible; puede que el formato no sea compatible o que la capacidad de vista previa no esté activada.',

  /* ============================ Movimiento ============================ */
  'file.move.title': 'Mover a',
  'file.move.ok': 'Mover',
  'file.move.alertTitle': 'Mover solo cambia la ubicación',
  'file.move.alertDescription':
    'El nivel de confidencialidad, los enlaces compartidos y los permisos ya concedidos no cambian por moverlo.',
  'file.move.placeholder': 'Selecciona el directorio de destino',
  'file.move.pending': '{count} pendientes de mover',
  'file.move.pendingNames': ': {names}',
  'file.move.etc': ' etc.',
  'file.move.unchanged':
    '({count} ya están en el directorio de destino y se omitirán)',
  'file.move.noop':
    'El directorio de destino es el actual; no hace falta mover',
  'file.move.done': 'Se movieron {count} elementos a «{target}»',
  'file.move.failed': 'Error al mover {count} elementos: {names}',

  /* ============================ Solicitud de permiso ============================ */
  'file.apply.title': 'Solicitar permiso sobre el archivo',
  'file.apply.submitFailed': 'Error al enviar la solicitud',
  'file.apply.submittedTitle': 'Solicitud enviada',
  'file.apply.submittedSubTitle':
    'N.º de solicitud: {no}; puedes consultar el progreso en «Mis solicitudes»',
  'file.apply.submittedExtra':
    'Una vez aprobada, el permiso entra en vigor automáticamente y no hace falta reenviar; si se rechaza, puedes leer el comentario del aprobador y añadir aclaraciones antes de volver a enviarla.',
  'file.apply.field.file': 'Archivo solicitado',
  'file.apply.field.level': 'Nivel de confidencialidad del archivo',
  'file.apply.levelAlertTitle': 'Aviso de nivel de confidencialidad',
  'file.apply.field.applyType': 'Tipo de permiso',
  'file.apply.field.applyTypeRequired': 'Selecciona el tipo de permiso',
  'file.apply.field.purpose': 'Uso previsto',
  'file.apply.field.purposeRequired': 'Indica el uso previsto',
  'file.apply.field.purposeMin':
    'Escribe al menos 10 caracteres para que el aprobador pueda valorarlo',
  'file.apply.field.purposeMax': 'Máximo 500 caracteres',
  'file.apply.field.purposePlaceholder':
    'Por ejemplo: para cotejar datos del informe trimestral de negocio, de uso personal y sin compartirlo al exterior',
  'file.apply.field.expireAt': 'Vigencia deseada',
  'file.apply.field.expireAtExtra':
    'Déjalo vacío para solicitar un permiso a largo plazo (más difícil de aprobar); se recomienda indicar la necesidad real, pues al caducar se recupera automáticamente',
  'file.apply.field.expireAtPlaceholder': 'Selecciona la fecha de caducidad',
  'file.apply.footnote':
    'Tras el envío, el servidor registra la identidad y la hora del solicitante; no se puede solicitar en nombre de otra persona.',
  'file.apply.submit': 'Enviar solicitud',
  /* ============================ Diálogo de uso compartido externo ============================ */
  'file.share.presetDays': '{days} días',
  'file.share.title': 'Uso compartido externo',
  'file.share.titleWithName': 'Uso compartido externo: {name}',
  'file.share.createFailed': 'Error al crear el uso compartido externo',
  'file.share.missingFileId':
    'A este archivo le falta el ID de archivo físico y no se puede crear el enlace externo; actualiza e inténtalo de nuevo',
  'file.share.copied': 'Enlace y código de extracción copiados',
  'file.share.copyDenied':
    'El navegador ha denegado el acceso al portapapeles; selecciona y copia a mano',
  'file.share.again': 'Crear otro',
  'file.share.done': 'Listo',
  'file.share.generate': 'Generar enlace',
  'file.share.resultTitle': 'Enlace externo generado',
  'file.share.resultSubTitle':
    'El código de extracción no se volverá a mostrar; cópialo y comunícalo de inmediato',
  'file.share.field.url': 'Enlace para compartir',
  'file.share.field.code': 'Código de extracción',
  'file.share.field.expireAt': 'Válido hasta',
  'file.share.field.downloadLimit': 'Número de descargas permitidas',
  'file.share.times': '{count} veces',
  'file.share.copyBoth': 'Copiar el enlace y el código de extracción',
  'file.share.approvalRequiredTitle':
    'Archivo confidencial: debe superar la aprobación del administrador antes de compartirlo al exterior',
  'file.share.approvalRequiredDescription':
    'El uso compartido externo de un archivo confidencial exige como condición previa una «solicitud de alta confidencialidad ya aprobada»; generar el enlace directamente será rechazado por el servidor (403 / 1003). Envía primero desde la lista la solicitud de permiso para ese archivo y, una vez aprobada, vuelve aquí.',
  'file.share.warningTitle':
    'Un enlace externo equivale a sacar el archivo de la intranet',
  'file.share.warningDescription':
    'El enlace permite el acceso sin inicio de sesión con el código de extracción y todas las descargas dejan rastro; los archivos de nivel confidencial deben superar antes la aprobación de uso compartido externo, o el servidor los rechazará (403 / 1003).',
  'file.share.block.audience': 'Quién puede acceder',
  'file.share.audience.link': 'Acceso con el enlace',
  'file.share.audience.linkHint':
    'Cualquiera que tenga el enlace y el código de extracción puede verlo sin iniciar sesión; es adecuado para enviar a socios externos. Al no identificar a la persona, encaja mejor en escenarios «de un solo uso y con límite de veces».',
  'file.share.audience.member': 'Receptor designado',
  'file.share.audience.memberHint':
    'Autoriza con precisión por correo, teléfono u organigrama, de modo que solo lo vean las personas autorizadas. Requiere una interfaz de autorización interna en el servidor, que la versión CE actual no ofrece, por lo que esta opción no se puede seleccionar.',
  'file.share.block.policy': 'Permisos y política de seguridad',
  'file.share.field.codeLabel': 'Contraseña de acceso (código de extracción)',
  'file.share.field.codeRequired': 'Introduce el código de extracción',
  'file.share.field.codeRule':
    'El código de extracción debe tener {min}~{max} letras o dígitos',
  'file.share.field.codeExtra':
    'El servidor solo guarda el valor resumido (hash); tras cerrar el diálogo no se puede volver a mostrar, y si lo olvidas solo queda invalidar el enlace y crearlo de nuevo',
  'file.share.field.codePlaceholder': 'De 6 a 32 letras o dígitos',
  'file.share.random': 'Aleatorio',
  'file.share.copy': 'Copiar',
  'file.share.codeMissing': 'Genera o rellena antes el código de extracción',
  'file.share.codeCopied': 'Código de extracción copiado',
  'file.share.field.limitLabel': 'Límite de descargas',
  'file.share.field.limitRequired': 'Introduce el límite de descargas',
  'file.share.field.limitExtra':
    'Al alcanzar el límite, el enlace se invalida automáticamente; cancelar el enlace invalida de inmediato los tickets de descarga ya emitidos',
  'file.share.trace.label': 'Todas las descargas dejan rastro',
  'file.share.trace.description':
    'Activo de forma obligatoria: cada descarga registra la cuenta (los visitantes sin sesión, la IP y el UA), la hora y el archivo, y se puede rastrear en el registro de auditoría; no se puede desactivar.',
  'file.share.watermark.label': 'Marca de agua dinámica en la vista previa',
  'file.share.watermark.description':
    'Requiere que el servidor proporcione el interruptor de marca de agua y la capacidad de renderizado, que la versión CE actual no ofrece; al no marcarlo aquí, el enlace externo de este archivo no tendrá protección por marca de agua.',
  'file.share.block.expire': 'Vigencia',
  'file.share.field.expireLabel': 'Duración del enlace',
  'file.share.field.expireRequired': 'Selecciona la vigencia',
  'file.share.field.expireExtra':
    'Se calcula como «momento de generación + N días»; el máximo es {max} días y, si se supera, el servidor lo rechazará',
};
