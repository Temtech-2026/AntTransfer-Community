/** Textos de las páginas de excepción (403 / 404 / 500). */
export default {
  /* ============================ 403 sin permiso ============================ */
  'exception.403.subTitle':
    'Lo sentimos, no tienes permiso para acceder a esta página. Pide al administrador que habilite el punto de permiso correspondiente para la cuenta actual.',
  'exception.403.buttonText': 'Volver al inicio',

  /* ============================ 404 página inexistente ============================ */
  'exception.404.subTitle':
    'Lo sentimos, la página a la que intentas acceder no existe.',
  'exception.404.buttonText': 'Volver al inicio',

  /* ============================ 500 servicio anómalo ============================ */
  'exception.500.subTitle':
    'Lo sentimos, el servicio presenta una anomalía. Inténtalo de nuevo más tarde; si persiste, contacta al administrador para que lo revise.',
  'exception.500.buttonText': 'Volver al inicio',
} as const;
