/**
 * 用户头像：`Avatar` 的取值收口。
 *
 * <p><b>为什么有这一层：</b>头像地址有两条来源（全局覆盖表 / 页面数据），取值口径必须统一，
 * 否则「A 换了头像，B 的会话列表还是旧图」会在漏改的那一处继续存在。把所有
 * `src={xxx.avatarUrl}` 改成 `userId={xxx.userId} src={xxx.avatarUrl}`，
 * 就自动接入了「收到变更帧即换图」的能力，不必在每个页面各写一遍订阅逻辑。</p>
 *
 * <p><b>为什么是组件而不是在每个页面里调 hook：</b>列表里对每一项调 hook 会违反
 * 「禁止在循环 / 条件里调用 hook」；封成组件后每一项各自是一个组件实例，订阅关系天然正确。</p>
 *
 * <p>用法与 `Avatar` 一致，只是多一个 `userId`，并且 `src` 允许 `null`：</p>
 *
 * ```tsx
 * <UserAvatar size={32} userId={msg.senderUserId} src={msg.senderAvatarUrl} />
 * ```
 *
 * <p><b>不传 `userId` 时行为与 `Avatar` 完全相同</b>（群头像这类没有用户主体的场景照旧直传
 * `src` 即可），所以替换是安全的、可增量的。</p>
 *
 * <p>其余 props（`size` / `icon` / `shape` / `children` 等）原样透传给 `Avatar`：
 * 传了 `children` 且没图时，`Avatar` 会显示这个首字符兜底。</p>
 */

import { Avatar, type AvatarProps } from 'antd';
import React from 'react';

import { useAvatarUrl } from '@/hooks/useAvatarUrl';

export interface UserAvatarProps extends Omit<AvatarProps, 'src'> {
  /** 用户 ID（服务端以字符串下发的雪花值）。不传则退化为普通 `Avatar`。 */
  userId?: string | number | null;
  /** 页面数据里的头像地址；被覆盖表命中时会被替换，`null` 表示没有头像。 */
  src?: string | null;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ userId, src, ...rest }) => {
  const resolved = useAvatarUrl(userId, src);
  return <Avatar {...rest} src={resolved} />;
};

export default UserAvatar;
