/** Textos de la página de inicio de sesión. */
export default {
  /* ============================ Marca ============================ */
  'auth.login.brand.subtitle':
    'Plataforma empresarial de transferencia y colaboración de archivos',

  /* ============================ Aviso de bloqueo ============================ */
  'auth.login.locked.title': 'Cuenta bloqueada',
  'auth.login.locked.fallback':
    'Demasiados intentos de inicio de sesión fallidos',
  'auth.login.locked.desc': '{message} (quedan {countdown})',

  /* ============================ Cuenta ============================ */
  'auth.login.username.label': 'Cuenta',
  'auth.login.username.placeholder': 'Introduce tu cuenta',
  'auth.login.username.required': 'Introduce tu cuenta',

  /* ============================ Contraseña ============================ */
  'auth.login.password.label': 'Contraseña',
  'auth.login.password.placeholder': 'Introduce tu contraseña',
  'auth.login.password.required': 'Introduce tu contraseña',

  /* ============================ Captcha gráfico (solo reservado en la UI) ============================ */
  'auth.login.captcha.label': 'Captcha gráfico',
  'auth.login.captcha.tooltip':
    'El servicio de captcha gráfico aún no está integrado; por ahora el inicio de sesión no lo valida (solo reservado en la UI)',
  'auth.login.captcha.placeholder': 'Se activará al integrar el servicio',
  'auth.login.captcha.button': 'Captcha',

  /* ============================ Recuérdame / Enviar ============================ */
  'auth.login.remember': 'Recuérdame (solo la cuenta, no guarda la contraseña)',
  'auth.login.submit': 'Iniciar sesión',
  'auth.login.submitLocked': 'Reintenta en {countdown}',

  /* ============================ Nota al pie ============================ */
  'auth.login.footerHint':
    'Las cuentas las asigna el administrador; si necesitas una, contacta al administrador',
} as const;
