/**
 * 路由 → perm_code 映射表（docs/development/frontend-permission-map.md「映射表」的前端落位）。
 *
 * <p>为什么是集中映射而不是写在路由文件里：Umi 4 的静态路由只透传 `path/component/routes/redirect/wrappers/name/icon`，
 * 自定义 meta 在多处（面包屑、菜单、守卫）读取时口径容易漂移；集中成表后：
 * <ul>
 *   <li>路由守卫（PermGuard）按<b>最长前缀匹配</b>取所需权限，业务页面无需各自写守卫；</li>
 *   <li>映射表可直接单测，改了漏了 CI 能发现；</li>
 *   <li>新增受保护路由必须在此登记，避免「忘了加守卫」导致越权页面被渲染。</li>
 * </ul>
 *
 * <p>⚠️ 映射的 perm_code 必须与后端 {@code sys_permission.perm_code} 逐字符一致
 * （来源：`sql/V2__init_data.sql`、`sql/V9__system_admin_permission_points.sql`、
 * `sql/V14__chat_group_permission_points.sql`）。
 */

import type { PermCode } from './perm';

/** 单条路由守卫规则。 */
export interface RoutePermRule {
  /** 路由前缀（以 / 开头，无尾斜杠）。 */
  path: string;
  /** 进入该路由所需权限点；数组表示「满足其一」。 */
  perm: PermCode | PermCode[];
  /** 说明（便于排查「为什么这个页面要这个权限」）。 */
  note?: string;
}

/**
 * 系统管理菜单根节点 perm_code（`sys_permission` 中 `type=1` 的 `system` 节点）。
 *
 * <p>V9 的授权语句把它与全部 `system:*` 一起只授给 SUPER_ADMIN，因此它是
 * 「能进系统管理面」的最小充分条件。CE 版没有部门 / 群组 / 菜单权限的原子权限点，
 * 这三个只读页只能用它守卫。
 *
 * <p>刻意不 import `services/system/perm.ts` 的同名常量：access 是底层权限域，
 * 反向依赖业务域常量会把依赖方向倒置（那边只是 SQL 的编译期别名镜像）。
 */
const SYSTEM_MENU_ROOT: PermCode = 'system';

/**
 * 受保护路由登记表（与 docs/development/frontend-permission-map.md 保持同步）。
 *
 * <p>未登记的路由默认放行（如 /workbench、/welcome、/upload、/messages、/approval、/permission-map、异常页）
 * ——它们是公开页、演示页，或只呈现「当前登录用户自己的数据」的自助页（工作台 / 消息中心 / 审批中心 / 权限地图）。
 */
export const ROUTE_PERM_RULES: readonly RoutePermRule[] = [
  {
    path: '/file',
    perm: 'file:download',
    note: '文件列表页可见性按映射表口径跟随文件域可用能力（菜单本身为 type=1「file」）',
  },
  {
    path: '/shares',
    perm: 'file:share',
    note: '分享管理页（我的外发链接）：后端 ShareController 的创建 / 撤销 / 查询统一要求 file:share',
  },
  { path: '/audit', perm: 'audit:log:read', note: '审计日志页：仅 SUPER_ADMIN / AUDITOR' },
  { path: '/system/users', perm: 'system:user:list', note: '用户管理：仅 SUPER_ADMIN' },
  { path: '/system/roles', perm: 'system:role:list', note: '角色管理：仅 SUPER_ADMIN' },
  {
    path: '/system/depts',
    perm: SYSTEM_MENU_ROOT,
    note: '部门只读页（CE 无部门原子权限点）：以系统管理菜单根节点 system 守卫，仅 SUPER_ADMIN',
  },
  {
    path: '/system/groups',
    perm: SYSTEM_MENU_ROOT,
    note: '群组占位页（CE 无群组接口与权限点）：以系统管理菜单根节点 system 守卫，仅 SUPER_ADMIN',
  },
  {
    path: '/system/menus',
    perm: SYSTEM_MENU_ROOT,
    note: '菜单 / 权限点目录只读页：以系统管理菜单根节点 system 守卫，仅 SUPER_ADMIN',
  },
] as const;

/**
 * 解析某路径所需的权限点（最长前缀匹配）。
 *
 * <p>例如 `/system/users/123` 命中 `/system/users`；`/file/share` 命中 `/file`。
 *
 * @returns 未登记时返回 undefined（表示不需要守卫）
 */
export function resolveRoutePerm(pathname: string): PermCode | PermCode[] | undefined {
  if (!pathname) {
    return undefined;
  }
  let matched: RoutePermRule | undefined;
  for (const rule of ROUTE_PERM_RULES) {
    const hit = pathname === rule.path || pathname.startsWith(`${rule.path}/`);
    if (hit && (!matched || rule.path.length > matched.path.length)) {
      matched = rule;
    }
  }
  return matched?.perm;
}
