/**
 * 部门打平列表 → 树的纯函数。
 *
 * <p>后端 {@code GET /api/v1/system/users/dept-options} 返回的是<b>打平</b>列表
 * （{@code DeptOptionVO{id, parentId, name}}），不是树。前端需要树形表格就得自己组装，
 * 因此把组装逻辑抽成纯函数单独测试：脏数据（父不存在 / 自引 / 成环）在真实库中是常态，
 * 一旦递归成环就会把页面打挂，必须显式兜底。</p>
 */

import type { DeptOptionVO } from '@/services/system';

/** 部门树节点。 */
export interface DeptTreeNode extends DeptOptionVO {
  /** 层级深度（0 为根），供表格缩进 / 统计使用。 */
  depth: number;
  children: DeptTreeNode[];
}

/**
 * 组装部门树。
 *
 * <p>容错口径：
 * <ul>
 *   <li>父节点为 0 / null / 指向不存在的 ID → 当根节点处理（不丢节点）；</li>
 *   <li>自引（parentId === id）→ 当根节点处理；</li>
 *   <li>成环（A→B→A）→ 从环中第一个可达节点起，把环内节点提升为根，
 *       保证每个节点恰好出现一次且递归必然终止。</li>
 * </ul>
 *
 * <p>同级顺序<b>保留后端返回顺序</b>，不额外排序——排序规则以服务端为准，
 * 前端再排一次会让两边顺序不一致，反而难以对账。</p>
 */
export function buildDeptTree(depts: readonly DeptOptionVO[]): DeptTreeNode[] {
  const nodeById = new Map<string, DeptTreeNode>();
  for (const dept of depts) {
    nodeById.set(dept.id, { ...dept, depth: 0, children: [] });
  }

  const roots: DeptTreeNode[] = [];
  for (const dept of depts) {
    const node = nodeById.get(dept.id);
    if (!node) {
      continue;
    }
    const parent = dept.parentId ? nodeById.get(dept.parentId) : undefined;
    if (!parent || parent.id === node.id) {
      roots.push(node);
      continue;
    }
    parent.children.push(node);
  }

  // 自顶向下填深度，同时用 visited 把环里的节点「漏」出来
  const visited = new Set<string>();
  const walk = (nodes: readonly DeptTreeNode[], depth: number) => {
    for (const node of nodes) {
      if (visited.has(node.id)) {
        continue;
      }
      visited.add(node.id);
      node.depth = depth;
      walk(node.children, depth + 1);
    }
  };
  walk(roots, 0);

  // 仍有未访问节点 ⇒ 它们在一个或多个环里，逐个提升为根
  for (const dept of depts) {
    const node = nodeById.get(dept.id);
    if (node && !visited.has(node.id)) {
      roots.push(node);
      walk([node], 0);
    }
  }

  return roots;
}

/** 树 → 打平列表（按深度优先顺序），用于「全部部门」下拉等只需要一维序列的场景。 */
export function flattenDeptTree(nodes: readonly DeptTreeNode[]): DeptTreeNode[] {
  const result: DeptTreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    result.push(...flattenDeptTree(node.children));
  }
  return result;
}
