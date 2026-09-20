/** 登录页文案。 */
export default {
  /* ============================ 品牌 ============================ */
  'auth.login.brand.subtitle': '企业文件传输与协作平台',

  /* ============================ 锁定提示 ============================ */
  'auth.login.locked.title': '账号已锁定',
  'auth.login.locked.fallback': '登录失败次数过多',
  'auth.login.locked.desc': '{message}（剩余 {countdown}）',

  /* ============================ 账号 ============================ */
  'auth.login.username.label': '账号',
  'auth.login.username.placeholder': '请输入账号',
  'auth.login.username.required': '请输入账号',

  /* ============================ 密码 ============================ */
  'auth.login.password.label': '密码',
  'auth.login.password.placeholder': '请输入密码',
  'auth.login.password.required': '请输入密码',

  /* ============================ 图形验证码（仅 UI 预留） ============================ */
  'auth.login.captcha.label': '图形验证码',
  'auth.login.captcha.tooltip':
    '图形验证码服务尚未接入，当前登录不做校验（仅 UI 预留）',
  'auth.login.captcha.placeholder': '服务接入后启用',
  'auth.login.captcha.button': '验证码',

  /* ============================ 记住我 / 提交 ============================ */
  'auth.login.remember': '记住我（仅记住账号，不保存密码）',
  'auth.login.submit': '登录',
  'auth.login.submitLocked': '请 {countdown} 后重试',

  /* ============================ 页脚说明 ============================ */
  'auth.login.footerHint': '账号由管理员统一分配，如需开通请联系管理员',
} as const;
