/** Textos de la administración del sistema (usuarios / roles / departamentos / grupos / permisos de menú). */
export default {
  // Acciones y nombres de columna del dominio del sistema reutilizados entre páginas
  'system.action.edit': 'Editar',
  'system.action.delete': 'Eliminar',
  'system.action.create': 'Crear',
  'system.column.action': 'Acciones',
  'system.column.status': 'Estado',
  'system.column.remark': 'Observaciones',
  'system.column.createTime': 'Fecha de creación',
  'system.alert.boundaryTitle': 'Límites de la operación',

  // Estado del usuario
  'system.userStatus.normal': 'Normal',
  'system.userStatus.disabled': 'Deshabilitado',
  'system.userStatus.locked': 'Bloqueado',
  'system.userStatus.unknown': 'Desconocido',

  // Ámbito de datos
  'system.dataScope.self': 'Solo el propio usuario',
  'system.dataScope.deptAndSub': 'Su departamento y los inferiores',
  'system.dataScope.all': 'Todos',
  'system.dataScope.unknown': 'Desconocido ({scope})',

  // Dimensión del punto de permiso
  'system.permType.menu': 'Menú',
  'system.permType.action': 'Operación',
  'system.permType.dataScope': 'Ámbito de datos',
  'system.permType.unknown': 'Desconocido ({type})',

  // Página de gestión de usuarios
  'system.user.title': 'Gestión de usuarios',
  'system.user.subtitle':
    'Cuentas, departamentos, estado y pertenencia a roles',
  'system.user.alertBoundary':
    'Las cuentas protegidas no pueden deshabilitarse / eliminarse / cambiárseles el rol; el administrador no puede deshabilitarse, restablecerse la contraseña, asignarse roles ni eliminarse a sí mismo (el backend lo rechazará, incluida la protección contra la autoescalada de privilegios). Cuando el ámbito de datos está restringido, tanto la lista como el desplegable de roles se ajustan automáticamente.',
  'system.user.column.keyword': 'Cuenta / apodo',
  'system.user.column.keywordPlaceholder':
    'Cuenta o apodo, coincidencia difusa',
  'system.user.column.username': 'Cuenta',
  'system.user.column.nickname': 'Apodo',
  'system.user.column.dept': 'Departamento',
  'system.user.column.deptPlaceholder': 'Todos los departamentos visibles',
  'system.user.column.roles': 'Roles',
  'system.user.column.lastLogin': 'Último inicio de sesión',
  'system.user.protectedTag': 'Protegida',
  'system.user.action.assignRole': 'Asignar roles',
  'system.user.action.resetPassword': 'Restablecer contraseña',
  'system.user.action.disable': 'Deshabilitar',
  'system.user.action.enable': 'Habilitar',
  'system.user.action.locked': 'Bloqueado',
  'system.user.action.create': 'Nuevo usuario',
  'system.user.confirm.disableTitle': '¿Confirmas deshabilitar esta cuenta?',
  'system.user.confirm.enableTitle': '¿Confirmas habilitar esta cuenta?',
  'system.user.confirm.disableDesc':
    'Tras deshabilitarla, todas las sesiones en curso de la cuenta se invalidan de inmediato.',
  'system.user.confirm.deleteTitle': '¿Confirmas eliminar este usuario?',
  'system.user.confirm.deleteDesc':
    'Tras eliminarlo no se puede recuperar; el servidor rechazará las cuentas protegidas o las que aún estén referenciadas.',
  'system.user.message.disabled': 'Se deshabilitó a {name}',
  'system.user.message.enabled': 'Se habilitó a {name}',
  'system.user.message.deleted': 'Se eliminó a {name}',

  // Avatar (canal específico: surte efecto al subir, no participa en el guardado del formulario de edición)
  'system.user.avatar.label': 'Avatar',
  'system.user.avatar.upload': 'Subir avatar',
  'system.user.avatar.hint':
    'Admite PNG / JPEG / GIF / WebP, sin superar {max}',
  'system.user.avatar.updated': 'Avatar actualizado',
  'system.user.avatar.tooLarge': 'La imagen no puede superar {max}',
  'system.user.avatar.typeInvalid':
    'Solo se admiten imágenes PNG / JPEG / GIF / WebP',
  // Diálogo de creación / edición de usuario
  'system.userForm.title.edit': 'Editar usuario · {name}',
  'system.userForm.title.create': 'Nuevo usuario',
  'system.userForm.alert.title':
    'Ni el nombre de cuenta, ni el estado, ni los roles, ni la contraseña están en este formulario',
  'system.userForm.alert.desc':
    'El nombre de cuenta no se puede cambiar; para el estado / la contraseña / los roles, usa los botones correspondientes de la lista. Las observaciones no se ofrecen para editar porque la interfaz no las devuelve.',
  'system.userForm.field.username': 'Cuenta de inicio de sesión',
  'system.userForm.field.password': 'Contraseña inicial',
  'system.userForm.field.nickname': 'Apodo / nombre',
  'system.userForm.field.dept': 'Departamento',
  'system.userForm.field.email': 'Correo electrónico',
  'system.userForm.field.mobile': 'Teléfono móvil',
  'system.userForm.field.roleIds': 'Roles iniciales',
  'system.userForm.placeholder.username':
    'De 3 a 64 letras/dígitos/guion bajo/punto/guion',
  'system.userForm.placeholder.password': 'De 8 a 64 caracteres',
  'system.userForm.placeholder.dept': 'Sin asignar',
  'system.userForm.placeholder.roleIds': 'Sin asignar roles',
  'system.userForm.extra.deptEdit':
    'Cambiar el departamento se considera un traslado: se revocarán todas las autorizaciones vigentes obtenidas «por aprobación» de ese usuario',
  'system.userForm.extra.deptCreate': 'Vacío = departamento sin asignar',
  'system.userForm.extra.emailEdit':
    'Vacío = no modificar (política conservadora del backend; el correo no puede dejarse vacío)',
  'system.userForm.extra.mobileEdit': 'Vacío = no modificar',
  'system.userForm.extra.roleIds':
    'Se puede no asignar ninguno. Si el ámbito de datos no es «Todos», solo podrás asignar roles que ya poseas (requiere {perm}).',
  'system.userForm.rule.usernameRequired':
    'Introduce la cuenta de inicio de sesión',
  'system.userForm.rule.usernamePattern':
    'Debe tener de 3 a 64 letras/dígitos/guion bajo/punto/guion',
  'system.userForm.rule.passwordRequired': 'Introduce la contraseña inicial',
  'system.userForm.rule.passwordLength':
    'La contraseña debe tener entre 8 y 64 caracteres',
  'system.userForm.rule.nicknameRequired': 'Introduce el apodo',
  'system.userForm.rule.nicknameMax': 'Máximo 64 caracteres',
  'system.userForm.rule.emailInvalid': 'El formato del correo no es correcto',
  'system.userForm.rule.emailMax': 'Máximo 128 caracteres',
  'system.userForm.rule.mobileMax': 'Máximo 32 caracteres',
  'system.userForm.rule.remarkMax': 'Máximo 255 caracteres',
  'system.userForm.message.updated': 'Datos del usuario actualizados',
  'system.userForm.message.created': 'Usuario creado',
  'system.userForm.roleOption': '{name} ({code}·{scope})',

  // Diálogo de restablecimiento de contraseña
  'system.resetPassword.title': 'Restablecer contraseña · {name}',
  'system.resetPassword.ok': 'Confirmar restablecimiento',
  'system.resetPassword.alert.title':
    'Tras el restablecimiento, todas las sesiones en curso de ese usuario se invalidan de inmediato',
  'system.resetPassword.alert.desc':
    'El usuario deberá iniciar sesión de nuevo con la nueva contraseña; el administrador no puede ver la contraseña original (en la base de datos solo se guarda el hash).',
  'system.resetPassword.field.newPassword': 'Nueva contraseña',
  'system.resetPassword.field.confirmPassword': 'Confirmar la nueva contraseña',
  'system.resetPassword.placeholder.password': 'De 8 a 64 caracteres',
  'system.resetPassword.rule.newRequired': 'Introduce la nueva contraseña',
  'system.resetPassword.rule.length':
    'La contraseña debe tener entre 8 y 64 caracteres',
  'system.resetPassword.rule.confirmRequired':
    'Introduce de nuevo la nueva contraseña',
  'system.resetPassword.rule.mismatch':
    'Las dos contraseñas introducidas no coinciden',
  'system.resetPassword.message.done':
    'Contraseña restablecida; se han invalidado todas las sesiones en curso de ese usuario',

  // Cajón de asignación de roles
  'system.assignRole.title': 'Asignar roles · {name}',
  'system.assignRole.alert.protected.title': 'Cuenta protegida',
  'system.assignRole.alert.protected.desc':
    'Debe conservar el rol de superadministrador; quitarlo será rechazado por el servidor.',
  'system.assignRole.alert.mode.title':
    'Reemplazo del conjunto completo + conservar al menos un rol',
  'system.assignRole.alert.mode.desc':
    'Tras enviar, prevalece lo marcado en esta ocasión (no es incremental). El backend exige que el conjunto de roles no esté vacío, así que hay que marcar al menos uno.',
  'system.assignRole.searchPlaceholder': 'Filtrar por nombre / código de rol',
  'system.assignRole.empty.noOptions':
    'No hay roles asignables (puede deberse a un ámbito de datos restringido)',
  'system.assignRole.empty.noMatch': 'No hay roles coincidentes',
  'system.assignRole.atLeastOne':
    'Marca al menos un rol: el backend valida que el conjunto de roles no esté vacío.',
  'system.assignRole.message.done': 'Roles actualizados',
  // Página de gestión de roles
  'system.role.title': 'Gestión de roles',
  'system.role.subtitle': 'El rol en sí y su matriz de permisos',
  'system.role.alertBoundary':
    'Los roles integrados no pueden eliminarse ni cambiarse de ámbito de datos; los puntos de permiso del área de administración del sistema solo se conceden al superadministrador. Si el ámbito de datos no es «Todos», al crear roles solo podrás conceder un ámbito de datos no superior al tuyo y, al asignar permisos, solo podrás marcar puntos de permiso que ya poseas (red de seguridad del servidor contra la escalada de privilegios).',
  'system.role.column.keyword': 'Nombre / código del rol',
  'system.role.column.keywordPlaceholder':
    'Nombre o código, coincidencia difusa',
  'system.role.column.name': 'Nombre del rol',
  'system.role.column.code': 'Código',
  'system.role.column.dataScope': 'Ámbito de datos',
  'system.role.column.permissionSet': 'Conjunto de permisos',
  'system.role.builtInTag': 'Integrado',
  'system.role.lockedTag': 'Bloqueado de solo lectura',
  'system.role.maintainableTag': 'Mantenible',
  'system.role.action.assignPerm': 'Asignar permisos',
  'system.role.action.create': 'Nuevo rol',
  'system.role.confirm.deleteTitle': '¿Confirmas eliminar este rol?',
  'system.role.confirm.deleteDesc':
    'El servidor rechazará los roles integrados, los que tengan permisos asociados o los que sigan asignados a usuarios.',
  'system.role.message.deleted': 'Se eliminó el rol {name}',

  // Diálogo de creación / edición de rol
  'system.roleForm.title.edit': 'Editar rol · {name}',
  'system.roleForm.title.create': 'Nuevo rol',
  'system.roleForm.alert.title': 'Rol integrado',
  'system.roleForm.alert.desc':
    'El código y el ámbito de datos no se pueden modificar; solo se pueden ajustar el nombre y las observaciones; la matriz de permisos se mantiene en el cajón «Asignar permisos».',
  'system.roleForm.field.code': 'Código del rol',
  'system.roleForm.field.name': 'Nombre del rol',
  'system.roleForm.field.dataScope': 'Ámbito de datos',
  'system.roleForm.placeholder.code': 'Por ejemplo, DEPT_ADMIN',
  'system.roleForm.extra.codeEdit':
    'El código es el identificador externo del rol y no se puede modificar tras crearlo',
  'system.roleForm.extra.dataScopeBuiltIn':
    'El ámbito de datos de un rol integrado no se puede modificar',
  'system.roleForm.extra.dataScopeMax':
    'No puede superar tu propio ámbito de datos (actual: {scope})',
  'system.roleForm.rule.codeRequired': 'Introduce el código del rol',
  'system.roleForm.rule.codePattern':
    'Debe empezar por mayúscula y contener solo mayúsculas/dígitos/guion bajo',
  'system.roleForm.rule.nameRequired': 'Introduce el nombre del rol',
  'system.roleForm.rule.nameMax': 'Máximo 64 caracteres',
  'system.roleForm.rule.dataScopeRequired': 'Selecciona el ámbito de datos',
  'system.roleForm.message.updated': 'Rol actualizado',
  'system.roleForm.message.created': 'Rol creado',
  // Cajón de autorización de rol
  'system.rolePerm.title': 'Asignar permisos · {name}',
  'system.rolePerm.alert.locked.title':
    'El conjunto de permisos del rol de auditor está bloqueado',
  'system.rolePerm.alert.locked.desc':
    'La capa de servicio rechaza cualquier cambio en el conjunto de permisos de este rol (1021); este cajón es de solo lectura.',
  'system.rolePerm.alert.readOnly.title': 'Solo lectura',
  'system.rolePerm.alert.readOnly.desc':
    'No tienes el punto de permiso de autorización de roles (system:role:assign-perm); solo puedes consultar la matriz de permisos actual.',
  'system.rolePerm.alert.selfLock.title':
    'Antiautobloqueo: tres puntos de permiso no se pueden quitar',
  'system.rolePerm.alert.selfLock.desc':
    'Debe conservarse {codes}; de lo contrario nadie podría gestionar permisos y el servidor lo rechazará directamente.',
  'system.rolePerm.alert.narrow.title':
    'Antiescalada: solo se pueden conceder puntos de permiso que ya poseas',
  'system.rolePerm.alert.narrow.desc':
    'Tu ámbito de datos no es «Todos»; los nodos marcados como «No concedible» serán rechazados por el servidor al enviarlos.',
  'system.rolePerm.tooltip.required':
    'Antiautobloqueo: el superadministrador debe conservar esta «puerta de entrada a la capacidad de gestión»; el servidor rechazará quitarla',
  'system.rolePerm.tooltip.notHeld':
    'Tu ámbito de datos no es «Todos» y no puedes conceder puntos de permiso que no poseas (protección del servidor contra la escalada)',
  'system.rolePerm.tag.required': 'Obligatorio',
  'system.rolePerm.tag.notHeld': 'No concedible',
  'system.rolePerm.selected':
    'Seleccionados {selected} / {total} puntos de permiso',
  'system.rolePerm.parentNote':
    '(los nodos padre cuentan como entrada visible)',
  'system.rolePerm.empty': 'El catálogo de puntos de permiso está vacío',
  'system.rolePerm.message.mustKeep':
    'El rol de superadministrador debe conservar estos puntos de permiso: {codes}',
  'system.rolePerm.message.done': 'Permisos del rol actualizados',

  // Catálogo de menús / puntos de permiso (solo lectura)
  'system.menu.title': 'Catálogo de menús / puntos de permiso',
  'system.menu.subtitle': 'Estado actual del modelo de permisos (solo lectura)',
  'system.menu.alert.title':
    'Página de solo lectura: el alta, la baja y la modificación de puntos de permiso los mantiene un script de migración SQL',
  'system.menu.alert.desc':
    'Este proyecto modela de forma unificada los «menús» y las «operaciones» como puntos de permiso (type: 1-menú 2-operación 3-ámbito de datos). Actualmente solo hay un endpoint de lectura del catálogo (GET /api/v1/permission-points), sin interfaz de mantenimiento de puntos de permiso. Para marcar permisos de un rol, ve a «Gestión de roles → Asignar permisos».',
  'system.menu.column.permName': 'Nombre del punto de permiso',
  'system.menu.column.permCode': 'Código del permiso',
  'system.menu.column.type': 'Dimensión',
  'system.menu.column.sortNo': 'Orden',
  'system.menu.stat.total': 'Total de puntos de permiso',
  'system.menu.stat.menu': 'Nodos de menú',
  'system.menu.stat.action': 'Nodos de operación',
  'system.menu.stat.scope': 'Nodos de ámbito de datos',
  'system.menu.headerTitle': 'Árbol de puntos de permiso',
  'system.menu.searchPlaceholder': 'Filtrar por nombre / código',
  'system.menu.empty.noPerm':
    'Falta permiso: se necesita system:role:list o system:role:assign-perm',
  // Gestión de grupos (texto de marcador de posición)
  'system.group.title': 'Gestión de grupos',
  'system.group.subtitle': 'Aún no disponible',
  'system.group.alert.title':
    'La interfaz de gestión de grupos aún no está disponible; esta página es por ahora un texto de marcador de posición',
  'system.group.alert.desc':
    'Las tablas de datos sys_group / sys_group_member ya existen, pero el servidor no tiene controladores de gestión ni puntos de permiso correspondientes. Para no ofrecer entradas que «fallarían con seguridad al pulsarlas», aquí no se ofrecen operaciones de alta/baja/modificación ni se renderizan datos simulados.',
  'system.group.section.current.title': 'Situación actual',
  'system.group.section.current.subtitle':
    'Tablas de datos, entidades del servidor y puntos de permiso',
  'system.group.section.endpoints.title':
    'Interfaces necesarias para completarlo',
  'system.group.section.endpoints.subtitle': 'Lista de trabajo pendiente',
  'system.group.desc.table': 'Tabla de datos',
  'system.group.desc.entity': 'Entidad del servidor',
  'system.group.entity.note':
    'Solo para uso interno del dominio de colaboración (determinación de acceso), sin CRUD externo',
  'system.group.desc.perm': 'Punto de permiso',
  'system.group.perm.none':
    'No hay puntos de permiso system:group:* (V9 solo definió system:user:* y system:role:*)',
  'system.group.desc.availability': 'Disponibilidad actual',
  'system.group.availability.readonly':
    'Solo lectura, no disponible (sin interfaz)',
  'system.group.column.method': 'Método',
  'system.group.column.path': 'Ruta',
  'system.group.column.purpose': 'Uso',
  'system.group.endpoint.groups.page':
    'Paginación / búsqueda por palabra clave de grupos',
  'system.group.endpoint.groups.detail': 'Detalle del grupo',
  'system.group.endpoint.groups.create': 'Crear grupo',
  'system.group.endpoint.groups.update':
    'Editar grupo (nombre / observaciones / responsable)',
  'system.group.endpoint.groups.remove': 'Eliminar grupo',
  'system.group.endpoint.members.list': 'Lista de miembros',
  'system.group.endpoint.members.replace':
    'Reemplazar el conjunto completo de miembros',

  // Gestión de departamentos (solo lectura)
  'system.dept.title': 'Gestión de departamentos',
  'system.dept.subtitle': 'Estructura organizativa (solo lectura)',
  'system.dept.alert.title':
    'Página de solo lectura: la interfaz de alta/baja/modificación de departamentos aún no está disponible',
  'system.dept.alert.desc':
    'El único endpoint de departamentos disponible actualmente es GET /api/v1/system/users/dept-options (para el desplegable del formulario de usuario y la determinación del ámbito de datos). Esta página muestra la estructura organizativa tal como es y no ofrece operaciones de escritura irrealizables. El ID de departamento se usa tanto para el «traslado de usuario» como para el cálculo del ámbito de datos; confirma antes el alcance del impacto.',
  'system.dept.column.name': 'Nombre del departamento',
  'system.dept.column.id': 'ID de departamento',
  'system.dept.column.parentId': 'ID del departamento superior',
  'system.dept.column.depth': 'Nivel',
  'system.dept.column.childCount': 'Número de departamentos inferiores',
  'system.dept.depthValue': 'Nivel {depth}',
  'system.dept.rootTag': 'Raíz',
  'system.dept.stat.total': 'Total de departamentos',
  'system.dept.stat.roots': 'Departamentos raíz',
  'system.dept.stat.maxDepth': 'Nivel máximo',
  'system.dept.stat.rootsFooter':
    'Nodos de nivel superior sin departamento superior',
  'system.dept.suffix.count': 'unidades',
  'system.dept.suffix.level': 'niveles',
  'system.dept.headerTitle': 'Lista de departamentos',
  'system.dept.message.reloaded':
    'Se volvió a consultar la lista de departamentos',
} as const;
