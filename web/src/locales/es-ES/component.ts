/**
 * Textos de componentes comunes (barra superior / barra lateral / búsqueda global / campana de notificaciones / selector de organización / zona de arrastre / selector de etiquetas).
 *
 * <p>Estos componentes cuelgan de todo el armazón y se renderizan en cada página; cualquier texto codificado
 * de forma fija se filtraría a las interfaces en otros idiomas, así que se reúnen todos en este dominio.</p>
 */
export default {
  'component.langSwitch': 'Cambio de idioma',

  // Selector de etiquetas
  'component.tagSelect.expand': 'Expandir',
  'component.tagSelect.collapse': 'Contraer',
  'component.tagSelect.all': 'Todos',

  // Entradas al pie de la barra lateral
  'component.siderFooter.messages': 'Mensajes',
  'component.siderFooter.transfer': 'Transferencias',
  'component.siderFooter.openMessages': 'Abrir el panel de mensajes',
  'component.siderFooter.openTransfer': 'Abrir el centro de transferencias',

  // Búsqueda global de la barra superior
  'component.globalSearch.placeholder':
    'Busca nombre de archivo / etiqueta; pulsa Intro para ir al archivo',
  'component.globalSearch.ariaLabel': 'Búsqueda global',
  'component.globalSearch.scopeAria': 'Descripción del alcance de búsqueda',
  'component.globalSearch.scopeTitle':
    'Alcance de búsqueda: nombre de archivo y etiquetas (abre el espacio de trabajo de archivos).',

  // Entrada a la documentación de uso en la barra superior
  'component.docLink.title': 'Documentación de uso',

  // Contenido de la lista de artículos (componente de plantilla)
  'component.articleList.publishedAt': 'Publicado en',

  // Menú desplegable del avatar e información personal
  'component.avatar.profile': 'Información personal',
  'component.avatar.changePassword': 'Cambiar contraseña',
  'component.avatar.logout': 'Cerrar sesión',
  'component.avatar.account': 'Cuenta',
  'component.avatar.nickname': 'Apodo',
  'component.avatar.roles': 'Roles',

  // Cambio de avatar por el propio usuario en el diálogo de información personal (surte efecto al subir, sin pasar por el formulario)
  // Los avisos de fallo de la comprobación previa reutilizan system.user.avatar.tooLarge / typeInvalid:
  // checkAvatarFile es una comprobación previa compartida nombrada según el dominio de administración; no se crea
  // otro juego de claves para no mantener la misma frase en dos sitios
  'component.avatar.avatar.upload': 'Subir avatar',
  'component.avatar.avatar.hint':
    'Admite PNG / JPEG / GIF / WebP, sin superar {max}',
  'component.avatar.avatar.updated': 'Avatar actualizado',

  // Diálogo de cambio de contraseña por el propio usuario (tras el éxito se revocan todas las sesiones; hay que iniciar sesión de nuevo)
  'component.avatar.changePassword.title': 'Cambiar contraseña',
  'component.avatar.changePassword.alert.title':
    'Tras cambiarla deberás iniciar sesión de nuevo',
  'component.avatar.changePassword.alert.desc':
    'Para proteger la cuenta, al cambiar la contraseña se invalidan de inmediato los inicios de sesión de todos los dispositivos; vuelve a entrar con la nueva contraseña.',
  'component.avatar.changePassword.old': 'Contraseña actual',
  'component.avatar.changePassword.oldPlaceholder':
    'Introduce la contraseña actual',
  'component.avatar.changePassword.oldRequired':
    'Introduce la contraseña actual',
  'component.avatar.changePassword.new': 'Nueva contraseña',
  'component.avatar.changePassword.newPlaceholder':
    'Introduce la nueva contraseña',
  'component.avatar.changePassword.newRequired':
    'Introduce la nueva contraseña',
  'component.avatar.changePassword.newLength':
    'La contraseña debe tener entre 8 y 64 caracteres',
  'component.avatar.changePassword.newPattern':
    'La contraseña debe incluir letras y números a la vez, y no contener espacios',
  'component.avatar.changePassword.policyHint':
    '8-64 caracteres, con letras y números a la vez',
  'component.avatar.changePassword.confirm': 'Confirmar la nueva contraseña',
  'component.avatar.changePassword.confirmPlaceholder':
    'Introduce de nuevo la nueva contraseña',
  'component.avatar.changePassword.confirmRequired':
    'Introduce de nuevo la nueva contraseña',
  'component.avatar.changePassword.confirmMismatch':
    'Las dos contraseñas nuevas introducidas no coinciden',
  'component.avatar.changePassword.submit': 'Confirmar cambio',
  'component.avatar.changePassword.done':
    'Contraseña cambiada; vuelve a iniciar sesión con la nueva contraseña',

  // Campana de notificaciones
  'component.notify.title': 'Notificaciones',
  'component.notify.count.inbox': 'Notificaciones {count}',
  'component.notify.count.todo': 'Pendientes {count}',
  'component.notify.count.chat': 'Mensajes privados {count}',
  'component.notify.markAllRead': 'Marcar todo como leído',
  'component.notify.markedAllRead': 'Todo marcado como leído',
  'component.notify.status.idle': 'Canal en tiempo real no iniciado',
  'component.notify.status.connecting': 'Conectando…',
  'component.notify.status.open': 'Notificaciones en tiempo real conectadas',
  'component.notify.status.reconnecting':
    'Conexión interrumpida; reconectando…',
  'component.notify.status.closed': 'Canal en tiempo real desconectado',

  // Selector de organización / equipo
  'component.org.defaultName': 'Organización predeterminada',
  'component.org.current': 'Despliegue actual',
  'component.org.create': 'Crear organización / equipo',
  'component.org.switch': 'Cambiar a otra organización',
  'component.org.tooltip': 'Organización actual: {name}',

  // Zona de arrastre / selección de archivos
  'component.dropZone.title':
    'Arrastra archivos aquí o haz clic para seleccionarlos',

  // Componente de carga por fragmentos
  'component.chunkUpload.title': 'Subida de archivos',
  'component.chunkUpload.busy': '{count} tareas en curso',
  'component.chunkUpload.resumableCount':
    'Se detectaron {count} subidas sin completar',
  'component.chunkUpload.resumableNote':
    'Para evitar transferencias duplicadas, vuelve a seleccionar el mismo archivo; el sistema omitirá los fragmentos que el servidor ya haya recibido y continuará la subida.',
  'component.chunkUpload.resumableSelect':
    'Volver a seleccionar el archivo para continuar',
  'component.chunkUpload.instantDone': 'Carga instantánea completada',
  'component.chunkUpload.instantSuccess': 'Carga instantánea correcta',
  'component.chunkUpload.progress.hashing':
    'Calculando el valor de verificación del archivo…',
  'component.chunkUpload.progress.prechecking':
    'Comprobando si se puede cargar al instante…',
  'component.chunkUpload.progress.querying':
    'Obteniendo los fragmentos ya subidos…',
  'component.chunkUpload.progress.merging': 'Fusionando fragmentos…',
  'component.chunkUpload.progress.paused':
    'En pausa (completados {received}/{total} fragmentos)',
  'component.chunkUpload.progress.failed': 'Error al subir',
  'component.chunkUpload.progress.uploading':
    '{received}/{total} fragmentos · {speed}',
  'component.chunkUpload.progress.retried': ' · Reintentado {count} veces',
  'component.chunkUpload.progress.chunks': '{count} fragmentos',
  'component.chunkUpload.retryTooltip':
    'Reintento automático con retroceso exponencial ante fluctuaciones de red',
  'component.chunkUpload.retryTag': 'Reintentar {count}',
  'component.chunkUpload.draggerText':
    'Haz clic o arrastra archivos aquí para subirlos',
  'component.chunkUpload.draggerHint':
    'Admite carga por fragmentos de archivos grandes, carga instantánea y reanudación; si un archivo falla, se reintenta automáticamente {count} veces',
  'component.chunkUpload.chunkSize': 'Tamaño del fragmento',
  'component.chunkUpload.concurrency': 'Número de concurrentes',
  'component.chunkUpload.tuningNote':
    'Los cambios surten efecto en los fragmentos posteriores',
  'component.chunkUpload.overallProgress': 'Progreso total',
  'component.chunkUpload.overallSummary':
    '{finished}/{total} archivos · {uploaded} / {totalSize}',

  // Bloques de código (sección de documentación que muestra código de ejemplo)
  'component.codeBlock.copy': 'Copiar',
  'component.codeBlock.copied': 'Copiado',
  'component.codeBlock.copyFailed': 'Error al copiar',

  // Ventana flotante de monitorización de transferencias
  'component.transfer.title': 'Centro de transferencias',
  'component.transfer.expand': 'Expandir el centro de transferencias',
  'component.transfer.collapse': 'Contraer el centro de transferencias',
  'component.transfer.capsule': '{count} en transferencia',
  'component.transfer.summary': '{active} en curso · {success} completadas',
  'component.transfer.summaryFailed': ' · {count} fallidas',
  'component.transfer.pauseAll': 'Pausar todo',
  'component.transfer.resumeAll': 'Reanudar todo / reintentar las fallidas',
  'component.transfer.clearFinished':
    'Vaciar completadas / canceladas / fallidas',
  'component.transfer.fastMode': 'Modo ultrarrápido',
  'component.transfer.fastModeHint':
    'Eleva el número de fragmentos concurrentes hasta el límite del contrato (5); también afecta a las tareas en curso. El número de concurrentes elegido en la página de subida queda anulado por este interruptor.',
  'component.transfer.empty': 'Sin tareas de transferencia',
  'component.transfer.chartAria': 'Curva de velocidad de transferencia',
  'component.transfer.pause': 'Pausar',
  'component.transfer.resumeRetry': 'Continuar / reintentar',
  'component.transfer.pauseNamed': 'Pausar {name}',
  'component.transfer.resumeNamed': 'Continuar {name}',
  'component.transfer.status.active': 'En transferencia',
  'component.transfer.status.paused': 'En pausa',
  'component.transfer.status.error': 'Fallida',
  'component.transfer.status.success': 'Completada',
  'component.transfer.status.canceled': 'Cancelada',
  // Sonido de mensaje nuevo (dentro del perfil; presets e interruptores comparten el prefijo)
  'component.avatar.notifySound.title': 'Sonido de mensaje nuevo',
  'component.avatar.notifySound.enabled':
    'Reproducir un sonido al recibir mensajes',
  'component.avatar.notifySound.presetLabel': 'Sonido',
  'component.avatar.notifySound.preset.default': 'Predeterminado',
  'component.avatar.notifySound.preset.chime': 'Campana',
  'component.avatar.notifySound.preset.bubble': 'Burbuja',
  'component.avatar.notifySound.preset.custom': 'Personalizado',
  'component.avatar.notifySound.upload': 'Subir audio',
  'component.avatar.notifySound.replace': 'Cambiar audio',
  'component.avatar.notifySound.clear': 'Eliminar',
  'component.avatar.notifySound.preview': 'Escuchar',
  'component.avatar.notifySound.uploaded':
    'Subido; el sonido se cambió a personalizado',
  'component.avatar.notifySound.cleared': 'Sonido personalizado eliminado',
  'component.avatar.notifySound.loadFailed':
    'No se pudo cargar la configuración de sonido',
  'component.avatar.notifySound.typeInvalid':
    'Solo se admite audio MP3 / WAV / OGG',
  'component.avatar.notifySound.tooLarge': 'El audio no puede superar {max}',
  'component.avatar.notifySound.previewBlocked':
    'El navegador bloqueó la reproducción automática. Haz clic en cualquier parte de la página e inténtalo de nuevo.',
  'component.avatar.notifySound.customEmpty': 'Aún no has subido ningún audio',
  'component.avatar.notifySound.customMeta':
    'Audio actual: {name} ({size}, {duration})',
  'component.avatar.notifySound.hint':
    'Admite MP3 / WAV / OGG, hasta {maxSize} y {maxDuration} de duración',
} as const;
