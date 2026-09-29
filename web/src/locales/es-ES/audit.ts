/** Textos del registro de auditoría. */
export default {
  /* ============================ Estructura de página ============================ */
  'audit.page.title': 'Registro de auditoría',
  'audit.page.subTitle':
    'Consulta de solo lectura (el lado de escritura ya está anonimizado)',

  /* ============================ Sin permiso ============================ */
  'audit.denied.title': 'Solo accesible para auditores',
  'audit.denied.subTitle':
    'Esta página requiere el punto de permiso audit:log:read, que solo se concede al rol de auditor.',

  /* ============================ Criterios de búsqueda ============================ */
  'audit.criteria.title': 'Criterios de búsqueda',
  'audit.criteria.operatorPrefix': 'El operador solo admite',
  'audit.criteria.operatorStrong': 'coincidencia exacta por ID de usuario',
  'audit.criteria.operatorSuffix':
    '(el backend no ofrece búsqueda difusa por nombre visible);',
  'audit.criteria.timePrefix':
    'El intervalo de tiempo es cerrado y filtra por la hora del evento (',
  'audit.criteria.timeSuffix': ');',
  'audit.criteria.export':
    'La exportación usa los criterios de búsqueda actuales; el límite lo controla el servidor.',

  /* ============================ Barra de herramientas y avisos ============================ */
  'audit.toolbar.export': 'Exportar CSV',
  'audit.export.success': 'La descarga de la exportación ha comenzado',

  /* ============================ Filtros ============================ */
  'audit.filter.all': 'Todos',
  'audit.filter.allActions': 'Todas las acciones',

  /* ============================ Columnas ============================ */
  'audit.column.logTime': 'Hora',
  'audit.column.timeRange': 'Intervalo de tiempo',
  'audit.column.timeRangeStart': 'Inicio (incl.)',
  'audit.column.endTime': 'Hora de fin',
  'audit.column.timeRangeEnd': 'Fin (incl.)',
  'audit.column.operator': 'Operador',
  'audit.column.operatorIdPlaceholder': 'ID de usuario (coincidencia exacta)',
  'audit.column.action': 'Tipo de operación',
  'audit.column.module': 'Dominio',
  'audit.column.targetType': 'Tipo de objeto',
  'audit.column.target': 'Objeto de la operación',
  'audit.column.result': 'Resultado',
  'audit.column.ip': 'IP',
  'audit.column.traceId': 'ID de traza',
  'audit.column.detail': 'Detalle',

  /* ============================ Resultado ============================ */
  'audit.result.success': 'Correcto',
  'audit.result.failed': 'Fallido',
  'audit.result.unknown': 'Desconocido',

  /* ============================ Reserva para el operador ============================ */
  'audit.operator.deletedUser': 'Usuario dado de baja n.º {userId}',
  'audit.operator.system': 'Sistema / anónimo',

  /* ============================ Grupos de acciones ============================ */
  'audit.actionGroup.file': 'Archivos y directorios',
  'audit.actionGroup.share': 'Uso compartido externo',
  'audit.actionGroup.userRole': 'Usuarios y roles',
  'audit.actionGroup.approval': 'Aprobaciones y autorizaciones',

  /* ============================ Nombres de acciones (reflejan las constantes del backend) ============================ */
  'audit.action.FILE_UPLOAD': 'Subir archivo',
  'audit.action.FILE_DOWNLOAD': 'Descargar archivo',
  'audit.action.FILE_PREVIEW': 'Previsualizar archivo',
  'audit.action.FILE_RENAME': 'Renombrar archivo',
  'audit.action.FILE_MOVE': 'Mover archivo',
  'audit.action.FILE_COPY': 'Copiar archivo',
  'audit.action.FILE_DELETE': 'Mover a la papelera',
  'audit.action.FILE_RESTORE': 'Restaurar desde la papelera',
  'audit.action.FILE_DESTROY': 'Destruir por completo',
  'audit.action.RECYCLE_PURGE': 'Limpieza por caducidad de la papelera',
  'audit.action.FILE_TICKET_ISSUE': 'Emisión de ticket de descarga',
  'audit.action.FOLDER_CREATE': 'Crear directorio',
  'audit.action.FOLDER_RENAME': 'Renombrar directorio',
  'audit.action.FOLDER_MOVE': 'Mover directorio',
  'audit.action.FOLDER_DELETE': 'Eliminar directorio',
  'audit.action.FILE_TAG': 'Etiquetar / quitar etiqueta',
  'audit.action.VERSION_ROLLBACK': 'Revertir a una versión anterior',
  'audit.action.VERSION_CREATE': 'Subir nueva versión',
  'audit.action.VERSION_PRUNE': 'Poda de versiones',
  'audit.action.PACK_CREATE': 'Iniciar empaquetado por lotes',
  'audit.action.PACK_DOWNLOAD': 'Descargar el empaquetado',
  'audit.action.SHARE_CREATE': 'Crear uso compartido',
  'audit.action.SHARE_REVOKE': 'Revocar uso compartido',
  'audit.action.SHARE_DOWNLOAD': 'Descarga de visitante',
  'audit.action.SHARE_PREVIEW': 'Vista previa de visitante',
  'audit.action.SHARE_BLOCKED': 'Bloqueo de envío externo',
  'audit.action.SHARE_CODE_LOCKED': 'Bloqueo del código de extracción',
  'audit.action.USER_CREATE': 'Crear usuario',
  'audit.action.USER_UPDATE': 'Modificar usuario',
  'audit.action.USER_DELETE': 'Eliminar usuario',
  'audit.action.USER_STATUS': 'Activar / desactivar usuario',
  'audit.action.USER_PASSWORD_RESET': 'Restablecer contraseña',
  'audit.action.USER_ROLE_ASSIGN': 'Cambiar roles del usuario',
  'audit.action.ROLE_CREATE': 'Crear rol',
  'audit.action.ROLE_UPDATE': 'Modificar rol',
  'audit.action.ROLE_DELETE': 'Eliminar rol',
  'audit.action.ROLE_PERM_ASSIGN': 'Ajuste de autorización de rol',
  'audit.action.APPLY': 'Enviar solicitud',
  'audit.action.APPROVE': 'Aprobación concedida',
  'audit.action.REJECT': 'Aprobación rechazada',
  'audit.action.TRANSFER': 'Transferir aprobación',
  'audit.action.GRANT': 'Autorización aplicada',
  'audit.action.REVOKE': 'Revocación de autorización',
  'audit.action.GRANT_EXPIRE': 'Revocación por caducidad de autorización',

  /* ============================ Dominio ============================ */
  'audit.module.AUTH': 'Autenticación',
  'audit.module.PERMISSION': 'Permisos y administración del sistema',
  'audit.module.TRANSFER': 'Transferencia',
  'audit.module.FILE': 'Archivos',
  'audit.module.COLLABORATION': 'Colaboración',
  'audit.module.COMMON': 'Común',

  /* ============================ Tipo de objeto de la operación ============================ */
  'audit.target.SHARE': 'Enlace externo',
  'audit.target.FILE': 'Entrada de archivo',
  'audit.target.FOLDER': 'Directorio',
  'audit.target.TAG': 'Etiqueta',
  'audit.target.PACK_TASK': 'Tarea de empaquetado',
  'audit.target.USER': 'Cuenta de usuario',
  'audit.target.ROLE': 'Rol',
  'audit.target.PERMISSION': 'Punto de permiso',
  'audit.target.APPLICATION': 'Solicitud de permiso',
  'audit.target.GRANT': 'Registro de autorización',
  'audit.target.SYSTEM': 'Tarea del sistema',
} as const;
