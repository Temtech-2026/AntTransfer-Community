/** 登录页文案。 */
export default {
  /* ============================ 品牌 ============================ */
  'auth.login.brand.subtitle':
    'Enterprise file transfer and collaboration platform',

  /* ============================ 锁定提示 ============================ */
  'auth.login.locked.title': 'Account locked',
  'auth.login.locked.fallback': 'Too many failed login attempts',
  'auth.login.locked.desc': '{message} ({countdown} left)',

  /* ============================ 账号 ============================ */
  'auth.login.username.label': 'Account',
  'auth.login.username.placeholder': 'Enter your account',
  'auth.login.username.required': 'Please enter your account',

  /* ============================ 密码 ============================ */
  'auth.login.password.label': 'Password',
  'auth.login.password.placeholder': 'Enter your password',
  'auth.login.password.required': 'Please enter your password',

  /* ============================ 图形验证码（仅 UI 预留） ============================ */
  'auth.login.captcha.label': 'Graphic captcha',
  'auth.login.captcha.tooltip':
    'The captcha service is not connected yet, so login does not verify it (UI placeholder only)',
  'auth.login.captcha.placeholder': 'Enabled after the service is connected',
  'auth.login.captcha.button': 'Captcha',

  /* ============================ 记住我 / 提交 ============================ */
  'auth.login.remember': 'Remember me (account only, password is never stored)',
  'auth.login.submit': 'Sign in',
  'auth.login.submitLocked': 'Please retry in {countdown}',

  /* ============================ 页脚说明 ============================ */
  'auth.login.footerHint':
    'Accounts are assigned by the administrator. Contact the administrator to request one.',
} as const;
