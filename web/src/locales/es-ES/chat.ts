/** Textos de la página de chat (lista de conversaciones + ventana de chat). */
export default {
  'chat.title': 'Chat',
  'chat.subtitle':
    'Conversaciones privadas / de grupo, envío y recepción en tiempo real',

  'chat.action.refresh': 'Actualizar',
  'chat.action.new': 'Iniciar conversación',
  'chat.action.send': 'Enviar',

  'chat.list.title': 'Conversaciones',
  'chat.search.placeholder': 'Buscar conversaciones',
  'chat.list.empty.title': 'Aún no hay conversaciones',
  'chat.list.empty.desc':
    'Pulsa «Iniciar conversación» para elegir a un compañero y empezar un chat privado, o introduce el ID del grupo para iniciar un chat de grupo',
  'chat.list.emptyFiltered.title': 'No hay conversaciones coincidentes',
  'chat.list.emptyFiltered.desc': 'Prueba con otra palabra clave',

  'chat.session.groupFallback': 'Chat de grupo n.º {id}',
  'chat.session.userFallback': 'Usuario n.º {id}',
  'chat.tag.private': 'Privado',
  'chat.tag.group': 'Grupo',
  'chat.sender.mine': 'Yo',

  // Confirmación de lectura: texto accesible de la fila de avatares de lectores bajo la burbuja (la información de solo iconos debe tener equivalente textual)
  'chat.read.by': 'Leído por: {names}',
  'chat.read.more': 'y {count} personas más lo han leído',

  // Menú contextual del mensaje: retirar (solo los propios y dentro de 2 minutos) y citar (responder a un mensaje concreto)
  'chat.message.action.quote': 'Citar',
  'chat.message.action.recall': 'Retirar',
  // Texto de sustitución tras retirar una burbuja: se escribe «quién la retiró» en vez de solo «retirado»,
  // porque en un chat de grupo esto último haría pensar que fue uno mismo
  'chat.message.recalled.mine': 'Has retirado un mensaje',
  'chat.message.recalled.other': '{name} ha retirado un mensaje',
  'chat.message.recall.success': 'Retirado',
  'chat.message.recall.failed':
    'Error al retirar; inténtalo de nuevo más tarde',

  // Aviso de «citando» sobre el cuadro de entrada
  'chat.composer.quote.cancel': 'Cancelar la cita',

  // Estado del interlocutor: la página de chat y el cajón comparten el mismo componente, así que el texto no pertenece a ninguno de los dos
  // Los tres estados deben llevar texto: solo con el punto verde/gris/rojo, los usuarios con daltonismo y en modo de alto contraste se quedan sin información
  'chat.presence.online': 'En línea',
  'chat.presence.offline': 'Desconectado',
  'chat.presence.unstable': 'Red inestable',
  // Comparte la misma fila que los tres estados anteriores: mientras el otro escribe, esta información es más inmediata que un estado estático
  'chat.typing': 'El otro está escribiendo…',

  // Calidad de nuestra propia conexión (siempre visible en el encabezado del chat):
  // no confundir con la presencia del interlocutor de arriba
  'chat.connection.open': 'Conexión en tiempo real correcta',
  'chat.connection.connecting': 'Conectando…',
  'chat.connection.reconnecting': 'Reconectando…',
  'chat.connection.closed': 'Conexión cerrada',
  'chat.connection.idle': 'Sin conexión',

  'chat.stream.placeholder.title':
    'Selecciona una conversación a la izquierda para empezar a chatear',
  'chat.stream.placeholder.desc':
    'El historial se sincroniza en tiempo real y lo recibido durante una desconexión se recupera al reconectar',
  'chat.stream.empty.title': 'Aún no hay mensajes',
  'chat.stream.empty.desc': 'Envía el primer mensaje para saludar',
  'chat.stream.loadMore': 'Cargar mensajes anteriores',
  'chat.stream.loadingMore': 'Cargando…',
  'chat.stream.noMore': 'No hay mensajes más antiguos',
  'chat.stream.loadMoreFailed':
    'Error al cargar mensajes anteriores; inténtalo de nuevo',
  // El criterio del cuadro de entrada se alinea con WeChat: Enter envía, Shift + Enter salta de línea
  'chat.composer.placeholder':
    'Escribe un mensaje; Enter envía y Shift + Enter salta de línea',
  'chat.composer.empty': 'El mensaje no puede estar vacío',
  'chat.composer.sendHint': 'Enter envía, Shift + Enter salta de línea',
  'chat.composer.emoji': 'Emoticonos',
  'chat.composer.emojiPanel': 'Categorías de emoticonos',
  'chat.composer.group.recent': 'Usados recientemente',
  'chat.composer.group.smileys': 'Emoticonos',
  'chat.composer.group.gestures': 'Gestos',
  'chat.composer.group.people': 'Personas y estados de ánimo',
  'chat.composer.group.animals': 'Animales y naturaleza',
  'chat.composer.group.food': 'Comida',
  'chat.composer.group.objects': 'Objetos y actividades',
  'chat.composer.group.symbols': 'Símbolos',

  // Mención @: la entrada solo aparece en chats de grupo (el privado no tiene semántica de mención; véase ChatComposer.mentionEnabled)
  'chat.composer.mention': 'Mencionar a un miembro',
  'chat.composer.mentionPanel': 'Miembros a los que se puede mencionar',
  'chat.composer.mentionEmpty': 'No hay miembros coincidentes',
  // «Alguien me ha mencionado»: el prefijo del resumen en la lista, el énfasis del distintivo y la marca en la burbuja comparten una sola frase
  'chat.mention.me': 'Alguien me ha mencionado',

  'chat.new.title': 'Iniciar conversación',
  'chat.new.scope.label': 'Tipo de conversación',
  'chat.new.scope.private': 'Privada',
  'chat.new.scope.group': 'De grupo',
  'chat.new.user.placeholder': 'Escribe una cuenta o un apodo para buscar',
  'chat.new.user.optionLabel': '{name} ({username})',
  'chat.new.user.resolveHint':
    'Introduce la cuenta de inicio de sesión del otro; se verificará automáticamente al salir del campo',
  'chat.new.user.resolved': 'Encontrado: {name}',
  'chat.new.user.notFound':
    'No se encontró ningún usuario disponible con esa cuenta; verifícala e inténtalo de nuevo',
  'chat.new.target.label': 'Cuenta de inicio de sesión del otro',
  'chat.new.target.placeholder':
    'Introduce la cuenta de inicio de sesión del otro',
  'chat.new.target.required':
    'Selecciona primero el destino de la conversación',
  'chat.new.target.accountRequired':
    'Introduce primero la cuenta de inicio de sesión del otro',

  // Chat de grupo: formulario de creación (nombre del grupo + miembros invitados) y entrada «Grupos a los que pertenezco».
  // Se ha eliminado el antiguo campo manual de «ID del grupo»: antes ni se podía crear un grupo ni se conocía su ID, así que esa entrada no llevaba a ninguna parte
  'chat.new.group.nameLabel': 'Nombre del chat de grupo',
  'chat.new.group.namePlaceholder': 'Introduce el nombre del chat de grupo',
  'chat.new.group.nameRequired':
    'Introduce primero el nombre del chat de grupo',
  'chat.new.group.memberLabel': 'Miembros del grupo',
  'chat.new.group.memberPlaceholder':
    'Escribe la cuenta del miembro y pulsa Intro para añadirlo',
  'chat.new.group.memberHint':
    'Invita al menos a 1 miembro; como máximo {max} personas, tú incluido',
  'chat.new.group.memberRequired': 'Invita al menos a un miembro del grupo',
  'chat.new.group.memberLimit':
    'El grupo admite como máximo {max} personas (tú incluido)',
  'chat.new.group.firstMessageFailed':
    'El chat de grupo se creó, pero falló el envío del primer mensaje; vuelve a enviarlo en el cuadro de chat',
  'chat.new.group.existingLabel': 'Grupos a los que pertenezco',
  'chat.new.group.existingPlaceholder':
    'Al seleccionarlo, entrarás directamente en ese grupo',
  'chat.new.group.optionLabel': '{name} ({count} personas)',
  'chat.new.content.required':
    'Escribe primero el primer mensaje (la conversación se crea al enviarlo)',
  'chat.new.content.label': 'Primer mensaje',
  'chat.new.content.placeholder': 'Escribe una frase para saludar',
  'chat.new.submit': 'Iniciar',
  'chat.new.cancel': 'Cancelar',
  // Panel de ajustes del grupo (la página /chat y el cajón de mensajería comparten el mismo componente; el texto no pertenece a ninguno de los dos).
  // La visibilidad de los botones es la conjunción de «punto de permiso CHAT_PERM ∧ ability enviada por el servidor»; véase components/ChatGroupPanel
  'chat.group.title': 'Ajustes del grupo',
  'chat.group.close': 'Cerrar',
  'chat.group.info': 'Datos del grupo',
  'chat.group.name.placeholder': 'Introduce el nombre del grupo',
  'chat.group.name.required': 'El nombre del grupo no puede estar vacío',
  'chat.group.name.save': 'Guardar',
  'chat.group.name.success': 'Nombre del grupo actualizado',
  'chat.group.meta': '{count}/{max} personas',
  'chat.group.members.label': 'Miembros del grupo',
  'chat.group.emptyMembers': 'Sin miembros',
  'chat.group.member.unknown': 'Miembro desconocido',
  'chat.group.member.owner': 'Propietario del grupo',
  'chat.group.member.admin': 'Administrador',
  'chat.group.member.readonly': 'Solo lectura',
  'chat.group.member.joinedAt': 'Entró en {time}',
  'chat.group.member.remove': 'Quitar',
  'chat.group.member.removeConfirmTitle': '¿Quitar a {name} del chat de grupo?',
  'chat.group.member.removeConfirmDesc':
    'Tras quitarlo, la otra parte pierde de inmediato el permiso de lectura del historial de ese grupo; si hace falta, se puede volver a invitar.',
  'chat.group.member.removed': 'Se quitó a {name}',
  'chat.group.invite.label': 'Invitar a miembros',
  'chat.group.invite.placeholder':
    'Escribe la cuenta del miembro y pulsa Intro para añadirlo',
  'chat.group.invite.button': 'Invitar',
  'chat.group.invite.success': 'Se invitó a {count} miembros',
  'chat.group.invite.none':
    'Estos miembros ya están en el grupo; no hace falta volver a invitarlos',
  'chat.group.invite.alreadyMember': '{name} ya está en el grupo',
  'chat.group.invite.noCandidate': 'No hay cuentas disponibles coincidentes',
  'chat.group.invite.hint':
    'Aún puedes invitar a {count} personas (límite: {max})',
  'chat.group.invite.full':
    'El grupo ha alcanzado el límite de miembros ({max} personas); no se puede invitar a más',
  'chat.group.invite.limit':
    'Como máximo puedes invitar a {count} personas más (límite: {max}); reduce el número de invitaciones',
  'chat.group.dangerZone': 'Operaciones peligrosas',
  'chat.group.quit': 'Salir del grupo',
  'chat.group.quitConfirmTitle': '¿Salir de este chat de grupo?',
  'chat.group.quitConfirmDesc':
    'Tras salir, dejarás de recibir los mensajes del grupo y tampoco podrás leer el historial; para volver a entrar necesitarás que te invite el propietario o un administrador.',
  'chat.group.quit.success': 'Has salido del chat de grupo',
  'chat.group.dissolve': 'Disolver el grupo',
  'chat.group.dissolveConfirmTitle': '¿Disolver este chat de grupo?',
  'chat.group.dissolveConfirmDesc':
    'Todos los miembros perderán el acceso a ese grupo y el historial dejará de ser legible en el servidor.',
  'chat.group.dissolve.success': 'Chat de grupo disuelto',
  'chat.group.loadFailed': 'No se pudo cargar la información del grupo',

  // Panel de datos del interlocutor (chat privado): lo que se cambia es la nota privada de «cómo le llamo yo», no el apodo de la cuenta de la otra persona.
  // La página y el cajón comparten el mismo componente; el texto no pertenece a ninguno de los dos
  'chat.peer.title': 'Datos del interlocutor',
  'chat.peer.action': 'Nota',
  'chat.peer.close': 'Cerrar',
  'chat.peer.nickname.label': 'Apodo: {name}',
  'chat.peer.alias.label': 'Nota',
  'chat.peer.alias.placeholder': 'Ponle un nombre que recuerdes',
  'chat.peer.alias.hint':
    'La nota solo la ves tú; la otra persona no la verá ni cambiará el apodo de su cuenta.',
  'chat.peer.alias.save': 'Guardar',
  'chat.peer.alias.clear': 'Quitar la nota',
  'chat.peer.alias.saved': 'Nota guardada',
  'chat.peer.alias.cleared': 'Nota eliminada',
  // Tarjeta de archivo en el flujo de mensajes: la página de chat y el cajón comparten el mismo componente; el texto no pertenece a ninguno de los dos
  'chat.fileCard.open': 'Abrir {name} en Archivos',

  // Límites de uso del adjunto (el remitente fija tres ejes: nivel de uso / vigencia / número de descargas)
  'chat.attach.policy.trigger': 'Límites de uso',
  'chat.attach.policy.title': 'Cómo puede usar el receptor este archivo',
  'chat.attach.policy.usage.label': 'Uso',
  'chat.attach.usage.previewOnly': 'Solo vista previa',
  'chat.attach.usage.previewOnly.desc':
    'Solo se puede ver en línea dentro de la conversación; no se puede descargar',
  'chat.attach.usage.downloadable': 'Descargable',
  'chat.attach.usage.downloadable.desc':
    'Se puede descargar, pero no se guarda en los archivos del receptor',
  'chat.attach.usage.resavable': 'Reenvío y guardado permitidos',
  'chat.attach.usage.resavable.desc':
    'Se puede descargar y también guardar en los archivos del propio receptor',
  'chat.attach.policy.expire.label': 'Vigencia',
  'chat.attach.expire.days': '{days} días',
  'chat.attach.expire.never': 'Sin caducidad',
  'chat.attach.policy.limit.label': 'Límite de descargas',
  'chat.attach.limit.unlimited': 'Sin límite',
  'chat.attach.limit.times': '{count} veces',
  'chat.attach.policy.limit.disabledHint':
    'La vista previa no consume descargas, así que no hace falta limitarla',
  'chat.attach.policy.footnote':
    'Tras revocarlo, el receptor ya no podrá recogerlo de inmediato; las copias descargadas en local no se pueden recuperar.',

  // Banda de adjuntos pendientes de envío: la página de chat y el cajón comparten el mismo componente; el texto no pertenece a ninguno de los dos
  'chat.attach.dropHint':
    'Arrastra un archivo desde la zona de archivos, o pulsa el clip para elegir uno de «Mis archivos» / subir un archivo local; cada archivo, como máximo {size}',
  'chat.attach.remove': 'Quitar el archivo pendiente de envío',
  'chat.attach.placeholder': 'Puedes añadir una nota (opcional)',
  // Entrada de transferencia de archivos (clip → diálogo «Enviar archivo»): la página y el cajón la comparten; el texto no pertenece a ninguno de los dos
  'chat.attach.entry': 'Enviar archivo',
  'chat.attach.modalTitle': 'Enviar archivo',
  'chat.attach.fromDevice': 'Subir un archivo local',
  'chat.attach.uploadHint':
    'El archivo local se sube primero a tus archivos y luego se envía como mensaje de archivo',
  // Aviso de tamaño: solo indica el límite, sin bloquear de antemano (el límite es configurable y la decisión autoritativa de rechazo está en el servidor)
  'chat.attach.sizeLimit': 'Cada archivo, como máximo {size}',
  'chat.attach.uploadProgress': 'Subiendo {name} ({percent}%)',
  'chat.attach.uploadFailed': 'Error al subir: {name}; puedes reintentarlo',
  'chat.attach.uploadNoNode':
    'La subida terminó, pero no se obtuvo la entrada de este archivo; confírmalo en «Mis archivos» y vuelve a seleccionarlo',
  'chat.attach.pickerSearch': 'Buscar por nombre de archivo',
  'chat.attach.pickerEmpty': 'No hay archivos coincidentes',
  'chat.attach.pickerFailed':
    'No se pudo cargar la lista de archivos; inténtalo de nuevo más tarde',
  'chat.attach.pickerInvalid':
    'Este archivo no se puede seleccionar por ahora; elige otro',
  'chat.attach.pickerClose': 'Cerrar',

  // Tarjeta de adjunto (el receptor recoge sin solicitar / el remitente consulta el consumo)
  'chat.attachCard.preview': 'Vista previa',
  'chat.attachCard.download': 'Descargar',
  'chat.attachCard.save': 'Guardar en mis archivos',
  'chat.attachCard.saveSuccess': 'Guardado en tus archivos',
  'chat.attachCard.revoke': 'Revocar la autorización',
  'chat.attachCard.revokeConfirmTitle':
    '¿Revocar la autorización de recogida de este adjunto?',
  'chat.attachCard.revokeConfirmDesc':
    'Tras revocarla, la otra parte ya no podrá recogerlo de inmediato, pero las copias descargadas en local no se pueden recuperar.',
  'chat.attachCard.revokeOk': 'Autorización revocada',
  'chat.attachCard.revoked': 'Revocado',
  'chat.attachCard.expired': 'Caducado',
  'chat.attachCard.remaining': 'Quedan {count} veces',
  'chat.attachCard.unlimited': 'Sin límite',
  'chat.attachCard.expireAt': 'Válido hasta {date}',
  'chat.attachCard.neverExpire': 'Vigencia permanente',
  'chat.attachCard.previewUnsupported':
    'Este tipo no admite vista previa en línea; descárgalo para verlo',
  // Con el nivel de solo vista previa no hay entrada de descarga: en ese caso ya no se puede aconsejar «descárgalo para verlo», solo explicar con sinceridad que esa vía no funciona
  'chat.attachCard.previewUnsupportedNoDownload':
    'Este tipo no se puede previsualizar en línea y el remitente no ha permitido la descarga; pídele que te lo envíe de otra forma',

  // Cajón de mensajería instantánea (segunda entrada fuera de /chat; el texto es independiente para que no se condicione con el título de la página)
  'chat.drawer.title': 'Mensajes',
  'chat.drawer.backToList': 'Volver a la lista de conversaciones',
  'chat.drawer.refresh': 'Actualizar la lista de conversaciones',
  'chat.drawer.close': 'Cerrar el panel de mensajes',
  'chat.drawer.emptyConversations': 'Sin conversaciones',
  'chat.drawer.openConversation': 'Abrir la conversación con {name}',
  'chat.drawer.emptyMessages':
    'Aún no hay mensajes; arrastra un archivo y di algo',
  'chat.drawer.mineAvatar': 'Yo',
  'chat.drawer.fileFallback': '[Archivo] {content}',
  'chat.drawer.send': 'Enviar',
  // Chat de grupo: número de miembros y avisos (los tres interruptores del panel del grupo)
  'chat.group.memberCount': '{count} miembros',
  'chat.composer.mentionAll': 'Todos',
  'chat.group.notify.title': 'Avisos de mensajes',
  'chat.group.notify.mute': 'Silenciar este grupo',
  'chat.group.notify.mention': 'Avisarme cuando alguien me mencione',
  'chat.group.notify.mentionAll':
    'Avisarme cuando el propietario mencione a todos',
  'chat.group.notify.muteHint':
    'Los mensajes de este grupo ya no suenan; los dos interruptores de abajo deciden si te avisamos igualmente.',
  'chat.group.notify.mentionHint':
    'Los mensajes de este grupo se avisan con normalidad; los dos interruptores de abajo solo se aplican al activar el silencio.',
} as const;
