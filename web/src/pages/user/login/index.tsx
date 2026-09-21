/**
 * 登录页。
 *
 * <p>范围与口径（第 2 步页面 1）：
 * <ul>
 *   <li>只提供账号密码登录：<b>不提供注册入口</b>，也不保留模板的第三方 / 手机号登录
 *       （后端没有对应端点，摆了就是假功能）；</li>
 *   <li>图形验证码只做 <b>UI 预留位</b>：服务未接入，因此控件禁用并在 label 上说明，
 *       不伪造一个「永远通过」的假校验；</li>
 *   <li>记住我：只记账号（localStorage），<b>绝不记密码 / 令牌</b>；</li>
 *   <li>登录失败 5 次触发后端锁定（1004）：展示后端原文案，并按文案里的分钟数挂倒计时，
 *       倒计时期间禁止再次提交；</li>
 *   <li>成功后双令牌已在 services/auth 落盘，这里按 `redirect` 回跳，并按刚登录
 *       用户的权限收敛落点（见 services/access/landing.ts）。</li>
 * </ul>
 *
 * <p>回跳用整页跳转而不是 `history.push`：`getInitialState` 只在应用启动时执行一次，
 * 路由跳转不会重新拉取权限与动态菜单，会出现「已登录但菜单还是空的 / 残留上个账号权限」；
 * 整页跳转顺带把上一个会话的内存态全部丢弃，更安全。</p>
 */

