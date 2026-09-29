/** Textos del centro de mensajes (notificaciones del sistema + pendientes). */
export default {
  'message.title': 'Centro de mensajes',
  'message.subtitle':
    'Las aprobaciones pendientes, el uso compartido y los avisos de seguridad se reúnen aquí en tiempo real',
  'message.tab.notifications': 'Notificaciones del sistema',
  'message.tab.todos': 'Pendientes',
  'message.unread.badge': '{count} sin leer',
  'message.unread.inbox': 'Notificaciones del sistema sin leer: {count}',
  'message.unread.todo': 'Pendientes sin resolver: {count}',

  'message.action.refresh': 'Actualizar',
  'message.action.markAllRead': 'Marcar todo como leído',
  'message.action.markRead': 'Marcar como leído',
  'message.action.markedRead': 'Marcado como leído',
  'message.action.allMarkedRead':
    'Se marcaron {count} notificaciones como leídas',
  'message.action.allReadNoop': 'No hay notificaciones sin leer',
  'message.action.jump': 'Atender',
  'message.action.markHandled': 'Marcar como resuelto',
  'message.action.handled': 'Marcado como resuelto',

  'message.state.new': 'Nuevo',
  'message.state.unread': 'Sin leer',
  'message.state.read': 'Leído',

  'message.connection.connecting': 'Estableciendo conexión en tiempo real…',
  'message.connection.reconnecting':
    'La conexión en tiempo real se ha interrumpido; reconectando automáticamente…',
  'message.connection.closed':
    'La conexión en tiempo real está cerrada; los mensajes nuevos llegarán con retraso',
  'message.connection.reconnectNow': 'Reconectar ahora',
  'message.connection.restored': 'Conexión en tiempo real restablecida',
  'message.connection.backfilled':
    'Se recuperaron {count} mensajes recibidos durante la desconexión',
  'message.connection.offlineHint':
    'Los mensajes de la desconexión se recuperarán automáticamente al reconectar',

  'message.empty.title': 'Sin mensajes',
  'message.empty.desc':
    'Las aprobaciones, el uso compartido y los avisos de seguridad aparecerán aquí en tiempo real',
  'message.empty.filteredTitle': 'No hay mensajes sin leer',
  'message.empty.filteredDesc':
    'Cambia a «Todos» para revisar notificaciones anteriores',

  'message.todo.filter.pending': 'Sin resolver',
  'message.todo.filter.done': 'Resueltos',
  'message.todo.filter.all': 'Todos',
  'message.todo.empty.title': 'Sin pendientes',
  'message.todo.empty.desc':
    'Ahora mismo no tienes aprobaciones ni avisos que atender',
  'message.todo.empty.doneTitle': 'Aún no hay registros resueltos',
  'message.todo.empty.doneDesc':
    'Los pendientes que hayas atendido se archivarán aquí',
  'message.todo.source.approval': 'Pendiente de mi aprobación',
  'message.todo.source.approvalResult': 'Resultado de aprobación',
  'message.todo.source.transfer': 'Transferencia completada',
  'message.todo.jumpMissing':
    'La página correspondiente aún no está disponible; puedes consultarla por ahora en el centro de aprobaciones',

  'message.type.1': 'Pendiente de mi aprobación',
  'message.type.2': 'Resultado de aprobación',
  'message.type.3': 'Enlace bloqueado',
  'message.type.4': 'Enlace caducado',
  'message.type.5': 'Aviso de seguridad',
  'message.type.8': 'Transferencia completada',
  'message.type.9': 'Confirmación de recogida',
  'message.type.unknown': 'Notificación del sistema',
} as const;
