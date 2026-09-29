import { history } from '@umijs/max';
import { message, notification } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { testFormatMessage } from './locales/testTranslate';
import { errorConfig, presentError } from './requestErrorConfig';
import { HandleStrategy, resolveStrategy } from './utils/result';
import { tokenStore } from './utils/token';

vi.mock('antd', () => ({
  message: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  },
  notification: {
    error: vi.fn(),
    open: vi.fn(),
  },
}));

vi.mock('@umijs/max', async () => {
  // 拦截器不在组件树里，走 getIntl()；这里接上真实 zh-CN 语言包，
  // 保证「语言包缺键」能在单测阶段立刻暴露（与 useIntl 的 mock 同一口径）。
  const { testFormatMessage } = await vi.importActual<
    typeof import('./locales/testTranslate')
  >('./locales/testTranslate');
  return {
    request: vi.fn(),
    history: {
      push: vi.fn(),
    },
    // 兼容两种调用形态：`formatMessage({ id, values })` 与 `formatMessage({ id }, values)`
    getIntl: () => ({
      formatMessage: (
        descriptor: { id: string; values?: Record<string, unknown> },
        values?: Record<string, unknown>,
      ) => testFormatMessage({ id: descriptor.id, values: values ?? descriptor.values }),
    }),
  };
});

vi.mock('./utils/token', () => ({
  tokenStore: {
    getAccessToken: vi.fn(() => 'access-token'),
    getRefreshToken: vi.fn(() => 'refresh-token'),
    setTokens: vi.fn(),
    clear: vi.fn(),
    hasSession: vi.fn(() => true),
  },
}));

// biome-ignore lint/style/noNonNullAssertion: 配置中的处理器必然存在
const errorThrower = errorConfig.errorConfig!.errorThrower!;
// biome-ignore lint/style/noNonNullAssertion: 配置中的处理器必然存在
const errorHandler = errorConfig.errorConfig!.errorHandler!;
const requestInterceptor = errorConfig.requestInterceptors?.[0] as (
  config: any,
) => any;

/** 构造一个带统一响应体的 axios 错误 */
function httpError(
  code: number,
  resultMessage = '提示文案',
  status = 400,
  traceId = 'trace-1',
) {
  const error: any = new Error(resultMessage);
  error.response = {
    status,
    data: { code, message: resultMessage, data: null, traceId },
  };
  return error;
}

