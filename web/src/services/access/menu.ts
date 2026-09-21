/**
 * 动态菜单构建与过滤（纯函数，便于单测）。
 *
 * <p>两种菜单来源，口径统一在这里收口：
 * <ol>
 *   <li><b>后端动态菜单</b>（`/api/v1/permission/menus`，D-9）：{@link buildMenuTree} + {@link toMenuData}；</li>
 *   <li><b>静态路由菜单</b>（Umi 路由自动生成，兜底）：{@link filterMenuByPerm}。</li>
 * </ol>
 *
 * <p>⚠️ 当前后端 D-9 未落地、`route_path` 未回填（permission-map.md 已知项），
 * 因此实际生效的是第 2 条兜底路径；第 1 条按既定契约实现并单测，后端就绪后无需改前端结构。
 */

import { compareSnowflakeId } from '@/utils/id';

import { hasPerm, type PermSource } from './perm';
import { MenuNodeType, type MenuDataNode, type MenuNode } from './types';

/** 该节点是否可作为菜单项渲染（维度=菜单 / 未显式隐藏 / 有路由路径）。 */
export function isRenderableMenu(node: MenuNode): boolean {
  return node.type === MenuNodeType.MENU && node.visible !== 0 && Boolean(node.routePath);
}

/** 排序：sortNo 升序，缺失排后，再按 id 稳定排序（字符串 ID 走数值序比较，禁止 `Number()`）。 */
function bySortNo(a: MenuNode, b: MenuNode): number {
  const left = a.sortNo ?? Number.MAX_SAFE_INTEGER;
  const right = b.sortNo ?? Number.MAX_SAFE_INTEGER;
  return left === right ? compareSnowflakeId(a.id, b.id) : left - right;
}

/** 深度收集（扁平列表里可能混有已组装的 children）。 */
function collect(nodes: readonly MenuNode[], bucket: Map<string, MenuNode>): void {
  for (const node of nodes) {
    if (!bucket.has(node.id)) {
      bucket.set(node.id, { ...node, children: undefined });
    }
    if (node.children?.length) {
      collect(node.children, bucket);
    }
  }
}

/**
 * 由扁平列表（含 parentId）组装菜单树，并剪掉不可渲染的节点。
 *
 * <p>剪枝规则：
 * <ul>
 *   <li>type≠1 或 visible=0 的节点不渲染；</li>
 *   <li>有子菜单的容器节点即使自身无 routePath 也保留（其 path 取第一个后代路径，保证可点击）；</li>
 *   <li>既无 routePath 又无子菜单的节点直接丢弃（例如只挂操作点的空菜单，见 D-9 已知问题）。</li>
 * </ul>
 */
export function buildMenuTree(nodes: readonly MenuNode[] | null | undefined): MenuNode[] {
  if (!nodes?.length) {
    return [];
  }
  const bucket = new Map<string, MenuNode>();
  collect(nodes, bucket);
  const all = [...bucket.values()];

  const childrenOf = (parentId: string): MenuNode[] =>
    all.filter((node) => node.parentId === parentId).sort(bySortNo);

  const prune = (node: MenuNode): MenuNode | undefined => {
    const children = childrenOf(node.id)
      .map(prune)
      .filter((child): child is MenuNode => Boolean(child));
    if (!isRenderableMenu(node)) {
      // 容器节点：自身不可渲染但有存活的子菜单时保留
      if (children.length === 0) {
        return undefined;
      }
      return { ...node, routePath: children[0]?.routePath ?? null, children };
    }
    return { ...node, children: children.length ? children : undefined };
  };

  // 根节点的 parentId 契约是字符串 '0'（后端 Long 0 序列化结果）
  return childrenOf('0')
    .map(prune)
    .filter((node): node is MenuNode => Boolean(node));
}

/**
 * 菜单节点 → 渲染数据（保持纯数据：图标只给键，由 UI 层映射组件）。
 */
export function toMenuData(nodes: readonly MenuNode[] | null | undefined): MenuDataNode[] {
  if (!nodes?.length) {
    return [];
  }
  return nodes.map((node) => {
    const children = toMenuData(node.children);
    return {
      path: node.routePath ?? children[0]?.path ?? '',
      name: node.permName || node.permCode,
      iconKey: node.icon ?? undefined,
      // type=1 菜单自身也有 perm_code（如 file / audit / system）：同样参与过滤
      perm: node.permCode || undefined,
      children: children.length ? children : undefined,
    };
  });
}

/**
 * 按权限过滤菜单（静态路由菜单兜底路径）。
 *
 * <p>规则：
 * <ul>
 *   <li>节点声明了 perm 且不具备 → 丢弃；未声明 perm（纯容器）→ 跟随子项；</li>
 *   <li>父节点的子项被全部过滤掉且父节点自身不是可跳转页面（无 perm）→ 一并丢弃；
 *       父节点自身有 perm（是真实页面）→ 保留。</li>
 * </ul>
 */
export function filterMenuByPerm(
  nodes: readonly MenuDataNode[] | null | undefined,
  source: PermSource,
): MenuDataNode[] {
  if (!nodes?.length) {
    return [];
  }
  const result: MenuDataNode[] = [];
  for (const node of nodes) {
    const children = filterMenuByPerm(node.children, source);
    if (!hasPerm(source, node.perm)) {
      continue;
    }
    if (!node.perm && node.children?.length && children.length === 0) {
      continue;
    }
    result.push(children.length ? { ...node, children } : { ...node, children: undefined });
  }
  return result;
}

/** 提取菜单中的所有路径（调试 / 守卫白名单用）。 */
export function flattenMenuPaths(nodes: readonly MenuDataNode[] | null | undefined): string[] {
  if (!nodes?.length) {
    return [];
  }
  return nodes.flatMap((node) => [node.path, ...flattenMenuPaths(node.children)]).filter(Boolean);
}
