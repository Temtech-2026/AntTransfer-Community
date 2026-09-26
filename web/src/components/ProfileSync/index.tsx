/**
 * 本人资料的「多端同步」入口（不渲染任何 UI）。
 *
 * <p><b>解决的问题：</b>头像只在登录时拉一次，之后没有任何刷新时机。用户在 A 端
 * （公司电脑 / 另一个标签页）换了头像，B 端界面会一直显示旧图，直到手动刷新整页。
 * 后端在头像落库提交后向<b>本人所有在线连接</b>推一帧 `PROFILE`，这里把它落到登录态上。</p>
 *
 * <p><b>为什么可以直接用帧里的地址，而不是回头拉一次 `/auth/me`：</b>
 * {@code useRefreshCurrentUser} 的注释说的是「前端不能凭『刚上传成功』这件事
 * <b>自己拼</b>出新地址」——那是上传方拿不到地址的情形。这里的地址不是猜的，
 * 是服务端在同一事务提交后下发的最终值（含 `?v=` 缓存版本号），与重新拉取等价，
 * 还省掉一次请求和一段「旧图 → 新图」的闪烁窗口。</p>
 *
 * <p><b>只改 `avatar`、不动其余字段：</b>帧里只有头像；昵称 / 角色 / 权限由各自的
 * 刷新时机负责，这里顺手覆盖会把别处刚拉到的状态冲掉。</p>
 *
 * <p><b>为什么挂在布局里而不是聊天页：</b>顶栏头像、头像下拉里的个人信息、聊天气泡
 * 读的都是同一份登录态，任何页面都可能需要它。挂在布局（`app.tsx` 的 `childrenRender`）
 * 才能保证「只推给本人各端」的这帧不会因为用户当前不在聊天页而丢失。</p>
 */
import { useModel } from '@umijs/max';
import type { FC } from 'react';

import { useWebSocket } from '@/hooks/useWebSocket';

/** 无 UI 的逻辑组件：订阅 `PROFILE` 帧并写回登录态。 */
const ProfileSync: FC = () => {
  const { setInitialState } = useModel('@@initialState');

  useWebSocket({
    onProfile: (profile) => {
      setInitialState((state) => {
        // 极早期渲染（登录页 / 未登录）没有当前用户：没有可更新的头像
        if (!state?.currentUser) {
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
