/** Textos del centro de aprobaciones (pendientes / tramitadas / detalle / decisión). */
export default {
  // Página
  'approval.title': 'Centro de aprobaciones',
  'approval.subtitle':
    'Aprobaciones pendientes y solicitudes de permiso que he iniciado',
  'approval.tab.pending': 'Pendientes de mi aprobación',
  'approval.tab.mine': 'Iniciadas por mí',
  'approval.slaNotice':
    'El SLA se calcula según el nivel de confidencialidad (público 24 h / interno 12 h / confidencial 4 h); el vencimiento solo genera un aviso, no aprueba ni concede permisos automáticamente.',
  'approval.decisionSubmitted': 'Resultado de aprobación enviado',
  'approval.longTerm': 'Vigencia permanente',

  // Columnas de la lista
  'approval.column.applicationNo': 'N.º de solicitud',
  'approval.column.applyAction': 'Acción solicitada',
  'approval.column.level': 'Nivel de confidencialidad',
  'approval.column.resource': 'Recurso',
  'approval.column.applicant': 'Solicitante',
  'approval.column.purpose': 'Uso previsto',
  'approval.column.desiredExpireAt': 'Caducidad deseada',
  'approval.column.sla': 'SLA',
  'approval.column.status': 'Estado',
  'approval.column.opinion': 'Comentario de aprobación',
  'approval.column.createdAt': 'Fecha de solicitud',
  'approval.column.actions': 'Acciones',

  // Acciones en línea
  'approval.rowAction.detail': 'Detalle',
  'approval.rowAction.approve': 'Aprobar',
  'approval.rowAction.reject': 'Rechazar',

  // Estado de la solicitud
  'approval.status.pending': 'Pendiente de aprobación',
  'approval.status.approved': 'Aprobada',
  'approval.status.rejected': 'Rechazada',
  'approval.status.transferred': 'Transferida',
  'approval.status.cancelled': 'Revocada',
  'approval.status.unknown': 'Desconocido',

  // Acción autorizada
  'approval.grantAction.access': 'Acceso (vista previa)',
  'approval.grantAction.download': 'Descarga',
  'approval.grantAction.edit': 'Edición',
  'approval.grantAction.share': 'Uso compartido externo',
  'approval.grantAction.unknown': 'Acción desconocida',

  // SLA (cuenta atrás y momento límite)
  'approval.sla.noDeadline': '--',
  'approval.sla.overdue.days': 'Vencido hace {days} días {hours} horas',
  'approval.sla.overdue.hours': 'Vencido hace {hours} horas {minutes} minutos',
  'approval.sla.overdue.minutes': 'Vencido hace {minutes} minutos',
  'approval.sla.tooltip':
    'Debe atenderse antes de {deadline} (el vencimiento solo avisa, no concede automáticamente)',

  // Cajón de detalle
  'approval.detail.title': 'Detalle de la solicitud',
  'approval.detail.slaDeadline': 'Fecha límite {deadline}',
  'approval.detail.timeline': 'Registro de tramitación',
  'approval.timeline.submit': 'Solicitud enviada',
  'approval.timeline.purpose': 'Uso: {purpose}',
  'approval.timeline.approved': 'Aprobación concedida',
  'approval.timeline.rejected': 'Aprobación rechazada',
  'approval.timeline.transferred': 'Transferida a otra persona',
  'approval.timeline.cancelled': 'Cancelada por el solicitante',
  'approval.timeline.pending': 'Pendiente de aprobación',

  // Diálogo de decisión
  'approval.modal.approveTitle': 'Aprobar solicitud',
  'approval.modal.rejectTitle': 'Rechazar solicitud',
  'approval.modal.approveOk': 'Confirmar aprobación',
  'approval.modal.rejectOk': 'Confirmar rechazo',
  'approval.modal.applicationNo': 'N.º de solicitud: {no}',
  'approval.modal.applyScope': 'Solicita: {action}',
  'approval.modal.desiredExpireAt': 'Caducidad deseada: {at}',
  'approval.modal.grantScope':
    'Alcance de la autorización (solo puede restringirse, nunca superar lo solicitado)',
  'approval.modal.grantScopeDownscoped':
    'Inferior a la acción solicitada «{action}»: se autorizará con un alcance menor',
  'approval.modal.grantScopeSame': 'Igual al alcance solicitado',
  'approval.modal.grantScopePlaceholder': 'Selecciona la acción a autorizar',
  'approval.modal.expireAt':
    'Vigencia de la autorización (solo puede acortarse, nunca superar el valor solicitado)',
  'approval.modal.expireCapped':
    'La hora elegida es posterior a la deseada por el solicitante; se ajustará a {expireAt}',
  'approval.modal.expireKeep': 'Déjalo vacío para vigencia permanente',
  'approval.modal.expirePlaceholder': 'Vacío = vigencia permanente',
  'approval.modal.opinionApprove': 'Comentario de aprobación (opcional)',
  'approval.modal.opinionReject': 'Motivo del rechazo (obligatorio)',
  'approval.modal.opinionMax': 'Máximo {max} caracteres',
  'approval.modal.opinionRequired': 'Indica el motivo del rechazo',
  'approval.modal.opinionPlaceholderApprove':
    'Puedes añadir las condiciones de la autorización',
  'approval.modal.opinionPlaceholderReject':
    'Explica el motivo del rechazo; se notificará al solicitante',
  'approval.modal.notice':
    'Surte efecto de inmediato tras la aprobación: ni el alcance ni la vigencia pueden ampliarse; si hiciera falta ampliarlos, el solicitante deberá presentar una nueva solicitud.',
  'approval.modal.approved': 'Solicitud aprobada',
  'approval.modal.rejected': 'Solicitud rechazada',
  'approval.modal.approveFailed': 'Error al aprobar',
  'approval.modal.rejectFailed': 'Error al rechazar',
} as const;
