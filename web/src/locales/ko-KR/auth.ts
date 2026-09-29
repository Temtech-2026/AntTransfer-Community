/** 로그인 페이지 문구. */
export default {
  /* ============================ 品牌 ============================ */
  'auth.login.brand.subtitle': '기업용 파일 전송 및 협업 플랫폼',

  /* ============================ 锁定提示 ============================ */
  'auth.login.locked.title': '계정이 잠겼습니다',
  'auth.login.locked.fallback': '로그인 실패 횟수가 너무 많습니다',
  'auth.login.locked.desc': '{message}(남은 시간 {countdown})',

  /* ============================ 账号 ============================ */
  'auth.login.username.label': '계정',
  'auth.login.username.placeholder': '계정을 입력하세요',
  'auth.login.username.required': '계정을 입력하세요',

  /* ============================ 密码 ============================ */
  'auth.login.password.label': '비밀번호',
  'auth.login.password.placeholder': '비밀번호를 입력하세요',
  'auth.login.password.required': '비밀번호를 입력하세요',

  /* ============================ 图形验证码（仅 UI 预留） ============================ */
  'auth.login.captcha.label': '이미지 인증 코드',
  'auth.login.captcha.tooltip':
    '이미지 인증 코드 서비스가 아직 연동되지 않아 현재 로그인에서는 검증하지 않습니다(UI만 마련)',
  'auth.login.captcha.placeholder': '서비스 연동 후 사용 가능',
  'auth.login.captcha.button': '인증 코드',

  /* ============================ 记住我 / 提交 ============================ */
  'auth.login.remember':
    '로그인 유지(계정만 기억하고 비밀번호는 저장하지 않습니다)',
  'auth.login.submit': '로그인',
  'auth.login.submitLocked': '{countdown} 후에 다시 시도하세요',

  /* ============================ 页脚说明 ============================ */
  'auth.login.footerHint':
    '계정은 관리자가 일괄 발급합니다. 개설이 필요하면 관리자에게 문의하세요',
} as const;
