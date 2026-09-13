/**
 * @name umi 的路由配置
 * @description 只支持 path,component,routes,redirect,wrappers,name,icon 的配置
 *
 * 说明：已清理 Ant Design Pro 模板示例页，保留布局骨架与必要运行时页面：
 *  - /user/*：登录 / 注册（layout:false）
 *  - /welcome：首页占位（随业务页面逐步替换）
 *  - /upload：分片上传示例页（演示组件用法，业务页面就绪后可删）
 *  - 其余路径落入 404
 */
export default [
  {
    path: '/user',
    layout: false,
    routes: [
      {
        path: '/user/login',
        name: 'login',
        component: './user/login',
      },
      {
        path: '/user',
        redirect: '/user/login',
      },
      {
        name: 'register-result',
        icon: 'checkCircle',
        path: '/user/register-result',
        component: './user/register-result',
      },
      {
        name: 'register',
        icon: 'userAdd',
        path: '/user/register',
        component: './user/register',
      },
      {
        name: '404',
        component: './exception/404',
        path: '/user/*',
      },
    ],
  },
  {
    path: '/welcome',
    name: 'welcome',
    icon: 'home',
    component: './Welcome',
  },
  {
    path: '/upload',
    name: 'upload',
    icon: 'cloudUpload',
    component: './upload',
  },
  {
    path: '/',
    redirect: '/welcome',
  },
  {
    component: './exception/404',
    path: '/*',
  },
];
