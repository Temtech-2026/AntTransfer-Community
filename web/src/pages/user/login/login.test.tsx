/**
 * 登录页测试。
 *
 * <p>只验证「前端自己的职责」：表单结构（含验证码预留位、无注册入口）、必填拦截、
 * 错误码分支（1004 挂倒计时 / 1007 只提示）、记住我回填。</p>
 *
 * <p>不测「登录成功后的整页跳转」：那一步依赖 `window.location.assign`，jsdom 不支持导航，
 * 断言它只会得到一堆 Not implemented 噪音，收益为零。</p>
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { testFormatMessage } from '@/locales/testTranslate';

/** 断言用：从 zh-CN 语言包取文案，键写错即失败（不在测试里另抄一份中文）。 */
const t = (id: string, values?: Record<string, unknown>) =>
  testFormatMessage({ id, values });

const mockLoginByPassword = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('@umijs/max', async () => {
  const { testFormatMessage: translate } = await import('@/locales/testTranslate');
  return {
    useSearchParams: () => [mockSearchParams],
    // 兼容两种调用形态：`formatMessage({ id, values })` 与 `formatMessage({ id }, values)`
    useIntl: () => ({
      formatMessage: (
        descriptor: { id: string; values?: Record<string, unknown> },
        values?: Record<string, unknown>,
      ) => translate({ id: descriptor.id, values: values ?? descriptor.values }),
    }),
  };
});

// 只替换登录这种 IO；BizError 等纯逻辑走真实实现，保证错误码分支真的被判到
vi.mock('@/services/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/auth')>()),
  loginByPassword: (...args: unknown[]) => mockLoginByPassword(...args),
}));

import { BizError } from '@/services/request';

import LoginPage from './index';

/** 构造一个后端风格的业务错误。 */
function bizError(code: number, message: string): BizError {
  return new BizError({ code, message, traceId: 'trace-test' } as never);
}

/**
 * 把文案转成「逐字允许空白」的正则。
 *
 * <p>antd 对「恰好两个汉字」的按钮文案会自动插一个空格（可访问名实际是「登 录」），
 * 字面量匹配会拿不到元素，因此按字符间插入 `\s*`。</p>
 */
function accessibleName(text: string): RegExp {
  return new RegExp(text.split('').join('\\s*'));
}

/** 取提交按钮。 */
function submitButton() {
  return screen.getByRole('button', {
    name: accessibleName(t('auth.login.submit')),
  });
}

/** 填账号密码并提交。 */
function submitLogin(username = 'zhangsan', password = 'secret') {
  fireEvent.change(
    screen.getByPlaceholderText(t('auth.login.username.placeholder')),
    { target: { value: username } },
  );
  fireEvent.change(
    screen.getByPlaceholderText(t('auth.login.password.placeholder')),
    { target: { value: password } },
  );
  fireEvent.click(submitButton());
}

describe('登录页', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('渲染账号密码表单与验证码预留位，且不提供注册入口', () => {
    render(<LoginPage />);

    expect(screen.getByText('AntTransfer')).toBeTruthy();
    expect(
      screen.getByPlaceholderText(t('auth.login.username.placeholder')),
    ).toBeTruthy();
    expect(
      screen.getByPlaceholderText(t('auth.login.password.placeholder')),
    ).toBeTruthy();

    // 验证码只做 UI 占位：服务未接入，控件必须是禁用的，不能假装能校验
    const captchaInput = screen.getByPlaceholderText(
      t('auth.login.captcha.placeholder'),
    ) as HTMLInputElement;
    expect(captchaInput.disabled).toBe(true);

    // 不提供注册入口
    expect(screen.queryByText(/注册/)).toBeNull();
    expect(screen.queryByText(/Sign up|Register/i)).toBeNull();
  });

  it('必填校验不通过时不发起登录请求', async () => {
    render(<LoginPage />);

    fireEvent.click(submitButton());

    await waitFor(() =>
      expect(
        screen.getByText(t('auth.login.username.required')),
      ).toBeTruthy(),
    );
    expect(screen.getByText(t('auth.login.password.required'))).toBeTruthy();
    expect(mockLoginByPassword).not.toHaveBeenCalled();
  });

  it('账号锁定（1004）时展示后端文案与倒计时，并禁用再次提交', async () => {
    mockLoginByPassword.mockRejectedValue(
      bizError(1004, '账号已锁定，请 15 分钟后重试'),
    );

    render(<LoginPage />);
    submitLogin();

    await waitFor(() =>
      expect(screen.getByText(t('auth.login.locked.title'))).toBeTruthy(),
    );
    // 倒计时初值取自后端文案里的分钟数（15 分钟 → 15:00），不是前端硬编码；
    // 同一时刻告警描述与按钮文案都会带上倒计时，用 AllBy 断言存在即可
    expect(screen.getAllByText(/15:00/).length).toBeGreaterThan(0);
    // 锁定期间提交按钮禁用，且按钮文案切换为倒计时
    expect(
      screen.getByRole('button', {
        name: accessibleName(
          t('auth.login.submitLocked', { countdown: '15:00' }),
        ),
      }),
    ).toHaveProperty('disabled', true);
  });

  it('账号或密码错误（1007）只就地提示，不进入锁定倒计时', async () => {
    mockLoginByPassword.mockRejectedValue(bizError(1007, '账号或密码错误'));

    render(<LoginPage />);
    submitLogin('zhangsan', 'wrong');

    await waitFor(() => expect(screen.getByText('账号或密码错误')).toBeTruthy());
    expect(screen.queryByText(t('auth.login.locked.title'))).toBeNull();
  });

  it('已记住的账号会自动回填并勾选「记住我」', () => {
    window.localStorage.setItem('at:remembered_username', 'zhangsan');

    render(<LoginPage />);

    expect(
      (
        screen.getByPlaceholderText(
          t('auth.login.username.placeholder'),
        ) as HTMLInputElement
      ).value,
    ).toBe('zhangsan');
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(
      true,
    );
  });
});
