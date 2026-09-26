/**
 * 顶栏头像下拉（第 2 步页面 2）。
 *
 * <p>只保留「个人信息 / 修改密码 / 退出登录」三项：模板原有的「主题设置」和
 * `history.push('/account/xxx')` 依赖的是已被清理的模板页面，留着就是死链。</p>
 *
 * <p><b>退出登录必须三件事一起做</b>，缺任何一件都会留下「假登录态」：
 * <ol>
 *   <li>通知服务端吊销 —— at-auth 会把 token_epoch + 1 并清 Redis 白名单，所有端的旧令牌立即失效；</li>
 *   <li>清本地令牌 —— 由 `services/auth#logout` 的 finally 保证（服务端失败也必须清）；</li>
 *   <li>清内存态 —— initialState 里的 currentUser / permissions / menus，并断开 WS 连接；
 *       否则上个账号的权限点会继续参与 `can()` 判定，出现「退出了还能看到菜单」。</li>
 * </ol>
 *
 * <p><b>自助改密是同一套收尾</b>：后端在改密成功时同样递增 token_epoch（含发起请求的当前会话），
 * 所以「服务端吊销 + 清本地令牌」由 `services/auth#changePassword` 负责，本组件在其成功后复用
 * 上面的第 3 步并跳登录页。</p>
 */

import { KeyOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { history, useIntl, useModel } from '@umijs/max';
import type { MenuProps } from 'antd';
import { Alert, App, Avatar, Descriptions, Form, Input, Modal, Spin, Tag } from 'antd';
import React, { startTransition, useMemo, useState } from 'react';

import { DENY_ALL_PERMISSION } from '@/services/access';
import { type AuthUserSummary, changePassword, fetchProfile, logout } from '@/services/auth';
import { BizError } from '@/services/request';
import { disposeAllUploadQueues } from '@/services/upload';
import { wsStore } from '@/services/ws';
import {
  DEFAULT_ERROR_MESSAGE_ID,
  OLD_PASSWORD_MISMATCH_CODE,
  PASSWORD_POLICY_VIOLATION_CODE,
} from '@/utils/result';
import HeaderDropdown from '../HeaderDropdown';

type GlobalHeaderRightProps = {
  children?: React.ReactNode;
};

/** 自助改密表单值（confirmPassword 只用于本地比对，不发送给后端）。 */
interface ChangePasswordFormValues {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const AvatarDropdown: React.FC<GlobalHeaderRightProps> = ({ children }) => {
  const intl = useIntl();
  const { message } = App.useApp();
  const { initialState, setInitialState } = useModel('@@initialState');

  const [passwordForm] = Form.useForm<ChangePasswordFormValues>();

  const menuItems = useMemo<MenuProps['items']>(
    () => [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: intl.formatMessage({ id: 'component.avatar.profile' }),
      },
      {
        key: 'password',
        icon: <KeyOutlined />,
        label: intl.formatMessage({ id: 'component.avatar.changePassword' }),
      },
      {
        type: 'divider' as const,
      },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: intl.formatMessage({ id: 'component.avatar.logout' }),
        danger: true,
      },
    ],
    [intl],
  );

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profile, setProfile] = useState<AuthUserSummary | undefined>();

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

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

  /**
   * 清空本端会话并回登录页（服务端吊销由调用方各自负责）。
   *
   * <p>登出与改密共用：两者在服务端都已使当前令牌失效，剩下的差异只有「谁去吊销」。</p>
   */
  const teardownLocalSession = () => {
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

  const handleLogout = async () => {
    try {
      // 服务端吊销 + 清本地令牌（logout 内部 finally 保证清令牌）
      await logout();
    } catch (error) {
      console.warn('[anttransfer] 注销请求失败，已按本地登出处理', error);
    }
    teardownLocalSession();
  };

  const openChangePassword = () => {
    passwordForm.resetFields();
    setPasswordOpen(true);
  };

  /**
   * 提交改密。
   *
   * <p>用 `silent` 通道：1029 原口令不符 / 1030 强度不合规必须落到具体字段就地修正，
   * 不能被全局 `message.error` 抢先弹一次、弹窗还留着错误值让人重填。</p>
   */
  const handleChangePassword = async () => {
    let values: ChangePasswordFormValues;
    try {
      values = await passwordForm.validateFields();
    } catch {
      return;
    }

    setPasswordSubmitting(true);
    try {
      await changePassword({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      setPasswordOpen(false);
      message.success(intl.formatMessage({ id: 'component.avatar.changePassword.done' }));
      // 后端已全端吊销、api 层已清本地令牌，这里只剩内存态与跳转
      teardownLocalSession();
    } catch (error) {
      if (error instanceof BizError && error.code === OLD_PASSWORD_MISMATCH_CODE) {
        passwordForm.setFields([{ name: 'oldPassword', errors: [error.message] }]);
      } else if (error instanceof BizError && error.code === PASSWORD_POLICY_VIOLATION_CODE) {
        passwordForm.setFields([{ name: 'newPassword', errors: [error.message] }]);
      } else {
        // 其它码（如 1005 账号已停用）没有可挂载的字段，走一次性提示
        message.error(
          (error as Error)?.message || intl.formatMessage({ id: DEFAULT_ERROR_MESSAGE_ID }),
        );
      }
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const onMenuClick: MenuProps['onClick'] = (event) => {
    if (event.key === 'profile') {
      void openProfile();
      return;
    }
    if (event.key === 'password') {
      openChangePassword();
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
        title={intl.formatMessage({ id: 'component.avatar.profile' })}
        open={profileOpen}
        onCancel={() => setProfileOpen(false)}
        footer={null}
      >
        <Spin spinning={profileLoading}>
          {/*
            头像只读展示：`profile` 是打开弹窗时现拉的 `/auth/me`，因此这里永远是最新值。
            换头像的入口只在用户管理页（需 system:user:update），本弹窗不提供上传，
            避免「人人都能改自己头像」这条产品边界被悄悄放宽。
          */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <Avatar size={72} src={profile?.avatarUrl} icon={<UserOutlined />} />
          </div>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label={intl.formatMessage({ id: 'component.avatar.account' })}>
              {profile?.username ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label={intl.formatMessage({ id: 'component.avatar.nickname' })}>
              {profile?.nickname || profile?.username || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={intl.formatMessage({ id: 'component.avatar.roles' })}>
              {roles.length > 0 ? roles.map((role) => <Tag key={role}>{role}</Tag>) : '-'}
            </Descriptions.Item>
          </Descriptions>
        </Spin>
      </Modal>
      <Modal
        title={intl.formatMessage({ id: 'component.avatar.changePassword.title' })}
        open={passwordOpen}
        okText={intl.formatMessage({ id: 'component.avatar.changePassword.submit' })}
        cancelText={intl.formatMessage({ id: 'common.action.cancel' })}
        confirmLoading={passwordSubmitting}
        onOk={handleChangePassword}
        onCancel={() => setPasswordOpen(false)}
        maskClosable={false}
        width={480}
        destroyOnHidden
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={intl.formatMessage({ id: 'component.avatar.changePassword.alert.title' })}
          description={intl.formatMessage({ id: 'component.avatar.changePassword.alert.desc' })}
        />
        <Form form={passwordForm} layout="vertical" preserve={false}>
          <Form.Item
            name="oldPassword"
            label={intl.formatMessage({ id: 'component.avatar.changePassword.old' })}
            rules={[
              {
                required: true,
                message: intl.formatMessage({ id: 'component.avatar.changePassword.oldRequired' }),
              },
            ]}
          >
            <Input.Password
              maxLength={128}
              autoComplete="current-password"
              placeholder={intl.formatMessage({
                id: 'component.avatar.changePassword.oldPlaceholder',
              })}
            />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label={intl.formatMessage({ id: 'component.avatar.changePassword.new' })}
            extra={intl.formatMessage({ id: 'component.avatar.changePassword.policyHint' })}
            rules={[
              {
                required: true,
                message: intl.formatMessage({ id: 'component.avatar.changePassword.newRequired' }),
              },
              {
                min: 8,
                max: 64,
                message: intl.formatMessage({ id: 'component.avatar.changePassword.newLength' }),
              },
              {
                // 与后端 PasswordPolicy 同口径：字母 + 数字、无空白
                pattern: /^(?=.*[A-Za-z])(?=.*\d)\S+$/,
                message: intl.formatMessage({ id: 'component.avatar.changePassword.newPattern' }),
              },
            ]}
          >
            <Input.Password
              maxLength={64}
              autoComplete="new-password"
              placeholder={intl.formatMessage({
                id: 'component.avatar.changePassword.newPlaceholder',
              })}
            />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label={intl.formatMessage({ id: 'component.avatar.changePassword.confirm' })}
            dependencies={['newPassword']}
            rules={[
              {
                required: true,
                message: intl.formatMessage({
                  id: 'component.avatar.changePassword.confirmRequired',
                }),
              },
              ({ getFieldValue }) => ({
                validator(_rule, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(
                    new Error(
                      intl.formatMessage({ id: 'component.avatar.changePassword.confirmMismatch' }),
                    ),
                  );
                },
              }),
            ]}
          >
            <Input.Password
              maxLength={64}
              autoComplete="new-password"
              placeholder={intl.formatMessage({
                id: 'component.avatar.changePassword.confirmPlaceholder',
              })}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
