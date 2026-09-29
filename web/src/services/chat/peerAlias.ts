/**
 * 会话对端备注覆盖表：`peerId → 我给这个人起的名字`。
 *
 * <p><b>为什么前端还要存一份：</b>备注的权威数据在服务端（`sys_chat_peer_alias`），
 * 会话列表也带回了 `peerAlias`。但「保存备注」这个动作发生在会话列表数据<b>已经躺在内存里</b>
 * 之后——没有这一层，用户点完保存会看到名字没变（列表还是旧对象），要么就得为了一个字的改动
 * 重拉整个列表，代价是一次全量往返 + 列表闪烁 + 分页与筛选状态丢失。</p>
 *
 * <p><b>它是「比页面数据更新的那一份」，不是缓存：</b>值就是用户刚写下的字，
 * 页面下次拉取时服务端会给同一份值，此时覆盖表与页面数据一致，属无害冗余。
 * 因此<b>不需要淘汰策略</b>，唯一的清空时机是登出（见 {@link resetPeerAliasOverrides}）——
 * 备注是纯私有数据，跨账号残留会让下一个登录的人在会话列表里看到上一个人的称呼。</p>
 *
 * <p>与头像覆盖表（`services/avatar/overrides`）同构，差别只在取值时机：
 * 头像由服务端广播帧驱动，备注由用户自己的保存动作驱动。</p>
 */

import { ChatScope } from '@/services/notify';

/** 覆盖表快照：`peerId → 备注名`；`null` 表示「已取消备注」（与「没记录」不同）。 */
export type PeerAliasOverrides = Readonly<Record<string, string | null>>;

/** 空表：冻结的共享常量，保证快照函数在无记录时返回稳定引用。 */
const EMPTY: PeerAliasOverrides = Object.freeze({});

let overrides: PeerAliasOverrides = EMPTY;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error('[anttransfer] 备注覆盖表订阅回调异常', error);
    }
  });
}

/** 订阅覆盖表变更（供 `useSyncExternalStore` 使用）。 */
export function subscribePeerAliasOverrides(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 读取当前覆盖表快照（引用稳定：无变更时不换对象）。 */
export function getPeerAliasOverrides(): PeerAliasOverrides {
  return overrides;
}

/**
 * 记下「我给某人起的最新名字」。
 *
 * <p><b>语义要点：</b>`alias` 传 `null` 是有效值（= 刚取消了备注），它会压掉页面数据里
 * 可能还在的旧备注、让名字回落为对端真实昵称；而「没有记录」表示「本端没改过」，
 * 此时页面数据（`Conversation.peerAlias`）照常生效。两者不可混同——查表一律用
 * `in` / `undefined` 判定，不能用真值判定，否则「取消备注」这个动作在本端不生效。</p>
 *
 * <p>幂等：值没变时直接返回、不通知订阅者，重复保存不会造成额外渲染。</p>
 *
 * @param peerId 被备注的用户 ID（服务端下发的字符串形式雪花 ID）
 * @param alias  备注名；`null` 表示取消备注
 * @returns 是否真的发生了变更（调用方据此决定要不要做后续动作）
 */
export function applyPeerAliasChange(
  peerId: string,
  alias: string | null,
): boolean {
  if (!peerId) {
    return false;
  }
  if (peerId in overrides && overrides[peerId] === alias) {
    return false;
  }
  overrides = Object.freeze({ ...overrides, [peerId]: alias });
  notify();
  return true;
}

/**
 * 清空覆盖表（<b>登出时调用</b>）。
 *
 * <p>与头像覆盖表同理，但理由更硬：头像残留只是显示旧图，备注残留是<b>把别人对他的称呼
 * 展示给下一个登录的人</b>。用户 ID 是雪花值、跨账号不会碰撞，所以这只是「同一浏览器换账号」
 * 这一条路径上的问题，但那条路径确实存在（共用电脑、切换测试账号）。</p>
 */
export function resetPeerAliasOverrides(): void {
  if (overrides === EMPTY) {
    return;
  }
  overrides = EMPTY;
  notify();
}

/** 覆盖表能作用的对象：会话列表项与详情态都满足（`targetId` 是会话对端 / 群组 ID）。 */
export interface PeerAliasTarget {
  /** 会话范围（`ChatScope` 数值）；只有单聊吃备注。 */
  chatScope: number;
  /** 会话定位 ID：单聊=对端用户 ID，群聊=群组 ID。 */
  targetId: string;
  /** 页面数据里带的备注（`undefined` = 还没从服务端拿到）。 */
  peerAlias?: string | null;
}

/**
 * 把覆盖表叠加到会话（列表项或详情态）上，得到「本端最新的那份」数据。
 *
 * <p><b>为什么要有这一层而不是各处自己查表：</b>查表要处理三个容易写错的分支——
 * 群聊不该吃备注、`null`（取消）要压过旧值、无记录要放行页面数据。
 * 分散在列表、标题、消息署名里写三遍，早晚有一处写成真值判定，表现就是
 * 「取消备注后列表变了、气泡署名没变」。</p>
 *
 * <p><b>未变更时返回原对象</b>（保持引用相等），避免 `useMemo` 下游白重渲染。</p>
 */
export function applyPeerAliasOverride<T extends PeerAliasTarget>(
  session: T,
  overrides: PeerAliasOverrides,
): T {
  // 群聊的 targetId 是群组 ID，拿它当用户 ID 查备注属于串域取值
  if (session.chatScope !== ChatScope.PRIVATE) {
    return session;
  }
  // 用 `in` 而不是真值判定：`null` 是有意义的值（刚取消备注）
  if (!(session.targetId in overrides)) {
    return session;
  }
  const alias = overrides[session.targetId];
  if (session.peerAlias === alias) {
    return session;
  }
  return { ...session, peerAlias: alias };
}
