export default {
  'app.network.offline':
    'Estás sin conexión; algunas funciones pueden no estar disponibles',
  'app.error.chunk.title': 'Error al cargar la página',
  'app.error.chunk.description.offline':
    'La conexión de red se ha interrumpido; comprueba la red y vuelve a cargar.',
  'app.error.chunk.description.online':
    'No se pudieron cargar los recursos de la página; recarga e inténtalo de nuevo.',
  'app.error.render.title': 'Se ha producido un error en la página',
  'app.error.render.description':
    'Lo sentimos, la página ha tenido un problema; actualízala o vuelve al inicio.',
  'app.error.retry': 'Reintentar',
  'app.error.reload': 'Actualizar la página',
  'app.error.home': 'Volver al inicio',
  'app.request.offline':
    'La red no está disponible; comprueba la conexión e inténtalo de nuevo.',
  // Texto de reserva cuando no se puede obtener el cuerpo de la respuesta (el canal XHR de services/request y el errorHandler global comparten el mismo criterio)
  'app.request.default':
    'Error de red; comprueba la conexión e inténtalo de nuevo',
  'app.request.http': '{message} (HTTP {status})',
  'app.request.retryLater': '{message}, inténtalo de nuevo más tarde',
  'app.request.traceId': 'traceId: {traceId}',
  'app.request.failed': 'Solicitud fallida',
  'app.request.aborted': 'Solicitud cancelada',
  'app.request.timeout':
    'Tiempo de espera agotado; inténtalo de nuevo más tarde',
  'app.request.parseFailed': 'Error al analizar la respuesta',
};
