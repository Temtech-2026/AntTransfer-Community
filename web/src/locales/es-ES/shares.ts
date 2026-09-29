/** Textos de la página de gestión de uso compartido y del diálogo de creación de enlaces externos. */
export default {
  /* ============================ Página ============================ */
  'shares.page.title': 'Gestión de uso compartido',
  'shares.page.subtitle':
    'Enlaces externos que he creado; el código de extracción no se vuelve a mostrar y, tras cancelarlo, no se puede recuperar',
  'shares.denied':
    'La cuenta actual no tiene permiso de uso compartido externo (file:share); contacta al administrador para habilitarlo',
  'shares.table.title': 'Mis elementos compartidos',

  /* ============================ Acciones ============================ */
  'shares.action.create': 'Crear uso compartido',
  'shares.action.copy': 'Copiar enlace',
  'shares.action.revoke': 'Cancelar uso compartido',

  /* ============================ Copia ============================ */
  'shares.copy.success':
    'Enlace copiado; el código de extracción no se vuelve a mostrar, usa el mismo con el que se creó',
  'shares.copy.manualTitle': 'Copia el enlace manualmente',
  'shares.copy.disabled': 'Solo se pueden copiar los usos compartidos vigentes',

  /* ============================ Revocación ============================ */
  'shares.revoke.success':
    'Uso compartido cancelado; el enlace deja de ser válido de inmediato',
  'shares.revoke.confirmTitle': '¿Cancelar este enlace compartido?',
  'shares.revoke.confirmContent':
    'Tras cancelarlo, el enlace deja de ser válido de inmediato y el código de extracción ya enviado también queda anulado. Para volver a compartirlo, tendrás que crearlo de nuevo y generar un enlace nuevo.',
  'shares.revoke.confirmOk': 'Confirmar cancelación',

  /* ==================== Invalidación por lotes (casillas de fila / todo de una vez) ==================== */
  'shares.action.revokeSelected': 'Invalidar los seleccionados',
  'shares.action.revokeSelectedCount': 'Invalidar los seleccionados ({count})',
  'shares.action.revokeAll': 'Invalidar todos',
  'shares.revokeBatch.success': 'Se invalidaron {count} enlaces compartidos',
  'shares.revoke.none': 'No hay enlaces compartidos vigentes',
  'shares.revokeSelected.confirmTitle':
    '¿Invalidar los {count} elementos compartidos seleccionados?',
  'shares.revokeSelected.confirmContent':
    'Los enlaces seleccionados dejan de ser válidos de inmediato y el código de extracción ya enviado también queda anulado. La invalidación es un estado final y no se puede deshacer.',
  'shares.revokeSelected.confirmOk': 'Confirmar invalidación',
  'shares.revokeAll.confirmTitle':
    '¿Invalidar todos los usos compartidos vigentes?',
  'shares.revokeAll.confirmContent':
    'Se invalidarán todos los enlaces «vigentes» de la cuenta actual (no solo los de esta página); los enlaces y códigos de extracción ya enviados quedarán anulados de inmediato. La invalidación es un estado final y no se puede deshacer.',
  'shares.revokeAll.confirmOk': 'Confirmar invalidación total',

  /* ============================ Creación correcta ============================ */
  'shares.created.title': 'Uso compartido creado',
  'shares.created.ok': 'Entendido',
  'shares.created.code': 'Código de extracción: ',
  'shares.created.note':
    'El servidor solo guarda el hash del código de extracción; una vez cerrada esta ventana no podrá volver a consultarse, así que comunícalo al destinatario de inmediato.',

  /* ============================ Columnas de la tabla ============================ */
  'shares.column.deletedFile': '(archivo eliminado)',
  'shares.column.status': 'Estado',
  'shares.column.expireAt': 'Válido hasta',
  'shares.column.used': 'Veces usadas',
  'shares.column.unlimited': 'Sin límite',
  'shares.column.remaining': 'Veces restantes',
  'shares.column.extractCode': 'Código de extracción',
  'shares.column.extractOn': 'Activado',
  'shares.column.extractOff': 'Desactivado',
  'shares.column.createTime': 'Fecha de creación',

  /* ============================ Diálogo de creación ============================ */
  'shares.create.title': 'Crear uso compartido externo',
  'shares.create.file': 'Archivo a compartir',
  'shares.create.filePlaceholder': 'Escribe el nombre del archivo para buscar',
  'shares.create.fileRequired': 'Selecciona el archivo que quieres compartir',
  'shares.create.fileNotFound': 'No hay archivos coincidentes',
  'shares.create.expire': 'Vigencia',
  'shares.create.expireRequired': 'Selecciona la vigencia',
  'shares.create.expireExtra':
    'Máximo {days} días; al caducar, el enlace deja de ser válido automáticamente',
  'shares.create.downloadLimit': 'Límite de descargas',
  'shares.create.downloadLimitRequired': 'Introduce el límite de descargas',
  'shares.create.downloadLimitExtra':
    'De 1 a {max} veces; al agotarse, el enlace deja de ser válido automáticamente',
  'shares.create.extractCode': 'Código de extracción',
  'shares.create.extractCodeRequired': 'Introduce el código de extracción',
  'shares.create.extractCodeRule':
    'El código de extracción debe tener {min}~{max} letras o dígitos',
  'shares.create.extractCodeExtra':
    'El servidor solo guarda el hash; tras crearlo, comunícalo al destinatario de inmediato, pues después no podrá volver a consultarse',

  /* ==================== Página de recogida del visitante (/share/:token, sin inicio de sesión) ==================== */
  'shares.visit.subtitle':
    'Alguien te ha enviado archivos a través de AntTransfer; introduce el código de extracción para recogerlos',
  'shares.visit.invalidLink':
    'Enlace incompleto: falta el token de uso compartido; comprueba que has copiado el enlace completo',
  'shares.visit.code.label': 'Código de extracción',
  'shares.visit.code.placeholder':
    'Introduce el código de extracción que recibiste por correo o chat',
  'shares.visit.code.prefilled':
    'Se ha rellenado automáticamente el código del enlace; confírmalo y pulsa «Extraer archivos»',
  'shares.visit.code.required': 'Introduce el código de extracción',
  'shares.visit.submit': 'Extraer archivos',
  'shares.visit.redeemed':
    'Extracción correcta; pulsa el botón de abajo para descargar',
  'shares.visit.ticketTtl':
    'La dirección de descarga es válida durante {minutes} minutos; al caducar habrá que extraer de nuevo y se consumirá otra vez una recogida',
  'shares.visit.unknownFile': '(no se pudo obtener el nombre del archivo)',
  'shares.visit.download': 'Descargar archivo',
  'shares.visit.footer':
    'El enlace solo permite la recogida a quien tiene el código de extracción; no lo reenvíes a personas ajenas',
} as const;
