/**
 * Textos comunes globales (esqueleto de carga / estados vacíos / confirmación de operaciones peligrosas / progreso de subida).
 *
 * <p>Se colocan en `locales` en lugar de dentro de los componentes para que los «componentes de experiencia
 * unificada» no se queden atrás al cambiar de idioma: estos componentes se reutilizan desde varias páginas
 * de negocio, así que cualquier texto codificado de forma fija se filtraría a las interfaces en otros idiomas.
 */
export default {
  // Estados vacíos
  'common.empty.noData': 'Sin datos',
  'common.empty.noResult.title': 'No hay resultados coincidentes',
  'common.empty.noResult.desc':
    'Prueba a ajustar los filtros o a vaciar las palabras clave y volver a buscar',
  'common.empty.error.title': 'Error al cargar',
  'common.empty.error.desc':
    'Anomalía de red o del servicio; inténtalo de nuevo más tarde',
  'common.empty.error.action': 'Volver a cargar',
  'common.empty.denied.title': 'Sin permiso de acceso',
  'common.empty.denied.desc':
    'La cuenta actual no tiene este permiso; si lo necesitas, contacta al administrador',

  // Confirmación secundaria de operaciones peligrosas
  'common.danger.title': 'Confirma la operación',
  'common.danger.irreversible':
    'Esta operación no se puede deshacer; confírmala para continuar.',
  'common.danger.ok': 'Confirmar y ejecutar',
  'common.danger.cancel': 'Cancelar',

  // Acciones y separador reutilizados entre módulos (evita repetirlos en cada módulo y que se filtre chino en otras interfaces)
  'common.action.cancel': 'Cancelar',
  'common.action.confirm': 'Aceptar',
  'common.action.ok': 'Vale',
  'common.action.gotIt': 'Entendido',
  'common.action.close': 'Cerrar',
  'common.action.submit': 'Enviar',
  'common.action.save': 'Guardar',
  'common.action.retry': 'Reintentar',
  'common.action.copy': 'Copiar',
  'common.action.copied': 'Copiado',
  'common.action.selectAll': 'Seleccionar todo',
  'common.action.clear': 'Vaciar',
  'common.action.refresh': 'Actualizar',
  'common.listSeparator': ', ',
  'common.etcCount': 'y {count} más',

  // Progreso global de subida
  'common.upload.title': 'Tareas de subida',
  'common.upload.summary': '{active} en subida · {total} en total',
  'common.upload.idle': 'No hay subidas en curso',
  'common.upload.failed': '{count} fallidas',
  'common.upload.percent': 'Progreso total {percent}%',
  'common.upload.openPage': 'Abrir la página de subida',
  'common.upload.viewQueue': 'Ver',
  'common.upload.queue.default': 'Carga por fragmentos',
  'common.upload.queue.file-workbench': 'Espacio de trabajo de archivos',
  // «Subir un archivo local» dentro del chat: la página y el cajón usan cada uno su propia cola
  // (véase el encabezado de ChatAttachmentPicker; un mismo id cruzaría las llamadas de finalización),
  // pero el nombre de grupo es el mismo asunto, así que el texto no se distingue
  'common.upload.queue.chat-send': 'Enviar archivo por chat',
  'common.upload.queue.chat-send-drawer': 'Enviar archivo por chat',
  'common.upload.queue.unknown': 'Tarea de subida',
  'common.upload.status.working': 'Subiendo',
  'common.upload.status.paused': 'En pausa',
  'common.upload.status.success': 'Completada',
  'common.upload.status.error': 'Fallida',
  'common.upload.status.canceled': 'Cancelada',
  'common.upload.status.instant': 'Carga instantánea completada',
} as const;
