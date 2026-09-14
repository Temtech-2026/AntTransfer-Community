/**
 * 顶栏头像下拉（第 2 步页面 2）。
 *
 * <p>只保留「个人信息 / 退出登录」两项：模板原有的「主题设置」和
 * `history.push('/account/xxx')` 依赖的是已被清理的模板页面，留着就是死链。</p>
 *
 * <p><b>退出登录必须三件事一起做</b>，缺任何一件都会留下「假登录态」：
 * <ol>
 *   <li>通知服务端吊销 —— at-auth 会把 token_epoch + 1 并清 Redis 白名单，所有端的旧令牌立即失效；</li>
 *   <li>清本地令牌 —— 由 `services/auth#logout` 的 finally 保证（服务端失败也必须清）；</li>
 *   <li>清内存态 —— initialState 里的 currentUser / permissions / menus，并断开 WS 连接；
 *       否则上个账号的权限点会继续参与 `can()` 判定，出现「退出了还能看到菜单」。</li>
 * </ol>
 */

import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { history, useModel } from '@umijs/max';
import type { MenuProps } from 'antd';
import { Descriptions, Modal, Spin, Tag } from 'antd';
import React, { startTransition, useState } from 'react';

import { DENY_ALL_PERMISSION } from '@/services/access';
import { type AuthUserSummary, fetchProfile, logout } from '@/services/auth';
import { disposeAllUploadQueues } from '@/services/upload';
import { wsStore } from '@/services/ws';
import HeaderDropdown from '../HeaderDropdown';

type GlobalHeaderRightProps = {
  children?: React.ReactNode;
};

const menuItems: MenuProps['items'] = [
  {
    key: 'profile',
    icon: <UserOutlined />,
    label: '个人信息',
  },
  {
    type: 'divider' as const,
  },
  {
    key: 'logout',
    icon: <LogoutOutlined />,
    label: '退出登录',
    danger: true,
  },
];

export const AvatarDropdown: React.FC<GlobalHeaderRightProps> = ({ children }) => {
  const { initialState, setInitialState } = useModel('@@initialState');

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profile, setProfile] = useState<AuthUserSummary | undefined>();

  /** 打开时现拉一次：角色被调整后无需重新登录即可看到最新结果。 */
  const openProfile = async () => {
    setProfileOpen(true);
    setProfileLoading(true);
    try {
      setProfile(await fetchProfile());
    } catch (error) {
      // 提示交给全局错误链路，这里只留痕
      console.warn('[anttransfer] 个人信息加载失败', error);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // 服务端吊销 + 清本地令牌（logout 内部 finally 保证清令牌）
      await logout();
    } catch (error) {
      console.warn('[anttransfer] 注销请求失败，已按本地登出处理', error);
    }
    // 断连要在清令牌之后：避免用已失效的令牌触发一轮无意义的重连
    wsStore.stop();
    // 上传控制器持有 File 引用与在途请求，不销毁会带着上个账号的任务进入下一个会话
    disposeAllUploadQueues();
    startTransition(() => {
      setInitialState((s) => ({
        ...s,
        currentUser: undefined,
        permissions: DENY_ALL_PERMISSION,
        menus: [],
      }));
    });
    const { pathname, search, hash } = history.location;
    if (pathname !== '/user/login') {
      history.replace(`/user/login?redirect=${encodeURIComponent(pathname + search + hash)}`);
    }
  };

  const onMenuClick: MenuProps['onClick'] = (event) => {
    if (event.key === 'profile') {
      void openProfile();
      return;
    }
    if (event.key === 'logout') {
      void handleLogout();
    }
  };

  if (!initialState) {
    return <Spin size="small" />;
  }

  const { currentUser } = initialState;

  if (!currentUser) {
    return <Spin size="small" />;
  }

  const roles = profile?.roles ?? [];

  return (
    <>
      <HeaderDropdown
        placement="bottomRight"
        menu={{
          selectedKeys: [],
          onClick: onMenuClick,
          items: menuItems,
        }}
        arrow
      >
        {children}
      </HeaderDropdown>
      <Modal
        title="个人信息"
        open={profileOpen}
        onCancel={() => setProfileOpen(false)}
        footer={null}
      >
        <Spin spinning={profileLoading}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="账号">{profile?.username ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="昵称">
              {profile?.nickname || profile?.username || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="角色">
              {roles.length > 0 ? roles.map((role) => <Tag key={role}>{role}</Tag>) : '-'}
            </Descriptions.Item>
          </Descriptions>
        </Spin>
      </Modal>
    </>
  );
};
