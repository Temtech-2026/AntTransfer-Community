/**
 * @name umi 的路由配置
 * @description 只支持 path,component,routes,redirect,wrappers,name,icon 的配置
 *
 * 说明：已清理 Ant Design Pro 模板示例页，保留布局骨架与必要运行时页面：
 *  - /user/login：登录页（layout:false）；CE 版账号由管理员分配，**不提供注册入口**，
 *    因此不再保留 /user/register、/user/register-result 路由
 *  - /workbench：工作台（web 首页，PRD US-11）
 *  - /file：文件工作台（列表 / 目录 / 上传 / 预览 / 分享 / 权限申请）
 *  - /shares：分享管理（我的外发链接，需 file:share）
 *  - /messages：消息中心（系统通知 + 待办，待办项可跳转到审批中心 / 文件工作台）
 *  - /approval：审批中心（?view=pending 待我审批 / ?view=mine 我发起）
 *  - /permission-map：权限地图（我的权限点 / 角色 / 审批授权到期轴，登录即用）
 *  - /system/*：系统管理面（用户 / 角色 / 部门 / 群组 / 菜单权限，按权限点显隐到子项）
 *  - /audit：审计日志只读（仅 SUPER_ADMIN / AUDITOR）
 *  - 其余路径落入 404
 *
 * ⚠️ **非菜单路由**：侧边栏只渲染带 `name` 的路由，以下两条刻意不给 `name`——
 * 「菜单口径收敛」的落点，避免演示 / 工具页混进业务导航：
 *  - `/welcome`：项目介绍页，仅由顶栏 DocLink 进入；
 *  - `/upload`：分片上传示例页（离线 mock 演示），被 GlobalUploadProgress 默认队列的「去查看」指向。
 *
 * 权限接线（两层，前端只负责「不渲染」，后端 `@RequiresPerm` 才是安全边界）：
 *  1. `wrappers: ['@/components/PermGuard']` —— 越权访问就地 403（策略 D，不跳登录）；
 *     所需权限点由 services/access/route-perm.ts 的 ROUTE_PERM_RULES 集中登记（最长前缀匹配）；
 *  2. 菜单显隐由 app.tsx 的 menuDataRender 按同一份权限表过滤。
 *
 * 新增业务路由时，请在 ROUTE_PERM_RULES 登记权限点并挂上 PermGuard。
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
        name: '404',
        component: './exception/404',
        path: '/user/*',
      },
    ],
  },
  {
    // 工作台 = web 首页（PRD US-11）：只看得到自己的聚合数据，故不在 ROUTE_PERM_RULES 登记权限点
    path: '/workbench',
    name: 'workbench',
    icon: 'dashboard',
    component: './workbench',
    wrappers: ['@/components/PermGuard'],
  },
  {
    path: '/welcome',
    name: 'welcome',
    icon: 'home',
    component: './Welcome',
    wrappers: ['@/components/PermGuard'],
  },
  {
    path: '/upload',
    name: 'upload',
    icon: 'cloudUpload',
    component: './upload',
    wrappers: ['@/components/PermGuard'],
  },
  {
    path: '/file',
    name: 'file',
    icon: 'folderOpen',
    component: './file',
    wrappers: ['@/components/PermGuard'],
  },
  {
    path: '/shares',
    name: 'shares',
    icon: 'link',
    component: './shares',
    wrappers: ['@/components/PermGuard'],
  },
  {
    // 消息中心：登录即用（只看得到自己的通知 / 待办），故不在 ROUTE_PERM_RULES 登记权限点
    path: '/messages',
    name: 'message',
    icon: 'bell',
    component: './messages',
    wrappers: ['@/components/PermGuard'],
  },
  {
    // 审批中心：?view=pending 待我审批 / ?view=mine 我发起（消息中心待办跳转的落点）
    path: '/approval',
    name: 'approval',
    icon: 'audit',
    component: './approval',
    wrappers: ['@/components/PermGuard'],
  },
  {
    path: '/system',
    name: 'system',
    icon: 'setting',
    wrappers: ['@/components/PermGuard'],
    routes: [
      {
        path: '/system/users',
        name: 'users',
        component: './system/users',
      },
      {
        path: '/system/roles',
        name: 'roles',
        component: './system/roles',
      },
      {
        path: '/system/depts',
        name: 'depts',
        component: './system/depts',
      },
      {
        path: '/system/groups',
        name: 'groups',
        component: './system/groups',
      },
      {
        path: '/system/menus',
        name: 'menus',
        component: './system/menus',
      },
    ],
  },
  {
    path: '/audit',
    name: 'audit',
    icon: 'audit',
    component: './audit',
    wrappers: ['@/components/PermGuard'],
  },
  {
    // 权限地图：后端 `GET /api/v1/permission/map` 无 @RequiresPerm（自助查询本人权限），登录即用
    path: '/permission-map',
    name: 'permissionMap',
    icon: 'safetyCertificate',
    component: './permission-map',
    wrappers: ['@/components/PermGuard'],
  },
  {
    path: '/',
    redirect: '/workbench',
  },
  {
    component: './exception/404',
    path: '/*',
  },
];
