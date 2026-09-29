/** Textos del mapa de permisos (matriz recurso × sujeto / cronología de autorizaciones). */
export default {
  /* ============================ Estructura de página ============================ */
  'permissionMap.page.title': 'Mapa de permisos',
  'permissionMap.page.subTitle':
    'Los puntos de permiso que poseo, su origen y su vigencia',
  'permissionMap.loadFailed': 'Error al cargar el mapa de permisos',

  /* ============================ Tarjetas de resumen ============================ */
  'permissionMap.stat.perm.title': 'Puntos de permiso',
  'permissionMap.stat.perm.footer': 'El backend solo indica si se posee o no',
  'permissionMap.stat.role.title': 'Roles',
  'permissionMap.stat.role.footer':
    'Una de las fuentes conocidas de puntos de permiso',
  'permissionMap.stat.grant.title': 'Autorizaciones por aprobación',
  'permissionMap.stat.grant.footer': 'De ellas, {expired} ya han caducado',
  'permissionMap.stat.expiring.footer': 'Caducan en 7 días',

  /* ============================ Resumen de permisos ============================ */
  'permissionMap.overview.title': 'Resumen de permisos',
  'permissionMap.overview.subTitle':
    'Usuario, ámbito de datos y puntos de permiso',
  'permissionMap.overview.userId': 'ID de usuario',
  'permissionMap.overview.dataScope': 'Ámbito de datos',
  'permissionMap.overview.roles': 'Roles',
  'permissionMap.overview.grants': 'Autorizaciones por aprobación',
  'permissionMap.grant.total': '{total} en total',
  'permissionMap.grant.expiringSuffix': '{count} a punto de caducar',
  'permissionMap.grant.expiredSuffix': '{count} caducadas',
  'permissionMap.permCodes.title': 'Puntos de permiso ({count})',
  'permissionMap.permCodes.desc':
    'El backend solo indica si se posee o no; el origen punto por punto requiere una interfaz posterior. Abajo, los roles y las autorizaciones por aprobación son dos fuentes conocidas.',
  'permissionMap.permCodes.empty': 'Sin puntos de permiso',

  /* ============================ Tabla de fuentes de autorización ============================ */
  'permissionMap.grants.title': 'Fuentes de autorización',
  'permissionMap.grants.subTitle': '{count} autorizaciones por aprobación',
  'permissionMap.grants.empty': 'Sin autorizaciones por aprobación',
  'permissionMap.column.source': 'Origen',
  'permissionMap.column.grantType': 'Acción autorizada',
  'permissionMap.column.resource': 'Recurso',
  'permissionMap.column.application': 'Solicitud de origen',
  'permissionMap.column.expireAt': 'Fecha de caducidad',
  'permissionMap.column.validity': 'Estado de vigencia',
  'permissionMap.source.approval': 'Autorización por aprobación',

  /* ============================ Cronología de vigencia ============================ */
  'permissionMap.timeline.title': 'Cronología de vigencia',
  'permissionMap.timeline.subTitle':
    'Eje de caducidad: la autorización surte efecto al registrarse',
  'permissionMap.timeline.expirePrefix': 'Caduca',
  'permissionMap.timeline.fromApplication': 'Solicitud de origen n.º {id}',
  'permissionMap.timeline.empty': 'Sin autorizaciones con vigencia',

  /* ============================ Distribución de estados (visualización) ============================ */
  'permissionMap.distribution.title': 'Distribución de estados de autorización',
  'permissionMap.distribution.subTitle':
    '{count} autorizaciones por aprobación, agrupadas por estado de vigencia',
  'permissionMap.distribution.empty':
    'Sin autorizaciones por aprobación; no hay distribución que dibujar',
  'permissionMap.distribution.percent': '{percent}%',
  'permissionMap.validity.barTip':
    'Quedan {days} días; la longitud de la barra es una escala visual con tope de {horizon} días (el backend no envía la hora de inicio de vigencia, así que no puede dibujarse la «proporción consumida»)',

  /* ============================ Estado de autorización y días restantes ============================ */
  'permissionMap.grantState.active': 'Vigente',
  'permissionMap.grantState.expiring': 'A punto de caducar',
  'permissionMap.grantState.expired': 'Caducada',
  'permissionMap.grantState.permanent': 'Vigencia permanente',
  'permissionMap.remainDays': 'Quedan {days} días',

  /* ============================ Distribución por dominio (agrupación por prefijo en el frontend) ============================ */
  'permissionMap.permCodes.domainTitle': 'Distribución por dominio',
  'permissionMap.permCodes.domainDesc':
    'Agrupación en el frontend por el prefijo `:` del punto de permiso (el backend no tiene el campo «dominio»); la barra es relativa al grupo con más elementos.',
  'permissionMap.permCodes.domainOther': 'Otros',
  'permissionMap.permCodes.domainCount': '{count}',
} as const;
