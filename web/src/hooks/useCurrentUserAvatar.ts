/**
 * 当前登录用户的头像地址（`initialState.currentUser.avatar`）。
 *
 * <p><b>为什么要有这个 Hook：</b>聊天里的「我发的」那一行不带发送人头像——服务端刻意
 * 不在自己的写扩散行上重复回填头像（见 `NotifyMessageVO.senderAvatarUrl`），
 * 自己的头像只存在于登录态。于是「我发的消息气泡头像」与「顶栏头像」必须同源，
 * 否则会出现「顶栏换了新头像、聊天里自己还是旧图」。
 *
 * <p><b>多端同步怎么跟上：</b>`ProfileSync` 收到 `PROFILE` 帧后直接改写
 * `initialState.currentUser.avatar`，读过本 Hook 的组件会自动重渲染，
 * 不需要额外的订阅或轮询。
 *
 * <p>返回 `undefined` 表示「没有头像」，交由 `Avatar` 走首字符 / 图标兜底——
 * 不要把空串透出去（空串进 `img src` 会渲染成破图）。
 */
import { useModel } from '@umijs/max';

export default function useCurrentUserAvatar(): string | undefined {
  const { initialState } = useModel('@@initialState');
  return initialState?.currentUser?.avatar || undefined;
}
