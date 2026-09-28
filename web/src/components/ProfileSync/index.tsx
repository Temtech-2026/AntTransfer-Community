/**
 * 用户资料的「全局即时刷新」入口（不渲染任何 UI）。
 *
 * <p><b>解决的问题：</b>头像只在登录时拉一次，之后没有任何刷新时机。有人换了头像后，
 * 界面会一直显示旧图，直到手动刷新整页。</p>
 *
 * <p><b>它处理两类接收方，缺一不可：</b>
 * <ol>
 *   <li><b>别人看到我的头像</b>——会话列表、聊天气泡、群成员列表、用户管理列表。
 *       这些地方读的是<b>各页面自己拉回来的数据</b>，改登录态对它们没有任何影响，
 *       所以必须写进全局覆盖表 {@link applyAvatarChange}，由 `UserAvatar` 统一取值换图。</li>
 *   <li><b>我自己看到自己的头像</b>——顶栏、头像下拉里的个人信息、自己发的气泡。
 *       这些读的是登录态，所以还要在 `userId` 命中本人时改写 `currentUser.avatar`。</li>
 * </ol>
 * 后端把资料变更帧<b>广播给所有在线端</b>（不再是「只推本人各端」），因此本组件
 * <b>必须按 `userId` 区分</b>：不判断就直接写登录态的话，别人换头像会把自己的顶栏头像改掉。</p>
 *
 * <p><b>为什么可以直接用帧里的地址，而不是回头拉一次 `/auth/me`：</b>
 * `useRefreshCurrentUser` 的注释说的是「前端不能凭『刚上传成功』这件事<b>自己拼</b>出新地址」
 * ——那是上传方拿不到地址的情形。这里的地址不是猜的，是服务端在同一事务提交后下发的最终值
 * （含 `?v=` 缓存版本号），与重新拉取等价，还省掉一次请求和一段「旧图 → 新图」的闪烁窗口。</p>
 *
 * <p><b>只改 `avatar`、不动其余字段：</b>帧里只有头像；昵称 / 角色 / 权限由各自的刷新时机
 * 负责，这里顺手覆盖会把别处刚拉到的状态冲掉。</p>
 *
 * <p><b>为什么挂在布局里而不是聊天页：</b>顶栏头像、头像下拉、聊天气泡、会话列表读的都是
 * 同一份状态，任何页面都可能需要它。挂在布局（`app.tsx` 的 `childrenRender`）才能保证
 * 这帧不会因为用户当前不在聊天页而丢失。</p>
 */
import { useModel } from '@umijs/max';
import type { FC } from 'react';

import { useWebSocket } from '@/hooks/useWebSocket';
import { applyAvatarChange } from '@/services/avatar/overrides';

/** 无 UI 的逻辑组件：订阅 `PROFILE` 帧，写覆盖表 + （命中本人时）写登录态。 */
const ProfileSync: FC = () => {
  const { setInitialState } = useModel('@@initialState');

  useWebSocket({
    onProfile: (profile) => {
      // ① 无论谁的头像变了，都记进全局覆盖表：会话列表 / 群成员 / 用户管理里
      //    正在展示这个人的地方据此立刻换图（这是「立刻刷新」对**他人**生效的那一半）
      applyAvatarChange(profile.userId, profile.avatarUrl ?? null);

      // ② 只有本人变更才动登录态（顶栏 / 个人信息弹窗 / 自己的气泡读的是它）
      setInitialState((state) => {
        // 极早期渲染（登录页 / 未登录）没有当前用户：没有可更新的头像
        if (!state?.currentUser) {
          return state;
        }
        // 帧现在会广播给所有人，所以必须比对 userId —— 否则别人换头像会改掉我的顶栏
        if (state.currentUser.userid !== profile.userId) {
          return state;
        }
        const avatar = profile.avatarUrl ?? undefined;
        // 值没变就原样返回：避免每次收到帧都造一个新 state 触发全树重渲染
        if (state.currentUser.avatar === avatar) {
          return state;
        }
        return {
          ...state,
          currentUser: { ...state.currentUser, avatar },
        };
      });
    },
  });

  return null;
};

export default ProfileSync;
