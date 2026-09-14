/**
 * 权限显隐组件与 hooks（按钮 / 区块级）。
 *
 * <p>⚠️ 红线（docs/development/frontend-permission-map.md）：**只藏不决定安全**。
 * 隐藏入口只是体验优化，安全由后端 {@code @RequiresPerm} 强制——因此这里不会、
 * 也不应该出现「前端判断通过就放行」的逻辑。
 *
 * <p>用法：
 * <pre>{@code
 * // ① 组件式：无权限时整块不渲染（可给 fallback）
 * <Access perm="file:upload">
 *   <Button>上传</Button>
 * </Access>
 *
 * // ② hook 式：需要参与其他逻辑（如禁用而非隐藏）时用
 * const canDownload = usePerm('file:download');
 * <Button disabled={!canDownload}>下载</Button>
 *
 * // ③ 多权限点：默认「满足其一」，mode="all" 为「全部满足」
 * <Access perm={['system:user:update', 'system:user:assign-role']} mode="all">…</Access>
 * }</pre>
 */

import { useAccess } from '@umijs/max';
import type { FC, ReactNode } from 'react';

import type { PermCode } from '@/services/access';

/** Access 组件属性。 */
export interface AccessProps {
  /** 所需权限点；数组时按 {@link AccessProps.mode} 判定。 */
  perm?: PermCode | readonly PermCode[];
  /** 多权限点判定口径：any 满足其一（默认）/ all 全部满足。 */
  mode?: 'any' | 'all';
  /** 无权限时渲染的内容（默认不渲染任何东西）。 */
  fallback?: ReactNode;
  children?: ReactNode;
}

/**
 * 是否为多权限点形态。
 *
 * <p>不用裸 {@code Array.isArray}：它无法把 {@code readonly PermCode[]} 从联合类型里收窄掉。
 */
function isPermList(perm?: PermCode | readonly PermCode[]): perm is readonly PermCode[] {
  return Array.isArray(perm);
}

/**
 * 权限显隐容器：有权限渲染 children，无权限渲染 fallback（默认 null）。
 */
export const Access: FC<AccessProps> = ({ perm, mode = 'any', fallback = null, children }) => {
  const access = useAccess();
  const allowed = isPermList(perm)
    ? mode === 'all'
      ? access.canAll(perm)
      : access.canAny(perm)
    : access.can(perm);
  return <>{allowed ? children : fallback}</>;
};

/** 是否具备某权限点（hook 形态，适合需要「禁用而非隐藏」的场景）。 */
export function usePerm(perm?: PermCode | null): boolean {
  const access = useAccess();
  return access.can(perm);
}

/** 是否具备其中任意一个权限点。 */
export function usePermAny(perms?: readonly PermCode[] | null): boolean {
  const access = useAccess();
  return access.canAny(perms);
}

/** 是否全部具备。 */
export function usePermAll(perms?: readonly PermCode[] | null): boolean {
  const access = useAccess();
  return access.canAll(perms);
}

export default Access;
