/**
 * @name umi 的路由配置
 * @description 只支持 path,component,routes,redirect,wrappers,name,icon 的配置
 *
 * 说明：已清理 Ant Design Pro 模板示例页，保留布局骨架与必要运行时页面：
 *  - /user/login：登录页（layout:false）；CE 版账号由管理员分配，**不提供注册入口**，
 *    因此不再保留 /user/register、/user/register-result 路由
 *  - /share/:token：外发分享访客取件页（layout:false，免登录）；分享链接 `{origin}/share/{token}`
 *    的落点，访客凭提取码取件，不参与权限判定
 *  - /workbench：工作台（web 首页，PRD US-11）
 *  - /file：文件工作台（列表 / 目录 / 上传 / 预览 / 分享 / 权限申请）
 *  - /shares：分享管理（我的外发链接，需 file:share）
 *  - /messages：消息中心（系统通知 + 待办，待办项可跳转到审批中心 / 文件工作台）
 *  - /chat：聊天（单聊 / 群聊会话列表 + 聊天窗，支持 ?scope=&targetId= 深链）
 *  - /approval：审批中心（?view=pending 待我审批 / ?view=mine 我发起）
 *  - /permission-map：权限地图（我的权限点 / 角色 / 审批授权到期轴，登录即用）
 *  - /system/*：系统管理面（用户 / 角色 / 部门 / 群组 / 菜单权限，按权限点显隐到子项）
 *  - /audit：审计日志只读（仅 SUPER_ADMIN / AUDITOR）
 *  - 其余路径落入 404
 *
 * 侧边栏只渲染带 `name` 的路由，**菜单顺序 = 路由声明顺序**（过滤逻辑见
 * services/access/menu-render.ts，保持原数组顺序，不重排）：
 *  - `/welcome`：项目介绍页，侧栏第一项（`utils/redirect.ts` 的 DEFAULT_REDIRECT_PATH 指向它）；
 *  - `/upload`：分片上传示例页（离线 mock 演示），当前带 `name`、会出现在侧栏。
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
    /**
     * 外发分享访客取件页（PRD US-03 的「复制链接 → 浏览器打开」落点）。
     *
     * <p>创建者复制的链接是 `{origin}/share/{token}`，必须在这里被接住——否则它会掉进
     * 兜底的 `/*` → 404，表现就是「链接复制出来了，浏览器打开却没有对应画面」。</p>
     *
     * <p>访客没有账号、没有菜单、也不参与权限判定，故：`layout: false`（不渲染侧边栏 / 顶栏）、
     * 不挂 `PermGuard`、不给 `name`（不进侧栏）。免登录放行口径集中在
     * `services/access/public-paths.ts`，与 `app.tsx` 的登录守卫同源。</p>
     */
    path: '/share',
    layout: false,
    routes: [
      {
        path: '/share/:token',
        component: './share',
      },
      {
        name: '404',
        component: './exception/404',
        path: '/share/*',
      },
    ],
  },
  {
    // 侧栏第一项：菜单顺序 = 路由声明顺序，故置于 `/workbench` 之前
    path: '/welcome',
    name: 'welcome',
    icon: 'home',
    component: './Welcome',
    wrappers: ['@/components/PermGuard'],
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
    // 聊天：登录即用（会话列表 / 历史 / 已读都只作用于本人），故不在 ROUTE_PERM_RULES 登记权限点。
    // 支持深链 /chat?scope=1&targetId=7，打开即定位到某个会话。
    path: '/chat',
    name: 'chat',
    icon: 'message',
    component: './chat',
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