describe('resolveStrategy（错误码 → 处理策略）', () => {
  it('A 类：成功码', () => {
    expect(resolveStrategy(0)).toBe(HandleStrategy.SUCCESS);
  });

  it('B 类：流程分支码（HTTP 200 + code≠0）', () => {
    expect(resolveStrategy(1008)).toBe(HandleStrategy.FLOW_BRANCH);
    expect(resolveStrategy(1009)).toBe(HandleStrategy.FLOW_BRANCH);
    expect(resolveStrategy(4001)).toBe(HandleStrategy.FLOW_BRANCH);
    expect(resolveStrategy(4002)).toBe(HandleStrategy.FLOW_BRANCH);
  });

  it('C 类：凭证失效', () => {
    expect(resolveStrategy(1001)).toBe(HandleStrategy.CREDENTIAL);
    expect(resolveStrategy(1002)).toBe(HandleStrategy.CREDENTIAL);
    expect(resolveStrategy(1006)).toBe(HandleStrategy.CREDENTIAL);
    expect(resolveStrategy(1007)).toBe(HandleStrategy.CREDENTIAL);
  });

  it('D 类：拒绝且不跳登录', () => {
    expect(resolveStrategy(1003)).toBe(HandleStrategy.DENY);
    expect(resolveStrategy(1004)).toBe(HandleStrategy.DENY);
    expect(resolveStrategy(1005)).toBe(HandleStrategy.DENY);
    expect(resolveStrategy(4010)).toBe(HandleStrategy.DENY);
    // 4017 彻底销毁被拒（非超管 / 高敏感缺审批）与 4018 下载凭证无效：均就地提示，绝不跳登录
    expect(resolveStrategy(4017)).toBe(HandleStrategy.DENY);
    expect(resolveStrategy(4018)).toBe(HandleStrategy.DENY);
    // 1012 与 1003 同为策略 D：非群成员是「拒绝」而非「未登录」，跳登录是红线
    expect(resolveStrategy(1012)).toBe(HandleStrategy.DENY);
    // 1038 / 1039 / 1041 / 1042 是「群内身份不足」这一族：会话未失效，就地提示即可，
    // 尤其 1042（@所有人 仅群主）绝不能被降级成「跳登录」——那会把一次越权提示放大成强制重认证
    expect(resolveStrategy(1038)).toBe(HandleStrategy.DENY);
    expect(resolveStrategy(1039)).toBe(HandleStrategy.DENY);
    expect(resolveStrategy(1041)).toBe(HandleStrategy.DENY);
    expect(resolveStrategy(1042)).toBe(HandleStrategy.DENY);
  });

  it('E/F/G/H 类：请求修正 / 状态冲突 / 限流 / 系统兜底', () => {
    expect(resolveStrategy(2001)).toBe(HandleStrategy.BAD_REQUEST);
    expect(resolveStrategy(4040)).toBe(HandleStrategy.BAD_REQUEST);
    expect(resolveStrategy(4102)).toBe(HandleStrategy.STATE_CONFLICT);
    expect(resolveStrategy(4011)).toBe(HandleStrategy.THROTTLE);
    expect(resolveStrategy(5001)).toBe(HandleStrategy.SYSTEM);
    // 协作模块新增：1011 审批状态冲突 / 1013、1014 会话参数类
    expect(resolveStrategy(1011)).toBe(HandleStrategy.STATE_CONFLICT);
    expect(resolveStrategy(1013)).toBe(HandleStrategy.BAD_REQUEST);
    expect(resolveStrategy(1014)).toBe(HandleStrategy.BAD_REQUEST);
    // 本人自助改密：1029 原口令不正确 / 1030 新口令不合规 —— 就地修正字段，绝不跳登录
    expect(resolveStrategy(1029)).toBe(HandleStrategy.BAD_REQUEST);
    expect(resolveStrategy(1030)).toBe(HandleStrategy.BAD_REQUEST);
    // 文件管理新增（4013~4023）：E 类请求修正 / F 类状态冲突
    expect(resolveStrategy(4013)).toBe(HandleStrategy.BAD_REQUEST);
    expect(resolveStrategy(4019)).toBe(HandleStrategy.BAD_REQUEST);
    expect(resolveStrategy(4023)).toBe(HandleStrategy.BAD_REQUEST);
    expect(resolveStrategy(4014)).toBe(HandleStrategy.STATE_CONFLICT);
    expect(resolveStrategy(4016)).toBe(HandleStrategy.STATE_CONFLICT);
    expect(resolveStrategy(4021)).toBe(HandleStrategy.STATE_CONFLICT);
    expect(resolveStrategy(4022)).toBe(HandleStrategy.STATE_CONFLICT);
  });
});

describe('errorThrower', () => {
  it('A 类不抛错', () => {
    expect(() =>
      errorThrower({ code: 0, message: '成功', data: { id: 1 }, traceId: 't' }),
    ).not.toThrow();
  });

  it('B 类流程分支码不抛错（不得被当成失败）', () => {
    expect(() =>
      errorThrower({
        code: 4001,
        message: '秒传未命中，请按分片上传',
        data: { uploadId: 'u1' },
        traceId: 't',
      }),
    ).not.toThrow();
  });

  it('非 A/B 类抛出 BizError 并携带 code 与 traceId', () => {
    expect.assertions(4);
    try {
      errorThrower({
        code: 4006,
        message: '文件大小超出限制',
        data: null,
        traceId: 'trace-9',
      });
    } catch (error: any) {
      expect(error.name).toBe('BizError');
      expect(error.info.code).toBe(4006);
      expect(error.info.traceId).toBe('trace-9');
      expect(error.info.strategy).toBe(HandleStrategy.BAD_REQUEST);
    }
  });
});

