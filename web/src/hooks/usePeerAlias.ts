import { useSyncExternalStore } from 'react';

import {
  getPeerAliasOverrides,
  type PeerAliasOverrides,
  subscribePeerAliasOverrides,
} from '@/services/chat/peerAlias';

/**
 * 取备注覆盖表（**整张表**，订阅粒度即整表）。
 *
 * <p><b>为什么不像 `useAvatarUrl` 那样按 userId 取值：</b>那个 hook 的调用方是单个头像组件，
 * 一次只要一个人的图；而这里的调用方是会话列表与消息流，它们要在一屏里把几十个对端的
 * 备注逐条查一遍——逐个 hook 会造出几十个订阅与几十次重渲染。取整表 + 在 map 时叠加，
 * 一次订阅覆盖一屏，也与「备注变更后用 useMemo 重算列表」这条数据流天然对齐。</p>
 *
 * <p>重渲染成本可接受：改备注是低频人工动作，且重算的只是列表项的展示名。</p>
 *
 * @returns 覆盖表快照（引用稳定，无变更时返回同一个对象）
 */
export function usePeerAliasOverrides(): PeerAliasOverrides {
  return useSyncExternalStore(
    subscribePeerAliasOverrides,
    getPeerAliasOverrides,
    getPeerAliasOverrides,
  );
}

export default usePeerAliasOverrides;
