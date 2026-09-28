/**
 * 全局头像覆盖表：`userId → 最新头像地址`，让「头像一变，所有看到它的地方立刻换图」成立。
 *
 * <p><b>为什么必须有这一层：</b>页面上的头像有两条来源，它们的更新时机完全不同——
 * <ul>
 *   <li><b>本人</b>：读全局登录态（`initialState.currentUser.avatar`），资料变更帧到达时
 *       改登录态就够了；</li>
 *   <li><b>他人</b>：读的是<b>各页面自己拉回来的数据</b>（会话列表的 `targetAvatarUrl`、
 *       消息载荷的 `senderAvatarUrl`、群成员列表的 `avatarUrl`）——这些对象躺在内存里，
 *       服务端换图不会让它们变。</li>
 * </ul>
 * 不动第二条来源，「A 换了头像，B 的会话列表还是旧图」就会一直存在，直到 B 手动刷新页面。
 * 而靠在每个页面各自重拉一遍列表来修，代价是全量接口往返 + 列表闪烁 + 分页与筛选状态丢失。</p>
 *
 * <p><b>做法：</b>把「这个人最新的头像地址」抽成一张与页面数据无关的旁路表。服务端广播的
 * 资料变更帧（含他人变更，见 `WsProfilePayload`）写进这里，所有渲染头像的组件都经
 * {@link useAvatarUrl}（`@/hooks/useAvatarUrl`）取值——覆盖表有记录就用它，没有才回落到页面数据。
 * 于是换图是一次改表 + 一次重渲染，不碰任何列表数据，也不产生接口往返。</p>
 *
 * <p><b>它不是缓存，而是「比页面数据更新的那一份」：</b>值仍以服务端下发的 `?v=` 地址为准
 * （这里不拼地址、不改地址）。页面下次拉取时自然也会拿到同一个新地址，此时覆盖表里的记录
 * 与页面数据一致，属无害冗余。因此<b>不需要淘汰策略</b>——唯一的清空时机是登出
 * （见 {@link resetAvatarOverrides}），避免跨账号残留。</p>
 */

/** 覆盖表快照：`userId → 头像地址`；`null` 表示「该用户现在没有头像」（与「没记录」不同）。 */
export type AvatarOverrides = Readonly<Record<string, string | null>>;

/** 空表：冻结的共享常量，保证快照函数在无记录时返回稳定引用。 */
const EMPTY: AvatarOverrides = Object.freeze({});

let overrides: AvatarOverrides = EMPTY;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error('[anttransfer] 头像覆盖表订阅回调异常', error);
    }
  });
}

/** 订阅覆盖表变更（供 `useSyncExternalStore` 使用）。 */
export function subscribeAvatarOverrides(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 读取当前覆盖表快照（引用稳定：无变更时不换对象）。 */
export function getAvatarOverrides(): AvatarOverrides {
  return overrides;
}

/**
 * 记下某人的最新头像。
 *
 * <p><b>语义要点：</b>`avatarUrl` 传 `null` 是有效值（= 该用户删掉了头像），它会覆盖页面数据里的
 * 旧地址、让头像回落为「展示名首字符」兜底；而「没有记录」表示「本端没见过这个人的变更」，
 * 此时页面数据照常生效。两者不可混同，所以查表一律用 `in` / `undefined` 判断，不能用真值判断。</p>
 *
 * <p>幂等：值没变时直接返回、不通知订阅者——同一帧重复到达（例如本人的变更同时来自
 * 上传响应与广播帧）不应造成额外渲染。</p>
 *
 * @returns 是否真的发生了变更（调用方据此决定要不要做后续动作）
 */
export function applyAvatarChange(userId: string, avatarUrl: string | null): boolean {
  if (!userId) {
    return false;
  }
  if (userId in overrides && overrides[userId] === avatarUrl) {
    return false;
  }
  overrides = Object.freeze({ ...overrides, [userId]: avatarUrl });
  notify();
  return true;
}

/**
 * 清空覆盖表（<b>登出时调用</b>）。
 *
 * <p>用户 ID 是雪花值、跨账号不会碰撞，残留值理论上不会串到别人头上；清空是为了不把一个
 * 已注销账号的头像地址留在内存里（它是可直出访问的地址），也避免「同一浏览器换账号后
 * 某个 ID 恰好命中旧记录」这类难复现的怪象。</p>
 */
export function resetAvatarOverrides(): void {
  if (overrides === EMPTY) {
    return;
  }
  overrides = EMPTY;
  notify();
}
