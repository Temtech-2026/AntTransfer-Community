import { useSyncExternalStore } from 'react';

import { getAvatarOverrides, subscribeAvatarOverrides } from '@/services/avatar/overrides';

/**
 * 取某个用户当前该显示的头像地址：**全局覆盖表优先，没有记录时回落到传入的页面数据**。
 *
 * <p>这是「所有用到头像的地方立刻刷新」的唯一取值口径，所有渲染用户头像的组件都应经它取图
 * （见 `components/UserAvatar`），而不要再直接读各自数据对象里的 `avatarUrl`：直读的话，
 * 服务端换了图、页面数据没重拉，那张脸就会一直停在旧图上。</p>
 *
 * <p><b>`null` 与「没记录」必须区分：</b>覆盖表命中 `null` 表示「该用户已无头像」，
 * 此时要<b>压掉</b> `fallback`（返回 `undefined`，让头像回落为展示名首字符），
 * 而不是回退到页面数据里的旧地址——否则「删头像」这个动作在别的端永远不生效。
 * 因此查表用 `in` / `undefined` 判定，不能用真值判定。</p>
 *
 * <p>订阅粒度是整张表：任一头像变更会让所有用本 hook 的组件重渲染。这在实践中是可接受的
 * ——换头像是低频人工动作，且重渲染的只是头像组件本身（`Avatar` 只换一个 `src`）。</p>
 *
 * @param userId   用户 ID（服务端以字符串下发的雪花值；数字也接受，避免调用方反复转换）
 * @param fallback 页面数据里的地址（会话列表 / 消息载荷 / 成员列表给的 `avatarUrl`）
 * @returns 该显示的头像地址；`undefined` 表示没有头像，由 `Avatar` 走首字符兜底
 */
export function useAvatarUrl(
  userId?: string | number | null,
  fallback?: string | null,
): string | undefined {
  const snapshot = useSyncExternalStore(
    subscribeAvatarOverrides,
    getAvatarOverrides,
    getAvatarOverrides,
  );

  const key = userId == null ? '' : String(userId);
  if (key) {
    const hit = snapshot[key];
    // 命中即以此为准：`null` 要压掉 fallback（= 该用户已无头像），不能回退
    if (hit !== undefined) {
      return hit ?? undefined;
    }
  }
  return fallback ?? undefined;
}

export default useAvatarUrl;