describe('errorHandler（按策略呈现）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skipErrorHandler 为真时直接抛出，由调用方自行处理', () => {
    const error = httpError(4006);
    expect(() => errorHandler(error, { skipErrorHandler: true })).toThrow();
    expect(message.error).not.toHaveBeenCalled();
  });

  it('【关键】B 类分支码绝不弹错误提示', () => {
    presentError({
      code: 4001,
      message: '秒传未命中，请按分片上传',
      data: { uploadId: 'u1' },
      traceId: 't',
    });
    presentError({
      code: 1009,
      message: '您已有进行中的申请',
      data: { applicationId: 1 },
      traceId: 't',
    });

    expect(message.error).not.toHaveBeenCalled();
    expect(message.warning).not.toHaveBeenCalled();
    expect(notification.error).not.toHaveBeenCalled();
  });

  it('D 类（403）就地提示，且不跳登录', () => {
    errorHandler(httpError(1003, '无操作权限', 403), {});

    expect(message.warning).toHaveBeenCalledWith('无操作权限');
    expect(history.push).not.toHaveBeenCalled();
  });

  it('E 类（400/404/413）提示具体原因', () => {
    errorHandler(httpError(4006, '文件大小超出限制', 413), {});

    expect(message.error).toHaveBeenCalledWith('文件大小超出限制');
  });

  it('G 类（429）提示退避重试', () => {
    errorHandler(httpError(4103, '超出传输并发或流量限制', 429), {});

    expect(message.warning).toHaveBeenCalledWith(
      testFormatMessage({
        id: 'app.request.retryLater',
        values: { message: '超出传输并发或流量限制' },
      }),
    );
  });

  it('H 类（500）用通知呈现并附 traceId 供上报', () => {
    errorHandler(httpError(5001, '系统繁忙，请稍后重试', 500, 'trace-abc'), {});

    expect(notification.error).toHaveBeenCalledWith({
      message: '系统繁忙，请稍后重试',
      description: testFormatMessage({
        id: 'app.request.traceId',
        values: { traceId: 'trace-abc' },
      }),
      placement: 'topRight',
    });
  });

  it('C 类：1007 账号密码错误只提示、不清除会话、不跳转', () => {
    errorHandler(httpError(1007, '账号或密码错误', 401), {});

    expect(message.error).toHaveBeenCalledWith('账号或密码错误');
    expect(tokenStore.clear).not.toHaveBeenCalled();
    expect(history.push).not.toHaveBeenCalled();
  });

  it('C 类：1001/1006 清除会话并跳转登录', () => {
    errorHandler(httpError(1001, '未登录或登录已过期', 401), {});
    errorHandler(httpError(1006, '登录态无效，请重新登录', 401), {});

    expect(tokenStore.clear).toHaveBeenCalledTimes(2);
    expect(history.push).toHaveBeenCalledWith('/user/login');
  });

  it('无统一响应体时按 HTTP 状态兜底提示', () => {
    const error: any = new Error('boom');
    error.response = { status: 502, data: '<html>bad gateway</html>' };

    errorHandler(error, {});

    expect(message.error).toHaveBeenCalledWith(
      testFormatMessage({
        id: 'app.request.http',
        values: {
          message: testFormatMessage({ id: 'app.request.default' }),
          status: 502,
        },
      }),
    );
  });

  it('离线时提示网络不可用', () => {
    const error: any = new Error('Network Error');
    error.request = {};
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    try {
      errorHandler(error, {});
      expect(message.error).toHaveBeenCalledWith(
        // 文案取自语言包，避免测试里再抄一份中文而与语言包脱节
        testFormatMessage({ id: 'app.request.offline' }),
      );
    } finally {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: originalOnLine,
      });
    }
  });
});

describe('requestInterceptors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('存在 access token 时附加 Authorization 头', () => {
    const config: any = { url: '/api/v1/files', method: 'GET', headers: {} };

    const result = requestInterceptor(config);

    expect(result.headers.Authorization).toBe('Bearer access-token');
  });

  it('兼容 AxiosHeaders 形态', () => {
    const set = vi.fn();
    const config: any = { url: '/api/v1/files', headers: { set } };

    requestInterceptor(config);

    expect(set).toHaveBeenCalledWith('Authorization', 'Bearer access-token');
  });
});
