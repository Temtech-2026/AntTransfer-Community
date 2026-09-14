/**
 * @name 代理的配置
 * @see 在生产环境 代理是无法生效的，所以这里没有生产环境的配置
 * -------------------------------
 * The agent cannot take effect in the production environment
 * so there is no configuration of the production environment
 * For details, please see
 * https://pro.ant.design/docs/deploy
 *
 * @doc https://umijs.org/docs/guides/proxy
 */
export default {
  // 本地开发：将 /api 代理到后端 at-bootstrap（默认端口 8080，可按需调整）
  dev: {
    '/api/': {
      // 后端服务地址（见 server/at-bootstrap/src/main/resources/application.yml）
      target: 'http://localhost:8080',
      // 允许 http<->https 与跨域改写 Host，cookie 等依赖 origin 的能力正常
      changeOrigin: true,
      // 实时通知走 /api/ws/notify（原生 WebSocket 握手，token 在查询串里）：
      // 不开 ws 转发的话 upgrade 请求会被当成普通 HTTP，握手恒 400
      ws: true,
    },
  },
  /**
   * @name 详细的代理配置
   * @doc https://github.com/chimurai/http-proxy-middleware
   */
  test: {
    // localhost:8000/api/** -> https://pro-api.ant-design-demo.workers.dev/api/**
    '/api/': {
      target: 'https://pro-api.ant-design-demo.workers.dev',
      changeOrigin: true,
    },
  },
  pre: {
    '/api/': {
      target: 'your pre url',
      changeOrigin: true,
    },
  },
};