import { LockOutlined, PictureOutlined, UserOutlined } from '@ant-design/icons';
import { useIntl, useSearchParams } from '@umijs/max';
import {
  Alert,
  Button,
  Checkbox,
  ConfigProvider,
  Form,
  Input,
  Space,
  Typography,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';

import FlyingFilesBackground from '@/components/FlyingFilesBackground';
import { PUBLIC_DARK_THEME } from '@/components/PublicDarkTheme';

import { fetchMyPermission, resolveLoginLandingPath } from '@/services/access';
import {
  formatCountdown,
  lockDeadline,
  loginByPassword,
  parseLockMinutes,
  readRememberedUsername,
  remainingSeconds,
  saveRememberedUsername,
} from '@/services/auth';
import { BizError } from '@/services/request';
import { ACCOUNT_LOCKED_CODE, DEFAULT_ERROR_MESSAGE_ID } from '@/utils/result';

import useStyles from './index.style';

/** 登录表单字段。 */
interface LoginFormValues {
  username: string;
  password: string;
  /** 记住我：只记账号 */
  remember?: boolean;
}

const LoginPage: React.FC = () => {
  const { styles } = useStyles();
  const intl = useIntl();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');

  // 只在首次渲染读一次：之后再改 localStorage 不应影响已渲染的表单初值
  const rememberedUsername = useMemo(() => readRememberedUsername(), []);

  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  /** 解锁时刻（毫秒）；为 null 表示当前未锁定 */
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  /** 后端锁定原文案（倒计时旁原样展示，避免前端改写政策） */
  const [lockMessage, setLockMessage] = useState('');
  const [remaining, setRemaining] = useState(0);

  // 倒计时：每秒重算剩余秒数，归零后自动解除锁定态
  useEffect(() => {
    if (lockUntil == null) {
      setRemaining(0);
      return;
    }
    setRemaining(remainingSeconds(lockUntil));
    const timer = window.setInterval(() => {
      const left = remainingSeconds(lockUntil);
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(timer);
        setLockUntil(null);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockUntil]);

  const locked = lockUntil != null && remaining > 0;

  const handleFinish = async (values: LoginFormValues) => {
    if (locked) {
      return;
    }
    setSubmitting(true);
    setErrorText(null);
    const username = values.username.trim();
    try {
      await loginByPassword(username, values.password);
      // 勾选才记账号；取消勾选要顺手清掉上一次的记录
      saveRememberedUsername(values.remember ? username : null);
      // redirect 只保证「站内」，不保证「当前用户可达」：上一个会话残留的
      // ?redirect=/system/users 会让普通用户登录成功即撞进 403，故按其权限收敛落点
      window.location.assign(
        await resolveLoginLandingPath(
          redirect,
          async () => (await fetchMyPermission()).permCodes,
        ),
      );
    } catch (error) {
      const biz = error instanceof BizError ? error : undefined;
      if (biz?.code === ACCOUNT_LOCKED_CODE) {
        const minutes = parseLockMinutes(biz.message);
        setLockMessage(biz.message);
        // 解析不到分钟数时只展示原文案：不臆造一个可能早已过期的倒计时
        setLockUntil(minutes ? lockDeadline(minutes) : null);
      }
      // 兜底文案走 i18n id（utils/result 是纯契约层，不内嵌语言文案）
      setErrorText(
        biz?.message ||
          (error as Error)?.message ||
          intl.formatMessage({ id: DEFAULT_ERROR_MESSAGE_ID }),
      );
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <FlyingFilesBackground />

      <div className={styles.contentWrapper}>
        {/* 公开页共用暗色 token，不影响全站亮色布局 */}
        <ConfigProvider theme={PUBLIC_DARK_THEME}>
          <div className={styles.formCard}>
            <div className={styles.brand}>
              {/* 装饰性图片：品牌名由下方标题承担，alt 留空避免读屏重复播报 */}
              <img className={styles.logo} src="/logo.svg" alt="" />
              <Typography.Title level={3} style={{ marginBottom: 8 }}>
                AntTransfer
              </Typography.Title>
              <Typography.Text type="secondary">
                {intl.formatMessage({ id: 'auth.login.brand.subtitle' })}
              </Typography.Text>
            </div>

            {locked ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                title={intl.formatMessage({ id: 'auth.login.locked.title' })}
                description={intl.formatMessage(
                  { id: 'auth.login.locked.desc' },
                  {
                    message:
                      lockMessage ||
                      intl.formatMessage({ id: 'auth.login.locked.fallback' }),
                    countdown: formatCountdown(remaining),
                  },
                )}
              />
            ) : null}

            {!locked && errorText ? (
              <Alert
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
                title={errorText}
              />
            ) : null}

            <Form
              layout="vertical"
              size="large"
              requiredMark={false}
              initialValues={{
                username: rememberedUsername,
                remember: Boolean(rememberedUsername),
              }}
              onFinish={handleFinish}
            >
              <Form.Item
                name="username"
                label={intl.formatMessage({ id: 'auth.login.username.label' })}
                rules={[
                  {
                    required: true,
                    message: intl.formatMessage({
                      id: 'auth.login.username.required',
                    }),
                  },
                ]}
              >
                <Input
                  className={styles.inputField}
                  prefix={<UserOutlined />}
                  placeholder={intl.formatMessage({
                    id: 'auth.login.username.placeholder',
                  })}
                  autoComplete="username"
                  disabled={locked}
                />
              </Form.Item>

              <Form.Item
                name="password"
                label={intl.formatMessage({ id: 'auth.login.password.label' })}
                rules={[
                  {
                    required: true,
                    message: intl.formatMessage({
                      id: 'auth.login.password.required',
                    }),
                  },
                ]}
              >
                <Input.Password
                  className={styles.inputField}
                  prefix={<LockOutlined />}
                  placeholder={intl.formatMessage({
                    id: 'auth.login.password.placeholder',
                  })}
                  autoComplete="current-password"
                  disabled={locked}
                />
              </Form.Item>

              <Form.Item
                label={intl.formatMessage({ id: 'auth.login.captcha.label' })}
                tooltip={intl.formatMessage({ id: 'auth.login.captcha.tooltip' })}
              >
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    placeholder={intl.formatMessage({
                      id: 'auth.login.captcha.placeholder',
                    })}
                    disabled
                  />
                  <Button
                    icon={<PictureOutlined />}
                    disabled
                    style={{ width: 104 }}
                  >
                    {intl.formatMessage({ id: 'auth.login.captcha.button' })}
                  </Button>
                </Space.Compact>
              </Form.Item>

              <Form.Item
                name="remember"
                valuePropName="checked"
                style={{ marginBottom: 16 }}
              >
                <Checkbox disabled={locked}>
                  {intl.formatMessage({ id: 'auth.login.remember' })}
                </Checkbox>
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                block
                loading={submitting}
                disabled={locked}
              >
                {locked
                  ? intl.formatMessage(
                      { id: 'auth.login.submitLocked' },
                      { countdown: formatCountdown(remaining) },
                    )
                  : intl.formatMessage({ id: 'auth.login.submit' })}
              </Button>
            </Form>

            <Typography.Paragraph
              type="secondary"
              style={{
                marginTop: 16,
                marginBottom: 0,
                fontSize: 12,
                textAlign: 'center',
              }}
            >
              {intl.formatMessage({ id: 'auth.login.footerHint' })}
            </Typography.Paragraph>
          </div>
        </ConfigProvider>
      </div>
    </div>
  );
};

export default LoginPage;
