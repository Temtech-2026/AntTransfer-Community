/**
 * 目录树的纯查询工具（面包屑 / 子目录列表）。
 *
 * <p>不走 `parentId` 反查而是直接 DFS：服务端返回的就是嵌套树，`parentId` 在某些返回
 * 场景下可能缺省（比如只查子树），依赖它反而会算出断链的面包屑。</p>
 *
 * <p>DFS 带深度上限：树数据一旦因为脏数据成环，无限递归会把页面直接挂死，
 * 宁可面包屑少一层也不要白屏。</p>
 */

import type { FolderNode } from '@/services/file';

/** 防御性深度上限（正常目录层级远小于此值）。 */
const MAX_DEPTH = 32;

/** 按 id 查找目录。 */
export function findFolder(
  tree: FolderNode[] | null | undefined,
  folderId?: number | null,
): FolderNode | undefined {
  if (!folderId) {
    return undefined;
  }
  return search(tree ?? [], folderId, 0);
}

function search(
  nodes: FolderNode[],
  folderId: number,
  depth: number,
): FolderNode | undefined {
  if (depth >= MAX_DEPTH) {
    return undefined;
  }
  for (const node of nodes) {
    if (node.id === folderId) {
      return node;
    }
    const found = search(node.children ?? [], folderId, depth + 1);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/**
 * 当前目录的直接子目录。
 *
 * <p>`parentId` 为空表示根目录，此时返回树的顶层节点。</p>
 */
export function folderChildren(
  tree: FolderNode[] | null | undefined,
  parentId?: number | null,
): FolderNode[] {
  if (!parentId) {
    return tree ?? [];
  }
  return findFolder(tree, parentId)?.children ?? [];
}

/**
 * 面包屑路径：从根到当前目录（含当前目录本身）。
 *
 * <p>找不到时返回空数组——调用方仍会渲染根目录这一层，不会出现悬空面包屑。</p>
 */
export function folderPath(
  tree: FolderNode[] | null | undefined,
  folderId?: number | null,
): FolderNode[] {
  if (!folderId) {
    return [];
  }
  return walk(tree ?? [], folderId, [], 0);
}

function walk(
  nodes: FolderNode[],
  folderId: number,
  trail: FolderNode[],
  depth: number,
): FolderNode[] {
  if (depth >= MAX_DEPTH) {
    return [];
  }
  for (const node of nodes) {
    const next = [...trail, node];
    if (node.id === folderId) {
      return next;
    }
    const found = walk(node.children ?? [], folderId, next, depth + 1);
    if (found.length > 0) {
      return found;
    }
  }
  return [];
}

/**
 * 路径 → 面包屑展示文案（用于日志 / 提示）。
 *
 * <p>根目录那一层的文案由调用方通过 `rootLabel` 传入（来自 i18n），
 * 本模块不内嵌任何语言文案，避免英文语境下混出中文。</p>
 */
export function folderPathText(
  tree: FolderNode[] | null | undefined,
  folderId?: number | null,
  rootLabel?: string,
): string {
  const names = folderPath(tree, folderId).map((node) => node.name);
  return [...(rootLabel ? [rootLabel] : []), ...names].join(' / ');
}
