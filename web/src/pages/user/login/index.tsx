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
 *   <li>成功后双令牌已在 services/auth 落盘，这里按 `redirect` 回跳。</li>
 * </ul>
 *
 * <p>回跳用整页跳转而不是 `history.push`：`getInitialState` 只在应用启动时执行一次，
 * 路由跳转不会重新拉取权限与动态菜单，会出现「已登录但菜单还是空的 / 残留上个账号权限」；
 * 整页跳转顺带把上一个会话的内存态全部丢弃，更安全。</p>
 */

import { LockOutlined, PictureOutlined, UserOutlined } from '@ant-design/icons';
import { useSearchParams } from '@umijs/max';
import type { ThemeConfig } from 'antd';
import {
  Alert,
  Button,
  Checkbox,
  ConfigProvider,
  Form,
  Input,
  Space,
  Typography,
  theme,
} from 'antd';
import React, { useEffect, useMemo, useState } from 'react';

import FlyingFilesBackground from '@/components/FlyingFilesBackground';

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
import { safeRedirectPath } from '@/utils/redirect';
import { ACCOUNT_LOCKED_CODE, DEFAULT_ERROR_MESSAGE } from '@/utils/result';

import useStyles from './index.style';

/** 登录表单字段。 */
interface LoginFormValues {
  username: string;
  password: string;
  /** 记住我：只记账号 */
  remember?: boolean;
}

/**
 * 登录页局部暗色主题。
 *
 * <p>用暗色算法把 antd 组件（输入框、告警、复选框、按钮）整体切到深色，
 * 再补齐品牌色；这里只覆盖 token，组件形状仍由 antd 统一给出，
 * 避免逐条覆盖 `.ant-*` 内部类名——那类写法会随 antd 改版静默失效。</p>
 *
 * <p>仅作用于登录页：登录页是独立入口（路由 `layout: false`），与全站亮色布局不同屏。</p>
 */
const DARK_THEME: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    // 控件底色比卡片更暗，压出内凹层次，也让磨砂卡片透出背景流光
    colorBgContainer: 'rgba(0, 0, 0, 0.25)',
    colorBorder: 'rgba(0, 212, 255, 0.15)',
    colorPrimary: '#00d68f',
    colorPrimaryHover: '#00d68f',
    colorLink: '#00d68f',
    colorIcon: '#80c8a0',
    colorText: '#e0e8f5',
    colorTextHeading: '#ffffff',
    colorTextSecondary: '#b8c8e0',
    colorTextPlaceholder: '#8899bb',
    // 实心主按钮：青绿底(#00d68f)配白字对比度只有约 1.8:1，远低于 WCAG AA 的 4.5:1；
    // 换成深墨绿字后可达 9:1 以上。若想还原白字，删掉这一行即可。
    colorTextLightSolid: '#04241a',
  },
};

const LoginPage: React.FC = () => {
  const { styles } = useStyles();
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
      window.location.assign(safeRedirectPath(redirect));
    } catch (error) {
      const biz = error instanceof BizError ? error : undefined;
      if (biz?.code === ACCOUNT_LOCKED_CODE) {
        const minutes = parseLockMinutes(biz.message);
        setLockMessage(biz.message);
        // 解析不到分钟数时只展示原文案：不臆造一个可能早已过期的倒计时
        setLockUntil(minutes ? lockDeadline(minutes) : null);
      }
      setErrorText(
        biz?.message || (error as Error)?.message || DEFAULT_ERROR_MESSAGE,
      );
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <FlyingFilesBackground />

      <div className={styles.contentWrapper}>
        {/* 只在登录页内切换暗色，不影响全站亮色布局 */}
        <ConfigProvider theme={DARK_THEME}>
          <div className={styles.formCard}>
            <div className={styles.brand}>
              {/* 装饰性图片：品牌名由下方标题承担，alt 留空避免读屏重复播报 */}
              <img className={styles.logo} src="/logo.svg" alt="" />
              <Typography.Title level={3} style={{ marginBottom: 8 }}>
                AntTransfer
              </Typography.Title>
              <Typography.Text type="secondary">
                企业文件传输与协作平台
              </Typography.Text>
            </div>

            {locked ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                title="账号已锁定"
                description={`${lockMessage || '登录失败次数过多'}（剩余 ${formatCountdown(remaining)}）`}
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
                label="账号"
                rules={[{ required: true, message: '请输入账号' }]}
              >
                <Input
                  className={styles.inputField}
                  prefix={<UserOutlined />}
                  placeholder="请输入账号"
                  autoComplete="username"
                  disabled={locked}
                />
              </Form.Item>

              <Form.Item
                name="password"
                label="密码"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password
                  className={styles.inputField}
                  prefix={<LockOutlined />}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  disabled={locked}
                />
              </Form.Item>

              <Form.Item
                label="图形验证码"
                tooltip="图形验证码服务尚未接入，当前登录不做校验（仅 UI 预留）"
              >
                <Space.Compact style={{ width: '100%' }}>
                  <Input placeholder="服务接入后启用" disabled />
                  <Button
                    icon={<PictureOutlined />}
                    disabled
                    style={{ width: 104 }}
                  >
                    验证码
                  </Button>
                </Space.Compact>
              </Form.Item>

              <Form.Item
                name="remember"
                valuePropName="checked"
                style={{ marginBottom: 16 }}
              >
                <Checkbox disabled={locked}>
                  记住我（仅记住账号，不保存密码）
                </Checkbox>
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                block
                loading={submitting}
                disabled={locked}
              >
                {locked ? `请 ${formatCountdown(remaining)} 后重试` : '登录'}
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
              账号由管理员统一分配，如需开通请联系管理员
            </Typography.Paragraph>
          </div>
        </ConfigProvider>
      </div>
    </div>
  );
};

export default LoginPage;
