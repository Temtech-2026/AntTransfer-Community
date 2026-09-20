/** 异常页（403 / 404 / 500）文案。 */
export default {
  /* ============================ 403 权限不足 ============================ */
  'exception.403.subTitle':
    'Sorry, you do not have permission to access this page. Please ask the administrator to grant the required permission to your account.',
  'exception.403.buttonText': 'Back Home',

  /* ============================ 404 页面不存在 ============================ */
  'exception.404.subTitle': 'Sorry, the page you visited does not exist.',
  'exception.404.buttonText': 'Back Home',

  /* ============================ 500 服务异常 ============================ */
  'exception.500.subTitle':
    'Sorry, something went wrong on the server. Please try again later, or contact the administrator if it persists.',
  'exception.500.buttonText': 'Back Home',
} as const;
