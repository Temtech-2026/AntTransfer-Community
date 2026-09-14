/**
 * 菜单渲染桥接层：把「Umi 路由自动生成的菜单」与「后端动态菜单」收敛成 ProLayout 可吃的结构。
 *
 * <p>两条来源的口径（与 docs/development/frontend-permission-map.md 一致）：
 * <ol>
 *   <li><b>动态菜单</b>：`GET /api/v1/permission/menus`（D-9，后端未落地）→
 *       {@link import('./menu').buildMenuTree} + {@link import('./menu').toMenuData}
 *       + {@link import('./menu').filterMenuByPerm} + {@link toProMenuItems}；</li>
 *   <li><b>静态路由兜底</b>：{@link filterProMenuByPerm} —— 直接对 ProLayout 传进来的菜单树
 *       按 {@link import('./route-perm').resolveRoutePerm} 过滤，**保留原对象**
 *       （name/icon/i18n 都是 Umi 处理好的，重建会丢本地化）。</li>
 * </ol>
 *
 * <p>铁律：无权限的菜单项**不渲染**（不是置灰）。前端不渲染只是体验优化，
 * 后端 `@RequiresPerm` 仍是安全边界。
 */

import type { ReactNode } from 'react';

import { menuIconOf } from './menu-icon';
import { hasAnyPerm, hasPerm, type PermSource } from './perm';
import { resolveRoutePerm } from './route-perm';
import type { MenuDataNode } from './types';

/** ProLayout 菜单项的最小结构（只声明用到的字段，避免把 pro-components 类型引进 services）。 */
export interface ProMenuLike {
  /** ProLayout 的 path 可能是单值或候选数组，取第一个即可。 */
  path?: string | readonly string[] | null;
  children?: ProMenuLike[] | null;
  routes?: ProMenuLike[] | null;
}

/** 后端动态菜单转换后的渲染节点。 */
export interface ProMenuItemNode {
  path: string;
  name: string;
  icon?: ReactNode;
  children?: ProMenuItemNode[];
}

/** 归一化 ProLayout 的 path（string | string[] | undefined）。 */
function firstPath(path?: string | readonly string[] | null): string {
  if (typeof path === 'string') {
    return path;
  }
  if (Array.isArray(path) && typeof path[0] === 'string') {
    return path[0];
  }
  return '';
}

/**
 * 按权限过滤 ProLayout 菜单树（静态路由兜底路径）。
 *
 * <p>规则：
 * <ul>
 *   <li>菜单项路径命中 {@link resolveRoutePerm} 且不具备对应权限 → 整项丢弃（含子项）；</li>
 *   <li>未登记的路径 = 公开页 / 演示页 → 放行；</li>
 *   <li>纯分组（自身无权限要求）的子项被全部过滤后 → 分组本身也丢弃，避免留下空目录；</li>
 *   <li>自身有权限要求的页面型节点 → 即使子项为空也保留。</li>
 * </ul>
 */
export function filterProMenuByPerm<T extends ProMenuLike>(
  items: readonly T[] | null | undefined,
  source: PermSource,
): T[] {
  if (!items?.length) {
    return [];
  }

  const result: ProMenuLike[] = [];
  for (const item of items) {
    const required = resolveRoutePerm(firstPath(item.path));
    // 路由登记了多个权限点时与 PermGuard 的 canAny 口径保持一致
    const allowed = Array.isArray(required)
      ? hasAnyPerm(source, required)
      : hasPerm(source, required);
    if (!allowed) {
      continue;
    }

    const hasChildKey = Boolean(item.children || item.routes);
    const children = filterProMenuByPerm<T>(
      (item.children ?? item.routes) as readonly T[] | undefined,
      source,
    );
    if (required === undefined && hasChildKey && children.length === 0) {
      continue;
    }

    const next: ProMenuLike = { ...item };
    if (children.length) {
      if (item.children) {
        next.children = children;
      }
      if (item.routes) {
        next.routes = children;
      }
    } else {
      delete next.children;
      delete next.routes;
    }
    result.push(next);
  }
  return result as T[];
}

/**
 * 后端动态菜单 → ProLayout 菜单项（图标键在这里映射为组件，服务层保持纯数据）。
 */
export function toProMenuItems(nodes: readonly MenuDataNode[] | null | undefined): ProMenuItemNode[] {
  if (!nodes?.length) {
    return [];
  }
  return nodes.map((node) => {
    const children = toProMenuItems(node.children);
    return {
      path: node.path,
      name: node.name,
      icon: menuIconOf(node.iconKey, node.perm),
      children: children.length ? children : undefined,
    };
  });
}
